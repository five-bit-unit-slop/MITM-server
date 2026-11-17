//import
import http from "node:http";
import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import { deviceRoute } from "./api/device.js";
import { healthRoute } from "./api/health.js";
import { measurementsRoute } from "./api/measurements.js";
import { sendError, sendJson } from "./api/common.js";
import { checkRateLimit } from "./migrations/ratelimiter.js";

//main
const server = http.createServer(async (req, res) => {
    try {
        if (!(await checkRateLimit(req, res, env))) {
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

        sendError(res, 404, "NOT_FOUND", "Route not found.");
    } catch (err) {
        console.error("Request failed:", err);
        sendError(res, 500, "INTERNAL_SERVER_ERROR", "Internal server error.");
    }
});

export default httpServerHandler(server);
