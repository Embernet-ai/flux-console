# SQLite Password Authentication for Flux Console — Implementation Guide

> **Purpose:** Add a `password_hash` column to the existing SQLite `users` table so that users can authenticate to the **Flux Console iframe** using email + password.  
> **Why:** The Flux Console (ZAC) runs inside an iframe modal in the dashboard. Azure AD SSO **cannot work inside iframes** — OAuth2 redirects break due to X-Frame-Options / CSP / redirect loops. So the Flux Console authenticates users via the SQLite-stored password instead.  
> **Date:** 2026-03-02  
>
> **⚠️ CRITICAL: TWO COMPLETELY SEPARATE AUTH SYSTEMS**  
> | What | Auth Method | How |
> |------|------------|-----|
> | **Dashboard login** | **Azure AD SSO** (OAuth2 Proxy) | Unchanged. Do NOT touch. |
> | **Flux Console iframe** | **SQLite password** | New. Uses `password_hash` column in `users` table. |

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Schema Migration — `password_hash` Column](#2-schema-migration)
3. [Sessions Table](#3-sessions-table)
4. [Password Hashing (bcrypt)](#4-password-hashing)
5. [Session Management](#5-session-management)
6. [New HTTP Endpoints (Flux Auth)](#6-new-http-endpoints)
7. [Dashboard Auth — DO NOT CHANGE](#7-auth-middleware)
8. [Auto-Create Admin on Domain Addition](#8-auto-create-admin-on-domain-addition)
9. [GetUserRole() — NO CHANGES NEEDED](#9-refactor-getuserrole)
10. [Helm / K8s Deployment Changes](#10-helm--k8s-deployment-changes)
11. [Flux Console (iframe) — Login via SQLite Password](#11-flux-console-iframe-login-integration)
12. [File-by-File Change Summary](#12-file-by-file-change-summary)

---

## 1. Architecture Overview

### Dashboard Login — Azure AD SSO — COMPLETELY UNCHANGED
```
Browser → OAuth2 Proxy (Azure AD OIDC) → _oauth2_proxy cookie
       → Traefik → Dashboard Pod
       → Go reads X-Auth-Request-Email header → looks up user in SQLite → resolves role
```
**This does not change. Do not touch OAuth2 Proxy. Do not touch `GetUserRole()`. Do not touch Traefik ForwardAuth.**

### Flux Console (iframe) — SQLite Password Auth
```
User is already logged into the dashboard (via Azure AD SSO)
  → User clicks "Flux Console" card → iframe modal opens
  → Flux Console SPA shows a login form inside the iframe
  → User enters their email + password (stored in SQLite users.password_hash)
  → POST /api/flux/auth/login { email, password }
  → Go backend verifies bcrypt hash from the SQLite users table
  → Issues a Flux session cookie (_flux_session)
  → Flux Console SPA uses this cookie for all /api/flux/mgmt/* calls
  → Dashboard proxy validates the _flux_session cookie before proxying to Flux controller
```

### Why two separate auth systems?
```
┌──────────────────────────────────────────────────────────────────┐
│  DASHBOARD (main window)                                        │
│  Auth: Azure AD SSO via OAuth2 Proxy                            │
│  Cookie: _oauth2_proxy (set by OAuth2 Proxy)                    │
│  GetUserRole() reads X-Auth-Request-Email header → resolves role│
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  FLUX CONSOLE (iframe)                                    │  │
│  │  Auth: SQLite password (email + password_hash)             │  │
│  │  Cookie: _flux_session (set by dashboard backend)          │  │
│  │  SSO CANNOT work here — OAuth2 redirect breaks in iframes │  │
│  │  Has its own login form inside the iframe                  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Key Dependency
`golang.org/x/crypto/bcrypt` — **already in go.sum** as an indirect dependency of the OpenZiti SDK. Just import it and run `go mod tidy`.

`github.com/golang-jwt/jwt/v5` — **already in go.sum** as indirect. Available if you prefer JWT session tokens over database-backed sessions. This guide uses **database-backed sessions** for simplicity and revocability.

---

## 2. Schema Migration

### File: `internal/db/sqlite.go`

Add this migration to the `migrations` slice (after the existing UPG-050 alert rules migrations):

```go
// ── UPG-052: Password-Based Authentication ──────────────────────────
// Add password_hash column to users table for bcrypt-hashed passwords.
// Empty string = no password set (legacy OAuth2 user or not yet provisioned).
`ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''`,
```

**That's it.** The existing `runMigrations()` function handles `ALTER TABLE ADD COLUMN` failures with `duplicate column` gracefully (lines ~400-405 in sqlite.go), so this is safe to re-run.

### Resulting users table schema

| Column | Type | Notes |
|---|---|---|
| email | TEXT PRIMARY KEY | Unchanged |
| role | TEXT | Unchanged |
| display_name | TEXT | Unchanged |
| status | TEXT | "active", "suspended", "invited" — unchanged |
| invited_by | TEXT | Unchanged |
| invited_at | TEXT | Unchanged |
| last_seen | TEXT | Unchanged |
| permissions | TEXT (JSON array) | Unchanged |
| created_at | TEXT | Unchanged |
| updated_at | TEXT | Unchanged |
| **password_hash** | **TEXT** | **NEW — bcrypt hash for Flux Console login. Empty = no Flux access.** |

---

## 3. Sessions Table

### File: `internal/db/sqlite.go`

Add this migration to the `migrations` slice (right after the password_hash migration):

```go
// Session store for password-based auth — replaces OAuth2 Proxy cookie.
// Each row is a valid session. Expired/revoked sessions are deleted.
`CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    email       TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at  TEXT NOT NULL,
    ip_address  TEXT NOT NULL DEFAULT '',
    user_agent  TEXT NOT NULL DEFAULT ''
)`,
`CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email)`,
`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`,
```

### Session ID Format
Use `crypto/rand` to generate 32-byte random tokens, hex-encoded (64 chars). **Do not use UUIDs** — they don't have enough entropy for session tokens.

---

## 4. Password Hashing

### New file: `internal/auth/password.go`

```go
package auth

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

const (
	// bcrypt cost factor. 12 is a good balance of security and speed.
	// ~250ms per hash on modern hardware.
	BcryptCost = 12

	// Default password for auto-created domain admins.
	// MUST be changed on first login (enforce via status or flag).
	DefaultAdminPassword = "ChangeMeNow!2026"
)

// HashPassword returns the bcrypt hash of a plaintext password.
func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), BcryptCost)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}
	return string(hash), nil
}

// CheckPassword compares a plaintext password against a bcrypt hash.
// Returns nil on match, error on mismatch or invalid hash.
func CheckPassword(hash, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

// GenerateSessionID creates a cryptographically random 32-byte hex session token.
func GenerateSessionID() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate session id: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// GenerateRandomPassword creates a random 16-character password for
// auto-provisioned admin accounts. Uses hex encoding of 8 random bytes.
func GenerateRandomPassword() (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate password: %w", err)
	}
	return hex.EncodeToString(b), nil
}
```

### Update go.mod

After adding the import, run:
```bash
cd embernet-dashboard && go mod tidy
```

This will promote `golang.org/x/crypto` from indirect to direct.

---

## 5. Session Management

### New file: `internal/auth/sessions.go`

```go
package auth

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/embernet-ai/dashboard/internal/db"
)

const (
	// Session cookie name for Flux Console authentication.
	// Completely separate from the _oauth2_proxy cookie used for dashboard SSO.
	SessionCookieName = "_flux_session"

	// Session duration — 24 hours. Sliding expiry on each request.
	SessionDuration = 24 * time.Hour

	// Cookie path
	SessionCookiePath = "/"
)

// SessionRecord represents a row in the sessions table.
type SessionRecord struct {
	ID        string
	Email     string
	CreatedAt string
	ExpiresAt string
	IPAddress string
	UserAgent string
}

// CreateSession inserts a new session and returns the session ID.
// The caller is responsible for setting the cookie on the response.
func CreateSession(email string, r *http.Request) (string, error) {
	sessionID, err := GenerateSessionID()
	if err != nil {
		return "", err
	}

	expiresAt := time.Now().UTC().Add(SessionDuration).Format("2006-01-02 15:04:05")
	ip := r.RemoteAddr
	ua := r.UserAgent()

	db.Mu.Lock()
	defer db.Mu.Unlock()

	_, err = db.DB.Exec(`
		INSERT INTO sessions (id, email, expires_at, ip_address, user_agent)
		VALUES (?, ?, ?, ?, ?)`,
		sessionID, email, expiresAt, ip, ua)
	if err != nil {
		return "", fmt.Errorf("insert session: %w", err)
	}

	return sessionID, nil
}

// ValidateSession checks if a session ID is valid and not expired.
// Returns the email associated with the session, or empty string if invalid.
// Also performs sliding expiry — extends the session on each valid check.
func ValidateSession(sessionID string) (string, error) {
	if sessionID == "" {
		return "", nil
	}

	now := time.Now().UTC().Format("2006-01-02 15:04:05")

	var email string
	err := db.DB.QueryRow(`
		SELECT email FROM sessions
		WHERE id = ? AND expires_at > ?`,
		sessionID, now).Scan(&email)

	if err == sql.ErrNoRows {
		return "", nil // expired or doesn't exist
	}
	if err != nil {
		return "", fmt.Errorf("validate session: %w", err)
	}

	// Sliding expiry — extend session
	newExpiry := time.Now().UTC().Add(SessionDuration).Format("2006-01-02 15:04:05")
	go func() {
		db.Mu.Lock()
		defer db.Mu.Unlock()
		_, _ = db.DB.Exec(`UPDATE sessions SET expires_at = ? WHERE id = ?`, newExpiry, sessionID)
	}()

	return email, nil
}

// DeleteSession removes a session (logout).
func DeleteSession(sessionID string) error {
	db.Mu.Lock()
	defer db.Mu.Unlock()

	_, err := db.DB.Exec(`DELETE FROM sessions WHERE id = ?`, sessionID)
	return err
}

// DeleteUserSessions removes ALL sessions for a user (force logout everywhere).
// Called when a user is suspended or deleted.
func DeleteUserSessions(email string) error {
	db.Mu.Lock()
	defer db.Mu.Unlock()

	_, err := db.DB.Exec(`DELETE FROM sessions WHERE email = ?`, email)
	return err
}

// CleanExpiredSessions removes all expired sessions.
// Call periodically (e.g., every hour) from a goroutine.
func CleanExpiredSessions() {
	now := time.Now().UTC().Format("2006-01-02 15:04:05")

	db.Mu.Lock()
	defer db.Mu.Unlock()

	res, err := db.DB.Exec(`DELETE FROM sessions WHERE expires_at < ?`, now)
	if err != nil {
		log.Printf("session cleanup error: %v", err)
		return
	}
	n, _ := res.RowsAffected()
	if n > 0 {
		log.Printf("cleaned %d expired sessions", n)
	}
}

// SetSessionCookie writes the session cookie to the HTTP response.
func SetSessionCookie(w http.ResponseWriter, sessionID string) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    sessionID,
		Path:     SessionCookiePath,
		MaxAge:   int(SessionDuration.Seconds()),
		HttpOnly: true,
		Secure:   true,            // Set to false for local dev without HTTPS
		SameSite: http.SameSiteLaxMode,
	})
}

// ClearSessionCookie removes the session cookie from the browser.
func ClearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     SessionCookiePath,
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
}

// GetSessionIDFromRequest extracts the session ID from the request cookie.
func GetSessionIDFromRequest(r *http.Request) string {
	cookie, err := r.Cookie(SessionCookieName)
	if err != nil {
		return ""
	}
	return cookie.Value
}

// StartSessionCleanup starts a background goroutine that periodically
// removes expired sessions. Call once from main().
func StartSessionCleanup() {
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			CleanExpiredSessions()
		}
	}()
}
```

---

## 6. New HTTP Endpoints (Flux Auth)

### File: `cmd/dashboard/main.go`

Add these route registrations alongside the existing `http.HandleFunc` calls. These endpoints are **only for Flux Console authentication** — the dashboard itself uses Azure AD SSO exclusively.

### 6a. `POST /api/flux/auth/login` — Flux Console login

```go
http.HandleFunc("/api/flux/auth/login", func(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var req struct {
        Email    string `json:"email"`
        Password string `json:"password"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "invalid request body", http.StatusBadRequest)
        return
    }

    req.Email = strings.TrimSpace(strings.ToLower(req.Email))
    if req.Email == "" || req.Password == "" {
        http.Error(w, `{"error":"email and password required"}`, http.StatusBadRequest)
        return
    }

    // Look up user
    user, err := auth.Store.GetUser(req.Email)
    if err != nil {
        log.Printf("flux login: db error for %s: %v", req.Email, err)
        http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
        return
    }
    if user == nil {
        http.Error(w, `{"error":"invalid email or password"}`, http.StatusUnauthorized)
        return
    }

    // Check status
    if user.Status == "suspended" {
        http.Error(w, `{"error":"account suspended"}`, http.StatusForbidden)
        return
    }

    // Verify password hash from SQLite
    if user.PasswordHash == "" {
        // User has no Flux password set — no Flux access
        http.Error(w, `{"error":"no flux password configured — contact your admin"}`, http.StatusUnauthorized)
        return
    }
    if err := auth.CheckPassword(user.PasswordHash, req.Password); err != nil {
        _ = auth.Store.LogAudit(req.Email, "flux_login_failed", req.Email, "bad password")
        http.Error(w, `{"error":"invalid email or password"}`, http.StatusUnauthorized)
        return
    }

    // Check manage:flux permission
    role := auth.RoleFromString(user.Role)
    if !auth.HasPermission(user, role, "manage:flux") {
        http.Error(w, `{"error":"you do not have Flux Console access"}`, http.StatusForbidden)
        return
    }

    // Activate invited user on first successful login
    if user.Status == "invited" {
        _, _ = auth.Store.ActivateInvitedUser(req.Email)
        _ = auth.Store.LogAudit(req.Email, "first_login", req.Email, "activated via flux password login")
    }

    // Create Flux session
    sessionID, err := auth.CreateSession(req.Email, r)
    if err != nil {
        log.Printf("flux login: session create error for %s: %v", req.Email, err)
        http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
        return
    }

    // Set _flux_session cookie
    auth.SetSessionCookie(w, sessionID)

    _ = auth.Store.UpdateLastSeen(req.Email)
    _ = auth.Store.LogAudit(req.Email, "flux_login", req.Email, "flux console login from "+r.RemoteAddr)

    perms := auth.GetEffectivePermissions(user, role)

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "email":       user.Email,
        "displayName": user.DisplayName,
        "role":        user.Role,
        "permissions": perms,
    })
})
```

### 6b. `POST /api/flux/auth/logout`

```go
http.HandleFunc("/api/flux/auth/logout", func(w http.ResponseWriter, r *http.Request) {
    sessionID := auth.GetSessionIDFromRequest(r)
    if sessionID != "" {
        email, _ := auth.ValidateSession(sessionID)
        _ = auth.DeleteSession(sessionID)
        auth.ClearSessionCookie(w)
        if email != "" {
            _ = auth.Store.LogAudit(email, "flux_logout", email, "")
        }
    }
    w.Header().Set("Content-Type", "application/json")
    w.Write([]byte(`{"ok":true}`))
})
```

### 6c. `GET /api/flux/auth/me` — Flux session validation + current user info

```go
http.HandleFunc("/api/flux/auth/me", func(w http.ResponseWriter, r *http.Request) {
    sessionID := auth.GetSessionIDFromRequest(r)
    email, err := auth.ValidateSession(sessionID)
    if err != nil || email == "" {
        http.Error(w, `{"error":"not authenticated"}`, http.StatusUnauthorized)
        return
    }

    user, err := auth.Store.GetUser(email)
    if err != nil || user == nil {
        http.Error(w, `{"error":"user not found"}`, http.StatusUnauthorized)
        return
    }

    role := auth.RoleFromString(user.Role)
    perms := auth.GetEffectivePermissions(user, role)

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "email":       user.Email,
        "displayName": user.DisplayName,
        "role":        user.Role,
        "status":      user.Status,
        "permissions": perms,
    })
})
```

### 6d. `POST /api/flux/auth/change-password` — Change Flux password

```go
http.HandleFunc("/api/flux/auth/change-password", func(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
        return
    }

    // Must be authenticated
    sessionID := auth.GetSessionIDFromRequest(r)
    email, _ := auth.ValidateSession(sessionID)
    if email == "" {
        http.Error(w, `{"error":"not authenticated"}`, http.StatusUnauthorized)
        return
    }

    var req struct {
        CurrentPassword string `json:"currentPassword"`
        NewPassword     string `json:"newPassword"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "invalid request body", http.StatusBadRequest)
        return
    }

    if len(req.NewPassword) < 8 {
        http.Error(w, `{"error":"password must be at least 8 characters"}`, http.StatusBadRequest)
        return
    }

    // Verify current password
    user, _ := auth.Store.GetUser(email)
    if user == nil {
        http.Error(w, `{"error":"user not found"}`, http.StatusUnauthorized)
        return
    }
    if err := auth.CheckPassword(user.PasswordHash, req.CurrentPassword); err != nil {
        http.Error(w, `{"error":"current password incorrect"}`, http.StatusUnauthorized)
        return
    }

    // Hash new password
    hash, err := auth.HashPassword(req.NewPassword)
    if err != nil {
        http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
        return
    }

    // Update in DB
    if err := auth.Store.SetPasswordHash(email, hash); err != nil {
        http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
        return
    }

    _ = auth.Store.LogAudit(email, "change_password", email, "password changed by user")

    w.Header().Set("Content-Type", "application/json")
    w.Write([]byte(`{"ok":true}`))
})
```

### 6e. `POST /api/admin/reset-password` — Admin resets a user's Flux password

```go
// Add inside the existing /api/admin/users/ handler (main.go ~line 682)
// or as a separate route:

