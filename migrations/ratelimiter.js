import { hashGatewayToken, getGatewayToken } from "../api/common.js";
import { sendJson } from "../api/common.js";

export function createRateLimiter(env) {
    return async function rateLimiter(req, res) {
        if (!env.API_RATE_LIMITER || typeof env.API_RATE_LIMITER.limit !== "function") {
            sendJson(res, 503, {
                status: "error",
                code: "RATE_LIMITER_NOT_CONFIGURED",
                message: "Rate limiter is not configured."
            });
            return false;
        }

        try {
            const ipAddress = req.headers["cf-connecting-ip"];
            const ipKey = `source:${typeof ipAddress === "string" ? ipAddress : "unknown"}`;
            const ipResult = await env.API_RATE_LIMITER.limit({ key: ipKey });

            if (!ipResult.success) {
                sendJson(res, 429, {
                    status: "error",
                    code: "RATE_LIMIT_EXCEEDED",
                    message: "Too many requests from this source. Try again later."
                }, { "Retry-After": "60" });
                return false;
            }

            const gatewayToken = getGatewayToken(req, false);
            if (gatewayToken) {
                const tokenHash = await hashGatewayToken(gatewayToken);
                const gatewayResult = await env.API_RATE_LIMITER.limit({ key: `gateway:${tokenHash}` });

                if (!gatewayResult.success) {
                    sendJson(res, 429, {
                        status: "error",
                        code: "RATE_LIMIT_EXCEEDED",
                        message: "Gateway request limit exceeded. Try again later."
                    }, { "Retry-After": "60" });
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error("Rate limiter failed:", error);
            sendJson(res, 503, {
                status: "error",
                code: "RATE_LIMITER_UNAVAILABLE",
                message: "Rate limiter is temporarily unavailable."
            });
            return false;
        }
    };
}
