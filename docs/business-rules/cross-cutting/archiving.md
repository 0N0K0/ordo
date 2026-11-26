# Archivage

Règles communes d'archivage et de restauration : ce qui peut être archivé, ce qu'implique l'état archivé (lecture seule), les cascades et le choix de valeurs archivées dans les formulaires. Sources : `apps/api/src/services/core/archive.ts`, `apps/api/src/graphql/modules/archive.ts`, `apps/api/src/services/projects/clients.ts`, `apps/api/src/services/projects/projects.ts`, `apps/api/src/services/tasks/tasks.ts`, `apps/api/src/services/routines/routines.ts`, `apps/api/src/services/people/contributor-links.ts` (`linkedPeople`, `assertPeopleArchivable`).

Voir aussi : [Erreurs](errors.md), [Nommage](naming.md), [tables](../../shared/cross-cutting/tables.md) (option « archivés » des vues).

## Principe

- Un élément archivé porte une date `archivedAt` (non nulle). Il est **masqué par défaut** dans les listes et **en lecture seule** : champ GraphQL `archived` (« Archived: hidden by default, read only. »).
- Les tableaux ont un interrupteur pour afficher aussi les archivés (`includeArchived` d'une vue), le même partout ; aucun tableau n'a de colonne ni de vue « Actifs / Archivés ».
- Archiver et restaurer passent seulement par l'action d'archivage (`setArchived` ou la mutation propre du domaine) : aucun formulaire n'a de case « Archivé ». Côté web, « Archiver » et « Restaurer » ne sont jamais un bouton : ils sont dans le menu « … » de l'élément (ligne, en-tête de page de détail, liste de réglages).
- Archiver ne supprime rien ; restaurer remet `archivedAt` à `null`.

## Mutation générique `setArchived`

`setArchived(kind, ids, archived)` archive ou restaure plusieurs éléments d'un même type en une fois.

- Tous les ids doivent exister (« Élément introuvable. ») ; un id répété compte une fois.
- Archiver garde la date des éléments déjà archivés (seuls les actifs reçoivent la date du jour).
- Types concernés (`ARCHIVABLE`) : les éléments principaux `MILESTONE`, `SPRINT`, `DASHBOARD`, `CALENDAR_EVENT`, `WORK_SCHEDULE`, `ACCOUNTING_DOCUMENT`, `RECURRING_INVOICE`, `IMPORTED_DOCUMENT`, `TREASURY_ENTRY`, `TREASURY_BUDGET`, `TREASURY_RELATION`, `SHOPPING_LIST`, `SHOPPING_PRODUCT`, `STOCK_ITEM`, `SHEET`, `CONTRIBUTOR`, `CLIENT_CONTACT`, `MAIL_ACCOUNT`, `CATALOG_ITEM`, et toutes les listes de réglages (`SETTINGS_LISTS`) : `PROJECT_STATUS`, `PROJECT_CATEGORY`, `TASK_STATUS`, `TASK_PRIORITY`, `TASK_TYPE`, `TASK_TAG`, `DOCUMENT_STATUS`, `SHEET_CATEGORY`, `SHOPPING_STORE`, `SHOPPING_UNIT`, `SHOPPING_STORAGE`, `SHOPPING_BASE_LIST`, `SHOPPING_CATEGORY`, `MAIL_LABEL`, `CALENDAR`, `CALENDAR_CATEGORY`, `SCHEDULE_TYPE`, `TREASURY_ACCOUNT`, `TREASURY_PAYMENT_METHOD`, `TREASURY_COUNTERPARTY`, `TREASURY_CATEGORY`, `ROUTINE_CATEGORY`, `STOCK_LOCATION`, `SAVED_COUNTDOWN`, `TASK_AUTOMATION`, `PLACE`. Un contexte de trésorerie n’a pas d’archivage propre : c’est celui de son type d’éphémérides (`SCHEDULE_TYPE`).
- Les personnes vont avec ce à quoi elles sont liées (`along`, `linkedPeople`) : archiver ou restaurer un contributeur (`CONTRIBUTOR`) archive ou restaure aussi sa relation ou son contact ; une relation (`TREASURY_RELATION`) ou un contact (`CLIENT_CONTACT`), son contributeur. « Moi » n'est pas archivé, un contact d'un client archivé n'est pas restauré. Voir [Personnes liées](#personnes-liées).
- `confirmLoss` : archiver ou restaurer un créneau (`WORK_SCHEDULE`), un type de créneaux (`SCHEDULE_TYPE`), un contributeur (`CONTRIBUTOR`), une relation (`TREASURY_RELATION`) ou un contact (`CLIENT_CONTACT`, par son contributeur) change ce que donnent les conditions de créneaux (un archivé n'y compte plus) : les occurrences de routines qui disparaissent perdent leurs commentaires, listes à cocher et liens avec des évènements une fois confirmé, sinon `CONFIRMATION_REQUIRED` et rien ne change (`archiveEdit`, `settleScheduleChange`, vérifié sur les seuls éléments dont l'état change, personnes liées comprises, après l'existence ; une seule confirmation pour le tout). Voir [Routines](../activities/routines.md#créneaux-de-lagenda-conditionwindows-windowsallowed).
- `writes` : écritures enregistrées dans la même transaction que l'archivage, d'après les éléments dont l'état change : archiver un calendrier (`CALENDAR`) ou un type de créneaux (`SCHEDULE_TYPE`) supprime les abonnements des autres espaces à lui (`archivedUnsubscribed`), définitivement (le restaurer ne les rend pas). Les abonnements d’un type partent avec leurs propres réglages (couleur, affichage, « Indisponible ici ») : restaurer le type ne les rend pas, l’autre espace s’abonne de nouveau et les règle de nouveau ; entre-temps, ces horaires ne bloquent plus ses tâches, ses routines ni ses rappels, et aucune occurrence n’est perdue par là. Le web relit le nombre d’abonnements sur le serveur juste avant de décider (`subscriberCount`, un abonnement pris entre-temps compte), puis confirme d’abord un tel archivage quand des abonnements existent (confirmation destructive).
- Les **clients**, **projets**, **tâches** et **routines** ont leurs propres mutations, à cause de leurs cascades.

## Lecture seule

Toute modification d'un élément archivé, ou d'un sous-élément d'un élément archivé, est refusée en `BAD_USER_INPUT` : « Élément archivé : restaurez-le pour le modifier. » (`ARCHIVED_MESSAGE`), le seul message d'archivé, affiché en erreur sous le champ (sauf pour un élément archivé d'un autre espace, qui ne se restaure pas d'ici : voir [Erreurs](errors.md#messages)).

- `findActive(model, id, what)` : charge l'élément (« X introuvable. ») puis refuse s'il est archivé.
- `refuseArchived(record, field?)` : refuse un élément déjà chargé.
- `refuseForeignArchived(record, what)` : refuse un élément archivé d'un autre espace déjà chargé, avec son message propre (`FOREIGN_ARCHIVED_MESSAGES` : « Ce calendrier est archivé. », « Ce type est archivé. ») ; voir [Erreurs](errors.md#messages).
- `assertActive(model, id, what, options)` : existence et non-archivage en une requête.
- La couleur et l'image d'un élément de réglages archivé ne changent pas (`setSettingsItemLook`).
- Les listes à cocher d'une routine, d'un évènement ou d'une tâche archivés (voir [Fiches](../supplies/sheets.md#listes-à-cocher)), et leurs fiches rattachées.
- Les listes de libellés (`createLabelService`, dont la modification ne change que les champs envoyés : `presentFields`, aucune valeur par défaut ajoutée pour un champ omis ; un `null` laisse un champ inchangé, sauf pour un champ facultatif déclaré `clearable`, qu’il vide : la sonnerie d’un minuteur enregistré, la condition d’une automatisation des tâches ; `stored` donne la valeur à enregistrer, une colonne JSON vidée par exemple) et les arbres de réglages (`treeListService`) refusent la modification d'un élément archivé ; un élément archivé ne reçoit pas de nouvel enfant (ceux déjà présents restent).
- Commentaires : on ne commente pas, ne modifie pas et ne supprime pas un commentaire d'un élément archivé, ni d'un élément contenu dans un élément archivé (article de fiche dans une fiche archivée, article de liste dans une liste archivée) (`apps/api/src/services/core/comments.ts`).
- Les sous-éléments verrouillés par leur parent : périodes d'un contexte de trésorerie archivé (ni ajout, ni modification, ni suppression).
- La lecture seule vaut pour les utilisateurs. La synchronisation GitHub n'y est pas soumise : une tâche archivée liée à un item reste synchronisée dans les deux sens (champs, état, parent, liens « bloquée par » et « relative à », commentaires, parent archivé accepté) ; l'archivage d'une tâche et celui de son item sur le tableau se suivent dans les deux sens (cascades habituelles) ; une tâche dont l'item quitte le tableau est archivée par elle, avec un commentaire (voir [GitHub](github.md#étapes)).
- Un contact archivé n'est pas modifié (il reste supprimable) ; un contact d'un client archivé n'est ni modifié ni supprimé.

## Valeur archivée choisie dans un formulaire

Une valeur archivée ne peut plus être **nouvellement** choisie, mais les valeurs déjà présentes restent valides.

- `assertNotArchived(target, id, { keep, field })`, `assertNoneArchived(target, ids, { keep, field })`, `activeIds(model, ids, what, { keep, field, missingField })` : les ids de `keep` (valeurs actuelles du champ) sont acceptés même archivés ; l'erreur s'affiche sous `field`.
- S'applique partout : catégories, statuts, priorités, types, étiquettes, agendas, créneaux, contributeurs (assignés, bénéficiaires), relations, contacts (documents, lien d'un contributeur), projets et clients archivés, routines préalables, parents d'arbre, etc.
- Annuler une action (« undo ») qui rend des valeurs anciennes accepte les valeurs archivées (paramètre `restoring` de certains services, ex. routines).

## Cascades

Les projets, tâches, routines, contacts et contributeurs utilisent un indicateur `archivedByCascade` pour distinguer un élément archivé avec son parent (ou son client) d'un élément archivé seul ; archivé ou restauré seul, il le perd.

### Client

- Archiver un client archive, dans la même transaction, ses projets actifs, ses contacts actifs et les contributeurs actifs liés à ses contacts (`archivedByCascade = true`).
- Restaurer un client restaure les projets, les contacts et les contributeurs archivés avec lui, pas ceux archivés seuls.
- Tant que le client est archivé, ses contacts ne sont pas restaurés seuls, ni par leur contributeur : « Restaurez d’abord le client. » (`BAD_USER_INPUT`, `assertPeopleArchivable`).
- Aucune confirmation de perte : un contributeur lié à un contact n'a pas d'anniversaire, aucune condition de créneaux ne change.
- Supprimer un client : les contributeurs de ses contacts archivés avec lui restent archivés, seuls (et sans lien).

### Personnes liées

- Un contributeur et ce à quoi il est lié (sa relation ou son contact, voir [Lien d'un contributeur](people.md#lien-dun-contributeur)) sont archivés et restaurés ensemble, dans les deux sens : archiver ou restaurer l'un archive ou restaure l'autre, dans la même transaction.
- Un membre est son propre contributeur (une seule ligne) : rien d'autre ne le suit. « Moi » est toujours membre : aucune relation ni aucun contact ne lui est lié.
- « Moi » n'est jamais archivé : « Vous ne pouvez pas vous archiver. » (`BAD_USER_INPUT`), vérifié sur tous les éléments dont l'état change, personnes liées comprises (`assertPeopleArchivable`) ; l'archivage d'un client n'emporte jamais « Moi » (`userId` exclu de la cascade).
- Un client n'est pas une personne : archiver un contact ou son contributeur n'archive pas le client ; restaurer un contact (ou son contributeur) d'un client archivé est refusé : « Restaurez d’abord le client. ».
- Ces refus sont vérifiés avant la confirmation de perte : refusé, rien ne change.

### Projet

- Archiver un projet archive tous ses sous-projets actifs (cascade).
- Restaurer un projet restaure ses sous-projets archivés avec lui, ainsi que ses ancêtres archivés **seuls** : les autres sous-projets de ces ancêtres, archivés avec eux, restent alors archivés « par eux-mêmes » (`archivedByCascade` remis à faux).
- Restaurer un projet dont le client est archivé restaure aussi le client (seul) ; les autres projets archivés avec ce client restent archivés par eux-mêmes.

### Tâche

- Même mécanique que les projets (`archiveTree`, sur `cascadeArchive`) : sous-tâches actives archivées avec la tâche, restauration des sous-tâches archivées avec elle et des ancêtres archivés seuls.

### Routine

- Archivage groupé `bulkSetRoutinesArchived(ids, archived)` : chaque id doit exister, un id répété compte une fois, la date des déjà archivées est gardée.
- Même mécanique que les tâches (`archiveTree`) : archiver une routine archive ses sous-routines actives, la restaurer restaure celles archivées avec elle et ses parentes archivées seules. Une routine sélectionnée sous une autre sélectionnée suit celle-ci (`topmostIds`).
- Une routine archivée n'a plus d'occurrence due ni à venir ; ses occurrences ouvertes avant le jour de l'archivage restent, archivées, en lecture seule, même dues ce jour-là ou après (aucune qui s'ouvre à partir de ce jour) ; la restaurer lui rend toutes ses occurrences (`archivedOn`). Archivée parce qu'une suppression « celle-ci et les suivantes » ne lui laisse rien, elle l'est avec ses sous-routines.

### Évènement

- `setArchived(CALENDAR_EVENT)` archive toute la série ; comme pour une routine, seules ses occurrences commencées avant le jour de l'archivage restent, archivées, même finies ce jour-là ou après ; aucune qui commence ensuite. Restauré, il retrouve toutes ses occurrences.
- Les modifications groupées sont refusées si la sélection contient une routine archivée.

## Effets de l'archivage ailleurs

- Factures récurrentes archivées : n'émettent plus ; à la restauration, elles reprennent à la prochaine date à venir sans rattraper les dates manquées (voir [Tâches de fond](background-jobs.md)).
- Boîtes mail archivées : leurs envois programmés attendent la restauration ; le suivi des conversations les ignore.
- Calendriers archivés : jamais affichés ni proposés dans un autre espace ; leurs abonnements sont supprimés à l'archivage, pour de bon (voir [Règles de l’agenda](../activities/calendar.md#abonnements-aux-calendriers-dautres-espaces)).
- Types de créneaux archivés : de même, plus proposés à l’abonnement dans un autre espace, leurs abonnements supprimés à l’archivage, pour de bon (voir [Règles de l’agenda](../activities/calendar.md#abonnements-aux-types-de-créneaux-dautres-espaces)).
- Contributeurs archivés : ne sont plus rattachés automatiquement aux projets de leurs tâches.
- `firstActive(model, where)` : premier élément actif d'une liste dans son ordre manuel, sinon le premier archivé (ex. agenda par défaut).

## Archiver ou supprimer

La suppression est distincte : elle est définitive et suit les règles de suppression de chaque domaine (voir les pages métier) et les cascades de la base (voir [Ordre](ordering.md) pour les arbres et les pages de domaine). Côté web, toute suppression passe par une confirmation destructive (« Cette action est irréversible. », ajoutée par `confirmDestructive`).

- Un élément archivé **reste supprimable** : la suppression n'est pas une modification, et le web l'offre avec « Restaurer » sur un élément archivé (tableaux de bord, évènements, mouvements de trésorerie, listes, produits, articles, fiches, jalons, sprints, etc.). Les règles de suppression propres au domaine s'appliquent toujours (un document définitif ne se supprime jamais, un compte qui a des mouvements non plus…).
- Un **sous-élément** d'un élément archivé, lui, ne se supprime pas : c'est une modification de l'élément archivé (élément d'une liste archivée, article d'une fiche archivée, ressource d'un projet archivé, diagramme d'un tableau archivé, brouillon d'une boîte archivée, élément d'une liste à cocher d'un propriétaire archivé, contact d'un client archivé…).
