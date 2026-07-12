# Public release checklist

This checklist records the initial v0.2.0 public release. Repository publication still requires the owner's explicit approval.

## Repository boundary

- [x] Confirm that the repository intentionally retains all rights until a license is selected.
- [x] Confirm that README, deployment, security, contribution, and release documentation contain no private infrastructure details.
- [x] Confirm that every documented example file is tracked and that copied secret files remain ignored.
- [x] Confirm that retired server-operations artifacts are absent from the release tree.
- [x] Review generated files, fixtures, screenshots, logs, database dumps, and archives for personal or confidential data.

## Clean initial history

The operational repository previously contained host-specific deployment history. That history is not part of the public repository.

1. A complete private backup bundle is created under the ignored `work/private/` directory.
2. The reviewed release tree is written as a new parentless root commit with public no-reply author metadata.
3. Only that root commit, the public `main` branch, and reviewed release tags may be pushed.
4. Legacy refs, Codex checkpoints, bundles, logs, dumps, environment files, and server scripts are never pushed.
5. The prospective public tree is scanned for domains, IP addresses, emails, credentials, host paths, large blobs, and retired download-service artifacts.

If any real secret was ever committed, history rewriting is not sufficient: revoke or rotate the credential first.

## Automated gates

- [x] `pnpm install --frozen-lockfile`
- [x] `pnpm format:check`
- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] `docker compose --env-file infra/.env.production.example -f infra/compose.yaml config --quiet`
- [x] Production Docker image builds from the reviewed release tree.
- [ ] Gitleaks and CodeQL complete without unresolved findings on GitHub.
- [x] `pnpm audit --prod` reports no known vulnerabilities.

## Release and rollback

- [x] Version follows Semantic Versioning and release notes identify user-visible and deployment changes.
- [x] Database migrations and the required fresh-database boundary are documented.
- [x] A fresh PostgreSQL 18 migration is tested from the production image.
- [x] A backup is verified by restoring it into an isolated database.
- [ ] The production image is tagged with the release version and immutable commit SHA.
- [x] Rollback steps name the previous image and required schema restore boundary.
- [x] The release owner explicitly approved a public repository and production data reset.
