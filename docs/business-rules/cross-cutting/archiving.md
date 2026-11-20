# Archivage

Règles communes d'archivage et de restauration : ce qui peut être archivé, ce qu'implique l'état archivé (lecture seule), les cascades et le choix de valeurs archivées dans les formulaires. Sources : `apps/api/src/services/core/archive.ts`, `apps/api/src/graphql/modules/archive.ts`, `apps/api/src/services/projects/clients.ts`, `apps/api/src/services/projects/projects.ts`, `apps/api/src/services/tasks/tasks.ts`, `apps/api/src/services/routines/routines.ts`.

Voir aussi : [Erreurs](errors.md), [Nommage](naming.md), [tables](../../shared/cross-cutting/tables.md) (option « archivés » des vues).

## Principe

- Un élément archivé porte une date `archivedAt` (non nulle). Il est **masqué par défaut** dans les listes et **en lecture seule** : champ GraphQL `archived` (« Archived: hidden by default, read only. »).
- Les tableaux ont un interrupteur pour afficher aussi les archivés (`includeArchived` d'une vue, décision AH).
- Archiver ne supprime rien ; restaurer remet `archivedAt` à `null`.

## Mutation générique `setArchived`

`setArchived(kind, ids, archived)` archive ou restaure plusieurs éléments d'un même type en une fois.

- Tous les ids doivent exister (« Élément introuvable. ») ; un id répété compte une fois.
- Archiver garde la date des éléments déjà archivés (seuls les actifs reçoivent la date du jour).
- Types concernés (`ARCHIVABLE`) : les éléments principaux `MILESTONE`, `SPRINT`, `DASHBOARD`, `CALENDAR_EVENT`, `WORK_SCHEDULE`, `ACCOUNTING_DOCUMENT`, `RECURRING_INVOICE`, `IMPORTED_DOCUMENT`, `TREASURY_ENTRY`, `TREASURY_BUDGET`, `TREASURY_RELATION`, `SHOPPING_LIST`, `SHOPPING_PRODUCT`, `STOCK_ITEM`, `SHEET`, `CONTRIBUTOR`, `MAIL_ACCOUNT`, `CATALOG_ITEM`, et toutes les listes de réglages (`SETTINGS_LISTS`) : `PROJECT_STATUS`, `PROJECT_CATEGORY`, `TASK_STATUS`, `TASK_PRIORITY`, `TASK_TYPE`, `TASK_TAG`, `DOCUMENT_STATUS`, `SHEET_CATEGORY`, `SHOPPING_STORE`, `SHOPPING_UNIT`, `SHOPPING_STORAGE`, `SHOPPING_BASE_LIST`, `SHOPPING_CATEGORY`, `MAIL_LABEL`, `CALENDAR`, `CALENDAR_CATEGORY`, `SCHEDULE_TYPE`, `TREASURY_ACCOUNT`, `TREASURY_PAYMENT_METHOD`, `TREASURY_COUNTERPARTY`, `TREASURY_CATEGORY`, `ROUTINE_CATEGORY`, `STOCK_LOCATION`, `PLACE`. Un contexte de trésorerie n’a plus d’archivage propre : c’est celui de son type d’éphémérides (`SCHEDULE_TYPE`, lot 16).
- Les **clients**, **projets**, **tâches** et **routines** ont leurs propres mutations, à cause de leurs cascades.

## Lecture seule

Toute modification d'un élément archivé, ou d'un sous-élément d'un élément archivé, est refusée en `BAD_USER_INPUT` : « Élément archivé : restaurez-le pour le modifier. » (`ARCHIVED_MESSAGE`, décision BC).

- `findActive(model, id, what)` : charge l'élément (« X introuvable. ») puis refuse s'il est archivé.
- `refuseArchived(record, field?)` : refuse un élément déjà chargé.
- `assertActive(model, id, what, options)` : existence et non-archivage en une requête.
- Les listes de libellés (`createLabelService`) et les arbres de réglages (`treeListService`) refusent la modification d'un élément archivé ; un élément archivé ne reçoit pas de nouvel enfant (ceux déjà présents restent).
- Commentaires : on ne commente pas, ne modifie pas et ne supprime pas un commentaire d'un élément archivé, ni d'un élément contenu dans un élément archivé (article de fiche dans une fiche archivée, article de liste dans une liste archivée) (`apps/api/src/services/core/comments.ts`).
- Les sous-éléments verrouillés par leur parent : périodes d'un contexte de trésorerie archivé (ni ajout, ni modification, ni suppression).

## Valeur archivée choisie dans un formulaire

Décisions AA et DA : une valeur archivée ne peut plus être **nouvellement** choisie, mais les valeurs déjà présentes restent valides.

- `assertNotArchived(target, id, { keep, field })`, `assertNoneArchived(target, ids, { keep, field })`, `activeIds(model, ids, what, { keep, field, missingField })` : les ids de `keep` (valeurs actuelles du champ) sont acceptés même archivés ; l'erreur s'affiche sous `field`.
- S'applique partout : catégories, statuts, priorités, types, étiquettes, agendas, créneaux, contributeurs (assignés, bénéficiaires), relations, projets et clients archivés, routines préalables, parents d'arbre, etc.
- Annuler une action (« undo ») qui rend des valeurs anciennes accepte les valeurs archivées (paramètre `restoring` de certains services, ex. routines).

## Cascades

Les clients, projets, tâches et routines utilisent un indicateur `archivedByCascade` pour distinguer un élément archivé avec son parent d'un élément archivé seul.

### Client

- Archiver un client archive ses projets actifs (`archivedByCascade = true`) dans la même transaction.
- Restaurer un client restaure les projets archivés avec lui, pas ceux archivés seuls.

### Projet

- Archiver un projet archive tous ses sous-projets actifs (cascade).
- Restaurer un projet restaure ses sous-projets archivés avec lui, ainsi que ses ancêtres archivés **seuls** : les autres sous-projets de ces ancêtres, archivés avec eux, restent alors archivés « par eux-mêmes » (`archivedByCascade` remis à faux).
- Restaurer un projet dont le client est archivé restaure aussi le client (seul) ; les autres projets archivés avec ce client restent archivés par eux-mêmes.

### Tâche

- Même mécanique que les projets (`archiveTree`, sur `cascadeArchive`) : sous-tâches actives archivées avec la tâche, restauration des sous-tâches archivées avec elle et des ancêtres archivés seuls.

### Routine

- Archivage groupé `bulkSetRoutinesArchived(ids, archived)` : chaque id doit exister, un id répété compte une fois, la date des déjà archivées est gardée.
- Même mécanique que les tâches (`archiveTree`, décision DQ) : archiver une routine archive ses sous-routines actives, la restaurer restaure celles archivées avec elle et ses parentes archivées seules. Une routine sélectionnée sous une autre sélectionnée suit celle-ci (`topmostIds`).
- Une routine archivée n'a plus d'occurrence due ni à venir ; ses occurrences ouvertes avant le jour de l'archivage restent, archivées, en lecture seule, même dues ce jour-là ou après (aucune qui s'ouvre à partir de ce jour) ; la restaurer remet tout comme avant (décision D21, `archivedOn`). Archivée parce qu'une suppression « celle-ci et les suivantes » ne lui laisse rien, elle l'est avec ses sous-routines.

