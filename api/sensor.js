const processedRequests = [];

export function sensorRoute(req, res) {
    if (req.method === "POST") {

        const expectedToken = process.env.API_TOKEN;
        const contentType = req.headers["content-type"];
        const Auth = req.headers["authorization"]

        if (!contentType || !contentType.startsWith("application/json")) {
            res.writeHead(415, {"Content-Type": "application/json"});
            res.end(JSON.stringify({ "message": "Unsupported Media Type" }));
            return;
        } else if (!expectedToken || !Auth || Auth !== "Bearer " + expectedToken) {
            res.writeHead(401, {"Content-Type": "application/json"});
            res.end(JSON.stringify({"message": "Unauthorized"}))
            return;
        }
        let body = "";
        let bodySize = 0;
        let bodyTooLarge = false;
        const maxBodySize = 10 * 1024;

        req.on("data", (chunk) => {
            if (bodyTooLarge) {
                return;
            }

            bodySize += chunk.length;

            if (bodySize > maxBodySize) {
                bodyTooLarge = true;
                res.writeHead(413, {"Content-Type": "application/json"});
                res.end(JSON.stringify({"message": "Request body too large"}));
                return;
            }

            body += chunk;
        });

        req.on("end", () => {
            if (bodyTooLarge) {
                return;
            }

            try {
                const data = JSON.parse(body);

                if (data === null || typeof data !== "object" || Array.isArray(data)) {
                    throw new Error("Invalid JSON structure!");
                }

                const ReqId = data.request_id;
                if (typeof data.request_id !== "string" || data.request_id.length === 0){
                    throw new Error("Invalid request ID!");
                } else if (processedRequests.includes(ReqId)) {
                    res.writeHead(409, {"Content-Type": "application/json"});
                    res.end(JSON.stringify({ "message": "Duplicate request" }));
                    return;
                }

                if (typeof data.temperature !== "number" || data.temperature < -40 || data.temperature > 85) {
                    throw new Error("Invalid temperature data!");
                } else if (typeof data.device_id !== "string" || data.device_id.length === 0) {
                    throw new Error("Invalid device ID!");
                } else if (typeof data.humidity !== "number" || data.humidity < 0 || data.humidity > 100) {
                    throw new Error("Invalid humidity data!");
                } else {
                    processedRequests.push(ReqId);
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