
import http from "node:http";

const deviceData = {
    device: "Pico",
    temperature: 24.5,
    isOnline: true
}

const message = {
    "message": "Sensor data received"
}

const error = {
    "message": "Method not allowed!"
}

const notFound = {
    "message": "Not found!"
}

const server = http.createServer((req,res) => {
    if (req.url === "/device" && req.method === "GET") {
        res.writeHead(200, {"Content-Type": "application/json"});
        res.end(JSON.stringify(deviceData));

    } else if (req.url === "/sensor") { 
        if (req.method === "POST") {
            if (req.headers["content-type"] !== "application/json") {
                        res.writeHead(415, {"Content-Type": "application/json"});
                        res.end(JSON.stringify({ "message": "Unsupported Media Type" }));
                        return;
            } else {
                console.log(req.headers["authorization"]);
            }
            let body = "";

            req.on("data", (chunk) => {
                body += chunk;
            });

            req.on("end", () => {
                try {
                    const data = JSON.parse(body);

                    console.log(data.device_id);
                    console.log(data.temperature);
                    console.log(data.humidity);
                    //auth validation
                    if (typeof data.temperature !== "number") {
                        throw new Error("Invalid temperature data!");
                    } else if (typeof data.device_id !== "string" || data.device_id.length === 0) {
                        throw new Error("Invalid device ID!");
                    } else if (typeof data.humidity !== "number") {
                        throw new Error("Invalid humidity data!");
                    } else {
                        res.writeHead(200, {"Content-Type": "application/json"});
                        res.end(JSON.stringify(message));
                    }

                } catch (error) {
                    res.writeHead(400, {"Content-Type": "application/json"});
                    res.end(JSON.stringify({ "message": error.message }));
                }
            });

        } else {
            res.writeHead(405, {"Content-Type": "application/json"});
            res.end(JSON.stringify(error));
        }

    } else {
        res.writeHead(404, {"Content-Type": "application/json"});
        res.end(JSON.stringify(notFound));
    }
})

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`listening on port ${PORT}`);
})