### Évènement

- `setArchived(CALENDAR_EVENT)` archive toute la série ; comme une routine (décision D21), seules ses occurrences commencées avant le jour de l'archivage restent, archivées, même finies ce jour-là ou après ; aucune qui commence ensuite. Restauré, il retrouve toutes ses occurrences.
- Les modifications groupées sont refusées si la sélection contient une routine archivée.

## Effets de l'archivage ailleurs

- Factures récurrentes archivées : n'émettent plus ; à la restauration, elles reprennent à la prochaine date à venir sans rattraper les dates manquées (voir [Tâches de fond](background-jobs.md)).
- Boîtes mail archivées : leurs envois programmés attendent la restauration ; le suivi des conversations les ignore.
- Contributeurs archivés : ne sont plus rattachés automatiquement aux projets de leurs tâches.
- `firstActive(model, where)` : premier élément actif d'une liste dans son ordre manuel, sinon le premier archivé (ex. agenda par défaut).

## Archiver ou supprimer

La suppression est distincte : elle est définitive et suit les règles de suppression de chaque domaine (voir les pages métier) et les cascades de la base (voir [Ordre](ordering.md) pour les arbres et les pages de domaine). Côté web, toute suppression passe par une confirmation destructive (« Cette action est irréversible. », décision X).
