import { sha265hasher } from "../local/hasher.js"; //shit happens, double dot so it takes root.

export async function data_to_sql(req, res, env) {
    const chunks = [];
    const authorization = req.headers.authorization; // Check gateway token
    let data;

    if (!env.AZURE_DB_BRIDGE_URL || !env.AZURE_DB_BRIDGE_KEY) {
        res.writeHead(500, {"Content-Type": "application/json"});
        res.end(JSON.stringify({error: "env not set. Please check!"}));
        return;
    }

    try {
        if (!authorization?.startsWith("Bearer ")) { // geen bearer geen toegang
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Unauthorized" }));
            return;
        }

        const gatewayToken = authorization.slice(7); //cleanup for hasher

        if (!gatewayToken) { //geen gateway token geen toegang
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Unauthorized" }));
            return;
        }

        const url = `${env.AZURE_DB_BRIDGE_URL}/api/database`; //inside try because they can fail, eg env not set.
        const tokenHash = await sha265hasher(gatewayToken);

        // Read request body
        for await (const chunk of req) {
            chunks.push(chunk);
        }

        // Convert body to string
        const body = Buffer.concat(chunks).toString("utf8");

        // Parse JSON
        try {
            data = JSON.parse(body);
        } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON body" }));
            return;
        }

        // Forward request to Azure Function
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-functions-key": env.AZURE_DB_BRIDGE_KEY
            },
            body: JSON.stringify({
                action: "measurement.create",
                gateway_token_hash: tokenHash,
                message: data
            })
        });

        // Read Azure response
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
        res.end(JSON.stringify({ error: "Internal server error" })); //ivm veiligheid geen exacte reden geven aan de gebruiker.
    }
}