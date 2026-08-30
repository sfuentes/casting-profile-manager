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
  connectors/        platform integrations + the interface the app talks to
  connectors/PlatformConnector.js   the interface every connector implements
  connectors/BrowserConnector.js    everything browser-driven, platform-agnostic
  connectors/<Name>Connector.js     one manifest + one `site` descriptor each
  connectors/profileNormalizer.js   platform words -> this app's vocabulary,
                                    and the questions it refuses to guess at
  connectors/forensics.js    screenshot/HTML/URL capture on every failure
  scripts/check-*.mjs        selectors, submits, normaliser, login pages
  scripts/recon-*.mjs        read a platform's pages before writing selectors
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

**A patch series can apply partially and commit clean.** The stack was
flattened onto `master` with **12 of its 47 files silently skipped**, and the
result was committed. `git status` was clean, the tree looked plausible, and the
backend could not start: `platformController.js` kept importing a `SyncService.js`
that the same commit deleted. After applying a diff, compare the files it touches
against the files the commit actually changed:

```bash
grep '^diff --git' the.diff | sed 's|diff --git a/||; s| b/.*||' | sort -u > /tmp/want
git show --name-only --format= HEAD | sort -u > /tmp/got
comm -23 /tmp/want /tmp/got     # anything printed here did not land
```

**Import every module before believing the app starts.** A missing file or a
missing named export is a link-time failure that nothing short of loading the
module reveals — no linter, no build, no `git status`:

