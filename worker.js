import http from "node:http";
import { httpServerHandler } from "cloudflare:node";
import { deviceRoute } from "./api/device.js";
import { sensorRoute } from "./api/sensor.js";
import index from "./index.html";

const server = http.createServer((req, res) => {
    if (req.url === "/") {
        res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
        res.end(index);

    } else if (req.url === "/device") {
        if (req.method === "GET") {
            deviceRoute(req, res);
        } else {
            res.writeHead(405, {"Content-Type": "application/json"});
            res.end(JSON.stringify({ "message": "Method not allowed!" }));
        }

    } else if (req.url === "/sensor") {
        if (req.method === "POST") {
            sensorRoute(req, res);
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