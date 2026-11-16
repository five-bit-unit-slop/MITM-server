export async function registerRequest(db, requestId, deviceId) {
    const now = Math.floor(Date.now() / 1000);

    await db.prepare("DELETE FROM processed_requests WHERE expires_at <= ?").bind(now).run();

    const statement = db.prepare("INSERT OR IGNORE INTO processed_requests (request_id, device_id, received_at, expires_at) VALUES (?, ?, ?, ?)");
    const result = await statement.bind(requestId,deviceId,now,now + 60 * 60).run();

    if (result.meta.changes > 0) {
        return { success: true, duplicate: false };
    } else {
        return { success: false, duplicate: true };
    }
}