export function deviceRoute(req, res) {
    const deviceData = {
        device: "Pico",
        temperature: 24.5,
        isOnline: true
    }

    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(JSON.stringify(deviceData));
}