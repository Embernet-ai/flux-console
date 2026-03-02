# Flux Console — Fork & Rebrand Action Plan

> **Upstream:** [`openziti/ziti-console`](https://github.com/openziti/ziti-console) (ZAC — Ziti Administration Console)
> **Our Fork:** [`embernet-ai/flux-console`](https://github.com/Embernet-ai/flux-console)
> **Tech Stack:** Angular 20 monorepo, Node.js ≥18, npm ≥8.1, SCSS, TypeScript
> **Build Output:** Static SPA in `./dist/app-ziti-console`
> **Deployment Target:** Embedded in the Embernet Dashboard at `/static/vendor/flux-console/`
> **Auth:** Dashboard overlay proxy (session managed by dashboard backend, NOT standalone Ziti auth)
> **UPG Ticket:** UPG-043
> **Last Updated:** 2026-03-02

---

## Cross-Repo Status

This rebrand is part of a larger Flux/Embernet white-label effort across multiple repos. Here's where each stands:

| Repo | Status | Version | Notes |
|------|--------|---------|-------|
| [`embernet-ai/flux-core`](https://github.com/Embernet-ai/flux-core) | ✅ **Complete** (33/33) | v2.0.2 | CLI = `flux`, Docker images at `ghcr.io/embernet-ai/flux-*`, all docs rebranded. Go module path intentionally kept as `github.com/openziti/ziti`. |
| [`embernet-ai/flux-helm-charts`](https://github.com/Embernet-ai/flux-helm-charts) | ✅ **~95% Complete** (86/106) | Charts v2.0.x | All 4 charts rebranded (`flux-controller`, `flux-router`, `flux-edge-tunnel`, `flux-l2-bridge`). Remaining `ZITI_*` env vars are protocol-level (upstream binary interface). Blocked on production controller deployment. |
| [`embernet-ai/flux-console`](https://github.com/Embernet-ai/flux-console) | 🟡 **Phase 4 Done** (30/54) | — | Forked, cloned, Angular projects renamed, visual rebrand complete (placeholder assets — replace with final artwork), string rebrand complete. This document tracks all remaining work. |
| [`embernet-ai/industrial-dashboard`](https://github.com/Embernet-ai/industrial-dashboard) | ✅ **Phase 8 Mostly Done** | v3.9.91 | Placeholder SPA, admin card, `/api/flux/mgmt/*` proxy route, Flux SDK integration all built. Waiting on this repo's SPA build. |

---

## Upstream Repo Structure

```
openziti/ziti-console/
├── .github/                          # CI/CD workflows (GitHub Actions)
├── docker-images/                    # Dockerfile for containerized builds
├── linux-packages/openziti-console/  # Linux packaging (deb/rpm)
├── projects/
│   ├── ziti-console-lib/             # Shared Angular library (components, services, assets)
│   │   └── src/lib/
│   │       ├── assets/               # Images, banners, icons (ZAC branding lives here)
│   │       ├── services/             # API client services (talks to Ziti Edge Management API)
│   │       └── ...                   # Angular modules, components
│   └── app-ziti-console/             # The console SPA (imports ziti-console-lib)
│       └── src/
│           ├── app/                  # Angular app module, routing
│           ├── assets/               # App-level static assets
│           ├── environments/         # Angular environment configs
│           └── index.html            # SPA entry point
├── angular.json                      # Angular workspace config (project names, build targets)
├── package.json                      # Dependencies, scripts, version
├── tsconfig.json                     # TypeScript config
├── server.js                         # Node.js dev server (deprecated for production)
├── server-edge.js                    # Edge server variant
├── build.sh                          # Build script
├── run-zac.sh                        # Docker entrypoint
├── version.js                        # Version file
├── README.md
├── CHANGELOG.md
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── LICENSE / LICENSE.md
├── SECURITY.md
└── RELEASE.md
```

**Two Angular projects in the monorepo:**

| Project | Path | Purpose |
|---------|------|---------|
| `ziti-console-lib` | `projects/ziti-console-lib/` | Shared Angular library — components, services, API clients, shared assets |
| `app-ziti-console` | `projects/app-ziti-console/` | The SPA that imports the lib. This is what gets built and deployed. |

---

## Phase 1 — Fork & Initial Setup

| # | Task | Details | Status |
|---|------|---------|--------|
| 1 | **Fork on GitHub** | `openziti/ziti-console` → `embernet-ai/flux-console`. Use GitHub's fork button. | ✅ Done |
| 2 | **Clone locally** | `git clone git@github.com:embernet-ai/flux-console.git && cd flux-console` | ✅ Done |
| 3 | ~~**Add upstream remote**~~ | Dropped from upstream sync — not needed. | ✅ N/A |
| 4 | ~~**Create `release-v1` branch**~~ | Working directly on `main`. | ✅ N/A |
| 5 | ~~**Verify build works unmodified**~~ | Skipped — proceeding directly to rebrand. | ✅ N/A |

---

## Phase 2 — Rename Angular Projects

The Angular workspace has two projects named `ziti-console-lib` and `app-ziti-console`. Rename them to `flux-console-lib` and `flux-console`.

| # | Task | File(s) | Details | Status |
|---|------|---------|---------|--------|
| 6 | **Rename in `angular.json`** | `angular.json` | Find/replace project names: `ziti-console-lib` → `flux-console-lib`, `app-ziti-console` → `flux-console`. Update `sourceRoot`, `outputPath`, `assets` paths. | ✅ Done |
| 7 | **Rename in `package.json`** | `package.json` | Change `"name"` to `flux-console`. Update the lib file reference: `"ziti-console-lib": "file:dist/ziti-console-lib"` → `"flux-console-lib": "file:dist/flux-console-lib"` | ✅ Done |
| 8 | **Rename in `tsconfig.json`** | `tsconfig.json` | Update path mappings from `ziti-console-lib` → `flux-console-lib` | ✅ Done |
| 9 | **Rename project directories** | Filesystem | `git mv projects/ziti-console-lib projects/flux-console-lib` and `git mv projects/app-ziti-console projects/flux-console` | ✅ Done |
| 10 | **Update internal imports** | `projects/**/*.ts` | Global find/replace in all TypeScript files: `from 'ziti-console-lib'` → `from 'flux-console-lib'`, `from "ziti-console-lib"` → `from "flux-console-lib"` | ✅ Done |
| 11 | **Rename lib `package.json`** | `projects/flux-console-lib/package.json` | Change `"name"` from `ziti-console-lib` to `@embernet-ai/flux-console-lib` (or `flux-console-lib`) | ✅ Done |
| 12 | **Rename lib `ng-package.json`** | `projects/flux-console-lib/ng-package.json` | Update `dest` path if it references old name | ✅ Done |
| 13 | **Update `build.sh`** | `build.sh` | Replace `ziti-console-lib` → `flux-console-lib`, `ziti-console` → `flux-console` in build commands | ✅ Done |
| 14 | **Update `publishSharedLib.sh`** | `publishSharedLib.sh` | Replace lib name references | ✅ Done |
| 15 | **Verify build** | Terminal | `npm install && ng build flux-console-lib && ng build flux-console` — must produce `dist/flux-console/` | ⬜ Blocked (Node.js not installed) |

---

## Phase 3 — Visual Rebrand (Assets & Theming)

This is the user-facing rebrand. Every screen the admin sees should say "Flux" with Embernet branding.

| # | Task | File(s) | Details | Status |
|---|------|---------|---------|--------|
| 16 | **Replace banner/logo images** | `projects/flux-console-lib/src/lib/assets/banners/` | Replace `ZAC.jpg` and any OpenZiti banners with Flux/Embernet branded versions. Use `⚡` bolt motif consistent with dashboard. | ✅ Done (SVG placeholders — replace with final artwork) |
| 17 | **Replace favicon** | `projects/flux-console/src/` | Replace `favicon.ico` with Embernet/Flux icon | ✅ Placeholder (needs binary ICO/PNG files) |
| 18 | **Update `index.html` title** | `projects/flux-console/src/index.html` | `<title>Flux Console</title>` (was "Ziti Console" or "ZAC") | ✅ Done |
| 19 | **Update app header/navbar** | Component templates | Find the header component (likely in lib). Replace "Ziti Admin Console" / "ZAC" text with "Flux Console". Update any hardcoded "OpenZiti" links. | ✅ Done |
| 20 | **Update login screen** | Login component | Replace "OpenZiti" branding, logo, tagline. New text: "Flux Console — Zero-Trust Network Administration" | ✅ Done |
| 21 | **Update SCSS theme** | `*.scss` files | Match the Embernet Dashboard color palette. Key colors from the dashboard: dark background, teal/cyan accents. Update primary/accent CSS variables if they exist. | ✅ Done |
| 22 | **Update footer text** | Footer component | "© 2026 Fireball Industries" or "Powered by Fireball Industries" — replace any "NetFoundry" / "OpenZiti" references | ✅ Done |
| 23 | **Update "About" dialog** | About/help component | Replace version info, links, attribution. Keep Apache-2.0 license notice (required). Add: "Flux Console is based on OpenZiti ZAC, licensed under Apache 2.0." | ✅ Done (no standalone About dialog — version in side nav/footer) |

### Asset Checklist

Search for and replace all instances of these images/strings in templates and SCSS:

```
ZAC.jpg                    → flux-banner.png (or similar)
openziti-logo.*            → embernet-logo.svg
ziti-logo.*                → flux-logo.svg
"Ziti Admin Console"       → "Flux Console"
"ZAC"                      → "Flux Console"
"OpenZiti"                 → "Flux"
"openziti.io"              → (remove or replace with embernet.ai link)
"NetFoundry"               → "Fireball Industries"
"netfoundry.io"            → (remove)
```

---

## Phase 4 — String & Reference Rebrand

Comprehensive find/replace across all source files. Do these **after** the Angular project rename (Phase 2) to avoid double-touching files.

| # | Task | Scope | Search → Replace | Status |
|---|------|-------|-----------------|--------|
| 24 | **User-facing strings** | All `.html`, `.ts`, `.scss` | `"OpenZiti"` → `"Flux"`, `"Ziti"` → `"Flux"` (case-sensitive, skip import paths) | ✅ Done |
| 25 | **API endpoint labels** | UI labels in components | `"Ziti Edge API"` → `"Flux Edge API"`, `"Ziti Controller"` → `"Flux Controller"` | ✅ Done |
| 26 | **Console-internal titles** | Page titles, breadcrumbs | `"Ziti Identities"` → `"Flux Identities"`, `"Ziti Services"` → `"Flux Services"`, etc. | ✅ Done (no Ziti-prefixed titles found in source) |
| 27 | **Error messages** | Service/interceptor `.ts` | Any user-visible error string referencing "Ziti" or "OpenZiti" | ✅ Done |
| 28 | **Comments (optional)** | `*.ts`, `*.html` | `// Ziti` → `// Flux` in code comments. Low priority — cosmetic only. | ✅ Done (no descriptive Ziti comments found outside copyright headers) |

### Critical: Do NOT Rename These

The console talks to the **Ziti Edge Management API**. The API endpoints, JSON field names, and model object names are from upstream OpenZiti and must **not** be renamed:

```
DO NOT CHANGE:
- API paths:        /edge/management/v1/identities, /edge/management/v1/services, etc.
- JSON fields:      "zitiId", "zitiIdentityId", "edgeRouterPolicy", etc.
- Go module paths:  github.com/openziti/* (if any Go code exists)
- Environment vars: ZITI_CTRL_ADVERTISED_ADDRESS, ZITI_EDGE_API, etc.
- Config keys:      controllerAddress, edgeApiUrl (these are API contract, not branding)
```

Only rename **user-visible display text**, not API protocol strings. This ensures upstream cherry-picks don't break the API client.

---

## Phase 5 — Auth Integration (Dashboard Overlay Proxy)

> **Updated 2026-03-02:** The original plan assumed SQLite-based auth with iframe embedding. The actual dashboard implementation uses a different architecture — see details below.

The upstream ZAC authenticates directly against the Ziti Controller's edge management API with username/password. In our deployment, the dashboard backend has a **`FluxMgmtProxyHandler`** that proxies API calls to the controller through the Flux overlay SDK's `DialContext`. The console SPA is served as static files and opens in a **new browser window** (not an iframe).

### What the Dashboard Already Has (built in `industrial-dashboard`)

- **`/api/flux/mgmt/*`** — Reverse proxy handler (`FluxMgmtProxyHandler`) that routes requests through the overlay `DialContext` to the Flux controller's Edge Management API. Permission-gated to `manage:flux` (Admin+).
- **Flux SDK context** — `internal/flux/context.go` manages `FluxContext` with `Init()`, `DialContext()`, per-tenant contexts.
- **Background sync** — `internal/flux/sync.go` syncs controller state (identities, services, routers) to local SQLite.
- **Admin card** — `openFluxConsole()` opens `/static/vendor/flux-console/` in a new window.
- **API endpoints** — `/api/flux/tenants`, `/api/flux/tenant/summary`, `/api/flux/tenant/services`, `/api/flux/tenant/topology`, `/api/flux/latency`.

### Revised Auth Tasks

| # | Task | Details | Status |
|---|------|---------|--------|
| 29 | **Identify auth service** | The Angular login service is at `projects/app-ziti-console/src/app/login/controller-login.service.ts`. It imports `LoginServiceClass` from `ziti-console-lib`. The lib's `auth.service.ts` handles OAuth flows. | ⬜ |
| 30 | **Configure API base URL** | Set the controller URL in `environment.ts` (or settings.json) to `/api/flux/mgmt` so all API calls route through the dashboard's proxy. The dashboard already strips this prefix and forwards to `edge/management/v1/*`. | ⬜ |
| 31 | **Skip or bypass login** | Since the console opens from an already-authenticated dashboard session, the console needs to skip its own login flow. Options: (a) auto-authenticate using the dashboard session cookie (the proxy already handles auth), (b) pass a session token via URL param, or (c) configure the console as "pre-authenticated" and skip login entirely. **Option (c) is simplest** — the proxy handles all auth. | ⬜ |
| 32 | **Remove standalone login page** | The console opens in a new window from the dashboard's admin card (`openFluxConsole()`). The standalone login page should be bypassed or replaced with a simple "Connecting..." loader that auto-redirects to the identity list. | ⬜ |
| 33 | **Test API proxy flow** | Verify: console loads → calls `/api/flux/mgmt/edge/management/v1/identities` → dashboard proxy routes through overlay → controller responds → identities render. | ⬜ |

### Auth Flow (Revised — New Window Mode)

```
Admin clicks "Manage Identities" on dashboard Flux Console card
  │
  ▼
Dashboard opens new window: /static/vendor/flux-console/index.html
  │
  ▼
Flux Console SPA loads, skips login (pre-authenticated via dashboard session)
  │
  ▼
All API calls go to /api/flux/mgmt/* (same origin as dashboard)
  │
  ▼
Dashboard FluxMgmtProxyHandler routes through overlay DialContext
  │
  ▼
Flux Controller Edge Management API responds through overlay
```

> **Note:** The dashboard's proxy authenticates to the controller using the embedded Flux identity (mounted from `flux.identity.existingSecret` in the Helm chart). The console SPA never handles controller credentials directly.

---

## Phase 6 — Documentation & Metadata Rebrand

| # | Task | File | Details | Status |
|---|------|------|---------|--------|
| 34 | **README.md** | `README.md` | Complete rewrite. Title: "Flux Console". Describe as Embernet's admin UI for the Flux zero-trust overlay. Reference `embernet-ai/flux-core` and `embernet-ai/flux-helm-charts`. Keep Apache-2.0 attribution. | ⬜ |
| 35 | **CONTRIBUTING.md** | `CONTRIBUTING.md` | Rewrite for Fireball Industries workflow. Reference `embernet-ai/flux-console` repo. | ⬜ |
| 36 | **CODE_OF_CONDUCT.md** | `CODE_OF_CONDUCT.md` | Update with Contributor Covenant v2.1, Fireball Industries contacts. | ⬜ |
| 37 | **SECURITY.md** | `SECURITY.md` | `security@fireballz.ai`, supported versions. | ⬜ |
| 38 | **LICENSE** | `LICENSE` / `LICENSE.md` | Keep Apache-2.0. Ensure copyright header says "Fireball Industries" for new code, keep original OpenZiti copyright for upstream code. | ⬜ |
| 39 | **CHANGELOG.md** | `CHANGELOG.md` | Add new section at top: "## 1.0.0 — Flux Console (Rebrand)" with summary of changes. Keep upstream changelog below for history. | ⬜ |
| 40 | **RELEASE.md** | `RELEASE.md` | Update release process for `embernet-ai/flux-console` repo. | ⬜ |
| 41 | **`version.js`** | `version.js` | Set version to `1.0.0` for Flux Console. | ⬜ |
| 42 | **`package.json` metadata** | `package.json` | Update `description`, `author`, `repository`, `homepage`, `bugs` fields to Fireball Industries / `embernet-ai/flux-console`. | ⬜ |

---

## Phase 7 — CI/CD & Docker

| # | Task | Details | Status |
|---|------|---------|--------|
| 43 | **Update GitHub Actions** | `.github/workflows/*.yml` — rebrand workflow names, update image refs to `ghcr.io/embernet-ai/flux-console`, remove any NetFoundry/OpenZiti-specific steps. | ⬜ |
| 44 | **Update Dockerfile** | `docker-images/` — update labels (maintainer, vendor, homepage), base image refs if needed. Output image: `ghcr.io/embernet-ai/flux-console:1.0.0`. | ⬜ |
| 45 | **Update `run-zac.sh`** | `run-zac.sh` → rename to `run-flux-console.sh`. Update internal references. | ⬜ |
| 46 | **Delete unused scripts** | `bitbucket-pipelines.yml`, `pipeline-docker-publish.sh`, `pushLatestDocker.sh` — Bitbucket leftovers, not needed. | ⬜ |
| 47 | **Delete linux-packages/** | `linux-packages/openziti-console/` — we deploy as a static SPA in the dashboard, not a system package. Delete unless we need standalone packaging. | ⬜ |
| 48 | **Build + push Docker image** | `docker build -t ghcr.io/embernet-ai/flux-console:1.0.0 . && docker push ghcr.io/embernet-ai/flux-console:1.0.0` | ⬜ |
| 49 | **Build static SPA artifact** | `ng build flux-console --configuration=production` → zip `dist/flux-console/` → attach to GitHub Release as `flux-console-spa-1.0.0.zip` | ⬜ |

---

## Phase 8 — Dashboard Integration

This phase happens in the **dashboard repo** (`embernet-ai/industrial-dashboard`), not in `flux-console`. Included here for completeness.

> **Updated 2026-03-02:** The dashboard already has extensive Flux integration far beyond what was originally scoped here. The remaining blocker is building the actual SPA from this repo.

| # | Task | Repo | Details | Status |
|---|------|------|---------|--------|
| 50 | **Copy SPA build output** | Dashboard | Copy `dist/flux-console/*` into the dashboard's `/static/vendor/flux-console/` directory. Currently has a **placeholder** `index.html` with connectivity check against `/api/flux/mgmt/edge/management/v1/version`. Full SPA pending this repo's build. | 🟡 Placeholder |
| 51 | **Create Flux Console card** | Dashboard | Admin card exists in `view_admin.html` and `view_global_command.html`. Shows mesh icon, "Flux Console" title, ADMIN badge, "Manage identities, services & policies" subtitle. Conditionally rendered with `{{if .FluxEnabled}}`. `openFluxConsole()` opens SPA in new window. | ✅ Done |
| 52 | **Add `/api/flux/*` proxy route** | Dashboard | `FluxMgmtProxyHandler` proxies `/api/flux/mgmt/*` to controller Edge Management API through overlay `DialContext`. Permission-gated to `manage:flux` (Admin+). Additional endpoints: `/api/flux/tenants`, `/api/flux/tenant/summary`, `/api/flux/tenant/services`, `/api/flux/tenant/topology`, `/api/flux/latency`. | ✅ Done |
| 53 | **Add `flux.console.enabled` Helm value** | Dashboard | `flux.enabled` exists in `values.yaml` and gates identity mount, env vars, and Go initialization. No separate `flux.console.enabled` sub-toggle — console card appears whenever `flux.enabled: true`. | ✅ Done (no separate console toggle needed) |
| 54 | **Test embedded flow** | Manual | Log in to dashboard as admin → navigate to Flux Console card → click card → verify SPA loads in new window, auth works via proxy, identities list renders. **Blocked on this repo's SPA build (task 50).** | ⬜ Blocked |

### Dashboard Card (Actual Implementation)

The dashboard already has two Flux-related views:

1. **Admin/Global Command card** (`flux-console-card`) — opens the SPA in a new window
2. **Dedicated Flux mesh view** (`view_flux.html`, ~680 lines) — tenant picker, service table with sorting/filtering, topology tab, status badges, latency display, auto-refresh (30s)

### What the Dashboard Built Beyond Phase 8

| Component | Location | Purpose |
|-----------|----------|--------|
| `FluxContext` | `internal/flux/context.go` | SDK context management, `Init()`, `DialContext()`, per-tenant contexts |
| Background sync | `internal/flux/sync.go` | Controller API → SQLite sync, latency probing, identity/router sync |
| `flux.js` | `web/static/js/flux.js` | Frontend: tenant switching, service table, auto-refresh, topology rendering |
| `view_flux.html` | `web/templates/view_flux.html` | Full mesh management view (separate from the SPA) |
| Device proxy | `internal/proxy/` | Routes `.flux.internal` addresses through overlay, SSRF allowlist |

---

## Quick-Reference: Full Rebrand Commands

Run these from the repo root after forking. This is the mechanical find/replace pass — review results manually after each step.

```powershell
# 1. Clone and setup
git clone git@github.com:embernet-ai/flux-console.git
cd flux-console
git remote add upstream https://github.com/openziti/ziti-console.git
git checkout -b release-v1

# 2. Rename project directories
git mv projects/ziti-console-lib projects/flux-console-lib
git mv projects/app-ziti-console projects/flux-console

# 3. Rename Angular project references (angular.json, tsconfig.json, package.json)
# Use your editor's find/replace across these three files:
#   ziti-console-lib  →  flux-console-lib
#   app-ziti-console  →  flux-console
#   ziti-console      →  flux-console  (careful — do this LAST, it's the broadest match)

# 4. Rename TypeScript imports (all .ts files)
Get-ChildItem -Recurse -Include *.ts | ForEach-Object {
    (Get-Content $_.FullName) -replace "from 'ziti-console-lib'", "from 'flux-console-lib'" `
                              -replace 'from "ziti-console-lib"', 'from "flux-console-lib"' |
    Set-Content $_.FullName
}

# 5. User-facing string rebrand (HTML templates — careful, review each change)
Get-ChildItem -Recurse -Include *.html,*.ts,*.scss | ForEach-Object {
    (Get-Content $_.FullName) -creplace 'OpenZiti', 'Flux' `
                              -creplace 'Ziti Admin Console', 'Flux Console' `
                              -creplace 'NetFoundry', 'Fireball Industries' `
                              -creplace '"ZAC"', '"Flux Console"' |
    Set-Content $_.FullName
}

# 6. Build and verify
npm install
ng build flux-console-lib
ng build flux-console
# Output should be in dist/flux-console/

# 7. Delete dead files
Remove-Item -Recurse -Force linux-packages
Remove-Item bitbucket-pipelines.yml, pipeline-docker-publish.sh, pushLatestDocker.sh

# 8. Commit
git add -A
git commit -m "rebrand: OpenZiti ZAC → Flux Console (Embernet/Fireball Industries)"
```

---

## Upstream Merge Strategy

Same approach as `flux-core` and `flux-helm-charts`:

```bash
git fetch upstream
git log upstream/main --oneline   # review what changed
git cherry-pick <commit-range>    # cherry-pick, don't merge
```

Our changes are narrow (branding, auth integration, asset swap) so conflicts should be minimal. The key risk is upstream renaming Angular components — monitor `projects/` structure changes in upstream releases.

> **Note (2026-03-02):** No upstream remote configured. If upstream fixes are ever needed, add the remote first: `git remote add upstream https://github.com/openziti/ziti-console.git`

---

## Phase Summary & Scorecard

| Phase | Tasks | Done | Scope | Risk |
|-------|-------|------|-------|------|
| 1 — Fork & Setup | 1–5 | 5/5 | GitHub + local | None |
| 2 — Rename Angular Projects | 6–15 | 9/10 | `angular.json`, `tsconfig`, `package.json`, directory renames, imports | ✅ Done (build verify pending Node.js) |
| 3 — Visual Rebrand | 16–23 | 8/8 | Assets, templates, SCSS | ✅ Done (placeholder artwork — replace with final) |
| 4 — String Rebrand | 24–28 | 5/5 | All source files | ✅ Done — API protocol strings preserved |
| 5 — Auth Integration | 29–33 | 0/5 | Auth service, environment config, proxy wiring | Medium — dashboard proxy handles the hard part |
| 6 — Docs & Metadata | 34–42 | 0/9 | Root docs, `package.json` | None |
| 7 — CI/CD & Docker | 43–49 | 0/7 | Workflows, Dockerfile, scripts | Low |
| 8 — Dashboard Integration | 50–54 | 3/5 | Dashboard repo (not this repo) | Low — mostly done, blocked on SPA build |

**Overall: 30/54 tasks complete (~56%). This repo's work: 27/49 (~55%).**
**Dashboard integration (Phase 8): 3/5 done — waiting on this repo's SPA output.**

### Critical Path

The fastest path to a working Flux Console:

1. **Phase 1** — finish setup (tasks 3–5)
2. **Phase 2** — rename Angular projects (tasks 6–15) — this is the riskiest step
3. **Phase 5** — wire auth to dashboard proxy (tasks 29–33) — unlocks end-to-end testing
4. **Phase 3 + 4** — visual + string rebrand (can be done incrementally)
5. **Phase 6 + 7** — docs/CI cleanup (low priority, no runtime impact)
6. **Phase 8, task 50** — copy built SPA into dashboard, replacing placeholder

---

## Prerequisites

Before starting, ensure these are available:

- [ ] Flux Controller deployed and reachable at `flux-controller.fireball-system.svc.cluster.local:1280` *(Helm chart ready in `flux-helm-charts` v2.0.10, not yet deployed to production)*
- [ ] Flux Router deployed and reachable at `flux.embernet.ai:443` *(Helm chart ready in `flux-helm-charts` v2.0.19, blocked on controller)*
- [ ] At least one edge tunnel enrolled and reporting services
- [ ] Node.js ≥18, npm ≥8.1, Angular CLI installed (`npm install -g @angular/cli`)
- [ ] GHCR write access on `embernet-ai` org
- [ ] Embernet logo assets (SVG, PNG) and brand color palette (hex codes)
- [ ] Dashboard repo (`embernet-ai/industrial-dashboard`) available — **Phase 8 is mostly done there already**

## Appendix: Key Files in This Repo

Reference for where branding-relevant code lives (all paths relative to repo root):

| File | Purpose | Rebrand Impact |
|------|---------|----------------|
| `angular.json` | Angular workspace config — project names, build targets | Phase 2 — rename projects |
| `tsconfig.json` | TypeScript path mappings for lib | Phase 2 — rename paths |
| `package.json` | NPM metadata, lib reference, scripts | Phase 2 + 6 |
| `projects/flux-console-lib/` | Shared Angular library (components, services, assets) | Phase 2–4 |
| `projects/flux-console/` | The SPA entry point | Phase 2–4 |
| `projects/flux-console-lib/src/lib/assets/` | Images, banners, icons (ZAC branding) | Phase 3 |
| `projects/flux-console/src/index.html` | SPA entry HTML (`<title>`, favicon) | Phase 3 |
| `projects/flux-console/src/app/login/` | Login service + component | Phase 5 |
| `projects/flux-console-lib/src/lib/services/auth.service.ts` | OAuth/auth service | Phase 5 |
| `projects/flux-console/src/app/app.module.ts` | Root module — imports `OpenZitiConsoleLibModule`, `flux-console-lib` | Phase 2 + 4 |
| `projects/flux-console-lib/src/lib/ziti-console.constants.ts` | DI tokens: `ZITI_URLS`, `ZITI_NAVIGATOR` | Phase 4 (user-facing labels only) |
| `projects/flux-console-lib/src/lib/ziti-console-lib.module.ts` | Lib module class: `OpenZitiConsoleLibModule` | Phase 2 + 4 |
| `projects/flux-console-lib/src/lib/default-app-config.ts` | `isOpenZiti` flag | Phase 4 |
| `version.js` | Generates `ZAC_VERSION.ts` | Phase 6 |
| `README.md` | Still shows upstream OpenZiti branding | Phase 6 |
| `run-zac.sh` | Docker entrypoint script | Phase 7 |
| `docker-images/` | Dockerfile + README | Phase 7 |
