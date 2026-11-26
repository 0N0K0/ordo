# Règles métier : espaces (PRO / PERSO) et changement d’espace

Règles des espaces de travail : création, type professionnel ou personnel, semaine, notifications d’un espace fermé, ordre, suppression, et la façon dont chaque requête est rattachée à un espace. Sources : `apps/api/src/services/workspaces/**`, `apps/api/src/workspace-context.ts`, `apps/api/src/db.ts`, `apps/api/src/graphql/modules/workspaces.ts`, `packages/shared/src/core/workspace.ts`, `packages/shared/src/dates/weeks.ts`.

L’authentification, les comptes et le partage entre utilisateurs sont décrits dans [Espaces et accès](workspaces-and-access.md).

## Cloisonnement des données

Sources : `apps/api/src/workspace-context.ts`, `apps/api/src/db.ts`.

- Toutes les données appartiennent à un espace, sauf les modèles partagés `Workspace`, `User`, `Session`, `AuthToken` et `RateLimit` (`SHARED` dans `db.ts`).
- Le client Prisma `prisma` est limité à l’espace courant : les lectures, mises à jour et suppressions sont filtrées par `workspaceId`, et les créations (y compris les créations imbriquées des relations) reçoivent l’espace courant. L’espace d’une ligne ne change jamais.
- L’espace courant est porté par un `AsyncLocalStorage` (`runInWorkspace`, `currentWorkspace`, `currentWorkspaceId`). Une requête sur des données d’espace hors de tout espace lève une erreur interne (« No workspace… »).
- `unscopedPrisma` sert aux modèles partagés et aux opérations qui traversent les espaces (liste des espaces, suppression…).
- `inTransaction(work)` (`db.ts`) : tout ce que `prisma` exécute pendant `work` (dans les services appelés aussi, SQL brut et `$transaction` imbriqués compris) fait partie d’une seule transaction : tout est écrit ou rien (un échec annule tout). Appelée à l’intérieur d’une autre, elle en fait partie. Une requête faite par `unscopedPrisma` pendant `work` s’exécute hors de la transaction (elle ne voit pas ses écritures pas encore validées, et une écriture faite ainsi ne serait pas annulée) : seules des lectures y sont admises (ex. la vérification des créneaux et types d’autres espaces cités par une condition, `assertConditionSchedules`). Sert aux annulations qui enchaînent plusieurs écritures habituelles (annuler un transfert de tâches, `undoTaskTransfer` : aucune écriture par `unscopedPrisma` sur son chemin) ; les règles d’automatisation qu’elles déclenchent s’appliquent après la validation.
- `afterCommit(job)` (`db.ts`) : lance un appel en tâche de fond à un autre service, qu’un retour en arrière ne pourrait pas défaire (ex. retirer des items GitHub, `forgetGithubItems`), une fois le travail écrit : tout de suite hors de `inTransaction` ; dedans, après sa validation, et jamais si elle échoue.
- Les scripts (seed, ligne de commande) entrent dans un espace avec `enterWorkspace`.

## Choix de l’espace d’une requête

Source : `services/workspaces/workspaces.ts` (`workspaceMiddleware`, `requestedWorkspace`).

1. En-tête `x-ordo-workspace`, sinon cookie `ordo_workspace`.
2. Si l’espace demandé n’existe pas : le premier espace dans l’ordre du sélecteur.
3. S’il n’existe aucun espace : un espace « Pro » de type `PRO` est créé.

La requête `currentWorkspaceId` rend l’espace retenu. Côté web, la fenêtre mémorise son espace et envoie l’en-tête à chaque requête (voir [Espaces, code web](../../web/features/cross-cutting/workspaces.md)).

## Types d’espace

`WORKSPACE_KINDS = ['PRO', 'PERSO']`.

- **PRO** : facturation, clients, société, catalogue.
- **PERSO** : ni facturation, ni clients, ni société. `requirePro(what)` refuse les actions correspondantes avec « Indisponible dans un espace personnel (<what>). ». Appels actuels : `clients` (création d’un client), `facturation` (documents comptables, documents importés, factures récurrentes, une action de `company.ts`), `société` (`company.ts`), `catalogue` (`catalog.ts`).
- Agenda : seul un espace PRO avertit d’un évènement hors des créneaux de travail ; la condition de créneaux des tâches et routines est la même dans les deux types (sans condition : n’importe quand), voir [Agenda](../activities/calendar.md).

## Création

`createWorkspace({ label, kind })` :

- `label` : requis, coupé, 250 caractères au plus (`workspaceLabelSchema`, `TEXT_MAX`) : « Le libellé est requis. », « 250 caractères maximum. ».
- `kind` : `PRO` ou `PERSO`.
- Le nouvel espace va à la fin du sélecteur.
- Mise en place (`setUpWorkspace`), aussi rejouée à chaque modification :
  - un contributeur « Moi » pour **chaque** utilisateur qui n’en a pas encore (`ensureMeContributor`) ;
  - un agenda par défaut (`resolveCalendarId`) ;
  - pour un espace PRO : un statut de suivi pour chaque catégorie de suivi des documents, ceux déjà présents conservés (`ensureDocumentStatuses`) ;
  - si l’espace n’a aucune unité d’achat : les unités usuelles (`DEFAULT_SHOPPING_UNITS`).
