---
name: devops-cicd
description: Use for CI/CD pipelines (GitHub Actions), Docker/containers, environments, releases, infra-as-code and deploy automation, including pipeline failures (see gh-fix-ci).
---
# devops-cicd
- **Pipeline order**: install (cached) → lint → typecheck → unit tests → build → integration/E2E → security scan (`scan-dependencies`) → deploy. Fail fast; run independent jobs in parallel; pin action versions by SHA/tag.
- **Docker**: multi-stage, pinned base tags, non-root user, `.dockerignore`, one process per container, healthcheck, no secrets in layers.
- **Secrets**: CI secret store/OIDC to cloud, never in repo or logs; rotate on exposure.
- **Releases**: trunk-based, small PRs, semver tags, automated changelog; deploy previews per PR; rollback = redeploy previous tag (rehearse it).
- **IaC**: Bicep/Terraform in repo, plan in PR, apply on main with approval; see `azure-*` skills for Azure.
- **Observability**: structured logs, health endpoint, alert on error rate/latency.
- **CI red?** use `gh-fix-ci`; record cause→fix below.

## Lessons learned
(none yet)
