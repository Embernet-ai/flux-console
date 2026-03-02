# ⚡ Flux Console

**Flux Console** is the administrative web UI for the [Flux](https://github.com/Embernet-ai/flux-core) zero-trust overlay network, part of the [Embernet](https://embernet.ai) platform by Fireball Industries.

It provides a browser-based interface for managing identities, services, routers, policies, and other resources on a Flux Controller via the Edge Management API.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=rounded)](CONTRIBUTING.md)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-v2.1%20adopted-ff69b4.svg)](CODE_OF_CONDUCT.md)

---

## Overview

Flux Console is deployed as a **static single-page application (SPA)** embedded in the [Embernet Dashboard](https://github.com/Embernet-ai/industrial-dashboard) at `/static/vendor/flux-console/`. It opens inside an iframe modal when an admin clicks the Flux Console card.

### Related Repositories

| Repo | Purpose |
|------|---------|
| [`embernet-ai/flux-core`](https://github.com/Embernet-ai/flux-core) | Flux controller, router, tunnel — the zero-trust overlay runtime |
| [`embernet-ai/flux-helm-charts`](https://github.com/Embernet-ai/flux-helm-charts) | Helm charts for deploying Flux components on Kubernetes |
| [`embernet-ai/industrial-dashboard`](https://github.com/Embernet-ai/industrial-dashboard) | Embernet Dashboard — hosts the Flux Console SPA and proxies API calls |

## Requirements

| Tool    | Version |
|:-------:|:-------:|
| Node.js | ≥ 18    |
| npm     | ≥ 8.1   |
| Angular CLI (`ng`) | 20 |

### Install Angular CLI

```bash
npm install -g @angular/cli@20
```

## Projects

This Angular monorepo contains two projects:

1. [flux-console-lib](./projects/flux-console-lib) — Shared Angular library (components, services, API clients, assets).
2. [flux-console](./projects/flux-console) — The SPA that imports the lib. This is what gets built and deployed.

## Build

From the project root:

1. Install dependencies and build the library:

    ```bash
    npm install
    ```

2. Build the SPA:

    ```bash
    ng build flux-console
    ```

3. The built assets are output to `./dist/flux-console/`.

### Development

1. Watch-build the library:

    ```bash
    ng build flux-console-lib --watch
    ```

2. Serve the SPA with live reload:

    ```bash
    ng serve flux-console
    ```

3. Access the console at http://localhost:4200

## Authentication

Flux Console authenticates via **SQLite password auth** (separate from the dashboard's Azure AD SSO). The auth flow uses a `_flux_session` cookie issued by the dashboard's `/api/flux/auth/login` endpoint. See [SQLITE_AUTH_IMPLEMENTATION.md](SQLITE_AUTH_IMPLEMENTATION.md) for details.

## Deployment

The production deployment is a static SPA served by the Embernet Dashboard:

1. Build: `ng build flux-console --configuration=production`
2. Copy `dist/flux-console/*` → dashboard's `/static/vendor/flux-console/`
3. All API calls route through the dashboard's `/api/flux/mgmt/*` proxy

## Attribution

Flux Console is based on [OpenZiti ZAC](https://github.com/openziti/ziti-console) (Ziti Administration Console), licensed under the [Apache License 2.0](LICENSE). Original copyright belongs to NetFoundry, Inc.

## License

[Apache License 2.0](LICENSE) — see [LICENSE](LICENSE) for the full text.