```bash
cd backend && node -e '0' # NO. see the CommonJS trap above
# walk src/**/*.js and `await import()` each one from a .mjs entry point
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
| `CREDENTIAL_ENCRYPTION_KEY is missing or invalid` while the variable *is* set in Coolify | `Buffer.from(x, 'hex')` is lenient: it decodes up to the first non-hex character and returns the prefix, silently. A quoted value, a base64 key, `-hex 64` instead of `-hex 32`, or one typo all became the same message. The compose `:?` guard already rejects unset **and empty**, so if the app starts and logs this, the value arrived and is simply the wrong shape. The startup error now names the reason; `npm run check:encryption-key` inside the container reports presence, length, the position of the first non-hex character and a SHA-256 fingerprint — never the key. |
| Backend container logs empty | winston only added a Console transport outside production, so logs went to files inside the container. stdout is the log stream in a container. |

**503 vs 504 matters.** 503 = no server in Traefik's pool (health check).
504 = a server exists but did not answer (routing/network).

### Required environment variables

Set in the Coolify UI. All are required and fail the deploy if absent:
`MONGO_ROOT_PASSWORD`, `JWT_SECRET` (`openssl rand -hex 64`), `FRONTEND_URL`,
`VITE_API_URL`, and `CREDENTIAL_ENCRYPTION_KEY` (`openssl rand -hex 32`, PR #18).

`CREDENTIAL_ENCRYPTION_KEY` is **not recoverable**. Losing or changing it makes
every stored platform credential undecryptable. It must be exactly 64 hex
characters — no quotes, no whitespace, not base64. Coolify stores the value
verbatim, quotes included, so paste the bare output of `openssl rand -hex 32`.

`VITE_API_URL` is compiled into the frontend bundle at build time, so changing
domains forces a frontend rebuild.

Routing comes from `SERVICE_FQDN_FRONTEND_80` and `SERVICE_FQDN_BACKEND_5000`
in the compose file — Coolify magic variables that generate the domain and the
Traefik labels. `expose:` alone publishes nothing. TLS is Coolify's job; do not
add cert handling to the repo.

---

## Platform integrations

Thirteen platforms, two of them (ids 6–7) agencies kept by hand. The rest are
browser-driven and were, on 2026-08-30, verified against their live login pages
for the first time. **Nothing below is guessed: every URL and selector here was
read off the page it belongs to.**

### The shape

`BrowserConnector` holds everything that is not specific to one platform:
launching Chromium, declining consent banners, logging in, deciding whether the
login worked, reading and writing form fields, uploading media, tearing down,
typing errors. A connector declares a `static site` descriptor and overrides a
method only where its platform genuinely behaves differently.

    static site = {
      baseUrl, loginPath,
      login: { user, password, submitTexts, submitBy, failureUrls },
      paths: { profileEdit, media, availability },
      profileRead:  { pages: [{ path, fields: [{ field, selector, kind }] }] },
      profileFields: [{ field, selector, kind, transform, map }],
      mediaFields:   [{ selector, type }]
    };

Field kinds for reading: `value`, `selected`, `selectedList`, `nativeLanguage`,
`list`, `join` (with `separators`), `images`. For writing: `text`, `select`,
`radio`, `file`. Outbound conversions are named (`year`, `firstSegment`,
`digits`) and enum translation is a `map`, so a descriptor stays data.

Adding a platform is a manifest plus a descriptor. The four scraping connectors
used to carry a copy of the same eighty-line `authenticate()`; fixes were made
in one or two of them, never all four.

### What each platform is, and where its data comes from

| id | key | login | import source | verified |
|---|---|---|---|---|
| 1 | filmmakers | filmmakers.eu`/users/sign_in` | edit form + sedcard gallery | login, import, pictures |
| 2 | casting-network | app.castingnetworks.com`/login/` | — | login page only |
| 3 | schauspielervideos | — (API, no access) | — | no |
| 4 | e-talenta | etalenta.eu`/login/login` | — | login page only |
| 5 | jobwork | jobwork.com`/de/login` | GraphQL `profile` payload | login, import, media |
| 8 | sarah-weiss | online.castingagentur-weiss.de | — | login page only |
| 9 | wanted | online.agentur-wanted.de | — | login page only |
| 10 | filmpool | filmpool-casting.de`/users/sign_in` | — | login page only |
| 11 | ufa-base | ufa-base.de`/users/sign_in` | — | login page only |
| 12 | im-off | app.im-off.de`/login` | multi-page form, 7 picture slots | login, import, pictures |
| 13 | casting-network-de | casting-network.de`/login` | account page | login, import, push (dry run) |

Three platforms, three completely different import sources — which is why
"look at the page first" is not a slogan here:

- **Filmmakers** keeps the data in its edit form (`actor_profile[...]`), the
  pictures on the public sedcard, the vita under `?section=vita_entries`. The
  profile URL contains a slug that differs per user and is read from the header.
- **JobWork** has no readable form at all: `/settings` carries zero controls,
  editing happens in overlays, and the markup is generated utility classes. The
  app is fed by GraphQL at `api.jobwork.com/graphql`, so the connector reads the
  response the app itself receives. Values are option keys
  (`profileEyeColorBrown`), not labels.
- **IM OFF** is an ordinary multi-page form — but every control is addressed by
  `id`, because the inputs carry no `name` at all.

### Traps these platforms actually sprung

Each of these cost a debugging round and is now covered by a check:

- **A cookie banner in a shadow root.** JobWork's login sat behind Usercentrics.
  The fields underneath were fillable, the click on "Weiter" went into the
  overlay, and the failure read "could not be reached". Consent banners are now
  declined on every navigation — declined, never accepted.
- **A submit selector that matched 36 elements.** filmmakers.eu has one submit
  form per interface language in its header. `page.click` took the first:
  "English". Submits are scoped to the form owning the field just filled.
- **An icon button mistaken for the submit.** JobWork's login form holds a
  hidden `button[type=submit]`, a typeless icon button that reveals the
  password, and the "Weiter" button. "First visible" clicked the eye — no
  login, and the password rendered in clear into the forensics screenshot.
  Buttons with no label are never clicked.
- **`url.includes('/login')` as a success check.** Devise re-renders
  `/users/sign_in` on a rejected password, so every failed login was reported
  as a success. Compare against the URL actually navigated to.
- **A single-page app that never fires a navigation.** JobWork logs in fine and
  `waitForNavigation` times out; when it does resolve, the app may still be
  routing and the URL has not changed yet. `waitForLoginOutcome` waits for the
  URL to leave the login page.
- **A Radix radio group.** Casting Network's gender field is a
  `button[role=radio]` with an invisible input beside it. Setting `checked` on
  the input changed the DOM and nothing else. Radios are chosen via ARIA and
  **the write is verified afterwards**.
- **`page.select` does not throw** on a value the select does not offer. It
  selects nothing and returns an empty array, which used to be reported as a
  successful write.

### Import, and what it must never do

`GET /api/platforms/:id/profile` reads and returns; it writes nothing.
`POST /api/platforms/:id/profile/apply` writes the fields the user ticked,
taking the values from the import's SyncLog rather than the request body.

Everything imported passes `profileNormalizer.js`, which turns a platform's
words into this app's vocabulary — and **asks rather than guesses**. A value it
cannot map (an eye colour nobody has seen, an unparseable date) comes back as a
question with the allowed options; the import dialog renders those as
dropdowns. `applyResolutions` accepts only an offered value or `__keep__`.

Media is normalised the same way: duplicates dropped, categories mapped into
the schema's enums, exactly one primary picture, an avatar that is not a URL
discarded. Only references are stored — a picture stays on the platform hosting
it.

### Uploads into the platforms

Pictures are the user's own, given to these platforms by them; keeping the
platforms in step is what this app is for. `pushMedia` fetches a picture
**through the logged-in page** (a server-side fetch gets the sign-in form
instead), uploads it, and deletes the temporary file.

**Only IM OFF has usable upload slots so far** — seven named `input[type=file]`.
The others hide their uploader behind a click and were not reachable in the
time available:

- Filmmakers: a "Medien verwalten" button, target unseen
- JobWork: a "Medien Manager" at `/media`, an Uploadcare widget, no plain input
- Casting Network (DE): a "Medien" step of the profile wizard

**Nothing has ever been uploaded to any platform.** Every push was a dry run.

### Dry runs

`pushProfile(profile, { dryRun: true })` and `pushMedia(profile, { dryRun: true })`
fill in or plan, photograph the page into `forensics/`, and submit nothing. On
these platforms "save" can mean publishing a public profile, so this is the only
honest way to check a push. It has already earned itself twice: it caught the
Radix radio that was not really set, and a format check that was asking an
upload control what it accepts before the page holding that control was open.

Filmmakers serves AVIF, IM OFF accepts image/jpeg only — a picture sync between
those two needs conversion, which means an image library and re-encoding
someone's photographs. **That is a decision, not a workaround to slip in.**

### Checks

    npm run check:connectors     selectors, text selectors, submit, normaliser
    npm run check:login-pages    every login page, live, no credentials
    npm run check:encryption-key inside the container
    node check-imports.mjs       every backend module loads

`check-selectors.mjs` reads selectors out of the source — including descriptor
keys (`selector:`, `user:`, `password:`) — and hands them to a real Chromium. It
strips comments first: an apostrophe in prose used to look like a string start,
and the scanner then silently skipped every selector below it.

`check-login-pages.mjs` is the one that would have caught four wrong hosts at
once. It needs internet and is deliberately not part of `check:connectors`.

### Reconnaissance, before writing anything

    node scripts/recon-login.mjs <url>        find and read a login form
    node scripts/recon-profile.mjs <key>      log in, follow the profile links

`recon-profile` uses the credentials already stored — it never asks for a
password, and it saves pages to a temp directory outside the repository,
because they are the account holder's personal data.

**Ask for a platform's URL rather than probing paths.** `/login` on Filmmakers
is a 404; `wanted.de` does not resolve; `jobwork.de` has no working certificate
and only redirects to `.com`; `home.castingnetworks.com` is a marketing site.
All four were guesses that survived for months.

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

`master` carries all of it: the connector abstraction, credential encryption,
forensics, the descriptor refactor, thirteen platforms, the importers for
Filmmakers, JobWork, IM OFF and Casting Network (DE), media import with
normalisation, and the dry runs.

**Three merges into `master` have silently resolved to the wrong side.** The
flatten commit (`493b5fc`) dropped 12 of its own 47 files; the merge after it
(`ec4cbe3`) resolved two files to the wrong side; and PR #28 spliced *both*
versions of four connector files into each other, leaving 25 of 60 modules with
syntax errors. Every time, `git status` was clean and the backend could not
start.

**After every merge into `master`, run this. It takes two seconds and would
have caught all three:**

    cd backend && node check-imports.mjs

### What is not done

- **Uploads into Filmmakers, JobWork and Casting Network (DE).** Their
  uploaders sit behind a click that was not followed.
- **Nothing has been pushed to any platform.** Every push is dry-run only.
- **AVIF → JPEG conversion** for picture syncs between platforms that disagree
  on format.
- **Writing back the profile** to JobWork and IM OFF: each page saves through
  its own button and nobody has watched what that does.
- **Casting Network (DE)'s actor profile does not exist yet** for this account;
  the page says "Schauspielprofil anlegen". The import reads the account page
  instead, and the descriptor for the profile page is deliberately absent until
  there is a filled one to check it against.
- **schauspielervideos (id 3)** is still an API adapter for an API nobody has
  access to. e-TALENTA was converted to its web login; this one was not.

### Credentials

Platform passwords are entered **by the user, in the app**. Never type one into
a form, never accept one pasted into the chat, never write one into a file.
Scripts read them through the Mongoose getters, which decrypt them, so the
plaintext is never handled directly.

## Conventions

- Verify claims by running something, and say plainly what was **not** verified.
  Live platforms cannot be reached from this environment.
- Fix causes, not symptoms: every deployment failure above was one layer beneath
  where it appeared.
- Never reintroduce a code path that reports success without doing the work.
- **Look at the page before writing a selector.** Every wrong URL in this
  project's history was a plausible guess: /login, wanted.de, jobwork.de,
  home.castingnetworks.com. Ask for the address rather than probing paths.
- **Disbelieve a number that looks small.** "One picture" from a page showing
  seven, "no video" from a profile holding one - both were real bugs found by
  not accepting the first plausible result.
- **A dry run before anything is published.** On these platforms "save" can
  create a public profile.
- **Declare only capabilities that have been established.** A connector whose
  profile pages nobody has seen gets `capabilities: ['verify']`; anything more
  puts a button in the UI that can only fail.
