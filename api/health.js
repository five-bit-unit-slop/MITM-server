//import
import { sendError, sendJson } from "./common.js";

//functions
export async function healthRoute(res, env) {
    const url = env.AZURE_DB_BRIDGE_URL;
    const key = env.AZURE_DB_BRIDGE_KEY;

    if (typeof url !== "string" || !url.startsWith("https://") || !key) {
        sendError(res, 503, "DATABASE_BRIDGE_NOT_CONFIGURED", "Database bridge is not configured.");
        return;
    }

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: { "x-functions-key": key },
            signal: AbortSignal.timeout(10000)
        });

        let result;
        try {
            result = await response.json();
        } catch {
            sendError(res, 502, "INVALID_DATABASE_BRIDGE_RESPONSE", "Database bridge returned an invalid response.");
            return;
        }

        if (!response.ok) {
            sendError(res, response.status, "DATABASE_UNHEALTHY", "Database bridge health check failed.");
            return;
        }

        sendJson(res, 200, {
            status: "ok",
            database: result.status === "connected" ? "connected" : "unknown"
        });
    } catch (err) {
        if (err.name === "TimeoutError" || err.name === "AbortError") {
            sendError(res, 504, "DATABASE_BRIDGE_TIMEOUT", "Database bridge request timed out.");
            return;
        }
        sendError(res, 503, "DATABASE_BRIDGE_UNAVAILABLE", "Database bridge is unavailable.");
    }
}
