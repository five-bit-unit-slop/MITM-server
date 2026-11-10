import http from "node:http";
import { deviceRoute } from "./api/device.js";
import { sensorRoute } from "./api/sensor.js";

const server = http.createServer((req,res) => {
    if (req.url === "/device") {
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