import { Client } from "pg";

export async function data_to_sql(req, res, env) {
    if (true) {
        res.writeHead(423, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "System is shut off for now" }));
        return;
    }
    const authorization = req.headers.authorization;
    const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });
    //auth checker
    if (!authorization?.startsWith("Bearer ")) { // geen bearer geen toegang
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
    };

    const gatewayToken = authorization.slice(7); //cleanup for hasher

    if (!gatewayToken) { //geen gateway token geen toegang
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
    };

    try {
        await client.connect();
        // Sample SQL query
        const result = await client.query("SELECT * FROM pg_tables");

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({result: result.rows}));
        return;
    } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({error: e}));
    }; 
    }
