# Redondances du code

Ce qui reste en double ou contourne une brique commune dans le code. Les briques communes et leur rôle sont décrits dans [Code web](web/app.md) et [Code partagé](shared/cross-cutting/core.md) ; les écarts entre le code et les règles sont dans [Écarts relevés](discrepancies.md). Une entrée est retirée quand le code est corrigé.

Vérifier : `npm run dup` (jscpd, `.jscpd.json`) ne doit pas trouver plus de copies qu'aujourd'hui (3) ; les gardes eslint sont dans `apps/web/eslint.config.js` et `packages/shared/eslint-rules.js`. Chemins depuis `apps/web/src` (web) et `apps/api/src` (API).

## Copies trouvées par `npm run dup`

Trois copies, toutes en CSS :

- `components/feedback/Skeletons.module.css:24-29` et `features/geo/components/PlaceMap.module.css:8-13` ;
- `components/filters/FilterBuilder.module.css:10-19` et `components/markdown/MarkdownEditor.module.css:2-11` ;
- `features/geo/components/PlacesManager.module.css:7-14` et `:54-61`.

## Contournements des briques

- **`DraftBadge` :** l'en-tête d'un document refait le badge à la main (`Badge` et `DRAFT_NAME`, à côté de « Définitif » / « Modèle ») (`features/accounting/components/DocumentEditor.tsx:349-351`).
- **`ActionsMenu` :** le menu des lieux enregistrés (`features/geo/components/AddressInput.tsx:145`) est un arbre avec coches, trop particulier pour la brique ; laissé à part.

## Petits doublons

- **Libellés d'erreur des personnes :** la même recherche dit « Membre » (`services/treasury/treasury-budgets.ts:61`, `services/treasury/treasury.ts:108`) ou « Contributeur » (`services/treasury/treasury-team.ts:49, 66, 122`) ; les assignés disent « Assigné » (`services/tasks/tasks.ts:141`, `services/routines/routines.ts:700`), mais « Contributeur » pour les évènements (`services/calendar/calendar-events.ts:264`) et les contributeurs d'un projet (`services/projects/contributors.ts:150`).
- **API inégale :** des mutations renvoient un id au lieu de l'objet : réglages et lignes de trésorerie (`addTreasuryMember`, `saveTreasuryBudget`, `saveTreasuryRelation`, `saveTreasuryContext`…, `graphql/modules/treasury.ts:918-1090`) et `createMailSearch` (`graphql/modules/mail.ts:490`) ; `treasuryStatementPdf` renvoie `{ filename, content }` sans le type `ReportFile` (`services/treasury/treasury-pdf.ts:70`), que `calendarPdf` utilise.
