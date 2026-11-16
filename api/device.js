import {
    callDatabaseBridge,
    getGatewayTokenHash,
    sendApiError,
    sendJson
} from "./common.js";

export async function deviceRoute(req, res, env) {
    try {
        if (req.method !== "GET") {
            sendJson(res, 405, {
                status: "error",
                code: "METHOD_NOT_ALLOWED",
                message: "Method not allowed."
            }, { "Allow": "GET" });
            return;
        }

        const gatewayTokenHash = await getGatewayTokenHash(req);
        const result = await callDatabaseBridge(env, {
            action: "device.list",
            gateway_token_hash: gatewayTokenHash
        });

        sendJson(res, result.status, result.body);
    } catch (error) {
        sendApiError(res, error);
    }
}
