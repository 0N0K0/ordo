# Règles métier : espaces (PRO / PERSO) et changement d’espace

Règles des espaces de travail : création, type professionnel ou personnel, semaine, notifications d’un espace fermé, ordre, suppression, et la façon dont chaque requête est rattachée à un espace. Sources : `apps/api/src/services/workspaces/**`, `apps/api/src/workspace-context.ts`, `apps/api/src/db.ts`, `apps/api/src/graphql/modules/workspaces.ts`, `packages/shared/src/core/workspace.ts`, `packages/shared/src/dates/weeks.ts`.

L’authentification, les comptes et le partage entre utilisateurs sont décrits dans [Espaces et accès](workspaces-and-access.md).

## Cloisonnement des données

Sources : `apps/api/src/workspace-context.ts`, `apps/api/src/db.ts`.

- Toutes les données appartiennent à un espace, sauf les modèles partagés `Workspace`, `User`, `Session`, `AuthToken` et `RateLimit` (`SHARED` dans `db.ts`).
- Le client Prisma `prisma` est limité à l’espace courant : les lectures, mises à jour et suppressions sont filtrées par `workspaceId`, et les créations (y compris les créations imbriquées des relations) reçoivent l’espace courant. L’espace d’une ligne ne change jamais.
- L’espace courant est porté par un `AsyncLocalStorage` (`runInWorkspace`, `currentWorkspace`, `currentWorkspaceId`). Une requête sur des données d’espace hors de tout espace lève une erreur interne (« No workspace… »).
- `unscopedPrisma` sert aux modèles partagés et aux opérations qui traversent les espaces (liste des espaces, suppression…).
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
- Les règles d’horaires de l’agenda diffèrent aussi selon le type (`services/calendar/slot-rules.ts`) : voir [Agenda](../activities/calendar.md).

## Création

`createWorkspace({ label, kind })` :

- `label` : requis, coupé, 250 caractères au plus (`workspaceLabelSchema`, `TEXT_MAX`, décision DO) : « Le libellé est requis. », « 250 caractères maximum. ».
- `kind` : `PRO` ou `PERSO`.
- Le nouvel espace va à la fin du sélecteur.
- Mise en place (`setUpWorkspace`), aussi rejouée à chaque modification :
  - un contributeur « Moi » pour **chaque** utilisateur qui n’en a pas encore (`ensureMeContributor`) ;
  - un agenda par défaut (`resolveCalendarId`) ;
  - pour un espace PRO : un statut de suivi pour chaque catégorie de suivi des documents, ceux déjà présents conservés (`ensureDocumentStatuses`) ;
  - si l’espace n’a aucune unité d’achat : les unités usuelles (`DEFAULT_SHOPPING_UNITS`).

## Modification

`updateWorkspace(id, { label, kind })` :

- Mêmes validations qu’à la création ; espace introuvable : « Espace introuvable. ».
- Passer de PRO à PERSO est refusé si l’espace a au moins un client, un document comptable ou un document importé : « Cet espace a des clients ou des documents de facturation : il ne peut pas devenir personnel. ».
- Passer de PERSO à PRO est toujours possible ; la mise en place crée alors les statuts de suivi.

## Semaine

`setWorkspaceWeek(id, { start, end })` (`weekSpanSchema`) : premier et dernier jour, de 1 (lundi) à 7 (dimanche). Par défaut lundi → dimanche (`DEFAULT_WEEK`).

- Longueur (`weekLength`) : nombre de jours de `start` à `end` inclus ; si `end` = `start`, la semaine fait **8 jours** et les semaines se chevauchent ce jour-là.
- Une valeur illisible en base est lue comme la semaine par défaut (`readWeek`).
- Elle sert à la vue semaine de l’agenda, aux périodes « cette semaine », etc. Voir [Dates](dates.md).

## Notifications d’un espace fermé

`setWorkspaceNotifications(id, sources)` : choix parmi `NOTIFICATION_SOURCES = ['ALARMS', 'CALENDAR', 'MAILS']` (alarmes, rappels d’agenda, nouveaux mails), doublons retirés. Ces notifications sont données par le navigateur tant qu’un **autre** espace est ouvert (voir [Espaces, fonctionnalités](../../features/cross-cutting/workspaces.md)).

## Ordre

`moveWorkspace(id, index)` : réordonne le sélecteur (« Espace introuvable. » si l’id n’existe pas). La requête `workspaces` les rend par position.

## Suppression

`deleteWorkspace(id)` :

- Le dernier espace ne peut pas être supprimé : « Le dernier espace ne peut pas être supprimé. ».
- Dans l’espace, une transaction supprime d’abord ce que d’autres lignes empêchent de supprimer : affectations et écritures de trésorerie, lien source des documents comptables, documents comptables. Puis la suppression de l’espace emporte tout le reste en cascade.
- Les boîtes mail elles-mêmes restent sur leur serveur (seules les données d’Ordo partent).

## Colonnes par défaut des vues de tâches

`taskColumnDefaults()` / `setTaskColumnDefaults(input | null)` : ordre et colonnes masquées avec lesquels démarrent les nouvelles vues de tâches de l’espace (`taskColumnDefaultsSchema`) ; `null` revient aux colonnes de l’application. Voir [Tâches](../activities/tasks.md).

## Tâches de fond par espace

Source : `forEachWorkspace`, `schedulePerWorkspace`.

- `forEachWorkspace(job, { kind })` exécute une tâche dans chaque espace (d’un type, éventuellement), l’un après l’autre ; une erreur dans un espace est journalisée (« Workspace « X »: ») sans arrêter les autres.
- `schedulePerWorkspace(label, job, { delay, interval, kind })` lance la tâche `delay` ms après le démarrage puis toutes les `interval` ms ; un échec est journalisé (« <label> en échec. ») et le tour suivant a lieu quand même. Liste des tâches : [Tâches de fond](background-jobs.md).

## Contributeur « Moi »

- `meContributorId(userId)` : contributeur lié à l’utilisateur dans l’espace courant.
- `ensureMeContributor(user)` : le crée s’il manque (voir [Projets › Contributeurs](projects.md#contributeurs)).
