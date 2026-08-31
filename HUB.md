# Homelab Hub (v1)

This app speaks **Hub Protocol v1** at `/hub/v1` so Homelab Hub on Android can drive inventory, purchases, borrows, approvals, and finance with a native UI (no WebView).

Browser login is unchanged. Hub uses a **separate device-pairing** system.

## URLs

Set these in the environment (docker-compose or `.env`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `HUB_PUBLIC_URL` | (derived from the request) | Public HTTPS origin, no trailing slash. Example: `https://inventory.example.com` |
| `HUB_TAILSCALE_URL` | — | Tailscale origin, used for `verification_uri` if public URL is unset. Example: `https://inventory.tail123.ts.net` |
| `HUB_JWT_SECRET` | `SESSION_SECRET` | Signs Hub access JWTs. Use a long random value in production. |
| `HUB_PAIRING_NETWORK` | `private_only` | `private_only` rejects `POST /hub/v1/pair/start` from the public internet. Set `public_allowed` only if you understand the risk. |
| `HUB_ACCESS_TTL_SECONDS` | `900` | Access token lifetime (~15 minutes). |
| `HUB_REFRESH_TTL_SECONDS` | `2592000` | Refresh token lifetime (30 days). |

`app_id` is `robotics.inventory`.

Add the **public URL and/or Tailscale URL** in Homelab Hub. Discovery is `GET /hub/v1/hello` (no auth).

## Pair a phone

1. On the phone, add this app by URL. Hub calls `/hub/v1/hello` then `/hub/v1/pair/start`.
2. The phone shows a code like `ABCD-EFGH`.
3. Sign in to this app as an **Admin** (or any user with `admin.users`) and open **Hub devices** (`/hub/pair`).
4. Enter or tap **Approve**. Optionally bind the device to another team user so Hub scopes match that person.
5. The phone polls `/hub/v1/pair/poll` and stores access + refresh tokens.

Pairing from a public IP is **blocked** unless `HUB_PAIRING_NETWORK=public_allowed`. Tailscale (`100.64.0.0/10`), RFC1918 LAN, and localhost are treated as private.

### Approve from curl (admin session)

```bash
# Browser JWT from /api/auth/login
curl -sS -X POST "$BASE/hub/v1/pair/approve" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"user_code":"ABCD-EFGH"}'
```

Revoke a device on the same page, or:

```bash
curl -sS -X POST "$BASE/hub/v1/admin/devices/dev_…/revoke" \
  -H "Authorization: Bearer $ADMIN_JWT"
```

## Scopes

Granted from the **bound user's** permissions at approve time:

| Scope | Meaning | App permission |
| --- | --- | --- |
| `read:inventory` | List/search items, item detail | `inventory.view` |
| `write:inventory` | Adjust stock, update condition | `inventory.edit` |
| `read:purchases` | Purchase list | `purchases.view` |
| `write:purchases` | Create purchase requests | `purchases.edit` |
| `read:borrows` | Active loans | `borrows.view` |
| `write:borrows` | Check out / return | `borrows.manage` |
| `read:approvals` | Pending moves & reimbursements | `approvals.manage` |
| `write:approvals` | Approve or deny | `approvals.manage` |
| `read:finance` | Balance and transactions | `finance.transactions.view` |
| `write:finance` | Add a transaction | `finance.transactions.edit` |
| `admin:devices` | List all Hub devices | `admin.users` |

The manifest is filtered so the phone only sees screens and actions it can use.

## Screens

Home (summary stats + pending approvals), Inventory (search + detail + stock/condition), Purchases, Borrows, Approvals, Finance.

Mutating actions require `idempotency_key`. Refresh tokens are stored hashed and rotated; reusing an old refresh **revokes the device**.
