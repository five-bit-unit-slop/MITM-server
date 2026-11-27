import http from "node:http";
import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import { data_to_sql } from "./communication/recieve.js";
import { authLogin, authRegister } from "./local/auth.ts";

//legacy -> will be decapritated
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

        if (path === "/auth/login") {
            if (req.method !== "POST") {
                res.writeHead(405, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ status: "Wrong methode you dumb fuck XD" }));
            } else {
                await authLogin(req,res,env);
            }
            return;
        } else if (path === "/auth/register") {
            await authRegister(req,res,env);
            return;
        } else if (path === "/auth") {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Expected /auth/login or /auth/register." }));
            return;
        }

        if (path === "/api/sensor-data") {
            if (req.method !== "POST") {
                res.writeHead(405, {"Content-Type": "application/json"});
                res.end(JSON.stringify({error:"Wrong methode dipshit :)"}));
                return;
            } else {
                try {
                    await data_to_sql(req,res,env);
                    return;
                } catch {
                    res.writeHead(500, {"Content-Type": "application/json"});
                    res.end(JSON.stringify({error: "Internal server error"}));
                    return;
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
