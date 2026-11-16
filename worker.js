import http from "node:http";
import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import { deviceRoute } from "./api/device.js";
import { sensorRoute } from "./api/sensor.js";
import { createRateLimiter } from "./rateLimiter.js";

const rateLimiter = createRateLimiter(env);

const server = http.createServer(async (req, res) => {
    if (!(await rateLimiter(req, res))) {
        return;
    }

    const path = (req.url ?? "/").split("?")[0];

    if (path === "/device") {
        if (req.method === "GET") {
            await deviceRoute(req, res);
        } else {
            res.writeHead(405, {"Content-Type": "application/json"});
            res.end(JSON.stringify({ "message": "Method not allowed!" }));
        }

    } else if (path === "/sensor") {
        if (req.method === "POST") {
            await sensorRoute(req, res, env);
        } else {
            res.writeHead(405, {"Content-Type": "application/json"});
            res.end(JSON.stringify({ "message": "Method not allowed!" }));
        }

    } else {
        res.writeHead(404, {"Content-Type": "application/json"});
        res.end(JSON.stringify({ "message": "Not found!" }));
    }
});

export default httpServerHandler(server);
