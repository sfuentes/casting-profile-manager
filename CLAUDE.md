# CLAUDE.md — working context for this repository

Casting profile manager: a React + Vite frontend, an Express + MongoDB backend,
deployed to a Hetzner server running Coolify. Actors keep one profile here and
push it out to German casting platforms.

This file records what was learned debugging the deployment and the platform
integrations, especially the things that are not visible from the code alone.

---

## Layout

```
backend/src/
  connectors/        platform integrations + the interface the app talks to  [PENDING, see PR #17]
  controllers/       route handlers
  models/            Mongoose schemas
  utils/logger.js    winston
frontend/src/
  context/AppContext.jsx     app-wide state, loads everything on auth
  services/apiService.js     every backend call
  components/PlatformsView.jsx
docker-compose.coolify.yml   the file Coolify deploys. NOT docker-compose.yml
```

`docker-compose.yml` and `docker-compose.dev.yml` are for local work only.

---

## Verification traps — read before trusting a check

**`node -e` runs as CommonJS and leaks `require` into `globalThis`.**
The backend is `"type": "module"`. Code containing `require(...)` will appear to
work under `node -e` and throw `ReferenceError: require is not defined` in
production. This masked a bug that made *every* platform adapter throw on
construction. Verify ESM behaviour from a real `.mjs` entry point:

```bash
cd backend && cat > check.mjs <<'EOF'
const m = await import('./src/whatever.js');
EOF
node check.mjs
```

**`docker compose config` does not validate what Coolify accepts.**
Compose parsed a quoted `${VAR:?message}` fine; Coolify's own schema layer
rejected it and refused to deploy. Passing `config` proves YAML and
interpolation only.

**Reaching a container from inside `coolify-proxy` does not prove Traefik can.**
Docker's embedded DNS answers with the address on the *shared* network. Traefik
reads container network settings from the Docker API and picks an address
itself. A `docker exec coolify-proxy wget …` success is not evidence of routing.

**Chromium is available locally** at `/opt/pw-browsers/chromium*/chrome-linux/chrome`.
Selector validity and scraper mechanics can be tested against fixture HTML
without reaching any real site.

**Outbound network is restricted.** GitHub, npm and PyPI resolve; everything
else, including the casting platforms and `coolify.io`, is blocked. Never claim
a live integration was tested.

---

## Deployment (Coolify on Hetzner)

Every one of these was a real outage. They are listed because each looks like
something else.

| Symptom | Cause |
|---|---|
| `UserNotFound … for db "admin"` | `MONGO_INITDB_ROOT_*` apply **only** to an empty `/data/db`. A `mongodb_data` volume from a failed deploy makes mongod skip init entirely — no root user, `mongo-init.js` never runs. Fix: delete the volume, redeploy. |
| `secrets additional properties … not allowed` | Coolify mis-parses a **quoted** `${VAR:?msg}` and registers the whole expression as a secret name. Keep `:?` lines unquoted and their messages free of colons. |
| Public 503 | Frontend health check used `localhost`; nginx binds IPv4 only (its entrypoint skips the IPv6 patch for a custom `default.conf`), so busybox wget hit `::1` and failed. Traefik drops unhealthy containers from the pool. Use `127.0.0.1` in container health checks. |
| Public 504 | A custom `casting-network` left each container on **two** networks. Traefik picked the one the proxy is not attached to and forwarded into a black hole. **Never declare custom networks in the Coolify compose file.** |
| `ValidationError: X-Forwarded-For … trust proxy` | Express sits behind Traefik. `trust proxy` is a hop **count** (1), never `true` — `true` trusts the client-supplied leftmost entry and lets anyone spoof an IP past the rate limiter. |
| Backend container logs empty | winston only added a Console transport outside production, so logs went to files inside the container. stdout is the log stream in a container. |

**503 vs 504 matters.** 503 = no server in Traefik's pool (health check).
504 = a server exists but did not answer (routing/network).

### Required environment variables

