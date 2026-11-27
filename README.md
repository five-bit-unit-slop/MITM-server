# MITM Server

Cloudflare Worker (Node.js HTTP compatibility) acting as the central MITM backend.

## Architecture

```
Pico W (WiFi)          DMZ Gateway (RPi)          Tkinter App
     │                        │                        │
     ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   Cloudflare Worker                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Hyperdrive │  │      D1     │  │       KV            │ │
│  │   (TiDB)     │  │ (Identity)  │  │  (Feature Flags)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

- **Hyperdrive** → TiDB Cloud (PostgreSQL) — sensor data, measurements
- **D1** (`smart_system_identity`) — users, sessions, gateway credentials
- **KV** (`SETTINGS`) — runtime feature flags (`allow_login`, `allow_registration`, `allow_sensor_receiving`)

## Current Implementation Status

### Authentication Routes

| Route | Method | Status |
|-------|--------|--------|
| `/auth/login` | POST | Implemented (incomplete) |
| `/auth/register` | POST | Stub only |
| `/auth` | — | Returns 404 with guidance |

### Login Implementation (`authLogin`)

**Current flow:**

1. Read `allow_login` from KV (`env.SETTINGS`)
2. Reject with 401 if not `"true"`
3. Read request body via `readBody(req)` helper
4. Parse JSON body
5. Return 400 on parse failure
6. Query D1 for user by username
7. Return 500 on DB error
8. Return 401 if user not found
9. Verify password with `passverify()` (Argon2id)
10. **Missing:** handle `passverify()` result, check `is_active`, create session, return token

**Request body:**
```json
{
    "username": "smartfridge_enjoyer",
    "password": "<password>"
}
```

**Current gaps:**
- `passverify()` boolean result is checked but **success branch is empty**
- No `is_active` check on user
- No session creation or token issuance on success
- No `UserSessions` insert

### Registration Implementation (`authRegister`)

- Reads `allow_registration` from KV
- Returns 200 if `"true"`, 423 if disabled
- **No actual account creation** implemented

### Sensor Data Route (`/api/sensor-data`)

- Checks `allow_sensor_receiving` from KV
- Validates Bearer token (non-empty check only)
- Connects to TiDB via Hyperdrive
- **Currently only runs `SELECT * FROM pg_tables`** — no sensor data insertion

## Code Structure

```
worker.js                    # Main entry, HTTP routing
local/
  ├─ auth.ts                 # authLogin, authRegister, generateToken
  ├─ readBody.ts             # Request body reader (IncomingMessage → Promise<string>)
  ├─ hasher.js               # Argon2id (passhasher, passverify), SHA-256
communication/
  ├─ recieve.js              # /api/sensor-data handler (TiDB via Hyperdrive)
  ├─ send.js                 # Legacy read endpoint (stub)
  └─ legacy/
      ├─ recieve.js          # Legacy sensor data ingest
      └─ send.js             # Legacy data retrieval
