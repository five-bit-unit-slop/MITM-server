import {
    ApiError,
    callDatabaseBridge,
    getGatewayTokenHash,
    readJsonBody,
    sendApiError,
    sendJson
} from "./common.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MEASUREMENTS = 16;
const MAX_VALUE = 9999999.999;

function validateMessage(data) {
    if (data.version !== "1.0") {
        throw new ApiError(400, "UNSUPPORTED_VERSION", "version must be 1.0.");
    }

    if (typeof data.request_id !== "string" || !UUID_PATTERN.test(data.request_id)) {
        throw new ApiError(400, "INVALID_REQUEST_ID", "request_id must be a valid UUID.");
    }

    if (typeof data.timestamp !== "string" || data.timestamp.length > 64 || !/(Z|[+-]\d{2}:\d{2})$/i.test(data.timestamp) || Number.isNaN(Date.parse(data.timestamp))) {
        throw new ApiError(400, "INVALID_TIMESTAMP", "timestamp must be a valid ISO 8601 date with an explicit timezone.");
    }

    if (data.action !== "sensor.measurement") {
        throw new ApiError(400, "INVALID_ACTION", "action must be sensor.measurement.");
    }

    if (data.device === null || typeof data.device !== "object" || Array.isArray(data.device) || typeof data.device.id !== "string") {
        throw new ApiError(400, "INVALID_DEVICE", "device.id is required.");
    }

    const deviceId = data.device.id.trim();
    if (deviceId.length === 0 || deviceId.length > 100) {
        throw new ApiError(400, "INVALID_DEVICE", "device.id must contain between 1 and 100 characters.");
    }

    if (data.payloads === null || typeof data.payloads !== "object" || Array.isArray(data.payloads)) {
        throw new ApiError(400, "INVALID_PAYLOADS", "payloads must be a JSON object.");
    }

    const payloadEntries = Object.entries(data.payloads);
    if (payloadEntries.length === 0 || payloadEntries.length > MAX_MEASUREMENTS) {
        throw new ApiError(400, "INVALID_PAYLOADS", `Provide between 1 and ${MAX_MEASUREMENTS} sensor payloads.`);
    }

    const seenSensors = new Set();
    const measurements = payloadEntries.map(([payloadId, payload]) => {
        if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
            throw new ApiError(400, "INVALID_SENSOR_PAYLOAD", `Payload '${payloadId}' must be a JSON object.`);
        }

        if (typeof payload.sensor !== "string") {
            throw new ApiError(400, "INVALID_SENSOR_KEY", `Payload '${payloadId}' is missing its sensor key.`);
        }

        const sensorKey = payload.sensor.trim();
        if (sensorKey.length === 0 || sensorKey.length > 100 || seenSensors.has(sensorKey)) {
            throw new ApiError(400, "INVALID_SENSOR_KEY", "Sensor keys must be unique and contain between 1 and 100 characters.");
        }
        seenSensors.add(sensorKey);

        if (typeof payload.unit !== "string" || payload.unit.trim().length === 0 || payload.unit.trim().length > 20) {
            throw new ApiError(400, "INVALID_UNIT", `Payload '${payloadId}' has an invalid unit.`);
        }

        if (typeof payload.value !== "number" && typeof payload.value !== "string") {
            throw new ApiError(400, "INVALID_VALUE", `Payload '${payloadId}' has an invalid value.`);
        }

        if (typeof payload.value === "string" && payload.value.trim().length === 0) {
            throw new ApiError(400, "INVALID_VALUE", `Payload '${payloadId}' has an invalid value.`);
        }

        const value = Number(payload.value);
        if (!Number.isFinite(value) || Math.abs(value) > MAX_VALUE) {
            throw new ApiError(400, "INVALID_VALUE", `Payload '${payloadId}' must be a finite number supported by DECIMAL(10,3).`);
        }

        if (Math.round(value * 1000) !== value * 1000) {
            throw new ApiError(400, "INVALID_VALUE_PRECISION", `Payload '${payloadId}' cannot contain more than 3 decimal places.`);
        }

        return {
            sensor_key: sensorKey,
            value,
            unit: payload.unit.trim()
        };
    });

    return {
        request_id: data.request_id,
        timestamp: new Date(data.timestamp).toISOString(),
        device: {
            id: deviceId
        },
        measurements
    };
}

export async function measurementsRoute(req, res, env, url) {
    try {
        const gatewayTokenHash = await getGatewayTokenHash(req);

        if (req.method === "GET") {
            const deviceId = url.searchParams.get("device_id");
            const limitValue = url.searchParams.get("limit");
            const limit = limitValue === null ? 50 : Number(limitValue);

            if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
                throw new ApiError(400, "INVALID_LIMIT", "limit must be an integer between 1 and 100.");
            }

            if (deviceId !== null && (deviceId.trim().length === 0 || deviceId.trim().length > 100)) {
                throw new ApiError(400, "INVALID_DEVICE", "device_id must contain between 1 and 100 characters.");
            }

            const result = await callDatabaseBridge(env, {
                action: "measurement.list",
                gateway_token_hash: gatewayTokenHash,
                device_id: deviceId,
                limit
            });

            sendJson(res, result.status, result.body);
            return;
        }

        if (req.method !== "POST") {
            sendJson(res, 405, { status: "error", code: "METHOD_NOT_ALLOWED", message: "Method not allowed." }, { "Allow": "GET, POST" });
            return;
        }

        const contentType = req.headers["content-type"];
        if (typeof contentType !== "string" || !contentType.toLowerCase().startsWith("application/json")) {
            throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
        }

        const data = await readJsonBody(req);
        const message = validateMessage(data);
        const result = await callDatabaseBridge(env, {
            action: "measurement.create",
            gateway_token_hash: gatewayTokenHash,
            message
        });

        sendJson(res, result.status, result.body);
    } catch (error) {
        sendApiError(res, error);
    }
}