http.HandleFunc("/api/admin/reset-password", func(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
        return
    }

    // Must be admin+
    if !auth.CheckPermission(r, "manage:users") {
        http.Error(w, "forbidden", http.StatusForbidden)
        return
    }

    var req struct {
        Email       string `json:"email"`
        NewPassword string `json:"newPassword"` // if empty, generate random
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "invalid request body", http.StatusBadRequest)
        return
    }

    password := req.NewPassword
    if password == "" {
        var err error
        password, err = auth.GenerateRandomPassword()
        if err != nil {
            http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
            return
        }
    }

    hash, err := auth.HashPassword(password)
    if err != nil {
        http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
        return
    }

    if err := auth.Store.SetPasswordHash(req.Email, hash); err != nil {
        http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
        return
    }

    // Force logout all existing sessions for this user
    _ = auth.DeleteUserSessions(req.Email)

    _, callerEmail := auth.GetUserRole(r)
    _ = auth.Store.LogAudit(callerEmail, "reset_password", req.Email, "admin reset")

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "ok":              true,
        "generatedPassword": password, // Only returned once — admin must relay to user
    })
})
```

---

## 7. Dashboard Auth — DO NOT CHANGE

**`GetUserRole()` in `internal/auth/rbac.go` is NOT modified.** The dashboard continues to authenticate exclusively via OAuth2 Proxy headers (Azure AD SSO). The session cookie / password auth system is entirely separate and only used for the Flux Console iframe.

The existing `GetUserRole()` flow:
1. Read `X-Auth-Request-Email` / `X-Forwarded-Email` headers (injected by OAuth2 Proxy)
2. Check for `@fireballz.ai` → Super Admin
3. Check SQLite user store for role/status/permissions
4. Check Azure AD group headers for role mapping
5. Default to Operator if authenticated but no role matched

**None of this changes. Leave it alone.**

---

## 8. Auto-Create Admin on Domain Addition

### The Full Flow

```
Super Admin adds new SSO domain (e.g. "acmecorp.com")
  │
  ├─ POST /api/admin/provision-domain { "domain": "acmecorp.com" }
  │
  ▼