```

## D1 Schema (`smart-system-identity`)

### `Users`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `ID` | TEXT | PRIMARY KEY | User UUID |
| `Username` | TEXT | NOT NULL, UNIQUE | Login username |
| `Password_Hash` | TEXT | NOT NULL | Argon2id encoded hash |
| `Created_At` | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Registration time |
| `Is_Active` | INTEGER | NOT NULL DEFAULT 1, CHECK(0,1) | Account enabled |

### `UserSessions`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `ID` | TEXT | PRIMARY KEY | Session UUID |
| `User_ID` | TEXT | NOT NULL, FK→Users(ID), ON DELETE CASCADE | Owning user |
| `Token_Hash` | TEXT | NOT NULL, UNIQUE | SHA-256 of raw token |
| `Created_At` | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Session start |
| `Expires_At` | TEXT | NOT NULL | Session expiry (ISO 8601) |
| `Is_Revoked` | INTEGER | NOT NULL DEFAULT 0, CHECK(0,1) | Revocation flag |

**Indexes:** `idx_UserSessions_user_id` on `User_ID`

### `GatewayCredentials`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `Gateway_ID` | TEXT | PRIMARY KEY | Gateway UUID |
| `Owner_User_ID` | TEXT | NOT NULL, FK→Users(ID), ON DELETE CASCADE | Owning user |
| `Token_Hash` | TEXT | NOT NULL, UNIQUE | SHA-256 of gateway token |
| `Created_At` | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Registration time |
| `Last_Seen_At` | TEXT | NULL | Last contact |
| `Is_Active` | INTEGER | NOT NULL DEFAULT 1, CHECK(0,1) | Gateway enabled |

**Indexes:** `idx_GatewayCredentials_owner_user_id` on `Owner_User_ID`

## Token Format

```
5bus_<prefix>_<64 hex chars>
```

- Prefix: `u` (user) or `h` (hub/gateway)
- 32 random bytes → 64 hex chars (256 bits entropy)
- Raw token returned to client; **only SHA-256 hash stored** in `UserSessions.Token_Hash` or `GatewayCredentials.Token_Hash`

## Outstanding Work (Incomplete)

### Login (`authLogin`)
- [ ] Handle `passverify()` boolean result (success branch is empty)
- [ ] Validate input types: `username` and `password` must be non-empty strings
- [ ] Check `Users.Is_Active` before allowing login
- [ ] On success: call `generateToken("user")`
- [ ] Hash token with SHA-256 (`sha265hasher`)
- [ ] Insert into `UserSessions` (token_hash, user_id, expires_at, etc.)
- [ ] Return raw token to client in response body

### Registration (`authRegister`)
- [ ] Implement actual account creation
- [ ] Validate username/password input
- [ ] Hash password with `passhasher()` (Argon2id)
- [ ] Insert into `Users` (ID, Username, Password_Hash, Is_Active=1)
- [ ] Return 201 on success, 409 on conflict

### General Auth
- [ ] Add HTTP method validation (already present for login/register)
- [ ] Handle request stream errors in `readBody` (already has error handler)
- [ ] Handle unexpected failures safely (try/catch in worker.js)

### Sensor Data
- [ ] Implement actual sensor data insertion into TiDB (`measurements` table)
- [ ] Validate sensor data payload structure
- [ ] Gateway authentication via D1 `GatewayCredentials` (currently only Bearer non-empty check)

## Security Considerations

- **Passwords:** Argon2id (16-byte salt, 19 MiB memory, 2 iterations, parallelism 1). Never stored plaintext.
- **Tokens:** 256-bit entropy, SHA-256 hashed before storage. Raw token returned once on login.
- **Account enumeration:** Generic "Credentials invalid" error for both unknown user and wrong password.
- **Feature flags:** All auth/sensor endpoints gated by KV settings (`allow_login`, `allow_registration`, `allow_sensor_receiving`).
- **Transport:** HTTPS enforced by Cloudflare. D1 and Hyperdrive connections use TLS.

## Environment Bindings (wrangler.jsonc)

| Binding | Type | Purpose |
|---------|------|---------|
| `HYPERDRIVE` | Hyperdrive | TiDB connection pool |
| `smart_system_identity` | D1 | Identity store (users, sessions, gateways) |
| `SETTINGS` | KV | Feature flags (`allow_login`, `allow_registration`, `allow_sensor_receiving`) |
| `KV` | KV | General purpose KV namespace |

## Running Locally

```bash
npm run dev    # wrangler dev on port 8080
npm run deploy # wrangler deploy
```

## Project Setup

- **Runtime:** Cloudflare Workers with Node.js compatibility (`nodejs_compat` flag)
- **Language:** JavaScript/TypeScript mixed (`.js` and `.ts` files)
- **HTTP:** Node.js `http` module via `cloudflare:node` `httpServerHandler`
- **Dependencies:** `pg` (TiDB), `hash-wasm` (Argon2id), `@types/node`, `@types/pg`

## Legacy Endpoints (Deprecated)

- `/api/legacy/sensor-data` (POST) — old sensor ingest
- `/api/legacy/get-data` (POST) — old data retrieval
- `/auth` (base path) — returns 404 with guidance

---

*This documentation reflects the actual code as of the current commit. Items marked with [ ] are not yet implemented.*