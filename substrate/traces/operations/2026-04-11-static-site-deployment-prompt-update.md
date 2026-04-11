---
status: completed
created_at: 2026-04-11
files_edited:
  - agent/static-site-dev.md
rationale:
  - Align static-site generation guidance with proven production deployment patterns from the Jesolo Dance Contest site.
  - Replace generic CDN-oriented advice with the containerized Next.js static export and Caddy delivery model used in production.
supporting_docs:
  - tmp/12-4-1-jesolo-dance-contest-fe/Dockerfile
  - tmp/12-4-1-jesolo-dance-contest-fe/Caddyfile
  - tmp/12-4-1-jesolo-dance-contest-fe/docker-compose.yml
  - tmp/12-4-1-jesolo-dance-contest-fe/next.config.ts
  - tmp/12-4-1-jesolo-dance-contest-fe/package.json
  - tmp/12-4-1-jesolo-dance-contest-fe/.github/workflows/docker-publish.yml
  - tmp/12-4-1-jesolo-dance-contest-fe/.github/workflows/release.yml
  - tmp/12-4-1-jesolo-dance-contest-fe/.github/workflows/trigger-build.yml
---

# Static-site deployment prompt update

## Summary of changes

Updated `agent/static-site-dev.md` to teach the production deployment model used by `tmp/12-4-1-jesolo-dance-contest-fe`.

Replaced the old generic static hosting guidance from the `## Essential Guidelines (2026 Standards)` section downward with production-specific guidance covering:

- Next.js static export to `out/`
- Bun-based dependency and build workflow
- multi-stage Docker builds
- Caddy as ingress manager and static runtime
- GHCR image publishing tied to semantic-release
- alpha, beta, and main branch release flow
- multi-architecture container publishing mindset
- `CMS_BASE_URL` as required build-time input
- local validation sequence before release
- docker-compose consumption of published images
- hardened unprivileged runtime posture

## Technical reasoning

The existing prompt optimized for generic CDN deployment. User requested a reusable prompt for producing the same family of static sites delivered in production today.

The production reference site shows a stable pattern:

- build static assets with Next.js export mode
- use Bun during build, not at runtime
- package output in a multi-stage container
- serve exported files from Caddy on port `3000`
- publish versioned container images through GitHub Actions and GHCR
- deploy published images through docker-compose rather than ad hoc hosting targets

Embedding these conventions in the subagent prompt should improve consistency across future static-site implementations and reduce drift between generated projects and real deployment infrastructure.

## Impact assessment

Positive impact:

- future static-site work should default to the same deployment architecture already proven in production
- agent guidance now matches organizational expectations for release, packaging, and runtime
- reduced chance that the agent proposes unsupported server features or mismatched hosting platforms

Scope limits:

- no application code changed
- no CI workflow changed in this repository
- update is instructional only and limited to one agent definition file

## Validation steps

Validated repository guidance and prompt conventions against:

- `AGENTS.md`
- `.github/CONTRIBUTING.md`
- existing agent prompt structure in `agent/web-app-dev.md`, `agent/javascript-typescript-dev.md`, and `agent/documentation-writer.md`

Validated production deployment model against:

- `tmp/12-4-1-jesolo-dance-contest-fe/Dockerfile`
- `tmp/12-4-1-jesolo-dance-contest-fe/Caddyfile`
- `tmp/12-4-1-jesolo-dance-contest-fe/docker-compose.yml`
- `tmp/12-4-1-jesolo-dance-contest-fe/next.config.ts`
- `tmp/12-4-1-jesolo-dance-contest-fe/package.json`
- `tmp/12-4-1-jesolo-dance-contest-fe/.github/workflows/docker-publish.yml`
- `tmp/12-4-1-jesolo-dance-contest-fe/.github/workflows/release.yml`
- `tmp/12-4-1-jesolo-dance-contest-fe/.github/workflows/trigger-build.yml`

Ran Markdown validation workflow:

1. synced `.markdownlint.json` and `.markdownlintignore`
2. ran `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot --fix`
3. reran `npx markdownlint-cli "**/*.md" --config .markdownlint.json --ignore-path .markdownlintignore --dot` with zero reported errors
