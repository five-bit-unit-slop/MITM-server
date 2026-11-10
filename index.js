import http from "node:http";
import fs from "node:fs";
import { deviceRoute } from "./api/device.js";
import { sensorRoute } from "./api/sensor.js";

const server = http.createServer((req,res) => {
    if (req.url === "/") {
        fs.readFile("./index.html", (err, data) => {
            if (err) {
                res.writeHead(500, {"Content-Type": "application/json"});
                res.end(JSON.stringify({ "message": "Internal server error!" }));
                return;
            }

            res.writeHead(200, {"Content-Type": "text/html"});
            res.end(data);
        });
    } else if (req.url === "/image.png") {
        fs.readFile("./image.png", (err, data) => {
            if (err) {
                res.writeHead(500, {"Content-Type": "application/json"});
                res.end(JSON.stringify({ "message": "Internal server error!" }));
                return;
            }

            res.writeHead(200, {"Content-Type": "image/png"});
            res.end(data);
        });
    } else if (req.url === "/device") {
        if (req.method === "GET") {
            deviceRoute(req, res);
        } else {
            res.writeHead(405, {"Content-Type": "application/json"});
            res.end(JSON.stringify({ "message": "Method not allowed!" }));
        }
    } else if (req.url === "/sensor") {
        sensorRoute(req, res);
    } else {
        res.writeHead(404, {"Content-Type": "application/json"});
        res.end(JSON.stringify({ "message": "Not found!" }));
    }
})

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`listening on port ${PORT}`);
})
