//import
//functions
export function sendJson(res, status, data, headers = {}) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ...headers
    });
    res.end(JSON.stringify(data));
}

export function sendError(res, status, code, message, headers = {}) {
    sendJson(res, status, {
        status: "error",
        code,
        message
    }, headers);
}

export function getGatewayToken(req) {
    const auth = req.headers.authorization;
    if (typeof auth !== "string" || !auth.startsWith("Bearer ")) {
        return null;
    }

    const token = auth.slice(7).trim();
    if (token.length < 16 || token.length > 4096) {
        return null;
    }

    return token;
}

export async function hashToken(token) {
    const bytes = new TextEncoder().encode(token);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function requireTokenHash(req, res) {
    const token = getGatewayToken(req);
    if (!token) {
        sendError(res, 401, "UNAUTHORIZED", "A valid gateway Bearer token is required.");
        return null;
    }
    return hashToken(token);
}

export function readJsonBody(req, maxBytes = 10 * 1024) {
    return new Promise((resolve) => {
        const chunks = [];
        let size = 0;
        let tooLarge = false;
        let done = false;

        req.on("data", (chunk) => {
            size += chunk.length;
            if (size > maxBytes) {
                tooLarge = true;
                chunks.length = 0;
                return;
            }
            chunks.push(Buffer.from(chunk));
        });

        req.on("end", () => {
            if (done) return;
            done = true;

            if (tooLarge) {
                resolve({ ok: false, status: 413, code: "BODY_TOO_LARGE", message: "Request body is too large." });
                return;
            }
            if (size === 0) {
                resolve({ ok: false, status: 400, code: "EMPTY_BODY", message: "Request body cannot be empty." });
                return;
            }

            try {
                const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
                if (body === null || typeof body !== "object" || Array.isArray(body)) {
                    resolve({ ok: false, status: 400, code: "INVALID_JSON", message: "Request body must contain a valid JSON object." });
                    return;
                }
                resolve({ ok: true, data: body });
            } catch {
                resolve({ ok: false, status: 400, code: "INVALID_JSON", message: "Request body must contain a valid JSON object." });
            }
        });

        req.on("error", () => {
            if (done) return;
            done = true;
            resolve({ ok: false, status: 500, code: "INTERNAL_SERVER_ERROR", message: "Failed to read request body." });
        });
    });
}

export async function callBridge(env, payload) {
    const url = env.AZURE_DB_BRIDGE_URL;
    const key = env.AZURE_DB_BRIDGE_KEY;

    if (typeof url !== "string" || !url.startsWith("https://") || !key) {
        return { ok: false, status: 503, code: "DATABASE_BRIDGE_NOT_CONFIGURED", message: "Database bridge is not configured." };
    }

    let response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-functions-key": key
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000)
        });
    } catch (err) {
        if (err.name === "TimeoutError" || err.name === "AbortError") {
            return { ok: false, status: 504, code: "DATABASE_BRIDGE_TIMEOUT", message: "Database bridge request timed out." };
        }
        return { ok: false, status: 503, code: "DATABASE_BRIDGE_UNAVAILABLE", message: "Database bridge is unavailable." };
    }

    try {
        const body = await response.json();
        return { ok: true, status: response.status, body };
    } catch {
        return { ok: false, status: 502, code: "INVALID_DATABASE_BRIDGE_RESPONSE", message: "Database bridge returned an invalid response." };
    }
}
