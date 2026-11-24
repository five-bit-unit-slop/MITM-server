
import http from "node:http";
import { httpServerHandler } from "cloudflare:node";
import { data_to_sql } from "./receive.js";
import { sql_to_data } from "./send.js";

const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url ?? "/", "https://mitm.local");
        const path = url.pathname;

        if (path === "/health") { //later uitbreiden naar testen verbinding met sql function
            if (req.method !== "GET") {
                res.writeHead(405, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ status: "Wrong methode you dumb fuck XD" }));
            } else {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ status: "ok" }));
            }
            return;
        }

        if (path === "/api/sensor-data") { // garbage in
            if (req.method !== "POST") {
                res.writeHead(405, { "Content-Type": "application/json" });
                res.end(JSON.stringify({}));
                return;
            } else {
                await data_to_sql(req, res);
                return;
            }
        }

        if (path === "/api/get-data") { // garbage out
            if (req.method !== "POST") {
                res.writeHead(405, { "Content-Type": "application/json" });
                res.end(JSON.stringify({}));
                return;
            } else {
                await sql_to_data(req, res);
                return;
            }
        }

        const error404 = { error: `uh, ${path} doesnt exist.` };
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify(error404));

    } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error, but we wont say what went wrong :)" }));
    }
});

export default httpServerHandler(server);
