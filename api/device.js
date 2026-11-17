//import
import { callBridge, requireTokenHash, sendError, sendJson } from "./common.js";

//functions
export async function deviceRoute(req, res, env) {
    if (req.method !== "GET") {
        sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.", { "Allow": "GET" });
        return;
    }

    const tokenHash = await requireTokenHash(req, res);
    if (!tokenHash) return;

    const result = await callBridge(env, {
        action: "device.list",
        gateway_token_hash: tokenHash
    });

    if (!result.ok) {
        sendError(res, result.status, result.code, result.message);
        return;
    }

    sendJson(res, result.status, result.body);
}
