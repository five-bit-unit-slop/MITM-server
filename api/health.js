import {
    ApiError,
    sendApiError,
    sendJson
} from "./common.js";

export async function healthRoute(res, env) {
    const endpoint = env.AZURE_DB_BRIDGE_URL;
    const functionKey = env.AZURE_DB_BRIDGE_KEY;

    if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || !functionKey) {
        sendJson(res, 503, {
            status: "error",
            code: "DATABASE_BRIDGE_NOT_CONFIGURED",
            message: "Database bridge is not configured."
        });
        return;
    }

    try {
        const response = await fetch(endpoint, {
            method: "GET",
            headers: {
                "x-functions-key": functionKey
            },
            signal: AbortSignal.timeout(10000)
        });

        let result;
        try {
            result = await response.json();
        } catch (error) {
            throw new ApiError(502, "INVALID_DATABASE_BRIDGE_RESPONSE", "Database bridge returned an invalid response.");
        }

        if (!response.ok) {
            sendJson(res, response.status, {
                status: "error",
                code: "DATABASE_UNHEALTHY",
                message: "Database bridge health check failed."
            });
            return;
        }

        sendJson(res, 200, {
            status: "ok",
            database: result.status === "connected" ? "connected" : "unknown"
        });
    } catch (error) {
        sendApiError(res, error);
    }
}