Set in the Coolify UI. All are required and fail the deploy if absent:
`MONGO_ROOT_PASSWORD`, `JWT_SECRET` (`openssl rand -hex 64`), `FRONTEND_URL`,
`VITE_API_URL`, and `CREDENTIAL_ENCRYPTION_KEY` (`openssl rand -hex 32`, PR #18).

`CREDENTIAL_ENCRYPTION_KEY` is **not recoverable**. Losing or changing it makes
every stored platform credential undecryptable.

`VITE_API_URL` is compiled into the frontend bundle at build time, so changing
domains forces a frontend rebuild.

Routing comes from `SERVICE_FQDN_FRONTEND_80` and `SERVICE_FQDN_BACKEND_5000`
in the compose file — Coolify magic variables that generate the domain and the
Traefik labels. `expose:` alone publishes nothing. TLS is Coolify's job; do not
add cert handling to the repo.

---

## Platform integrations

Nine platforms. Six have real integrations, three (ids 6–8) are agencies handled
by hand.

**Everything here was simulated at some point.** Four separate code paths
claimed success without contacting anything: `platformController` (endpoints the
UI calls), `platformAgent.js` on the backend, a 615-line copy of it on the
frontend, and a hard-coded platform list in the client. All are removed or made
real across PRs #16, #17 and #21. **If something reports success suspiciously
easily, check whether it is actually doing anything.**

The connector interface (PR #17) is the single entry point. Each connector
declares a manifest — `id`, `key`, `name`, `authType`, `credentialFields`,
`capabilities` — and the app reads that instead of knowing anything
platform-specific. No id is special-cased anywhere; capability checks and the
UI's connect form both derive from the manifest.

Errors are typed (`AuthError`, `RateLimitError`, `PlatformUnavailableError`,
`NotSupportedError`, `PlatformChangedError`) and carry `retryable`. Do not match
on message strings. `PlatformChangedError` means selectors rotted, which is
distinct from the site being down and is the failure to expect most often.

### Known broken, with evidence

- **Six selectors are invalid CSS.** `button:contains("Add")` is jQuery syntax;
  `querySelectorAll` throws `SyntaxError`. Confirmed in real Chromium. They sit
  in the availability paths of Filmmakers, CastingNetwork, JobWork and Wanted,
  and fail regardless of what the sites look like.
- **e-TALENTA and Schauspielervideos have zero selectors.** They are API
  adapters against APIs the project has no access to. They cannot work as
  written.
- **No connector has ever run against a live platform.** Deeper selectors
  (`.upload-success`, `textarea[name="biography"]`, `[data-action="add-availability"]`)
  are speculative. Login selectors are valid CSS and plausible; everything past
  login probably is not.

### Recommended next step

Not "fix all six blind". Add failure forensics to the connector base —
screenshot, HTML, final URL on every failure — plus a selector-validity test
running against local Chromium, then fix the six invalid selectors. That turns a
blind redeploy loop into one round trip. Then take **one** platform end to end
with real credentials on the server.

Scraping is an ongoing maintenance burden and likely breaches these platforms'
terms; the downside lands on users as suspended accounts. Worth confirming the
project owner accepts that before expanding it.

---

## Security

- Platform credentials are AES-256-GCM encrypted at rest (PR #18). They are
  encrypted rather than hashed because connectors replay them into a login form.
  Applied via Mongoose setters/getters, which works only because **no query
  uses `.lean()`** — adding one would silently return ciphertext.
- `toJSON` strips secrets and sends `hasPassword` / `hasApiKey` flags. The API
  used to return the password to the browser on every platform request.
- A development `JWT_SECRET` is still readable in git history (commits
  `0d5a3ef`, `ac683f3`, `67bbf3f`). Treat it as public; never reuse it.
- `.env` is gitignored in root, `backend/` and `frontend/`. It was not, which is
  how `backend/.env` came to be committed.
- A prior compose default made every deploy without `JWT_SECRET` sign tokens
  with a fixed string published in this repo. Compose does **not** evaluate
  `$(...)` — a "random" default is a literal.

---

## State

Merged through PR #20. The deployment works.

Open, stacked — merge in order: **#16 → #17 → #18 → #21**

| PR | Contents |
|---|---|
| #16 | connect/test/sync attempt real logins; `email`/`username` schema fix |
| #17 | connector abstraction; fixes the `require()`-in-ESM bug; −1797 lines |
| #18 | credential encryption at rest; API stops returning secrets |
| #21 | UI renders from manifests; OAuth removed everywhere |

`master` has moved on (#19, #20) since the stack was branched. If GitHub reports
a conflict on `docker-compose.coolify.yml`, rebase the stack onto `master`.

## Conventions

- Verify claims by running something, and say plainly what was **not** verified.
  Live platforms cannot be reached from this environment.
- Fix causes, not symptoms: every deployment failure above was one layer beneath
  where it appeared.
- Never reintroduce a code path that reports success without doing the work.
