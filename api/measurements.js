//import
import { callBridge, readJsonBody, requireTokenHash, sendError, sendJson } from "./common.js";

//vars
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MEASUREMENTS = 16;
const MAX_VALUE = 9999999.999; // DECIMAL(10,3)

//functions
function validateMessage(data) {
    if (data.version !== "1.0") {
        return { ok: false, code: "UNSUPPORTED_VERSION", message: "version must be 1.0." };
    }
    if (typeof data.request_id !== "string" || !UUID_PATTERN.test(data.request_id)) {
        return { ok: false, code: "INVALID_REQUEST_ID", message: "request_id must be a valid UUID." };
    }
    if (typeof data.timestamp !== "string" || data.timestamp.length > 64 || !/(Z|[+-]\d{2}:\d{2})$/i.test(data.timestamp) || Number.isNaN(Date.parse(data.timestamp))) {
        return { ok: false, code: "INVALID_TIMESTAMP", message: "timestamp must be a valid ISO 8601 date with an explicit timezone." };
    }
    if (data.action !== "sensor.measurement") {
        return { ok: false, code: "INVALID_ACTION", message: "action must be sensor.measurement." };
    }
    if (data.device === null || typeof data.device !== "object" || Array.isArray(data.device) || typeof data.device.id !== "string") {
        return { ok: false, code: "INVALID_DEVICE", message: "device.id is required." };
    }

    const deviceId = data.device.id.trim();
    if (deviceId.length === 0 || deviceId.length > 100) {
        return { ok: false, code: "INVALID_DEVICE", message: "device.id must contain between 1 and 100 characters." };
    }

    if (data.payloads === null || typeof data.payloads !== "object" || Array.isArray(data.payloads)) {
        return { ok: false, code: "INVALID_PAYLOADS", message: "payloads must be a JSON object." };
    }

    const entries = Object.entries(data.payloads);
    if (entries.length === 0 || entries.length > MAX_MEASUREMENTS) {
        return { ok: false, code: "INVALID_PAYLOADS", message: `Provide between 1 and ${MAX_MEASUREMENTS} sensor payloads.` };
    }

    const seenSensors = new Set();
    const measurements = [];

    for (const [id, payload] of entries) {
        if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
            return { ok: false, code: "INVALID_SENSOR_PAYLOAD", message: `Payload '${id}' must be a JSON object.` };
        }
        if (typeof payload.sensor !== "string") {
            return { ok: false, code: "INVALID_SENSOR_KEY", message: `Payload '${id}' is missing its sensor key.` };
        }

        const sensorKey = payload.sensor.trim();
        if (sensorKey.length === 0 || sensorKey.length > 100 || seenSensors.has(sensorKey)) {
            return { ok: false, code: "INVALID_SENSOR_KEY", message: "Sensor keys must be unique and contain between 1 and 100 characters." };
        }
        seenSensors.add(sensorKey);

        if (typeof payload.unit !== "string" || payload.unit.trim().length === 0 || payload.unit.trim().length > 20) {
            return { ok: false, code: "INVALID_UNIT", message: `Payload '${id}' has an invalid unit.` };
        }
        if (typeof payload.value !== "number" && typeof payload.value !== "string") {
            return { ok: false, code: "INVALID_VALUE", message: `Payload '${id}' has an invalid value.` };
        }
        if (typeof payload.value === "string" && payload.value.trim().length === 0) {
            return { ok: false, code: "INVALID_VALUE", message: `Payload '${id}' has an invalid value.` };
        }

        const value = Number(payload.value);
        if (!Number.isFinite(value) || Math.abs(value) > MAX_VALUE) {
            return { ok: false, code: "INVALID_VALUE", message: `Payload '${id}' must be a finite number supported by DECIMAL(10,3).` };
        }
        if (Math.round(value * 1000) !== value * 1000) {
            return { ok: false, code: "INVALID_VALUE_PRECISION", message: `Payload '${id}' cannot contain more than 3 decimal places.` };
        }

        measurements.push({
            sensor_key: sensorKey,
            value,
            unit: payload.unit.trim()
        });
    }

    return {
        ok: true,
        message: {
            request_id: data.request_id,
            timestamp: new Date(data.timestamp).toISOString(),
            device: { id: deviceId },
            measurements
        }
    };
}

export async function measurementsRoute(req, res, env, url) {
    const tokenHash = await requireTokenHash(req, res);
    if (!tokenHash) return;

    if (req.method === "GET") {
        const deviceId = url.searchParams.get("device_id");
        const limitParam = url.searchParams.get("limit");
        const limit = limitParam === null ? 50 : Number(limitParam);

        if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
            sendError(res, 400, "INVALID_LIMIT", "limit must be an integer between 1 and 100.");
            return;
        }
        if (deviceId !== null && (deviceId.trim().length === 0 || deviceId.trim().length > 100)) {
            sendError(res, 400, "INVALID_DEVICE", "device_id must contain between 1 and 100 characters.");
            return;
        }

        const result = await callBridge(env, {
            action: "measurement.list",
            gateway_token_hash: tokenHash,
            device_id: deviceId,
            limit
        });

        if (!result.ok) {
            sendError(res, result.status, result.code, result.message);
            return;
        }
        sendJson(res, result.status, result.body);
        return;
    }

    if (req.method !== "POST") {
        sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.", { "Allow": "GET, POST" });
        return;
    }

    const contentType = req.headers["content-type"];
    if (typeof contentType !== "string" || !contentType.toLowerCase().startsWith("application/json")) {
        sendError(res, 415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
        return;
    }

    const body = await readJsonBody(req);
    if (!body.ok) {
        sendError(res, body.status, body.code, body.message);
        return;
    }

    const validated = validateMessage(body.data);
    if (!validated.ok) {
        sendError(res, 400, validated.code, validated.message);
        return;
    }

    const result = await callBridge(env, {
        action: "measurement.create",
        gateway_token_hash: tokenHash,
        message: validated.message
    });

    if (!result.ok) {
        sendError(res, result.status, result.code, result.message);
        return;
    }
    sendJson(res, result.status, result.body);
}