System auto-creates:  admin@acmecorp.com
  ├─ role = "admin"
  ├─ status = "invited"
  ├─ password_hash = bcrypt(random 16-char password)
  ├─ permissions = DefaultPermissionsForRole("admin")
  │     → view:nodes, view:node-detail, launch:apps, view:facilities,
  │       view:logs, view:events, shell:pod, shell:node, deploy:apps,
  │       manage:storage, view:metrics, manage:users, manage:facilities,
  │       manage:shells, manage:flux, view:all-facilities, manage:facility-access
  ├─ display_name = "Domain Admin"
  ├─ invited_by = "system"
  │
  ▼
Email sent to admin@acmecorp.com
  ├─ Contains: email, generated password, login URL
  ├─ Tells them to change password on first login
  │
  ▼
Domain Admin opens dashboard URL
  ├─ SSO: if acmecorp.com is in Azure AD → SSO login works immediately
  │        (headers flow → GetUserRole() finds user in store → role=admin)
  ├─ OR password: POST /api/auth/login with emailed credentials
  │
  ▼
ActivateInvitedUser() flips status: "invited" → "active"
  │
  ▼
Domain Admin is now fully active with admin permissions
  ├─ Can invite users via Settings → manage:users permission
  ├─ Can assign roles (operator, engineer, manager, custom)
  ├─ Can assign granular permissions per user (UPG-026)
  │     e.g., give an engineer shell:node but NOT deploy:apps
  ├─ Can manage facility access bindings (UPG-046)
  │     e.g., user X can only see Facility A and Facility B
  ├─ Can access Flux Console (manage:flux permission)
  ├─ Can open cross-site shells (manage:shells permission)
  ├─ Can suspend/delete users they created
  ├─ CANNOT see or manage Super Admin (@fireballz.ai) accounts (UPG-027)
