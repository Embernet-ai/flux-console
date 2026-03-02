# SQLite Auth — flux-console Repo Changes

> **Source of truth:** `SQLITE_AUTH_IMPLEMENTATION.md` (in industrial-dashboard repo)
> **Repo:** `flux-console`
> **Scope:** Login form UI, session check on load, remove Ziti Controller direct auth, ensure cookie credentials on all API calls.

---

## Summary

The Flux Console SPA runs inside an iframe modal in the dashboard. It **cannot** use Azure AD SSO (OAuth2 redirects break in iframes). Instead, it authenticates users via their SQLite-stored password through the dashboard's `/api/flux/auth/*` endpoints.

All changes are UI/frontend — the Flux Console SPA needs to:

1. Show a login form when no valid `_flux_session` cookie exists
2. Authenticate via `POST /api/flux/auth/login` (dashboard backend)
3. Remove any direct Ziti Controller `POST /authenticate` calls
4. Ensure all API calls include `credentials: 'same-origin'` so the `_flux_session` cookie is sent

---

## Auth Flow (from the iframe's perspective)

```
iframe loads /static/vendor/flux-console/index.html
  │
  ├─ On init: GET /api/flux/auth/me (credentials: 'same-origin')
  │   ├─ 200 → already authenticated → hide login, show Flux UI
  │   └─ 401 → show login form
  │
  ├─ User enters email + password
  ├─ POST /api/flux/auth/login { email, password } (credentials: 'same-origin')
  │   ├─ 200 → backend sets _flux_session cookie → hide login, show Flux UI
  │   └─ 401/403 → show error message
  │
  ├─ All subsequent API calls: /api/flux/mgmt/* (cookie sent automatically)
  │
  └─ User closes iframe → session stays valid → next open skips login
```

---

## Checklist

### Phase 5 — Flux Console iframe Login UI

| # | Task | Status |
|---|------|--------|
| 5.1 | Add login form component (email + password fields, styled to match dashboard dark theme) | [x] |
| 5.2 | On SPA init, check `GET /api/flux/auth/me` — if 200, skip login and load Flux UI directly | [x] |
| 5.3 | On login form submit, `POST /api/flux/auth/login` — on success, hide form, init Flux Console UI | [x] |
| 5.4 | Remove any direct Ziti Controller `POST /authenticate` calls | [x] |
| 5.5 | Ensure all `/api/flux/mgmt/*` calls use `credentials: 'same-origin'` so `_flux_session` cookie is sent | [x] |
| 5.6 | Add logout button/option that calls `POST /api/flux/auth/logout` | [x] |
| 5.7 | Handle session expiry gracefully (re-show login form on 401 from any API call) | [x] |

---

## Login Form Reference

Minimal login form for the Flux Console SPA (styled to match the dashboard's dark theme):

```html
<div id="flux-login" style="max-width:400px;margin:80px auto;padding:32px;background:#1a1a1a;border-radius:12px;border:2px solid var(--ember-red,#dc3545);color:#fff;font-family:sans-serif;">
  <div style="text-align:center;margin-bottom:24px;">
    <img src="/static/images/embernet.png" style="height:40px;" alt="Embernet">
    <h2 style="margin:12px 0 4px;color:#00ffca;">Flux Console</h2>
    <p style="color:#999;font-size:0.85em;">Enter your dashboard credentials</p>
  </div>
  <form onsubmit="fluxLogin(event)">
    <input id="flux-email" type="email" placeholder="Email" required
      style="width:100%;padding:10px;margin-bottom:12px;border:1px solid #333;border-radius:6px;background:#0d0d0d;color:#fff;box-sizing:border-box;">
    <input id="flux-password" type="password" placeholder="Password" required
      style="width:100%;padding:10px;margin-bottom:16px;border:1px solid #333;border-radius:6px;background:#0d0d0d;color:#fff;box-sizing:border-box;">
    <button type="submit"
      style="width:100%;padding:10px;background:var(--ember-red,#dc3545);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:1em;">Sign In</button>
    <div id="flux-login-error" style="color:#ff6b6b;margin-top:12px;text-align:center;font-size:0.85em;"></div>
  </form>
</div>
```

### Login JavaScript

```javascript
function fluxLogin(e) {
  e.preventDefault();
  var email = document.getElementById('flux-email').value;
  var password = document.getElementById('flux-password').value;
  var errorEl = document.getElementById('flux-login-error');
  errorEl.textContent = '';

  fetch('/api/flux/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ email: email, password: password })
  })
  .then(function(r) {
    if (!r.ok) return r.json().then(function(d) { throw new Error(d.error || 'Login failed'); });
    return r.json();
  })
  .then(function(user) {
    document.getElementById('flux-login').style.display = 'none';
    initFluxConsole(user);
  })
  .catch(function(err) {
    errorEl.textContent = err.message;
  });
}

// On page load — auto-check for existing session
fetch('/api/flux/auth/me', { credentials: 'same-origin' })
  .then(function(r) { if (!r.ok) throw new Error(); return r.json(); })
  .then(function(user) {
    document.getElementById('flux-login').style.display = 'none';
    initFluxConsole(user);
  })
  .catch(function() {
    // Not authenticated — login form is already visible
  });
```

---

## What NOT to Do

- ❌ Do **NOT** redirect to Azure AD SSO from within the iframe (breaks due to X-Frame-Options)
- ❌ Do **NOT** call the Ziti Controller's `POST /authenticate` endpoint directly
- ❌ Do **NOT** try to inherit or read the `_oauth2_proxy` cookie — it's for dashboard SSO only
- ❌ Do **NOT** store passwords or tokens in localStorage/sessionStorage

---

## API Endpoints Used

All endpoints are served by the industrial-dashboard backend:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/flux/auth/login` | Authenticate with email + password, receive `_flux_session` cookie |
| `POST` | `/api/flux/auth/logout` | Delete session, clear cookie |
| `GET` | `/api/flux/auth/me` | Check existing session, get current user info |
| `POST` | `/api/flux/auth/change-password` | Change own Flux password |
| `GET/POST/PUT/DELETE` | `/api/flux/mgmt/*` | All Flux management API calls (proxied to Flux controller) |

All requests must include `credentials: 'same-origin'` so the browser sends the `_flux_session` cookie.

---

## Verification

- [ ] Open dashboard (SSO login)
- [ ] Click "Flux Console" card → iframe opens with login form
- [ ] Enter email + Flux password → Flux Console UI loads
- [ ] Close iframe, reopen → session persists, no re-login needed
- [ ] Wait 24h+ → session expired → login form shown again
- [ ] All Flux CRUD operations work through `/api/flux/mgmt/*` proxy
