# CLAUDE.md — Ordo

Rules for every change in this repository, by Claude or any agent.

## Where to look before writing

The global rule « reuse before writing, never write the same thing twice » (`~/.claude/CLAUDE.md`) applies. In Ordo, the shared bricks are:

- web: `apps/web/src/components/**`, `apps/web/src/lib/**`;
- API: `apps/api/src/services/core/**`, `apps/api/src/graphql/*.ts`, `apps/api/src/routes/http.ts`;
- shared: `packages/shared/src/**` (re-exported by `@ordo/shared`).

`docs/code-redundancies.md` lists what was unified (« Déjà unifié ») and the decisions taken. Lint guards live in `apps/web/eslint.config.js`.

## Other rules

- Folder layout: web `features/<feature>/{api,pages,components,hooks,lib}`, web `components/<domain>`, `packages/shared/src/<domain>`, `apps/api/src/services/<domain>`.
- One shared component per UI role; forms in the side panel (`openFormPanel`), modals only for confirmations.
- Migrations are append-only and must run on PostgreSQL 9.6.
- JSDoc on every function. Icons: `@phosphor-icons/react`.
- The documents library (`features/library`, `services/library`) will be rewritten: leave it alone.
- Duplicates: `npm run dup` (jscpd, `.jscpd.json`) must not report more clones after a change than before (baseline 2026-11-18: 4 clones).
- Checks: `npx tsc --noEmit` (api, shared), `npx tsc --noEmit -p tsconfig.app.json` and `npx eslint src` (web).
