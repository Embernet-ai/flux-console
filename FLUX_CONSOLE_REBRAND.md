# Flux Console — Fork & Rebrand Action Plan

> **Upstream:** [`openziti/ziti-console`](https://github.com/openziti/ziti-console) (ZAC — Ziti Administration Console)
> **Our Fork:** `embernet-ai/flux-console`
> **Tech Stack:** Angular 20 monorepo, Node.js ≥18, npm ≥8.1, SCSS, TypeScript
> **Build Output:** Static SPA in `./dist/app-ziti-console`
> **Deployment Target:** Embedded in the Embernet Dashboard at `/static/vendor/flux-console/`
> **Auth:** Dashboard SQLite user DB (NOT Azure AD, NOT Ziti's built-in auth)
> **UPG Ticket:** UPG-043

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
| 1 | **Fork on GitHub** | `openziti/ziti-console` → `embernet-ai/flux-console`. Use GitHub's fork button. | ⬜ |
| 2 | **Clone locally** | `git clone git@github.com:embernet-ai/flux-console.git && cd flux-console` | ⬜ |
| 3 | **Add upstream remote** | `git remote add upstream https://github.com/openziti/ziti-console.git` | ⬜ |
| 4 | **Create `release-v1` branch** | `git checkout -b release-v1` — all rebrand work happens here, merge to `main` when done | ⬜ |
| 5 | **Verify build works unmodified** | `npm install && ng build ziti-console` — confirm the SPA builds to `dist/app-ziti-console/` | ⬜ |

---

## Phase 2 — Rename Angular Projects

The Angular workspace has two projects named `ziti-console-lib` and `app-ziti-console`. Rename them to `flux-console-lib` and `flux-console`.

| # | Task | File(s) | Details | Status |
|---|------|---------|---------|--------|
| 6 | **Rename in `angular.json`** | `angular.json` | Find/replace project names: `ziti-console-lib` → `flux-console-lib`, `app-ziti-console` → `flux-console`. Update `sourceRoot`, `outputPath`, `assets` paths. | ⬜ |
| 7 | **Rename in `package.json`** | `package.json` | Change `"name"` to `flux-console`. Update the lib file reference: `"ziti-console-lib": "file:dist/ziti-console-lib"` → `"flux-console-lib": "file:dist/flux-console-lib"` | ⬜ |
| 8 | **Rename in `tsconfig.json`** | `tsconfig.json` | Update path mappings from `ziti-console-lib` → `flux-console-lib` | ⬜ |
| 9 | **Rename project directories** | Filesystem | `git mv projects/ziti-console-lib projects/flux-console-lib` and `git mv projects/app-ziti-console projects/flux-console` | ⬜ |
| 10 | **Update internal imports** | `projects/**/*.ts` | Global find/replace in all TypeScript files: `from 'ziti-console-lib'` → `from 'flux-console-lib'`, `from "ziti-console-lib"` → `from "flux-console-lib"` | ⬜ |
| 11 | **Rename lib `package.json`** | `projects/flux-console-lib/package.json` | Change `"name"` from `ziti-console-lib` to `@embernet-ai/flux-console-lib` (or `flux-console-lib`) | ⬜ |
| 12 | **Rename lib `ng-package.json`** | `projects/flux-console-lib/ng-package.json` | Update `dest` path if it references old name | ⬜ |
| 13 | **Update `build.sh`** | `build.sh` | Replace `ziti-console-lib` → `flux-console-lib`, `ziti-console` → `flux-console` in build commands | ⬜ |
| 14 | **Update `publishSharedLib.sh`** | `publishSharedLib.sh` | Replace lib name references | ⬜ |
| 15 | **Verify build** | Terminal | `npm install && ng build flux-console-lib && ng build flux-console` — must produce `dist/flux-console/` | ⬜ |

---

## Phase 3 — Visual Rebrand (Assets & Theming)

This is the user-facing rebrand. Every screen the admin sees should say "Flux" with Embernet branding.

| # | Task | File(s) | Details | Status |
|---|------|---------|---------|--------|
| 16 | **Replace banner/logo images** | `projects/flux-console-lib/src/lib/assets/banners/` | Replace `ZAC.jpg` and any OpenZiti banners with Flux/Embernet branded versions. Use `⚡` bolt motif consistent with dashboard. | ⬜ |
| 17 | **Replace favicon** | `projects/flux-console/src/` | Replace `favicon.ico` with Embernet/Flux icon | ⬜ |
| 18 | **Update `index.html` title** | `projects/flux-console/src/index.html` | `<title>Flux Console</title>` (was "Ziti Console" or "ZAC") | ⬜ |
| 19 | **Update app header/navbar** | Component templates | Find the header component (likely in lib). Replace "Ziti Admin Console" / "ZAC" text with "Flux Console". Update any hardcoded "OpenZiti" links. | ⬜ |
| 20 | **Update login screen** | Login component | Replace "OpenZiti" branding, logo, tagline. New text: "Flux Console — Zero-Trust Network Administration" | ⬜ |
| 21 | **Update SCSS theme** | `*.scss` files | Match the Embernet Dashboard color palette. Key colors from the dashboard: dark background, teal/cyan accents. Update primary/accent CSS variables if they exist. | ⬜ |
| 22 | **Update footer text** | Footer component | "© 2026 Fireball Industries" or "Powered by Fireball Industries" — replace any "NetFoundry" / "OpenZiti" references | ⬜ |
| 23 | **Update "About" dialog** | About/help component | Replace version info, links, attribution. Keep Apache-2.0 license notice (required). Add: "Flux Console is based on OpenZiti ZAC, licensed under Apache 2.0." | ⬜ |

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
| 24 | **User-facing strings** | All `.html`, `.ts`, `.scss` | `"OpenZiti"` → `"Flux"`, `"Ziti"` → `"Flux"` (case-sensitive, skip import paths) | ⬜ |
| 25 | **API endpoint labels** | UI labels in components | `"Ziti Edge API"` → `"Flux Edge API"`, `"Ziti Controller"` → `"Flux Controller"` | ⬜ |
| 26 | **Console-internal titles** | Page titles, breadcrumbs | `"Ziti Identities"` → `"Flux Identities"`, `"Ziti Services"` → `"Flux Services"`, etc. | ⬜ |
| 27 | **Error messages** | Service/interceptor `.ts` | Any user-visible error string referencing "Ziti" or "OpenZiti" | ⬜ |
| 28 | **Comments (optional)** | `*.ts`, `*.html` | `// Ziti` → `// Flux` in code comments. Low priority — cosmetic only. | ⬜ |

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

## Phase 5 — Auth Integration (Dashboard SQLite)

The upstream ZAC authenticates directly against the Ziti Controller's edge management API with username/password. For our deployment, the Flux Console authenticates against the **dashboard's embedded SQLite user database** instead.

| # | Task | Details | Status |
|---|------|---------|--------|
| 29 | **Identify auth service** | Find the Angular service that handles login (likely `projects/flux-console-lib/src/lib/services/` — look for `login`, `auth`, `session`, `credentials`). | ⬜ |
| 30 | **Replace auth endpoint** | Modify the auth service to POST credentials to the dashboard's auth API (`/api/auth/login`) instead of the Ziti controller's `/authenticate`. The dashboard validates against SQLite and returns a session token. | ⬜ |
| 31 | **Pass controller session downstream** | After dashboard auth succeeds, the dashboard backend establishes a controller management session using the embedded admin credential and returns a proxied session token. The console SPA uses this token for all subsequent API calls. | ⬜ |
| 32 | **Configure API base URL** | The console needs to know where the Flux Controller management API is. Options: (a) hardcode `/api/flux/` and let the dashboard reverse-proxy, or (b) make it configurable via `environment.ts`. **Option (a) is preferred** — the dashboard proxy already exists. | ⬜ |
| 33 | **Remove standalone login page** | Since the console is embedded as an iframe card inside the already-authenticated dashboard, the standalone login page is unnecessary. Either remove it or auto-skip it when an auth token is present in the iframe URL params. | ⬜ |

### Auth Flow (Embedded Mode)

```
Admin clicks "Manage Identities" in dashboard
  │
  ▼
Dashboard opens iframe: /static/vendor/flux-console/index.html?token=<session-token>
  │
  ▼
Flux Console reads token from URL params
  │
  ▼
All API calls go to /api/flux/* (dashboard reverse-proxies to flux-controller:1280)
  │
  ▼
Dashboard injects auth header before proxying to controller's Edge Management API
```

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

This phase happens in the **dashboard repo**, not in `flux-console`. Included here for completeness.

| # | Task | Repo | Details | Status |
|---|------|------|---------|--------|
| 50 | **Copy SPA build output** | Dashboard | Copy `dist/flux-console/*` into the dashboard's `/static/vendor/flux-console/` directory. The dashboard serves these as static files. | ⬜ |
| 51 | **Create Flux Console card** | Dashboard | New admin card component. Shows status summary (identity count, service count, controller endpoint). "Manage Identities" / "Manage Services" buttons open the console SPA in the existing iframe overlay. | ⬜ |
| 52 | **Add `/api/flux/*` proxy route** | Dashboard | Reverse-proxy all `/api/flux/*` requests to `flux-controller.fireball-system.svc.cluster.local:1280/edge/management/v1/*`. Inject the admin auth session. | ⬜ |
| 53 | **Add `flux.console.enabled` Helm value** | Dashboard | Gate the Flux Console card and proxy route behind a values toggle (default: `true` when `flux.enabled: true`). | ⬜ |
| 54 | **Test embedded flow** | Manual | Log in to dashboard as admin → navigate to Flux Console card → click "Manage Identities" → verify iframe loads, auth works, identities list renders. | ⬜ |

### Dashboard Card Wireframe

```
┌─────────────────────────────────────────────────────────┐
│  ⚡ Flux Zero-Trust Overlay                    [ADMIN+] │
│                                                         │
│  Status: ● Connected (12 identities, 8 services)       │
│  Controller: flux-controller.fireball-system.svc        │
│  Router: flux.embernet.ai:443                           │
│                                                         │
│  [MANAGE IDENTITIES]   [MANAGE SERVICES]                │
│                                                         │
│  Part of Embernet's zero-trust security framework.      │
│  Identities are managed independently of SSO —          │
│  separate trust domains for defense in depth.           │
└─────────────────────────────────────────────────────────┘
```

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

---

## Phase Summary

| Phase | Tasks | Scope | Risk |
|-------|-------|-------|------|
| 1 — Fork & Setup | 1–5 | GitHub + local | None |
| 2 — Rename Angular Projects | 6–15 | `angular.json`, `tsconfig`, `package.json`, directory renames, imports | Medium — build breaks if any import is missed |
| 3 — Visual Rebrand | 16–23 | Assets, templates, SCSS | Low — cosmetic only |
| 4 — String Rebrand | 24–28 | All source files | Medium — must not touch API protocol strings |
| 5 — Auth Integration | 29–33 | Auth service, environment config | High — changes runtime behavior |
| 6 — Docs & Metadata | 34–42 | Root docs, `package.json` | None |
| 7 — CI/CD & Docker | 43–49 | Workflows, Dockerfile, scripts | Low |
| 8 — Dashboard Integration | 50–54 | Dashboard repo (not this repo) | Medium — iframe + proxy plumbing |

**Total: 54 tasks across 8 phases.**

---

## Prerequisites

Before starting, ensure these are available:

- [ ] Flux Controller deployed and reachable at `flux-controller.fireball-system.svc.cluster.local:1280`
- [ ] Flux Router deployed and reachable at `flux.embernet.ai:443`
- [ ] At least one edge tunnel enrolled and reporting services
- [ ] Node.js ≥18, npm ≥8.1, Angular CLI installed (`npm install -g @angular/cli`)
- [ ] GHCR write access on `embernet-ai` org
- [ ] Embernet logo assets (SVG, PNG) and brand color palette (hex codes)
- [ ] Dashboard repo available for Phase 8 integration work
