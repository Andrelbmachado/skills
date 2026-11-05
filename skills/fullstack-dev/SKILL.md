---
name: fullstack-dev
description: Use when building or extending a full-stack application (frontend + API + database + auth + deploy). Gives the project skeleton, stack choice rules, API/contract-first workflow and the checklist of skills to auto-invoke (frontend-design, database-dev, devops-cicd, security-best-practices, test-driven-development).
---
# fullstack-dev
1. **Scope first**: write PLAN.md (users, flows, data, non-goals) via `writing-plans`; pick the simplest stack that fits (static HTML/JS → Vite/React or Next → add API/DB only when state demands it).
2. **Contract first**: define API (OpenAPI or typed route signatures) and DB schema before UI; share types between client and server.
3. **Layers**: UI (`frontend-design`, `web-design-guidelines`) → API (validate every input, central error shape, auth middleware) → data (`database-dev`) → infra (`devops-cicd`).
4. **Auth**: never roll your own crypto; hashed passwords (argon2/bcrypt), httpOnly+SameSite cookies or short JWT + refresh, CSRF on cookies, rate-limit login. Invoke `security-best-practices`.
5. **Tests**: `test-driven-development` for API + critical flows; one E2E happy path with `playwright`.
6. **Config**: 12-factor env vars, `.env.example`, no secrets in git.
7. **Definition of done**: build + tests + lint green, E2E passes, README with run steps, `verification-before-completion`.
8. Missing skill? invoke `manager` (`ensure-skill.sh`).

## Lessons learned
(none yet — cue / lesson / evidence / confidence)
