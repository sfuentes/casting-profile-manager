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

**`npm run build` is not a check that the frontend works.** Vite compiles each
module without resolving names across them, so an identifier that is referenced
but no longer defined builds cleanly and throws `X is not defined` in the
browser on first render. That is exactly how `disconnectPlatform` was deleted
out of `AppContext.jsx` while still being exported and called: the build passed,
and the app broke on the platforms page. `cd frontend && npm run lint` reports
it as `no-undef` in a second. Run it for any frontend change - the build is a
compile, the lint is the check.

Beware of editing by replacing everything between two anchors, which is how that
deletion happened: two other functions sat between them and went with it. After
such an edit, compare what the file defines before and after:

```bash
diff <(git show HEAD:path/to/File.jsx | grep -oE "const [a-zA-Z]+ = ")      <(grep -oE "const [a-zA-Z]+ = " path/to/File.jsx)
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

Fourteen platforms, three of them (ids 6–7, 14) kept by hand. The rest are
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
| 10 | filmpool | filmpool-casting.de`/users/sign_in` | — | login (logged in 2026-08-31) |
| 11 | ufa-base | ufa-base.de`/users/sign_in` | — | login (logged in 2026-08-31) |
| 12 | im-off | app.im-off.de`/login` | multi-page form, 7 picture slots | login, import, pictures |
| 13 | casting-network-de | casting-network.de`/login` | account page | login, import, push (dry run) |
| 14 | backstage | Google OAuth — not automated | — | see below |

Three platforms, three completely different import sources — which is why
"look at the page first" is not a slogan here:

- **Filmmakers** keeps the data in its edit form (`actor_profile[...]`), the
  pictures on the public sedcard, the vita under `?section=vita_entries`. The
  profile URL contains a slug that differs per user and is read from the header.
- **JobWork** is read through GraphQL at `api.jobwork.com/graphql`: `/settings`
  carries zero controls and the markup is generated utility classes, so the
  connector reads the response the app itself receives. Values are option keys
  (`profileEyeColorBrown`), not labels. **Writing is a different story than this
  file used to tell.** Each profile section has a pencil that routes to
  `/@<handle>/edit/<section>` - a real editor page, reachable by direct
  navigation too. `/edit/experiences` opens a drawer with named inputs
  (`meta.profileExperience*.value`), the same vocabulary the import already
  reads. See "Credits" below.
- **IM OFF** is an ordinary multi-page form — but every control is addressed by
  `id`, because the inputs carry no `name` at all.

### Backstage (id 14): recorded, not automated

Two independent reasons, either enough on its own.

**The sign-in is Google OAuth.** Driving it means typing the account holder's
Google password into a Google form. That is not a platform credential like the
others here: it is the key to their identity and their mail. This app encrypts
platform passwords because connectors replay them into a login form - a Google
password is not something to take custody of on those terms, and Google treats
automated sign-in as a compromise and locks the account.

**The site is behind Cloudflare.** Checked 2026-08-31: the first request to
www.backstage.com answered 200, everything after it 403 "Sorry, you have been
blocked", and a fresh browser was blocked on its first page load. The login page
could not be read at all. Working around a bot check is not something this
project does, and the account that gets suspended for it is the user's.

So there is **no `site` descriptor with a login path** - no login page has been
seen. The nine paths a first attempt tried all answered 403, which says nothing
about whether any of them exist. `capabilities: []`, and every sync path refuses
it by name.

If it is ever wanted for real, the only honest route is a session the user
establishes themselves in their own browser - and Cloudflare blocks unattended
requests on fingerprint, not just on authentication, so that would likely fail
too. It is a decision, not a workaround to slip in.

**A platform that is recorded is not a platform that was verified.** `verify()`
returns `ok: true, verified: false`, and the platform list now renders three
outcomes rather than two: green "Test OK" only when something was actually
logged into, grey "Nicht prüfbar" for the ones kept by hand, red for a real
failure. A green badge for Backstage would claim a login that never happened.

### Traps these platforms actually sprung

Each of these cost a debugging round and is now covered by a check:

- **A cookie banner with nothing to decline.** filmpool and UFA Base (the same
  white-label system) put one button - "OK - verstanden" - over a notice saying
  only *necessary* cookies are set. No reject, no settings, no accept-all. The
  banner declining was built around found nothing to click and left the overlay
  covering the login form, so **neither platform could be logged into at all** -
  and the two failures looked completely different: filmpool never reached its
  submit and reported "still on the login page", UFA's click on Einloggen was
  swallowed and came back as "Node is either not clickable". One cause, two
  symptoms. The rule now runs in order: decline if there is anything to decline;
  if a choice is offered and cannot be declined, **click nothing** and log it,
  because consenting is not this code's to give; only a notice that asks nothing
  is dismissed. `check:consent` pins all three against real Chromium.
- **A submit that posts the form somewhere else.** Both sites put "Sende mir
  einen Login-Link" in the login form as a second `button[type=submit]`,
  distinguished only by `formaction="/passwordless/users/sign_in"`. Clicking it
  mails the account holder a link instead of logging in. That attribute is now
  what separates them - structural, not a label to recognise.
- **`submitBy: 'text'` escaped the form.** It was added to avoid the login-link
  button, and did it by skipping the form-scoped search and matching by label
  across the whole page. UFA Base's header carries two `<a>Einloggen</a>`
  navigation links, one of them hidden, so the click landed on a link: "Node is
  either not clickable". It now means what it was meant to mean - the labels
  decide *within* the form - and the page-wide search is only the last resort.
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

### Credits, and matching them across platforms

Every platform keeps the same career in its own words. `connectors/workHistory.js`
answers one question for all of them: given what we hold and what a platform
holds, which credits does that platform not have? Identity is production plus
role plus year, canonicalised for case, dashes and punctuation - and a field
that only one side records is not evidence of a different credit, so a missing
role or year widens the match rather than splitting it.

Both halves of that rule were paid for. This account has **"GZSZ" twice in one
year** with two different roles - two jobs, so production alone cannot identify
a credit. And the first real run matched **0 of 23 against 10**, because
Filmmakers records no role at all in its own field: it prints the role, the
part size, the director and the broadcaster into one block of prose
(`Bösewicht, Jochen Bauer (ENR) Axel Hannemann Sender: Sat 1`), and puts the
format and the production status into the title (`... (Serie)`,
`... (AT) (Spielfilm) In Entwicklung`). `parseVitaBody` and
`cleanProductionTitle` pull those apart - in the Filmmakers connector, because
they are Filmmakers' habits and the cross-platform matcher must not learn one
site's layout. The raw text stays on `title` and `description`. That took the
run from 0 shared to 5.

What is left over is real disagreement between the two sites, not a matching
bug: `Jefferey Bernard` against `Jeffrey Bernard`, `Berlin Tag und Nacht - 2985`
against `Berlin Tag und Nacht`, the same job billed as `Bösewicht, Jochen Bauer`
on one site and `Jochen Bach` on the other. **Those are not guessed at — they
are asked.** An episode number might be the difference between two jobs, and
merging them would delete one from a CV silently; adding them would duplicate a
credit on a public profile that someone then has to go and delete by hand.

`reconcileWorkHistory` therefore splits the answer in three: credits that are
certainly missing, credits the platform certainly has, and credits that
resemble one already there. The third kind is neither pushed nor dropped. It
comes back as a question carrying the credit, the candidates it might be, and
why it is being asked - the same contract `profileNormalizer` uses for values it
cannot map, down to "no answer means no action". `POST /api/sync/work-history/:id`
returns them (on the envelope, beside `data`), the platform list renders them in
a "Vita-Abgleich" dialog, and a second call carries the answers back in
`resolutions`. Only an answer that was offered counts.

On the real accounts this is not a corner case: **all five** credits Filmmakers
had and JobWork appeared to lack turned out to be uncertain, and none of them is
written without someone saying so.

`pushWorkHistory` adds only what is missing or answered, never edits and never
deletes.

### Where each value came from

Every imported value is marked with the platform it was read from, and the mark
survives into the profile.

A connector reports the place inside its own site - `graphql:profileAbout`,
`edit?section=vita_entries` - which says nothing about *which* site that was.
`ConnectorService.importProfile` stamps the platform on, because that is the
layer that knows it, so a source is `{ platform, platformName, location,
readAt }` rather than a bare string. `applyImportedProfile` then writes
`Profile.provenance[field] = { platform, platformName, location, importedAt }`.
Before this, applying an import threw the origin away: the profile became a pile
of values with no way to tell what the actor typed from what a scraper read off
a casting site.

A field with **no** provenance entry was the actor's own. That absence renders
as nothing rather than "unknown" - silence means "yours".

Credits carry it too. `mergeWorkHistory` accepts
`[{ platform, platformName, credits }]` and records `platforms: [...]` on each
merged credit, so a merged list still says who has a credit and who is missing
it. A reconciliation question names both sides - which platform our entry came
from, and which platform the candidate is already on - because a question
showing two spellings without saying where each lives cannot be answered.

The UI shows it: `Quelle: JobWork · graphql:profileAbout` in the import dialog,
`Übernommen von Filmmakers am 31.8.2026` under the profile field, and
`Derselbe Credit wie auf JobWork: ...` in the Vita dialog.

### Import, and what it must never do

`POST /api/sync/media/:id` sends the **profile**, not a single media item: the
connector holds the slots and is the only party that can see what each accepts.
It used to answer 501 with a TODO to fetch media from the database - there was
nothing to fetch, since only references are stored and the picture is fetched
through the logged-in page at upload time. A connector with no `mediaFields` is
refused in `ConnectorService.syncMedia` with a sentence saying its uploader has
not been read, rather than being handed a profile its older per-item `pushMedia`
would crash on. That refusal lifts by itself once slots are declared.

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

A slot says what it takes. `kind: 'video'` draws from the profile's videos
(and the showreel, merged on the URL so the same reel is not offered twice)
instead of the setcard; `write: 'url'` writes the address into a link field
rather than downloading and uploading a file, which is how these portals
usually take a showreel. A slot with neither is a picture slot uploaded as a
file, which is what every descriptor written before videos existed meant.
`check:media-plan` covers the plan: one file per slot, no file in two slots, an
AVIF refused by a slot that accepts image/jpeg.

**Only IM OFF has usable upload slots so far** — seven named `input[type=file]`.
The others hide their uploader behind a click and were not reachable in the
time available:

- Filmmakers: a "Medien verwalten" button, target unseen
- JobWork: a "Medien Manager" at `/media`, an Uploadcare widget, no plain input
- Casting Network (DE): a "Medien" step of the profile wizard

**Nothing has ever been uploaded to any platform.** Every push was a dry run.

### The calendar: only block times

A platform learns that a period is not bookable, and nothing else. Not the
reason, not the production, not whether it is a firm booking or a tentative
option, and not the actor's notes. `connectors/blockedPeriods.js` reduces the
Availability entries to `{start, end}` pairs and the reduction happens in
`ConnectorService.syncAvailability` - the one place every platform passes
through, so a connector cannot leak what it was never handed, and a connector
added later inherits the rule without knowing it exists.

Merging is part of the rule, not tidying. Five separate blocks in a month say
"five separate jobs"; one merged block says "not available", which is the only
question a casting platform needs answered. Blocks less than a day apart merge,
periods entirely in the past are dropped, and `partially_available` counts as
blocked - a day the actor cannot freely take is not advertised as free.

This mattered: all four connectors that push availability write `item.notes`
into a notes field and `item.status` into a status select, and one of them maps
a status to `gebucht`. Their code is untouched; nothing reaches those fields any
more. `check:availability-forms` runs each of those fillers against real
Chromium and reads the page back - and runs them once with a raw entry too, so
a green result means the reduction works rather than the fixture being empty.

### Dry runs

`pushProfile(profile, { dryRun: true })` and `pushMedia(profile, { dryRun: true })`
fill in or plan, photograph the page into `forensics/`, and submit nothing.

`ConnectorService.#run` used to pass a single argument to the connector, so the
options never arrived and a dry run could not be asked for at all. It forwards
them now - but **only to the service, never from the HTTP layer**. A dry run is
a verification tool for scripts and checks, not a feature of the app: a sync
route exists to sync, and a client able to request a dry run could record one as
though the platform had been updated. `syncController` deliberately does not
read `dryRun` off the request.

