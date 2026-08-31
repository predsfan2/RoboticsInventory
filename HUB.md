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
| `HUB_PAIRING_NETWORK` | `public_allowed` | `public_allowed` lets phones pair using only the public HTTPS URL. Set `private_only` to reject `POST /hub/v1/pair/start` from the public internet (Tailscale/LAN still work). |
| `HUB_ACCESS_TTL_SECONDS` | `900` | Access token lifetime (~15 minutes). |
| `HUB_REFRESH_TTL_SECONDS` | `2592000` | Refresh token lifetime (30 days). |

`app_id` is `robotics.inventory`.

Add the **public HTTPS URL** in Homelab Hub (Tailscale/LAN is optional). Discovery is `GET /hub/v1/hello` (no auth). An admin must still approve the pairing code.

If Homelab Hub shows `Expected start of the object '{', but had '<'` (HTML starting with `<!DOCTYPE html>`), Cloudflare Access is still in front of `/hub/v1` — see [Troubleshooting](#troubleshooting). That block happens *before* this app can allow public pairing.

## Pair a phone

1. On the phone, add this app with the **public HTTPS URL** (for example `https://inventory.example.com`). A Tailscale/LAN URL is optional.
2. Hub calls `/hub/v1/hello` then `/hub/v1/pair/start`.
3. The phone shows a code like `ABCD-EFGH`.
4. Sign in to this app as an **Admin** (or any user with `admin.users`) and open **Hub devices** (`/hub/pair`).
5. Enter or tap **Approve**. Optionally bind the device to another team user so Hub scopes match that person.
6. The phone polls `/hub/v1/pair/poll` and stores access + refresh tokens.

Anyone who can reach `/hub/v1` can *start* pairing. Tokens are issued only after an admin approves the code. Set `HUB_PAIRING_NETWORK=private_only` if you want `pair/start` limited to Tailscale (`100.64.0.0/10`), RFC1918 LAN, and localhost.

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

## Troubleshooting

### Homelab Hub: `Expected start of the object '{', but had '<'`

The phone called `GET /hub/v1/hello` and received **HTML**, not JSON. Homelab Hub then fails while parsing the body.

Confirm what the URL actually returns (do not follow redirects if you want to see an Access login):

```bash
curl -sS -D- -o /tmp/hub-hello.body "https://YOUR-HOST/hub/v1/hello"
head -c 80 /tmp/hub-hello.body; echo
```

A healthy origin starts with `{` and HTTP **200**:

```json
{"protocol":"hub/v1","app_id":"robotics.inventory", ...}
```

| Body starts with | Cause | What to do |
| --- | --- | --- |
| `<!DOCTYPE html>` and a Cloudflare Access / login page, or `302` to `*.cloudflareaccess.com` | Cloudflare Access is in front of `/hub/v1`. Hub `hello` must be unauthenticated. | Add a **more specific** Access application for `YOUR-HOST/hub/v1` with a **Bypass** policy (Include → Everyone). See below. Keep Access on the rest of the site. |
| The inventory SPA (`index.html`) | Production image was built before Hub was added, or `/hub/v1` is falling through to the SPA. | Pull latest, `docker compose up -d --build`, then re-check `curl` against the origin. |
| JSON `{ "error": { "code": "forbidden" } }` on `pair/start` | Pairing from a public IP while `HUB_PAIRING_NETWORK=private_only`. | Set `HUB_PAIRING_NETWORK=public_allowed` (the default) and redeploy, or pair over Tailscale/LAN. |

#### Cloudflare Access bypass for `/hub/v1`

Hub pairing and tokens are a **separate** device-auth system. Do not put Cloudflare Access login HTML in front of `/hub/v1`. Browser pages (`/`, `/hub/pair`, `/api` except health/login) can stay behind Access.

1. Zero Trust → **Access controls** → **Applications** → add a **self-hosted** app.
2. Public hostname = the inventory host (for example `robotics.example.com`), **Path** = `hub/v1` (covers `/hub/v1` and `/hub/v1/*`; more specific paths take precedence over a hostname-wide Access app — see [Application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)).
3. Policy **Action** = **Bypass**, Include **Everyone** ([Bypass policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/#bypass)). Bypass is evaluated before Allow/Block.
4. From a network that is **not** signed into Access, `curl -sS https://YOUR-HOST/hub/v1/hello` must return JSON, not a login page.

Until that Bypass exists, Homelab Hub on the public URL cannot pair — Access HTML is returned instead of JSON. After Bypass, `pair/start` from the public hostname works with the default `HUB_PAIRING_NETWORK=public_allowed`. Approve the code in the browser as usual (`/hub/pair` can stay behind Access).

### Rebuild after pulling Hub

```bash
git pull
docker compose up -d --build
```

