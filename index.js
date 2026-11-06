import http from "node:http";
const deviceData = {
    device: "Pico",
    temperature: 24.5,
    isOnline: true
}

const server = http.createServer((req,res) => {
    if (req.url === "/device") {
        res.writeHead(200, {"Content-Type": "application/json"});
        res.end(JSON.stringify(deviceData));
    } else {
        res.writeHead(404, {"Content-Type": "text/plain"});
        res.end("Page not found!")
    }
})

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`listening on port ;${PORT}/`)
})