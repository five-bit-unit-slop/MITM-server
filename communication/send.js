export async function legacy_sql_to_data(req, res, env) {
    if (allow_sensor_reading !== "true") {
        res.writeHead(423, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Reading data is disabled at this moment." }));
        return;
    }
}