When one does run, it is recorded on the SyncLog as `dryRun`, counts zero items
processed, and does **not** move `platform.lastSync` - it wrote nothing, and
must not read as a sync afterwards. `getPlatformStatus` skips dry runs for the
same reason. On
these platforms "save" can mean publishing a public profile, so this is the only
honest way to check a push. It has already earned itself twice: it caught the
Radix radio that was not really set, and a format check that was asking an
upload control what it accepts before the page holding that control was open.

Filmmakers serves AVIF, IM OFF accepts image/jpeg only — a picture sync between
those two needs conversion, which means an image library and re-encoding
someone's photographs. **That is a decision, not a workaround to slip in.**

### Testing a login that does not work yet

The Test button was reachable only from the connected list, and a platform is
connected only after a login has succeeded. So the one situation a connection
test exists for - the login does not work and nobody knows why - was the one
situation it could not be used in.

The credentials were never the problem: `connectPlatform` saves them and *then*
verifies, so a rejected login still leaves them stored. Three things above that
threw the fact away. The endpoint answers 400, and `handleResponse` throws on
any non-2xx, discarding the message, the final URL and the saved record with it.
The context caught that and rolled its state back, so the platform vanished from
the list. And the card for a platform that is not connected offered only
"Verbinden", which meant typing the password again to find out anything.

