import http from "node:http";
import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import { deviceRoute } from "./api/device.js";
import { healthRoute } from "./api/health.js";
import { measurementsRoute } from "./api/measurements.js";
import { sendJson } from "./api/common.js";
import { createRateLimiter } from "./migrations/ratelimiter.js";

const rateLimiter = createRateLimiter(env);

const server = http.createServer(async (req, res) => {
    if (!(await rateLimiter(req, res))) {
        return;
    }

    const url = new URL(req.url ?? "/", "https://mitm.local");
    const path = url.pathname;

    if (path === "/" && req.method === "GET") {
        sendJson(res, 200, {
            service: "MITM-server",
            status: "online",
            endpoints: [
                "GET /health",
                "GET /demo/health",
                "GET /device",
                "GET|POST /measurements",
                "GET|POST /demo/measurements",
                "POST /sensor"
            ]
        });
        return;
    }

    if (path === "/health" && req.method === "GET") {
        sendJson(res, 200, {
            service: "MITM-server",
            status: "ok"
        });
        return;
    }

    if (path === "/demo" && req.method === "GET") { //why is this still here?
        sendJson(res, 200, {
            service: "MITM-server",
            status: "online",
            database_bridge: "configured by AZURE_DB_BRIDGE_URL and AZURE_DB_BRIDGE_KEY"
        });
        return;
    }

    if (path === "/demo/health" && req.method === "GET") { //remove demo for later id say
        await healthRoute(res, env);
        return;
    }

    if (path === "/device") {
        await deviceRoute(req, res, env);
        return;
    }

    if (path === "/sensor" || path === "/measurements" || path === "/demo/measurements") {
        await measurementsRoute(req, res, env, url);
        return;
    }

    sendJson(res, 404, { // else
        status: "error",
        code: "NOT_FOUND",
        message: "Route not found."
    });
});

export default httpServerHandler(server);
