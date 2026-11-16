import test from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { measurementsRoute } from "../api/measurements.js";
import { createRateLimiter } from "../migrations/ratelimiter.js";

function createResponse() {
    return {
        status: null,
        headers: null,
        body: null,
        writeHead(status, headers) {
            this.status = status;
            this.headers = headers;
        },
        end(body) {
            this.body = body;
        }
    };
}

function createRequest(method, headers, body) {
    const req = new PassThrough();
    req.method = method;
    req.headers = headers;
    process.nextTick(() => {
        if (body === undefined) {
            req.end();
        } else {
            req.end(body);
        }
    });
    return req;
}

const validMessage = {
    version: "1.0",
    request_id: "9a0ce8db-3fbd-4a65-84c4-80f2f5b98a4d",
    timestamp: "2026-11-16T12:00:00Z",
    device: { id: "pico-001" },
    action: "sensor.measurement",
    payloads: {
        "1": { sensor: "light", value: 1820, unit: "raw" },
        "2": { sensor: "draaiknop", value: "32768", unit: "raw" }
    }
};

const env = {
    AZURE_DB_BRIDGE_URL: "https://example.azurewebsites.net/api/database",
    AZURE_DB_BRIDGE_KEY: "test-function-key"
};

test("POST normalizes measurements and forwards only the hashed gateway token", async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    let forwarded;
    globalThis.fetch = async (url, options) => {
        forwarded = { url, options };
        return new Response(JSON.stringify({ status: "stored" }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    };

    const req = createRequest("POST", {
        authorization: "Bearer gateway-token-for-tests",
        "content-type": "application/json"
    }, JSON.stringify(validMessage));
    const res = createResponse();

    await measurementsRoute(req, res, env, new URL("https://mitm.local/demo/measurements"));

    assert.equal(res.status, 200);
    assert.equal(forwarded.url, env.AZURE_DB_BRIDGE_URL);
    assert.equal(forwarded.options.headers["x-functions-key"], env.AZURE_DB_BRIDGE_KEY);

    const body = JSON.parse(forwarded.options.body);
    assert.equal(body.action, "measurement.create");
    assert.equal(body.message.measurements.length, 2);
    assert.equal(body.message.measurements[1].value, 32768);
    assert.equal(body.gateway_token_hash.length, 64);
    assert.equal(JSON.stringify(body).includes("gateway-token-for-tests"), false);
});

test("POST rejects a non-UUID request_id before contacting Azure", async (t) => {
    const originalFetch = globalThis.fetch;
    let called = false;
    t.after(() => {
        globalThis.fetch = originalFetch;
    });
    globalThis.fetch = async () => {
        called = true;
        return new Response("{}", { status: 200 });
    };

    const req = createRequest("POST", {
        authorization: "Bearer gateway-token-for-tests",
        "content-type": "application/json"
    }, JSON.stringify({ ...validMessage, request_id: "x" }));
    const res = createResponse();

    await measurementsRoute(req, res, env, new URL("https://mitm.local/measurements"));

    assert.equal(res.status, 400);
    assert.equal(called, false);
    assert.equal(JSON.parse(res.body).code, "INVALID_REQUEST_ID");
});

test("measurement endpoints require gateway authentication", async () => {
    const req = createRequest("GET", {}, undefined);
    const res = createResponse();

    await measurementsRoute(req, res, env, new URL("https://mitm.local/measurements"));

    assert.equal(res.status, 401);
    assert.equal(JSON.parse(res.body).code, "UNAUTHORIZED");
});

test("rate limiter checks both source IP and gateway identity", async () => {
    const keys = [];
    const env = {
        API_RATE_LIMITER: {
            async limit({ key }) {
                keys.push(key);
                return { success: true };
            }
        }
    };
    const limiter = createRateLimiter(env);
    const req = {
        headers: {
            "cf-connecting-ip": "192.0.2.10",
            authorization: "Bearer gateway-token-for-tests"
        }
    };
    const res = createResponse();

    assert.equal(await limiter(req, res), true);
    assert.equal(keys.length, 2);
    assert.equal(keys[0], "source:192.0.2.10");
    assert.ok(keys[1].startsWith("gateway:"));
});
