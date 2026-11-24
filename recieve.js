export async function data_to_sql(req, res) {
    let body = "";

    for await (const chunk of req) {
        body += chunk;
    }

    const data = JSON.parse(body);

    const response = await fetch(`${AZURE_URL}/api/database?code=${AZURE_FUNCTION_KEY}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            action: "measurement.create",
            gateway_token_hash: tokenHash,
            message: data
        })
    });

    const result = await response.json();

    res.writeHead(response.status, {
        "Content-Type": "application/json"
    });
    res.end(JSON.stringify(result));
}