Now: a rejected login is an outcome rather than an exception (the same wording
`ConnectorService.verify` already used for the same reason), the saved record is
kept, the dialog stays open with the reason and the final URL, and a platform
holding credentials offers **Test** on its card whether or not it is connected.
`toJSON` already sent `hasPassword` / `hasApiKey` for exactly this - the client
can tell that a retry is possible without ever seeing the secret. A test that
succeeds carries `connected` back, so the card moves to the connected list by
itself.

### Diagnosing a failed login on the server

`AuthError` says "the credentials were rejected, or the login form changed",
and it says so deliberately: from inside `authenticate()` the two are
indistinguishable. What tells them apart is **the URL the browser ended on**,
which is why forensics exist.

`ConnectorService.verify` used to take that capture and throw the return value
away. Locally that was survivable - the screenshot is in `backend/forensics/`.
On the server it was not: the capture went into a container filesystem nobody
can reach and the next deploy wipes, so a failed login in production reported a
sentence and nothing else. The summary is now carried out of `verify`, stored on
`platform.testResult` (`url`, `title`, `errorType`), returned on the envelope as
`finalUrl`, and shown on the badge. The screenshot stays where it is - it is the
account holder's page and does not belong in a database.

**What to read first, in order:** the final URL, then the backend container log
for that request. The connector logs each step it takes - which consent banner
it declined or dismissed, that it loaded the login page, that it entered
credentials - so the log says how far it got. Local success and production
failure with the same credentials usually means one of: a different
`CREDENTIAL_ENCRYPTION_KEY` than the one the credentials were saved with (the
stored password then decrypts to something else and is genuinely rejected -
`npm run check:encryption-key` inside the container reports a fingerprint
without revealing the key), a consent banner that differs by IP or region, or
the platform treating a datacenter address differently from a home one.