```

### How it ties into the granular permissions DB

The user store is already in SQLite (`users` table) with a `permissions` JSON column. When the domain admin creates users:

1. **Role-based defaults** — assigning a role (e.g., "engineer") gives that user `RoleDefaults["engineer"]` automatically
2. **Granular overrides** — the admin can toggle individual permissions on/off per user via the Settings UI. These are stored in the `permissions` JSON column and take priority over role defaults
3. **Custom role** — for fully bespoke access, set role to "custom" and cherry-pick permissions
4. **Facility scoping** — users without `view:all-facilities` only see facilities bound to them via the facility-access table (UPG-046)

The permission check chain (`HasPermission()` in [permissions.go](embernet-dashboard/internal/auth/permissions.go)):
```
Super Admin? → always true
Suspended?   → always false  
User has explicit permissions[] set? → use those (authoritative)
Otherwise    → use RoleDefaults[user.role]
```

### When a new SSO domain/namespace is added:

1. Auto-create `admin@<domain>` with:
   - `role = "admin"`
   - `status = "invited"` 
   - `password_hash` = bcrypt hash of a generated random password
   - `permissions` = default admin permissions
   - `display_name` = "Domain Admin"
   - `invited_by` = "system"

2. Email the credentials to `admin@<domain>`

3. On first login, `ActivateInvitedUser()` flips status to `"active"`

### New function: `internal/auth/domain_admin.go`

```go
package auth

