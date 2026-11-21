# CLAUDE.md — Ordo

Rules for every change in this repository, by Claude or any agent.

## The reference documentation comes first

`docs/` (index: `docs/README.md`) is the base of ALL work in Ordo, above all the business rules.

1. **Before any change** (feature, fix, refactor, review, plan), read the pages it touches: `docs/business-rules/<group>/<domain>.md` and the cross-cutting rules (`docs/business-rules/cross-cutting/`: archiving, naming, ordering, people, dates, access, files, errors, background jobs), then `docs/features/…`, `docs/web/…`, `docs/shared/…` as needed. Groups follow the app menu: `activities`, `supplies`, `finances`, `resources`, `cross-cutting`.
2. **Follow the documented rules.** A change that would break or contradict a business rule is a decision for the user: ask before doing it, never decide alone.
3. **Keep the docs true in the same change.** Any change of behaviour, rule, error message, UI string, component, hook, function or export updates the matching pages in the same commit (new export → listed in its `docs/web/` or `docs/shared/` page with its role).
4. **Discrepancies** (code vs UI vs docs, rule only enforced by the UI, missing archive check…) go to `docs/discrepancies.md`, not into the reference pages; remove an entry when it is fixed.
5. A decision is written directly in the page(s) it touches, as the rule as it stands: no decision letter, no date, no history.

## Where to look before writing

The global rule « reuse before writing, never write the same thing twice » (`~/.claude/CLAUDE.md`) applies. In Ordo, the shared bricks are:

- web: `apps/web/src/components/**`, `apps/web/src/lib/**`;
- API: `apps/api/src/services/core/**`, `apps/api/src/graphql/*.ts`, `apps/api/src/routes/http.ts`;
- shared: `packages/shared/src/**` (re-exported by `@ordo/shared`).

`docs/code-redundancies.md` lists only the redundancies still present; the shared bricks and their roles are in `docs/web/` and `docs/shared/`. Lint guards live in `apps/web/eslint.config.js`.

## Other rules

- Folder layout: web `features/<feature>/{api,pages,components,hooks,lib}`, web `components/<domain>`, `packages/shared/src/<domain>`, `apps/api/src/services/<domain>`.
- One shared component per UI role; forms in the side panel (`openFormPanel`), modals only for confirmations.
- Migrations are append-only and must run on PostgreSQL 9.6.
- JSDoc on every function. Icons: `@phosphor-icons/react`.
- The documents library (`features/library`, `services/library`) will be rewritten: leave it alone.
- Duplicates: `npm run dup` (jscpd, `.jscpd.json`) must not report more clones after a change than before (currently 3 clones).
- Checks: `npx tsc --noEmit` (api, shared), `npx tsc --noEmit -p tsconfig.app.json` and `npx eslint src` (web).
