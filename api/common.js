export class ApiError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

export function sendJson(res, status, data, headers = {}) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ...headers
    });
    res.end(JSON.stringify(data));
}

export function getGatewayToken(req, required = true) {
    const authorization = req.headers.authorization;

    if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
        if (!required) {
            return null;
        }

        throw new ApiError(401, "UNAUTHORIZED", "A gateway Bearer token is required.");
    }

    const token = authorization.slice(7).trim();
    if (token.length < 16 || token.length > 4096) {
        if (!required) {
            return null;
        }

        throw new ApiError(401, "UNAUTHORIZED", "Invalid gateway token.");
    }

    return token;
}

export async function hashGatewayToken(token) {
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(token)
    );

    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getGatewayTokenHash(req) {
    return hashGatewayToken(getGatewayToken(req));
}

export function readJsonBody(req, maxBodySize = 10 * 1024) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let bodySize = 0;
        let bodyTooLarge = false;
        let finished = false;

        req.on("data", (chunk) => {
            bodySize += chunk.length;

            if (bodySize > maxBodySize) {
                bodyTooLarge = true;
                chunks.length = 0;
                return;
            }

            if (!bodyTooLarge) {
                chunks.push(Buffer.from(chunk));
            }
        });

        req.on("end", () => {
            if (finished) {
                return;
            }
            finished = true;

            if (bodyTooLarge) {
                reject(new ApiError(413, "BODY_TOO_LARGE", "Request body is too large."));
                return;
            }

            if (bodySize === 0) {
                reject(new ApiError(400, "EMPTY_BODY", "Request body cannot be empty."));
                return;
            }

            try {
                const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
                if (body === null || typeof body !== "object" || Array.isArray(body)) {
                    throw new Error("JSON root must be an object.");
                }

                resolve(body);
            } catch (error) {
                reject(new ApiError(400, "INVALID_JSON", "Request body must contain a valid JSON object."));
            }
        });

        req.on("error", (error) => {
            if (finished) {
                return;
            }
            finished = true;
            reject(error);
        });
    });
}

export async function callDatabaseBridge(env, payload) {
    const endpoint = env.AZURE_DB_BRIDGE_URL;
    const functionKey = env.AZURE_DB_BRIDGE_KEY;

    if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || !functionKey) {
        throw new ApiError(503, "DATABASE_BRIDGE_NOT_CONFIGURED", "Database bridge is not configured.");
    }

    let response;
    try {
        response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-functions-key": functionKey
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000)
        });
    } catch (error) {
        if (error.name === "TimeoutError" || error.name === "AbortError") {
            throw new ApiError(504, "DATABASE_BRIDGE_TIMEOUT", "Database bridge request timed out.");
        }

        throw new ApiError(503, "DATABASE_BRIDGE_UNAVAILABLE", "Database bridge is unavailable.");
    }

    let result;
    try {
        result = await response.json();
    } catch (error) {
        throw new ApiError(502, "INVALID_DATABASE_BRIDGE_RESPONSE", "Database bridge returned an invalid response.");
    }

    return {
        status: response.status,
        body: result
    };
}

export function sendApiError(res, error) {
    if (error instanceof ApiError) {
        sendJson(res, error.status, {
            status: "error",
            code: error.code,
            message: error.message
        });
        return;
    }

    console.error("Request failed:", error);
    sendJson(res, 500, {
        status: "error",
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error."
    });
}
