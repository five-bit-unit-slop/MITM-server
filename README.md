# MITM Server

Cloudflare Worker between the Raspberry Pi Gateway and the Azure DB Bridge.

## Request path

`Raspberry Pi Gateway -> Cloudflare Worker -> Azure Function -> Azure SQL`

The Raspberry Pi sends a gateway token in the HTTP `Authorization` header. The Worker hashes that token with SHA-256 and forwards only the hash to the Azure Function. The Azure Function validates the hash against an active `dbo.Gateways` row. Pico devices do not authenticate directly with the cloud API.

## Configuration

`wrangler.jsonc` contains the non-secret Azure Function URL. Configure the Function Key as a Cloudflare Worker secret:

```powershell
npx wrangler secret put AZURE_DB_BRIDGE_KEY
```

Paste the Azure Function Key when prompted. Do not put it in `wrangler.jsonc`, `.env` committed to Git, source code, or Raspberry Pi configuration.

The gateway's raw API token is stored only on the Raspberry Pi. Store its SHA-256 hash in `dbo.Gateways.gateway_token_hash`.

## Endpoints

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Worker liveness check |
| GET | `/demo` | Development endpoint overview |
| GET | `/demo/health` | Check the Azure SQL bridge connection |
| GET | `/device` | List devices registered to the authenticated gateway |
| POST | `/sensor` | Compatibility alias for measurement ingestion |
| GET/POST | `/measurements` | List or create measurements |
| GET/POST | `/demo/measurements` | Development alias for measurements |

All gateway-specific endpoints require `Authorization: Bearer <gateway-token>`.

## Measurement request

```json
{
  "version": "1.0",
  "request_id": "9a0ce8db-3fbd-4a65-84c4-80f2f5b98a4d",
  "timestamp": "2026-11-16T12:00:00Z",
  "device": {
    "id": "pico-001"
  },
  "action": "sensor.measurement",
  "payloads": {
    "1": {
      "sensor": "light",
      "value": 1820,
      "unit": "raw"
    },
    "2": {
      "sensor": "draaiknop",
      "value": 32768,
      "unit": "raw"
    }
  }
}
```

`request_id` must be a UUID because the SQL column is `UNIQUEIDENTIFIER`. `timestamp` must include an explicit timezone and is normalized to UTC. The same `request_id` is used for every sensor value in one message; SQL deduplicates each `(request_id, sensor_id)` pair. Sensor keys and units must match active rows in `dbo.Sensors`.

Example request from PowerShell:

```powershell
$headers = @{
    Authorization = "Bearer $env:GATEWAY_TOKEN"
    "Content-Type" = "application/json"
}

$body = @{
    version = "1.0"
    request_id = [guid]::NewGuid().ToString()
    timestamp = [DateTime]::UtcNow.ToString("o")
    device = @{ id = "pico-001" }
    action = "sensor.measurement"
    payloads = @{
        "1" = @{ sensor = "light"; value = 1820; unit = "raw" }
        "2" = @{ sensor = "draaiknop"; value = 32768; unit = "raw" }
    }
} | ConvertTo-Json -Depth 6

curl.exe -X POST "https://<worker-host>/demo/measurements" `
    -H "Authorization: Bearer $env:GATEWAY_TOKEN" `
    -H "Content-Type: application/json" `
    --data-binary $body
```

## Development

Run the Worker with Wrangler:

```powershell
npx wrangler dev --port 8080
```

The Cloudflare Rate Limiting binding applies a 60 requests/minute source-IP limit to all traffic and an additional 60 requests/minute limit to authenticated gateway tokens. Cloudflare's rate-limit counters are approximate and local to each Cloudflare location.
