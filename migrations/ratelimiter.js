export function createRateLimiter({
    windowMs = 60_000,
    maxRequests = 60
} = {}) {
    const requests = new Map();

    let lastCleanup = Date.now();

    return function rateLimiter(req, res) {
        const now = Date.now();
        if (now - lastCleanup >= windowMs) {
            for (const [key, bucket] of requests) {
                if (now >= bucket.resetAt) {
                    requests.delete(key);
                }
            }

            lastCleanup = now;
        }

        const ip = req.socket.remoteAddress ?? "unknown";
        const normalizedIp = ip.startsWith("::ffff:")
            ? ip.slice(7)
            : ip;

        const path = (req.url ?? "/").split("?")[0];
        const key = `${normalizedIp}:${path}`;

        let bucket = requests.get(key);
        if (!bucket || now >= bucket.resetAt) {
            bucket = {
                count: 0,
                resetAt: now + windowMs
            };

            requests.set(key, bucket);
        }

        bucket.count++;

        const remaining = Math.max(0, maxRequests - bucket.count);
        const retryAfter = Math.max(
            1,
            Math.ceil((bucket.resetAt - now) / 1000)
        );

        res.setHeader("RateLimit-Limit", maxRequests);
        res.setHeader("RateLimit-Remaining", remaining);
        res.setHeader("RateLimit-Reset", retryAfter);

        // Reject requests exceeding the limit
        if (bucket.count > maxRequests) {
            res.writeHead(429, {
                "Content-Type": "application/json",
                "Retry-After": retryAfter
            });

            res.end(JSON.stringify({
                error: "Too many requests",
                retry_after: retryAfter
            }));

            return false;
        }

        return true;
    };
}