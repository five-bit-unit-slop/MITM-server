export async function auth(req,res,env) {
    const allow_login = true
    if (allow_login === true) {
        res.writeHead(200, {"Content-Type": "application/json"});
        res.end(JSON.stringify({auth:"ok"}));
    } else {
        res.writeHead(401, {"Content-Type": "application/json"});
        res.end(JSON.stringify({auth:"Credentials not valid!"}))
    }
}