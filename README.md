# MITM Server

Cloudflare Worker (Node.js HTTP compat) acting as the central MITM backend.

## Architecture

```text
Pico W (WiFi)          DMZ Gateway (RPi)          Tkinter App
     |                        |                        |
     v                        v                        v
+-------------------------------------------------------------+
|                   Cloudflare Worker                         |
|  +-------------+  +-------------+  +---------------------+  |
|  | Hyperdrive  |  |     D1      |  |        KV           |  |
|  |   (TiDB)    |  | (Identity)  |  |  (Feature Flags)    |  |
|  +-------------+  +-------------+  +---------------------+  |
+-------------------------------------------------------------+
```

- **Hyperdrive** to TiDB Cloud (PostgreSQL): gateways, devices, sensors, measurements, alerts.
- **D1** (`smart-system-identity`): users, sessions, gateway credentials.
- **KV** (`SETTINGS`): runtime feature flags (`allow_login`, `allow_registration`, `allow_sensor_receiving`, `allow_sensor_reading`).

D1 is the source of truth for identity. TiDB does not contain users in the target schema. The current TiDB database still has a legacy `users` table and `gateways.owner_user_id`; those are scheduled for removal.

## Routes

| Route | Method | Status |
|-------|--------|--------|
| `/health` | GET | Returns 200 with `{"status":"ok"}`. No database check. |
| `/auth/login` | POST | Implemented. Reads D1, verifies the password, creates a session token. |
| `/auth/register` | POST | Stub. Checks `allow_registration` and returns 200 or 423. |
| `/auth` | GET | Returns 404 with a pointer to `/auth/login` and `/auth/register`. |
| `/api/sensor-data` | POST | Checks a non-empty Bearer token, runs `SELECT * FROM pg_tables`, returns the rows. No insert. |
| `/legacy/*` | - | Returns 404. |

## Auth Flow (login)

1. Read `allow_login` from KV. Only the value `true` allows login.
2. Reject with 401 if login is disabled.
3. Read and parse the JSON body.
4. Validate that `username` and `password` are strings of at most 255 characters.
5. Query D1 `Users` by username.
6. Reject unknown, inactive or wrong-password accounts with `Credentials invalid.`
7. Verify the password with scrypt.
8. Create a session token, hash it with SHA-256 and insert it into `UserSessions` with a one-hour expiry.
9. Return the raw token once.

## Registration (current)

`/auth/register` only checks `allow_registration`:

- `true`: returns 200 with `{"auth":"ok"}`.
- anything else: returns 423 with a message that registration is disabled.

No body is parsed and no user is inserted.

## D1 Schema (`smart-system-identity`)

### Users

| Column | Type | Constraints |
|--------|------|-------------|
| `ID` | TEXT | PRIMARY KEY |
| `username` | TEXT | NOT NULL, UNIQUE |
| `password_hash` | TEXT | NOT NULL |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP |
| `is_active` | INTEGER | DEFAULT 1, CHECK(0,1) |

### UserSessions

| Column | Type | Constraints |
|--------|------|-------------|
| `ID` | TEXT | PRIMARY KEY |
| `user_id` | TEXT | FK to `Users(ID)`, ON DELETE CASCADE |
| `token_hash` | TEXT | NOT NULL, UNIQUE (SHA-256) |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP |
| `expires_at` | TEXT | NOT NULL |
| `is_revoked` | INTEGER | DEFAULT 0, CHECK(0,1) |

### GatewayCredentials

| Column | Type | Constraints |
|--------|------|-------------|
| `gateway_id` | TEXT | PRIMARY KEY |
| `owner_user_id` | TEXT | FK to `Users(ID)`, ON DELETE CASCADE |
| `token_hash` | TEXT | NOT NULL, UNIQUE (SHA-256) |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP |
| `last_seen_at` | TEXT | NULL |
| `is_active` | INTEGER | DEFAULT 1, CHECK(0,1) |

`GatewayCredentials.gateway_id` must match `gateways.id` in TiDB. The Worker validates this link. There is no SQL foreign key between D1 and TiDB.

## Token Format

```text
5bus_<prefix>_<64 hex chars>
```

- Prefix: `u` for a user session, `h` for a gateway.
- 32 random bytes (256 bits of entropy).
- Raw token returned once; only the SHA-256 hash is stored.
- This is an opaque session token, not a JWT.

## Password Hashing

The current code uses `@better-auth/utils/password`. On Workers, that library uses `node:crypto.scrypt` with:

| Parameter | Value |
|-----------|-------|
| `N` | 16384 |
| `r` | 16 |
| `p` | 1 |
| `dkLen` | 64 |
| Salt | 16 random bytes |
| Stored format | `<salt-hex>:<key-hex>` |

Argon2id is possible on Cloudflare Workers through WebAssembly, for example `hash-wasm`. The claim that Argon2id is unsupported on Workers is too broad. The current code uses scrypt because it is native to `node:crypto` and does not need a WASM layer.

Still required:

- Benchmark scrypt CPU time and memory against the Workers Free limits.
- Decide whether Argon2id via WASM is needed if scrypt is too expensive.
- Review the library's password comparison, which uses string equality rather than `timingSafeEqual`.

## Outstanding Work

- [ ] Handle the session token on protected endpoints.
- [ ] Implement JWT or session-token validation.
- [ ] Implement registration: parse the body, hash the password, insert the user.
- [ ] Validate gateway tokens against D1 `GatewayCredentials`.
- [ ] Insert sensor data into TiDB `measurements`.
- [ ] Enforce the unique `request_id` constraint in the insert path.
- [ ] Add Zod or equivalent request validation.
- [ ] Add rate limiting.
- [ ] Add structured logging and monitoring.
- [ ] Remove the legacy TiDB `users` table and `gateways.owner_user_id`.
- [ ] Make `/health` check database connectivity.

## Security

- **Passwords:** scrypt via `@better-auth/utils/password` (`node:crypto.scrypt`).
- **Tokens:** 256-bit entropy, SHA-256 hashed before storage.
- **Account enumeration:** generic `Credentials invalid.` error for unknown user, inactive account and wrong password.
- **Feature flags:** `/auth/login`, `/auth/register` and `/api/sensor-data` are gated by KV settings. `/health` is not gated.
- **Transport:** HTTPS enforced by Cloudflare for the Worker. Hyperdrive and TiDB use TLS. Pico W currently uses UDP without TLS.

## Environment Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `HYPERDRIVE` | Hyperdrive | TiDB connection pool |
| `smart_system_identity` | D1 | Identity store |
| `SETTINGS` | KV | Feature flags |

## Run

```bash
npm run dev    # wrangler dev on port 8080
npm run deploy # wrangler deploy
```

Local Hyperdrive development requires `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` or a `localConnectionString` in the Hyperdrive config.

---

*Docs reflect the current code. Unchecked items are not implemented.*