import (
	"fmt"
	"log"
)

// ProvisionDomainAdmin creates an admin@<domain> account with a random
// password and sends the credentials via email. Called when a new SSO
// domain/namespace is added to the system.
//
// Returns the generated password (for logging/testing only — in
// production the password is only sent via email).
func ProvisionDomainAdmin(domain string) (string, error) {
	email := "admin@" + domain

	// Check if already exists
	existing, err := Store.GetUser(email)
	if err != nil {
		return "", fmt.Errorf("check existing admin: %w", err)
	}
	if existing != nil {
		return "", fmt.Errorf("admin@%s already exists (role: %s, status: %s)",
			domain, existing.Role, existing.Status)
	}

	// Generate random password
	password, err := GenerateRandomPassword()
	if err != nil {
		return "", fmt.Errorf("generate password: %w", err)
	}

	// Hash it
	hash, err := HashPassword(password)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}

	// Create user record
	user := &UserRecord{
		Email:        email,
		Role:         "admin",
		DisplayName:  "Domain Admin",
		Status:       "invited",
		InvitedBy:    "system",
		InvitedAt:    Now(),
		PasswordHash: hash,
		Permissions:  DefaultPermissionsForRole("admin"),
	}

	if err := Store.UpsertUser(user); err != nil {
		return "", fmt.Errorf("create admin user: %w", err)
	}

	// Set the password hash (UpsertUser doesn't handle password_hash yet
	// until you add it to the upsert query — see Section 12)
	if err := Store.SetPasswordHash(email, hash); err != nil {
		return "", fmt.Errorf("set password hash: %w", err)
	}

	// Send credentials email
	if err := SendAdminCredentials(email, password, domain); err != nil {
		log.Printf("WARNING: admin created but email failed for %s: %v", email, err)
		// Don't fail — the admin was created, password can be reset manually
	}

	_ = Store.LogAudit("system", "provision_domain_admin", email,
		fmt.Sprintf("auto-created admin for domain %s", domain))

	log.Printf("Provisioned domain admin: %s (password emailed)", email)
	return password, nil
}
```

### Email function: Add to `internal/auth/email.go`

Add this alongside the existing `SendInviteEmail` function:

```go
// SendAdminCredentials sends the auto-generated admin credentials to the
// domain admin email. Uses the same SMTP configuration as invite emails.
func SendAdminCredentials(email, password, domain string) error {
	subject := fmt.Sprintf("Your Embernet Dashboard Admin Account — %s", domain)
	body := fmt.Sprintf(`
		<h2>Welcome to the Embernet Dashboard</h2>
		<p>An admin account has been created for you on the <strong>%s</strong> domain.</p>
		<table style="margin:20px 0;border-collapse:collapse;">
			<tr><td style="padding:8px;font-weight:bold;">Email:</td><td style="padding:8px;">%s</td></tr>
			<tr><td style="padding:8px;font-weight:bold;">Password:</td><td style="padding:8px;font-family:monospace;">%s</td></tr>
		</table>
		<p><strong>Please change your password immediately after logging in.</strong></p>
		<p>As the domain admin, you can:</p>
		<ul>
			<li>Invite and manage users for your organization</li>
			<li>Assign roles and granular permissions</li>
			<li>Manage facility access</li>
			<li>Access the Flux network console</li>
		</ul>
	`, domain, email, password)

	return sendEmail(email, subject, body)
}
```

### API endpoint to trigger domain provisioning

```go
http.HandleFunc("/api/admin/provision-domain", func(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
        return
    }

    // Super admin only
    role, callerEmail := auth.GetUserRole(r)
    if role < auth.RoleSuper {
        http.Error(w, "forbidden — super admin only", http.StatusForbidden)
        return
    }

    var req struct {
        Domain string `json:"domain"` // e.g. "acmecorp.com"
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "invalid request body", http.StatusBadRequest)
        return
    }

    if req.Domain == "" {
        http.Error(w, `{"error":"domain required"}`, http.StatusBadRequest)
        return
    }

    password, err := auth.ProvisionDomainAdmin(req.Domain)
    if err != nil {
        http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusConflict)
        return
    }

    _ = auth.Store.LogAudit(callerEmail, "provision_domain", "admin@"+req.Domain,
        "domain: "+req.Domain)

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "ok":       true,
        "email":    "admin@" + req.Domain,
        "password": password, // Super admin gets this for backup
    })
})
```

---

## 9. GetUserRole() — NO CHANGES NEEDED

### File: `internal/auth/rbac.go`

**Do NOT modify `GetUserRole()`.** It stays exactly as it is today. The dashboard authenticates via OAuth2 Proxy / Azure AD SSO headers. This function is not involved in Flux Console authentication at all.

The Flux Console iframe has its own separate auth flow:
- `POST /api/flux/auth/login` → validates SQLite password → creates a Flux session → sets `_flux_session` cookie
- `/api/flux/mgmt/*` proxy handlers check for a valid `_flux_session` cookie (via `ValidateFluxSession()`) instead of calling `GetUserRole()`

### Flux session validation helper

Add a new helper specifically for Flux-authenticated endpoints:

```go
// ValidateFluxRequest checks for a valid Flux session cookie.
// Used ONLY by /api/flux/* handlers. Dashboard routes use GetUserRole() (SSO) instead.
// Returns (email, role, ok).
func ValidateFluxRequest(w http.ResponseWriter, r *http.Request) (string, Role, bool) {
    sessionID := GetFluxSessionIDFromRequest(r)
    if sessionID == "" {
        http.Error(w, `{"error":"not authenticated"}`, http.StatusUnauthorized)
        return "", 0, false
    }

    email, err := ValidateSession(sessionID)
    if err != nil || email == "" {
        http.Error(w, `{"error":"session expired"}`, http.StatusUnauthorized)
        return "", 0, false
    }

    // Look up role from user store
    if Store != nil {
        user, err := Store.GetUser(email)
        if err == nil && user != nil {
            if user.Status == "suspended" {
                http.Error(w, `{"error":"account suspended"}`, http.StatusForbidden)
                return email, 0, false
            }
            resolved := RoleFromString(user.Role)
            if !HasPermission(user, resolved, "manage:flux") {
                http.Error(w, `{"error":"no flux access"}`, http.StatusForbidden)
                return email, resolved, false
            }
            return email, resolved, true
        }
    }

    http.Error(w, `{"error":"user not found"}`, http.StatusUnauthorized)
    return "", 0, false
}

// GetFluxSessionIDFromRequest extracts the Flux session cookie.
func GetFluxSessionIDFromRequest(r *http.Request) string {
    cookie, err := r.Cookie("_flux_session")
    if err != nil {
        return ""
    }
    return cookie.Value
}
```

### Important: Unauthenticated requests

Dashboard routes: OAuth2 Proxy blocks unauthenticated requests before they reach the dashboard. No change.

Flux routes (`/api/flux/*`): These must be accessible without OAuth2 Proxy ForwardAuth (the iframe can't do SSO). The `ValidateFluxRequest()` function handles auth for these routes using the `_flux_session` cookie.

---

## 10. Helm / K8s Deployment Changes

### ⚠️ KEEP OAuth2 Proxy — DO NOT REMOVE

Dashboard SSO is untouched. **Do not remove anything:**

- ✅ **KEEP** the `oauth2-proxy` sidecar container
- ✅ **KEEP** the `_oauth2_proxy` cookie secret
- ✅ **KEEP** the `OAUTH2_PROXY_*` environment variables
- ✅ **KEEP** the Traefik ForwardAuth middleware
- ✅ **KEEP** the Azure AD group ID env vars
- ✅ **KEEP** the `oauth2Proxy` section in `values.yaml`

### What DOES change in Helm

1. **SQLite migrations** — `password_hash` column and `sessions` table are added automatically by `runMigrations()` on pod startup. No Helm template changes.

2. **Bypass ForwardAuth for Flux auth endpoints** — The Flux Console iframe cannot do SSO, so `/api/flux/auth/*` must be reachable without OAuth2 Proxy:

```yaml
# In the Ingress or Traefik IngressRoute, add a route for Flux auth
# that does NOT have the ForwardAuth middleware:
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: dashboard-flux-auth-bypass
  namespace: fireball-system
spec:
  entryPoints:
    - websecure
  routes:
    - match: PathPrefix(`/api/flux/auth/`)
      kind: Rule
      services:
        - name: dashboard-industrial-dashboard
          port: 8080
      # NO middlewares — Flux auth is handled by the dashboard backend via SQLite passwords
```

### Cookie security
The `_flux_session` cookie uses `Secure: true` for production (HTTPS). For local dev:

```go
Secure: os.Getenv("EMBERNET_DEV") == "",
```

---

## 11. Flux Console (iframe) — Login via SQLite Password

The Flux Console SPA runs inside an iframe modal in the dashboard. It **cannot** use Azure AD SSO (OAuth2 redirects break in iframes). Instead, it authenticates users via their SQLite-stored password.

### Flow

```
User is already logged into the dashboard via Azure AD SSO
  │
  ├─ User clicks "Flux Console" card in the Admin portal
  ├─ Iframe modal opens: /static/vendor/flux-console/index.html
  │
  ├─ Flux Console SPA checks for existing Flux session:
  │   GET /api/flux/auth/me (sends _flux_session cookie if present)
  │   ├─ 200 → already authenticated → skip login, show Flux UI
  │   └─ 401 → show login form
  │
  ├─ User enters email + password (the password from SQLite users.password_hash)
  ├─ POST /api/flux/auth/login { email, password }
  │   ├─ Backend verifies bcrypt hash from SQLite
  │   ├─ Checks user has manage:flux permission
  │   ├─ Creates session in sessions table
  │   └─ Sets _flux_session cookie (HttpOnly, Secure, SameSite=Lax)
  │
  ├─ Flux Console SPA now has a valid session
  ├─ All Flux API calls: /api/flux/mgmt/* (cookie sent automatically, same-origin)
  ├─ Dashboard proxy validates _flux_session → checks manage:flux permission → proxies to Flux controller
  │
  └─ User clicks CLOSE → iframe resets to about:blank → session stays valid until expiry
```

### Flux Console login form (in the iframe SPA)

The Flux Console SPA needs a login component. This replaces the old Ziti Controller `POST /authenticate` call.

```html
<!-- Minimal login form for the Flux Console SPA -->
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

<script>
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
    // Login successful — hide login form, show Flux Console UI
    document.getElementById('flux-login').style.display = 'none';
    initFluxConsole(user);
  })
  .catch(function(err) {
    errorEl.textContent = err.message;
  });
}

// On page load, check if already authenticated
fetch('/api/flux/auth/me', { credentials: 'same-origin' })
  .then(function(r) { if (!r.ok) throw new Error(); return r.json(); })
  .then(function(user) {
    // Already logged in — skip login form
    document.getElementById('flux-login').style.display = 'none';
    initFluxConsole(user);
  })
  .catch(function() {
    // Not authenticated — login form is already visible
  });
</script>
```

### What NOT to do

- ❌ Do **NOT** redirect to Azure AD SSO from within the iframe (breaks due to X-Frame-Options)
- ❌ Do **NOT** call the Ziti Controller's `POST /authenticate` endpoint directly
- ❌ Do **NOT** try to inherit the `_oauth2_proxy` cookie for Flux auth — it's for dashboard SSO only

### API calls from the Flux Console

All Flux management API calls go through the dashboard's proxy at `/api/flux/mgmt/*`. The browser sends the `_flux_session` cookie automatically (same-origin). The dashboard's `ValidateFluxRequest()` checks the cookie, verifies `manage:flux` permission, and proxies to the Flux controller.

```
iframe → GET /api/flux/mgmt/identities
       → dashboard validates _flux_session cookie
       → checks user has manage:flux permission
       → proxies to Flux controller
```

---

## 12. File-by-File Change Summary

### New Files

| File | Description |
|---|---|
| `internal/auth/password.go` | `HashPassword()`, `CheckPassword()`, `GenerateSessionID()`, `GenerateRandomPassword()` |
| `internal/auth/sessions.go` | `CreateSession()`, `ValidateSession()`, `DeleteSession()`, `SetSessionCookie()`, `StartSessionCleanup()` |
| `internal/auth/domain_admin.go` | `ProvisionDomainAdmin()` |

### Modified Files

| File | Changes |
|---|---|
| `internal/db/sqlite.go` | Add 2 migrations: `ALTER TABLE users ADD COLUMN password_hash`, `CREATE TABLE sessions` |
| `internal/auth/users.go` | Add `PasswordHash string` to `UserRecord` struct; add `SetPasswordHash()` method; update `scanUserFromScanner()` to scan `password_hash`; update `UpsertUser()` to include `password_hash` in INSERT/UPDATE |
| `internal/auth/rbac.go` | **NO CHANGES to `GetUserRole()`** — dashboard SSO auth is untouched. Add `ValidateFluxRequest()` and `GetFluxSessionIDFromRequest()` helpers for Flux Console auth only. |
| `internal/auth/email.go` | Add `SendAdminCredentials()` function |
| `cmd/dashboard/main.go` | Add Flux auth routes (`/api/flux/auth/login`, `/api/flux/auth/logout`, `/api/flux/auth/me`, `/api/flux/auth/change-password`); add `/api/admin/reset-password`; add `/api/admin/provision-domain`; call `auth.StartSessionCleanup()` in main; **do NOT touch OAuth2 Proxy or `GetUserRole()`** |

### `UserRecord` struct changes (`internal/auth/users.go`)

```go
// BEFORE:
type UserRecord struct {
    Email       string   `json:"email"`
    Role        string   `json:"role"`
    DisplayName string   `json:"displayName"`
    Status      string   `json:"status"`
    InvitedBy   string   `json:"invitedBy"`
    InvitedAt   string   `json:"invitedAt"`
    LastSeen    string   `json:"lastSeen"`
    Permissions []string `json:"permissions"`
    CreatedAt   string   `json:"createdAt"`
    UpdatedAt   string   `json:"updatedAt"`
}

// AFTER:
type UserRecord struct {
    Email        string   `json:"email"`
    Role         string   `json:"role"`
    DisplayName  string   `json:"displayName"`
    Status       string   `json:"status"`
    InvitedBy    string   `json:"invitedBy"`
    InvitedAt    string   `json:"invitedAt"`
    LastSeen     string   `json:"lastSeen"`
    Permissions  []string `json:"permissions"`
    PasswordHash string   `json:"-"`           // NEW — bcrypt hash for Flux Console login, never serialized to JSON
    CreatedAt    string   `json:"createdAt"`
    UpdatedAt    string   `json:"updatedAt"`
}
```

### `scanUserFromScanner()` changes (`internal/auth/users.go`)

Must scan the new `password_hash` column:

```go
// BEFORE (10 columns):
func scanUserFromScanner(s scanner) (*UserRecord, error) {
    var u UserRecord
    var permsJSON string
    err := s.Scan(
        &u.Email, &u.Role, &u.DisplayName, &u.Status,
        &u.InvitedBy, &u.InvitedAt, &u.LastSeen,
        &permsJSON, &u.CreatedAt, &u.UpdatedAt)
    // ...
}

// AFTER (11 columns):
func scanUserFromScanner(s scanner) (*UserRecord, error) {
    var u UserRecord
    var permsJSON string
    err := s.Scan(
        &u.Email, &u.Role, &u.DisplayName, &u.Status,
        &u.InvitedBy, &u.InvitedAt, &u.LastSeen,
        &permsJSON, &u.PasswordHash, &u.CreatedAt, &u.UpdatedAt)
    // ...
}
```

**IMPORTANT:** Every `SELECT` query in `users.go` that reads from the `users` table must now include `password_hash` in the column list, or the scan will fail with a column count mismatch. Update these functions:

- `GetUser()` — add `password_hash` to SELECT
- `ListUsers()` — add `password_hash` to SELECT  
- `ActivateInvitedUser()` — add `password_hash` to the re-read SELECT
- Anywhere else that calls `scanUser()` / `scanUserRows()`

### New `SetPasswordHash()` method (`internal/auth/users.go`)

```go
// SetPasswordHash updates only the password_hash column for a user.
func (s *UserStore) SetPasswordHash(email, hash string) error {
    db.Mu.Lock()
    defer db.Mu.Unlock()

    res, err := s.db.Exec(
        `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE email = ?`,
        hash, email)
    if err != nil {
        return err
    }
    n, _ := res.RowsAffected()
    if n == 0 {
        return fmt.Errorf("user not found: %s", email)
    }
    return nil
}
```

### `main.go` — Session cleanup startup

```go
// In main(), after auth.Store is initialized:
auth.StartSessionCleanup()
log.Println("Session cleanup goroutine started")
```

---

## Appendix A: Security Considerations

| Concern | Mitigation |
|---|---|
| Password storage | bcrypt with cost=12. Never stored in plaintext. |
| Session tokens | 32 bytes of `crypto/rand` (256 bits of entropy) |
| Cookie flags | `HttpOnly`, `Secure`, `SameSite=Lax` |
| Brute force | Add rate limiting on `/api/auth/login` (not covered here — use `golang.org/x/time/rate` or Traefik rate-limit middleware) |
| Session revocation | Database-backed sessions can be instantly revoked. `DeleteUserSessions()` on suspend/delete. |
| Password complexity | Enforce minimum 8 characters at the API level. Add more rules as needed. |
| First-login password change | Auto-created domain admins get `status = "invited"`. Consider adding a `must_change_password` flag. |

## Appendix B: Migration Checklist

### SQLite Schema
- [ ] Add `password_hash` column migration to `sqlite.go`
- [ ] Add `sessions` table migration to `sqlite.go`

### New Files
- [ ] Create `internal/auth/password.go` — bcrypt hashing helpers
- [ ] Create `internal/auth/sessions.go` — Flux session management (`_flux_session` cookie)
- [ ] Create `internal/auth/domain_admin.go` — auto-create admin on domain addition

### Modified Files
- [ ] Update `UserRecord` struct — add `PasswordHash` field
- [ ] Update `scanUserFromScanner()` — scan 11 columns
- [ ] Update all user SELECT queries — add `password_hash`
- [ ] Add `SetPasswordHash()` to `UserStore`
- [ ] Add `ValidateFluxRequest()` + `GetFluxSessionIDFromRequest()` to `rbac.go`
- [ ] **DO NOT** modify `GetUserRole()` — dashboard SSO auth is unchanged
- [ ] Add `SendAdminCredentials()` to `email.go`

### New Endpoints (all under /api/flux/auth/)
- [ ] Add `POST /api/flux/auth/login` handler — Flux Console login via SQLite password
- [ ] Add `POST /api/flux/auth/logout` handler
- [ ] Add `GET /api/flux/auth/me` handler
- [ ] Add `POST /api/flux/auth/change-password` handler
- [ ] Add `POST /api/admin/reset-password` handler (admin resets user's Flux password)
- [ ] Add `POST /api/admin/provision-domain` handler
- [ ] Call `auth.StartSessionCleanup()` in `main()`

### Helm / Ingress
- [ ] **DO NOT** remove OAuth2 Proxy sidecar from Helm chart
- [ ] **DO NOT** remove ForwardAuth annotations from Ingress
- [ ] **DO NOT** remove Azure AD group env vars
- [ ] Add Traefik bypass route for `/api/flux/auth/*` (iframe can't do SSO)

### Flux Console iframe
- [ ] Add login form to Flux Console SPA (email + password, POST to `/api/flux/auth/login`)
- [ ] Add auto-check for existing `_flux_session` on iframe load (`GET /api/flux/auth/me`)
- [ ] Remove any direct Ziti Controller `POST /authenticate` calls
- [ ] Update `/api/flux/mgmt/*` proxy handlers to use `ValidateFluxRequest()` instead of `GetUserRole()`

### Setup & Testing
- [ ] Run `go mod tidy`
- [ ] Seed initial super admin: `admin@fireballz.ai` with known Flux password
- [ ] Test: Dashboard SSO login works (unchanged)
- [ ] Test: Flux Console iframe shows login form
- [ ] Test: Flux login with SQLite password works
- [ ] Test: Flux login session persists across iframe close/reopen
- [ ] Test: Domain provisioning creates admin with Flux password and sends email
- [ ] Test: Admin can change their own Flux password
- [ ] Test: Super admin can reset a user's Flux password
