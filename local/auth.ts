export async function authLogin(req,res,env) {
    const allowLogin = await env.SETTINGS.get("allow_login");
    if (allowLogin === "true") {
        res.writeHead(200, {"Content-Type": "application/json"});
        res.end(JSON.stringify({auth:"ok"}));
    } else {
        res.writeHead(401, {"Content-Type": "application/json"});
        res.end(JSON.stringify({auth:"Credentials not valid!"}))
    }
}
export async function authRegister(req,res,env) {
    const allowRegistration = await env.SETTINGS.get("allow_registration");
    if (allowRegistration === "true") {
        res.writeHead(200, {"Content-Type": "application/json"});
        res.end(JSON.stringify({auth:"ok"}));
    } else {
        res.writeHead(401, {"Content-Type": "application/json"});
        res.end(JSON.stringify({auth:"Credentials not valid!"}))
    }
}
export function generateToken(type: "user" | "hub"): string {
    let prefix;
    if (type === "user") {
        prefix = "u"
    } else if (type === "hub") {
        prefix = "h"
    } else {
        throw new Error("Specified type does not exist. { user || hub }");
    }
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; // Takes 1.38 * 10^10 years to crack, nice.
    const charactersLength = characters.length;
    let j;
    for ( let i = 0; i < 256; i++ ) {
        j = new Uint32Array(1)
        result += characters.charAt(Math.floor(crypto.getRandomValues(j)[0] * charactersLength));
    }
    return `5bus_${prefix}_${result}`
};