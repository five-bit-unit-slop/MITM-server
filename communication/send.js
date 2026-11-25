import { sha265hasher } from "../local/hasher.js";

export async function sql_to_data(req, res, env) {
    let data;
    const chunks = [];
    const headers = {
    "Content-Type": "application/json",
    "x-functions-key": env.AZURE_DB_BRIDGE_KEY
    };
    if (typeof env.AZURE_DB_BRIDGE_URL !== "undefined" || typeof env.AZURE_DB_BRIDGE_KEY !== "undefined") {
        res.writeHead(500, {"Content-Type": "application/json"});
        res.end(JSON.stringify({error: "env not set. Please check!"}))
    }

    try{ //basically a copy of recieve.js but modified...?
        //inside try because they can fail, eg env not set.
        const url = `${env.AZURE_DB_BRIDGE_URL}/api/database`;
        const authorization = req.headers.authorization;
        const gatewayToken = authorization.slice(7);
        const tokenHash = await sha265hasher(gatewayToken);

        if (!authorization?.startsWith("Bearer ")) { // geen bearer geen toegang
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Unauthorized" }));
            return;
        }

        if (!gatewayToken) { //geen gateway token geen toegang
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Unauthorized" }));
            return;
        }

        for await (const chunk of req) {
            chunks.push(chunk);
        }

        const body = Buffer.concat(chunks).toString("utf8");

        try {
            data = JSON.parse(body);
        } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON body" }));
            return;
        }

        const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
            action: "measurement.list",
            gateway_token_hash: tokenHash,
            device_id: data.device_id ?? null,
            limit: data.limit ?? 50
        })
        });

        const result = await response.json();

        // Return Azure response to DMZ
        res.writeHead(response.status, {
            "Content-Type": "application/json"
        });
        res.end(JSON.stringify(result));

    } catch {
        res.writeHead(500, {
            "Content-Type": "application/json"
        });
        res.end(JSON.stringify({ error: "Internal server error", why: "we dont know :)" }));
    }
}