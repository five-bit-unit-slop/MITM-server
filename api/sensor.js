export function sensorRoute(req, res) {
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

                if (typeof data.temperature !== "number") {
                    throw new Error("Invalid temperature data!");
                } else if (typeof data.device_id !== "string" || data.device_id.length === 0) {
                    throw new Error("Invalid device ID!");
                } else if (typeof data.humidity !== "number") {
                    throw new Error("Invalid humidity data!");
                } else {
                    res.writeHead(200, {"Content-Type": "application/json"});
                    res.end(JSON.stringify({ "message": "Sensor data received" }));
                }

            } catch (error) {
                res.writeHead(400, {"Content-Type": "application/json"});
                res.end(JSON.stringify({ "message": error.message }));
            }
        });

    } else {
        res.writeHead(405, {"Content-Type": "application/json"});
        res.end(JSON.stringify({ "message": "Method not allowed!" }));
    }
}