- À la création seulement : les contextes du budget partagés par les autres espaces y deviennent des contextes (`addSharedContexts`, voir [Trésorerie](../finances/treasury.md#contextes-et-leurs-périodes-éphémérides)).

## Modification

`updateWorkspace(id, { label, kind })` :

- Mêmes validations qu’à la création ; espace introuvable : « Espace introuvable. ».
- Passer de PRO à PERSO est refusé si l’espace a au moins un client, un document comptable ou un document importé : « Cet espace a des clients ou des documents de facturation : il ne peut pas devenir personnel. ».
- Passer de PERSO à PRO est toujours possible ; la mise en place crée alors les statuts de suivi.

## Semaine

`setWorkspaceWeek(id, { start, end })` (`weekSpanSchema`) : premier et dernier jour, de 1 (lundi) à 7 (dimanche). Par défaut lundi → dimanche (`DEFAULT_WEEK`).

- Longueur (`weekLength`) : nombre de jours de `start` à `end` inclus ; si `end` = `start`, la semaine fait **8 jours** et les semaines se chevauchent ce jour-là.
- Une valeur illisible en base est lue comme la semaine par défaut (`readWeek`).
- Elle se règle dans les paramètres de l’agenda (section « Semaine »), pas dans les paramètres des espaces, et vaut pour tout l’espace.
- Elle sert à la vue semaine de l’agenda, aux périodes « cette semaine » des filtres, au temps prévu, à l’accueil, aux tableaux de bord et à l’envoi programmé des mails. Les sélecteurs de date ne la suivent pas : leurs semaines vont toujours du lundi au dimanche. Voir [Dates](dates.md).

## Notifications d’un espace fermé

`setWorkspaceNotifications(id, sources)` : choix parmi `NOTIFICATION_SOURCES = ['MAILS']` (nouveaux mails), doublons retirés. Les alarmes et les rappels des tâches, routines et évènements ne sont pas un choix : ils sonnent quel que soit l'espace ouvert. Ces notifications sont données par le navigateur tant qu'un **autre** espace est ouvert (voir [Espaces, fonctionnalités](../../features/cross-cutting/workspaces.md)).

## Ordre

`moveWorkspace(id, index)` : réordonne le sélecteur (« Espace introuvable. » si l’id n’existe pas). La requête `workspaces` les rend par position.

## Suppression

`deleteWorkspace(id)` :

- Le dernier espace ne peut pas être supprimé : « Le dernier espace ne peut pas être supprimé. ».
- Dans l’espace, une transaction supprime d’abord ce que d’autres lignes empêchent de supprimer : affectations et écritures de trésorerie, lien source des documents comptables, documents comptables. Puis la suppression de l’espace emporte tout le reste en cascade.
- Les boîtes mail elles-mêmes restent sur leur serveur (seules les données d’Ordo partent).

## Colonnes par défaut des nouvelles vues

Source : `tableColumnDefaults(tableKey)` / `setTableColumnDefaults(tableKey, input | null)` (`services/workspaces/workspaces.ts`), `tableColumnDefaultsSchema`, `readTableColumnDefaults`.

- Par espace et par tableau de données (sa clé `tableKey`, celle de ses vues : minuscules, chiffres et « - », 64 au plus, « Tableau invalide. ») : ordre des colonnes et colonnes masquées avec lesquels démarrent les nouvelles vues du tableau (200 colonnes au plus, identifiants de 64 caractères au plus). La colonne `label` n’est jamais masquée. Le même réglage vaut pour les vues de la page et celles des projets.
- `null` (ou une liste vide) revient aux colonnes de l’application pour ce tableau ; les autres tableaux gardent les leurs.
- Stocké dans `Workspace.tableColumns`, une valeur par clé de tableau ; 200 tableaux au plus (« Trop de tableaux ont des colonnes par défaut. »).
- « Colonnes par défaut » des options d’une vue lui redonne ces colonnes (ordre et colonnes masquées, largeurs effacées), celles de l’application si le tableau n’en a pas ; les colonnes ajoutées à l’application depuis le réglage viennent à la fin, masquées si elles le sont par défaut ; une colonne verrouillée reste affichée.
- Les vues déjà créées gardent leurs colonnes ; l’ancien identifiant de la colonne du libellé (`title` / `name`, `LEGACY_LABEL_COLUMNS`) est relu comme `label`.
- Les colonnes par défaut des tâches d’avant (`Workspace.taskColumns`, qui n’est plus lu) sont celles du tableau `tasks`.

Inventaire des tableaux et des paramètres où chacun se règle : [Paramètres](../../features/cross-cutting/settings.md#colonnes-des-nouvelles-vues).

## Tâches de fond par espace

Source : `forEachWorkspace`, `schedulePerWorkspace`.

- `forEachWorkspace(job, { kind })` exécute une tâche dans chaque espace (d’un type, éventuellement), l’un après l’autre ; une erreur dans un espace est journalisée (« Workspace « X »: ») sans arrêter les autres.
- `schedulePerWorkspace(label, job, { delay, interval, kind })` lance la tâche `delay` ms après le démarrage puis toutes les `interval` ms ; un échec est journalisé (« <label> en échec. ») et le tour suivant a lieu quand même. Liste des tâches : [Tâches de fond](background-jobs.md).

## Contributeur « Moi »

- `meContributorId(userId)` : contributeur lié à l’utilisateur dans l’espace courant.
- `ensureMeContributor(user)` : le crée s’il manque (voir [Projets › Contributeurs](projects.md#contributeurs)).
