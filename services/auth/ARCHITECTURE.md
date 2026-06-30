# ArsTechnicAI — User Authentication Architecture

> **Document Version**: 2.0 · **Last Updated**: June 2026
>
> This document defines the authentication and authorization architecture for ArsTechnicAI. It balances pragmatic implementation (what exists today) with aspirational vision (where we're going).

---

## Current Implementation (Pragmatic Reality)

### Stack
- **Framework**: NextAuth.js v4 (App Router compatible)
- **Session**: JWT (HTTP-only, Secure, SameSite=Strict)
- **Password Hashing**: bcrypt (cost factor 12)
- **Database**: PostgreSQL (PrismaAdapter) — optional; falls back to JWT-only when DB absent
- **OAuth Providers**: Google, GitHub
- **Credentials Provider**: Email + password with registration flow

### Auth Flow (Current)

```
┌─────────────┐     POST /api/auth/callback/credentials    ┌──────────────┐
│   Client    │──────────────────────────────────────────▶│  NextAuth    │
│  (Browser)  │                                           │  Handler     │
└─────────────┘                                           └──────────────┘
                                                                │
                                                    ┌───────────┴───────────┐
                                                    ▼                       ▼
                                             ┌──────────────┐      ┌──────────────┐
                                             │  JWT Token   │      │  DB Session  │
                                             │  (always)    │      │  (if DB URL) │
                                             └──────────────┘      └──────────────┘
                                                    │
                                                    ▼
                                             ┌──────────────┐
                                             │  HTTP Cookie │
                                             │  (secure)    │
                                             └──────────────┘
```

### Roles (Current)

| Role | Description | Privileges |
|------|-------------|------------|
| `SUPERADMIN` | System administrator | Full access, user management, system config |
| `ADMIN` | Instance administrator | Project management, user management (limited) |
| `CREATOR` | Content creator (default) | Create/edit/delete own projects, generate, export |
| `USER` | Basic user | View, limited creation |
| `VIEWER` | Read-only | View only |

### Offline Mode

When `DATABASE_URL` is absent:
- NextAuth runs in JWT-only mode (no `PrismaAdapter`)
- Credential login returns `null` gracefully (no DB to verify against)
- OAuth providers still work (they validate externally)
- All state stored in browser localStorage

---

## Core Design Principles

1. **Cryptographic Security**: bcrypt for passwords, JWT for sessions
2. **Minimal PII Collection**: Only email and name; no address, phone, or demographic data
3. **Privacy-First**: User data never leaves the system without explicit consent
4. **Offline-First**: Auth must not block app functionality when server is unreachable
5. **Defense in Depth**: Multiple security layers — network, application, data

---

## Security Mechanisms

### Current

| Mechanism | Implementation | Status |
|-----------|---------------|--------|
| Password hashing | bcrypt (cost 12) | ✅ |
| JWT session tokens | NextAuth JWT | ✅ |
| HTTP-only cookies | Secure + SameSite=Strict | ✅ |
| OAuth 2.0 | Google, GitHub providers | ✅ |
| Session expiry | Configurable JWT maxAge | ✅ |
| Device tracking | SHA-256 fingerprint + geo via ip-api.com | ✅ |

### Planned / Recommended

| Mechanism | Priority | Notes |
|-----------|----------|-------|
| CSRF protection | 🔴 Critical | Add to all state-changing API routes |
| Rate limiting on login | 🔴 Critical | 5 attempts/5 min per IP |
| 2FA (TOTP) | 🟠 High | Time-based one-time passwords |
| Session revocation | 🟠 High | Force logout across all devices |
| Audit logging | 🟡 Medium | Log all auth events (login, logout, role change) |
| API key encryption (localStorage) | 🟡 Medium | Web Crypto AES-GCM for at-rest keys |
| Passkey/WebAuthn | 🟢 Low | Biometric/pin-based passwordless login |
| Hardware token support | 🟢 Low | YubiKey, FIDO2 |

---

## Identity Management

### Current
- Centralized user table in PostgreSQL
- Email as primary identifier
- Optional display name and avatar

### Future Vision (Aspirational)
- **Decentralized Identifier (DID)** support for self-sovereign identity
- **Zero-Knowledge Proofs** for authentication without revealing credentials
- **Selective Disclosure** — share only what's needed per context
- **Social Graph Integration** — connect across platforms without centralized DB

> ⚠️ **Note**: The aspirational vision (DID, ZKP, blockchain-inspired) represents long-term R&D direction, not current implementation. The current system uses standard, battle-tested NextAuth patterns which are the correct choice for a production web application. The advanced cryptographic patterns described in the original `services/auth/ARCHITECTURE.md` are academically interesting but not yet practical for this use case.

---

## Access Control

### Current: Role-Based Access Control (RBAC)

```
SUPERADMIN → Full system access
    │
    ▼
ADMIN → Manage users (limited), all projects
    │
    ▼
CREATOR → CRUD own projects, generate, export, publish
    │
    ▼
USER → View, limited creation
    │
    ▼
VIEWER → Read-only access
```

### Route Protection

| Route | Minimum Role | Notes |
|-------|-------------|-------|
| `/api/admin/*` | ADMIN | Administrative functions |
| `/api/projects/create` | CREATOR | Create new projects |
| `/api/projects/[id]/edit` | CREATOR | Edit own projects |
| `/api/generate` | CREATOR | AI generation |
| `/api/users/me` | USER | Own profile |
| `/api/publish/*` | CREATOR | Social publishing |

### Future: Attribute-Based Access Control (ABAC)

```
Grant access IF:
  role IN [CREATOR, ADMIN]
  AND project.ownerId = session.userId
  AND session.deviceId IN project.trustedDevices
  AND time.now BETWEEN project.accessWindow.start AND project.accessWindow.end
```

---

## Authentication Layers (Defense in Depth)

```
┌─────────────────────────────────────────────┐
│ LAYER 1: Transport Security                 │
│ • TLS 1.3 (Nginx)                           │
│ • HSTS header                               │
│ • Secure cookie flags (HttpOnly, Secure)    │
├─────────────────────────────────────────────┤
│ LAYER 2: Authentication                     │
│ • NextAuth JWT + PrismaAdapter              │
│ • bcrypt passwords (cost 12)                │
│ • OAuth 2.0 (Google, GitHub)                │
│ • Rate-limited login attempts               │
├─────────────────────────────────────────────┤
│ LAYER 3: Authorization                      │
│ • RBAC middleware on API routes             │
│ • Owner-based resource access               │
│ • Session validation on each request        │
├─────────────────────────────────────────────┤
│ LAYER 4: Monitoring                         │
│ • Audit log: all auth events                │
│ • Anomaly detection: unusual login patterns │
│ • Session activity tracking                 │
└─────────────────────────────────────────────┘
```

---

## Privacy Guarantees

| Guarantee | Implementation |
|-----------|---------------|
| No centralized user DB required | Offline mode works without PostgreSQL |
| Encrypted credential storage | bcrypt (one-way hash), never stored in plaintext |
| User-controlled data | Telemetry opt-out, data export, account deletion |
| Minimal PII | Only email + name; no address, phone, SSN, or demographic data |
| Local-first | All user data stays on device by default, sync is opt-in |

---

## Implementation Files

| File | Purpose |
|------|---------|
| `lib/auth/options.ts` | NextAuth configuration (JWT, adapters, callbacks) |
| `lib/auth/device.ts` | SHA-256 device fingerprint, geo via ip-api.com |
| `pages/api/auth/[...nextauth].ts` | NextAuth API handler |
| `pages/auth/signin.tsx` | Custom sign-in page |
| `pages/auth/register.tsx` | Custom registration page |
| `pages/auth/error.tsx` | Auth error page |
| `pages/api/users/me.ts` | Profile + stats + devices + sessions |
| `pages/api/users/me/settings.ts` | Cross-device settings sync |
| `stores/authStore.ts` | Client-side auth state (optional, for UI) |

---

*This document supersedes the previous aspirational-only architecture. Current implementation uses standard, audited NextAuth patterns. Advanced cryptographic features (DID, ZKP, quantum-resistant) are long-term R&D targets, not current production goals.*
