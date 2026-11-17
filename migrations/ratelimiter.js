//import
import { getGatewayToken, hashToken, sendError } from "../api/common.js";

//functions
export async function checkRateLimit(req, res, env) {
    if (!env.API_RATE_LIMITER || typeof env.API_RATE_LIMITER.limit !== "function") {
        sendError(res, 503, "RATE_LIMITER_NOT_CONFIGURED", "Rate limiter is not configured.");
        return false;
    }

    try {
        const ip = req.headers["cf-connecting-ip"];
        const ipKey = `source:${typeof ip === "string" ? ip : "unknown"}`;
        const ipCheck = await env.API_RATE_LIMITER.limit({ key: ipKey });

        if (!ipCheck.success) {
            sendError(res, 429, "RATE_LIMIT_EXCEEDED", "Too many requests from this source. Try again later.", { "Retry-After": "60" });
            return false;
        }

        const token = getGatewayToken(req);
        if (token) {
            const tokenHash = await hashToken(token);
            const tokenCheck = await env.API_RATE_LIMITER.limit({ key: `gateway:${tokenHash}` });

            if (!tokenCheck.success) {
                sendError(res, 429, "RATE_LIMIT_EXCEEDED", "Gateway request limit exceeded. Try again later.", { "Retry-After": "60" });
                return false;
            }
        }

        return true;
    } catch (err) {
        console.error("Rate limiter failed:", err);
        sendError(res, 503, "RATE_LIMITER_UNAVAILABLE", "Rate limiter is temporarily unavailable.");
        return false;
    }
}
