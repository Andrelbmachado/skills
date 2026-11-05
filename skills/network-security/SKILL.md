---
name: network-security
description: Use for networking and hardening tasks - DNS, TLS/certs, HTTP/CORS, firewalls/NSGs, VPN/zero-trust, port/service exposure, reverse proxies, and defensive security review. Defensive and authorized use only.
---
# network-security
- **Diagnose bottom-up**: DNS (`dig`) → route/ping → port (`nc -vz`) → TLS (`openssl s_client`) → HTTP (`curl -v`) → app logs.
- **TLS**: TLS1.2+ only, auto-renew certs (ACME), HSTS, redirect 80→443. **CORS**: explicit origins, never `*` with credentials.
- **Exposure**: default-deny inbound; expose only 80/443; admin/DB ports private (VPN/bastion/private endpoint); bind dev servers to localhost.
- **Headers**: CSP, X-Content-Type-Options, frame-ancestors, Referrer-Policy; cookies Secure+HttpOnly+SameSite.
- **Hardening**: least privilege, patched images, no default creds, rate limiting, WAF for public apps, centralised logs.
- **Scope rule**: scan/test only systems the user owns or is authorised to test; for code review use `security-best-practices`, `run-security-scanner`, `determine-threat-model`.

## Lessons learned
(none yet)
