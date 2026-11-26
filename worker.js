import http from "node:http";
import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import { data_to_sql } from "./communication/recieve.js";
import { auth } from "./local/auth.js";

//legacy
import { legacy_data_to_sql } from "./communication/legacy/recieve.js";
import { legacy_sql_to_data } from "./communication/legacy/send.js";

const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url ?? "/", "https://mitm.local");
        const path = url.pathname;
        
        if (path === "/health") { // later uitbreiden naar testen verbinding met sql function
            if (req.method !== "GET") {
                res.writeHead(405, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ status: "Wrong methode you dumb fuck XD" }));
            } else {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ status: "ok" }));
            }
            return;
        }

        if (path === "/auth") {
            await auth(req,res,env);
            return;
        }

        if (path === "/api/sensor-data") {
            if (req.method !== "POST") {
                res.writeHead(405, {"Content-Type": "application/json"});
                res.end(JSON.stringify({error:"Wrong methode dipshit :)"}));
                return;
            } else {
                try {
                const response = await data_to_sql(req,res,env);
                const body = response.text
                const code = response.status
                res.writeHead(code, {"Content-Type": "application/json"});
                res.end(JSON.stringify(body))
                } catch {
                    res.writeHead(500, {"Content-Type": "application/json"});
                    res.end(JSON.stringify({error: "Internal server error"}));
                };
            }
        }

        //legacy stuff

        if (path === "/api/legacy/sensor-data") { // garbage in
            if (req.method !== "POST") {
                res.writeHead(405, { "Content-Type": "application/json" });
                res.end(JSON.stringify({error: "Wrong method dipshit :)"}));
                return;
            } else {
                await legacy_data_to_sql(req, res, env);
                return;
            }
        }

        if (path === "/api/legacy/get-data") { // garbage out
            if (req.method !== "POST") {
                res.writeHead(405, { "Content-Type": "application/json" });
                res.end(JSON.stringify({error: "Wrong method dipshit :)"}));
                return;
            } else {
                await legacy_sql_to_data(req, res, env);
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
