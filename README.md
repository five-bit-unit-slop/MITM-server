# MITM Server

Cloudflare Worker (Node.js HTTP compat) acting as central MITM backend.

## Architecture

```
Pico W (WiFi)          DMZ Gateway (RPi)          Tkinter App
     │                        │                        │
     ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   Cloudflare Worker                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Hyperdrive │  │      D1     │  │       KV           │  │
│  │   (TiDB)     │  │ (Identity)  │  │  (Feature Flags)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

- **Hyperdrive** to TiDB Cloud (PostgreSQL) - sensor data, measurements
- **D1** (`smart_system_identity`) - users, sessions, gateway credentials
- **KV** (`SETTINGS`) - runtime feature flags (`allow_login`, `allow_registration`, `allow_sensor_receiving`)

## Routes

| Route | Method | Status |
|-------|--------|--------|
| `/auth/login` | POST | Implemented (incomplete) |
| `/auth/register` | POST | Stub only |
| `/auth` | GET | Returns 404 with guidance |
| `/api/sensor-data` | POST | Accepts data, inserts not implemented |
| `/health` | GET | Returns 200, DB check |

## Auth Flow (login)

1. Read `allow_login` from KV
2. Reject 401 if disabled
3. Read and parse JSON body
4. Query D1 for user by username
5. Verify password with `passverify()` (Argon2id, planned scrypt)
4. **Missing:** handle success, check `is_active`, create session, return token

## D1 Schema (`smart-system-identity`)

### Users
| Column | Type | Constraints |
|--------|------|-------------|
| ID | TEXT | PRIMARY KEY |
| Username | TEXT | NOT NULL, UNIQUE |
| Password_Hash | TEXT | NOT NULL (Argon2id, planned scrypt) |
| Created_At | TEXT | DEFAULT CURRENT_TIMESTAMP |
| Is_Active | INTEGER | DEFAULT 1, CHECK(0,1) |

### UserSessions
| Column | Type | Constraints |
|--------|------|-------------|
| ID | TEXT | PRIMARY KEY |
| User_ID | TEXT | FK to Users, CASCADE |
| Token_Hash | TEXT | NOT NULL, UNIQUE (SHA-256) |
| Created_At | TEXT | DEFAULT CURRENT_TIMESTAMP |
| Expires_At | TEXT | NOT NULL |
| Is_Revoked | INTEGER | DEFAULT 0, CHECK(0,1) |

### GatewayCredentials
| Column | Type | Constraints |
|--------|------|-------------|
| Gateway_ID | TEXT | PRIMARY KEY |
| Owner_User_ID | TEXT | FK to Users, CASCADE |
| Token_Hash | TEXT | NOT NULL, UNIQUE (SHA-256) |
| Created_At | TEXT | DEFAULT CURRENT_TIMESTAMP |
| Last_Seen_At | TEXT | NULL |
| Is_Active | INTEGER | DEFAULT 1, CHECK(0,1) |

## Token Format

```
5bus_<prefix>_<64 hex chars>
```

- Prefix: `u` (user) or `h` (hub/gateway)
- 32 random bytes (256 bits entropy)
- Raw token returned once; SHA-256 hash stored

## Outstanding Work

- [ ] Handle `passverify()` result (success branch empty)
- [ ] Input validation (username/password)
- [ ] Check `Users.Is_Active`
- [ ] Create session token, hash with SHA-256, store in `UserSessions`
- [ ] Return raw token to client
- [ ] Implement registration (hash password, insert user)
- [ ] Implement sensor data INSERT to TiDB
- [ ] Gateway auth via D1 `GatewayCredentials`

## Security

- **Passwords:** Argon2id (planned scrypt migration - native `node:crypto.scrypt`)
- **Tokens:** 256-bit entropy, SHA-256 hashed before storage
- **Account enumeration:** Generic "Credentials invalid" error
- **Feature flags:** All endpoints gated by KV settings
- **Transport:** HTTPS enforced by Cloudflare

### Planned: scrypt Migration

- Argon2id not supported in Cloudflare Workers `node:crypto`
- scrypt is OWASP fallback when Argon2id unavailable
- Parameters: N=16384, r=8, p=1 (~16 MiB, within 128 MB limit)
- Format: `scrypt$N$r$p$salt$key` (base64)
- Benchmark required: verify CPU fits 10 ms Workers Free limit

## Environment Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `HYPERDRIVE` | Hyperdrive | TiDB connection pool |
| `smart_system_identity` | D1 | Identity store |
| `SETTINGS` | KV | Feature flags |
| `KV` | KV | General purpose |

## Run

```bash
npm run dev    # wrangler dev on port 8080
npm run deploy # wrangler deploy
```
