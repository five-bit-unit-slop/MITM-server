import { readBody } from "../local/readBody";
import { passverify, sha256hasher } from "../local/hasher.js"

export async function authLogin(req,res,env) {
    const allowLogin = await env.SETTINGS.get("allow_login");
    if (allowLogin !== "true") {
        res.writeHead(401, {"Content-Type": "application/json"});
        res.end(JSON.stringify({auth:"Login is disabled at this moment."}))
        return;
    } 

    let body;
    let data;
    try {
        body = await readBody(req);
        data = JSON.parse(body);
    } catch (error) {
        res.writeHead(400, {"Content-Type": "application/json"});
        res.end(JSON.stringify({auth: "Malformed request body."}));
        return;
    }

    if (data === null || typeof data !== "object" || Array.isArray(data)) { //object check
    res.writeHead(400, {"Content-Type": "application/json"});
    res.end(JSON.stringify({error: "Request body must be a JSON object."}));
    return;
    }

    if (typeof data.username !== "string" || typeof data.password !== "string") { //object validation
        res.writeHead(400, {"Content-Type": "application/json"});
        res.end(JSON.stringify({error: "Username and password must be strings."}));
        return;
    }
    
    if (data.username.length > 255 || data.password.length > 255) {
        res.writeHead(400, {"Content-Type": "application/json"});
        res.end(JSON.stringify({error: "Username and password must not exceed 255 characters."}));
        return;
    }

    let result_select_username;
    try {
    result_select_username = await env.smart_system_identity // Checks if current givenup username exists
				.prepare("SELECT * FROM Users WHERE Username = ?")
				.bind(data.username)
				.run();
    } catch {
        res.writeHead(500, {"Content-type": "application/json"});
        res.end(JSON.stringify({error:"Internal server error."}));
        return;
    }

    if (result_select_username.results.length === 0 || result_select_username.results[0].is_active === 0) { //no results found
        res.writeHead(401, {"Content-Type": "application/json"});
        res.end(JSON.stringify({error: "Credentials invalid."}))
        return;
    }

    let pass_correct = false;
    try {
        pass_correct = await passverify(data.password, result_select_username.results[0].password_hash); //password verification
    } catch {
        res.writeHead(500, {"Content-Type": "application/json"});
        res.end(JSON.stringify({error: "Internal server error."}));
        return;
    }
    
    if (pass_correct) { //verify the password
        const token = generateToken("user");
        try{
        const tokenHash = await sha256hasher(token);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
        await env.smart_system_identity
        .prepare("INSERT INTO UserSessions (ID, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
        .bind(crypto.randomUUID(), result_select_username.results[0].ID, tokenHash, expiresAt)
        .run();
        res.writeHead(200, {"Content-Type": "application/json"});
        res.end(JSON.stringify({status: "ok", token: token, expires_at: expiresAt}));
        return;
        } catch {
            res.writeHead(500, {"Content-Type": "application/json"});
            res.end(JSON.stringify({error: "Internal server error."}));
            return;
        }
    } else {
        res.writeHead(401, {"Content-Type": "application/json"});
        res.end(JSON.stringify({error: "Credentials invalid."}));
        return;
    }
};

export async function authRegister(req,res,env) {
    const allowRegistration = await env.SETTINGS.get("allow_registration");
    if (allowRegistration === "true") {
        res.writeHead(200, {"Content-Type": "application/json"});
        res.end(JSON.stringify({auth:"ok"}));
    } else {
        res.writeHead(423, {"Content-Type": "application/json"});
        res.end(JSON.stringify({auth:"Register is disabled at this moment."}))
    }
}

export function generateToken(type: "user" | "hub"): string {
    let prefix;
    if (type === "user") {
        prefix = "u";
    } else if (type === "hub") {
        prefix = "h";
    } else {
        throw new Error("Specified type does not exist. { user || hub }");
    }

    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const result = Array.from(randomBytes)
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");

    return `5bus_${prefix}_${result}`;
}