### The API envelope, and the field that keeps getting lost

`handleResponse` in `apiService.js` unwraps `{ success, data }` and returns
`data`. Anything an endpoint puts **beside** `data` is thrown away unless the
caller passes `unwrap: false`.

This has now bitten twice, both times as a UI that confidently reported the
opposite of the truth. `/agent/health` carries status, message and timestamp on
the envelope: the UI showed a permanent red "Agent: Unbekannt" with "Letzte
Prüfung: Invalid Date" while the backend reported healthy. `/platforms/:id/test`
carries `success`, `verified` and `message` on the envelope: `result.success`
was always `undefined`, so **a login that actually succeeded was shown as "Test
fehlgeschlagen"**, and "Letzter Test" read "Nie" straight after a test.

Both are fixed. When adding an endpoint, either put everything the client reads
inside `data`, or use `unwrap: false` and say why. The import endpoint gets this
right - `fields` and `unmapped` live inside `data`, and only `message` sits
outside, which nothing reads.

### Checks

    npm run check:connectors     selectors, text selectors, submit, normaliser,
                                 block times, availability forms, media plan,
                                 credit matching, manifests vs the schema,
                                 consent banners
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

### The registry and the schema have to agree

`Platform.authType` allowed `['oauth', 'credentials', 'api']` while the registry
produced five values. Three of its own manifests therefore could not be stored:
schauspielervideos declares `apiKey`, and the two manual agencies declare
`manual`. Nothing said so - it surfaced only when something tried to write one.

Two paths ran into it. `npm run add-platforms` builds a user's platform list
*from the registry*, so it threw on the platforms it existed to create. And
connecting a platform the user has no row for takes `name` and `authType` from
the manifest, so connecting any manual platform failed validation.

The enum was widened rather than the manifests renamed: the registry is the
source of truth, and the client already reads its vocabulary - `PlatformsView`
tests for `'manual'` and `'apiKey'` by name. `'api'` stays because seeded rows
use it. `check:manifests` now walks the registry and validates each manifest
against the real schema, so the two cannot drift apart again quietly.

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
- **Writing back the profile** to JobWork and IM OFF beyond credits. JobWork's
  editors are now known to be real routed pages; only `/edit/experiences` has
  been driven. `/edit/about`, `/edit/basedata`, `/edit/skills`, `/edit/education`
  and `/edit/awards` are the same shape and nobody has opened them.
- **Nothing has been submitted to JobWork.** The credits push is verified only
  as a dry run: it filled the drawer, photographed it and pressed Abbrechen.
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
