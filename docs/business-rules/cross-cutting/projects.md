# Règles métier : projets, clients, statuts, catégories, ressources, contributeurs

Règles appliquées par l’API sur l’arbre des clients et des projets, leurs statuts et catégories, leurs ressources (fichiers et liens), les favoris et les contributeurs. Sources : `apps/api/src/services/projects/**`, `apps/api/src/graphql/modules/projects.ts`, schémas partagés de `packages/shared/src/core/workspace.ts`, `core/rules.ts` et `tasks/tasks.ts`.

Les règles communes d’archivage, de nommage et d’ordre sont détaillées dans [Archivage](archiving.md), [Nommage](naming.md) et [Ordre manuel](ordering.md). Tout ce qui suit est limité à l’espace courant (voir [Espaces et accès](workspaces-and-access.md)).

## Clients

Source : `apps/api/src/services/projects/clients.ts`.

### Champs et validations

| Champ      | Règle                                                                                                          | Message                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `name`     | requis, coupé (trim), 250 caractères au plus (`personNameSchema`, `TEXT_MAX`)                     | « Le nom est requis. », « 250 caractères maximum. »                                           |
| `color`    | facultative, format `#rrggbb` (mise en minuscules) ; une chaîne vide efface la couleur (`optionalColorSchema`) | « Couleur invalide (format #rrggbb). »                                                        |
| `icon`     | facultative, image de 1 Mo au plus, JPG, PNG, WebP ou SVG (`MAX_ICON_BYTES`, `ICON_MIME_TYPES`)                | « Image trop lourde (1 Mo maximum). », « Format non pris en charge (JPG, PNG, WebP ou SVG). » |
| `favorite` | booléen, modifiable même sur un client archivé (pas de contrôle d’archive dans `setClientFavorite`)            | —                                                                                             |
| `position` | ordre manuel ; un nouveau client va en fin de liste (`nextPositionIn('client')`)                               | —                                                                                             |

Le nom d’un client n’est pas unique.

### Espace personnel

- `createClient` appelle `requirePro('clients')` : dans un espace PERSO, la création est refusée avec « Indisponible dans un espace personnel (clients). ».
- Les autres mutations (modification, archivage, suppression) ne contrôlent pas le type d’espace ; un espace ne peut de toute façon devenir personnel que sans client (voir [Espaces](workspaces.md)).

### Modification

- `updateClient` refuse un client archivé : « Élément archivé : restaurez-le pour le modifier. » (`findActive`).
- Un champ omis reste inchangé ; `color: null` efface la couleur ; `removeIcon: true` retire l’icône, `icon` la remplace. L’ancienne icône devenue orpheline est supprimée (`deleteOrphanIcons`).

### Archivage

`setClientArchived(id, archived)` :

- Ne fait rien si le client est déjà dans l’état demandé.
- Archiver : tous les projets actifs du client (`clientId` = client, `archivedAt` nul) sont archivés à la même date avec `archivedByCascade = true`, dans la même transaction que le client.
- Restaurer : seuls les projets archivés **avec** le client (`archivedByCascade = true`) reviennent ; un projet archivé seul avant reste archivé.
- Ses contacts actifs et les contributeurs actifs liés à ses contacts suivent de même (archivés avec `archivedByCascade = true`, restaurés seulement s'ils l'ont été avec lui) ; voir [Archivage](archiving.md#client).

### Suppression

`deleteClient(id, deleteProjects)` :

- Les contributeurs de ses contacts archivés avec lui restent archivés, seuls (`archivedByCascade = false`).
- `deleteProjects = true` : tous les projets du client (archivés compris, avec leurs sous-projets) sont supprimés, puis le client. Icônes orphelines supprimées.
- `deleteProjects = false` : les projets passent « sans client » (`clientId = null`, `archivedByCascade = false`) en gardant leur arborescence ; les projets racines sont placés à la fin de la liste « Sans client », dans leur ordre actuel. Puis le client est supprimé.
- Les données de facturation liées au client suivent les règles du schéma Prisma (voir [Facturation](../finances/accounting.md)).

### Déplacement

`moveClient(id, index)` : réordonne parmi les clients **actifs** (`archivedAt: null`). La requête `clients` les rend triés par position puis par nom (`BY_POSITION_NAME`).

## Projets

Source : `apps/api/src/services/projects/projects.ts`.

### Champs et validations

| Champ                  | Règle                                                                                                                                         | Message                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `label`                | requis, coupé, 250 caractères au plus (`projectLabelSchema`) ; non unique                                                                     | « Le libellé est requis. », « 250 caractères maximum. » |
| `description`          | facultative, markdown, 65 536 caractères au plus ; blanche devient `null` (`descriptionSchema` = `markdownSchema`)                            | « Texte trop long. »                                    |
| `startDate`, `endDate` | jours `YYYY-MM-DD` facultatifs (`dateSchema`) ; la fin doit suivre le début (`assertDateRange`, comparée aux dates actuelles en modification) | « La fin doit suivre le début. »                        |
| `color`                | comme pour un client                                                                                                                          | « Couleur invalide (format #rrggbb). »                  |
| `statusId`             | un statut de projet existant et non archivé ; le statut actuel reste accepté même archivé                                                     | « Élément archivé : restaurez-le pour le modifier. »    |
| `categoryIds`          | catégories existantes et non archivées ; celles que le projet a déjà restent acceptées                                                        | idem, sur le champ `categoryIds`                        |
| `icon`                 | comme pour un client                                                                                                                          | idem                                                    |
| `clientId`             | client d’un projet racine ; il doit exister et ne pas être archivé (champ `clientId`)                                                         | « Élément archivé… »                                    |
| `parentId`             | projet parent ; voir ci-dessous                                                                                                               | voir ci-dessous                                         |

### Arbre et profondeur

- Un projet a au plus un parent ; la profondeur maximale est `MAX_PROJECT_DEPTH = 5` (un projet racine est au niveau 1).
- Le parent doit exister (« Projet parent introuvable. ») et ne pas être archivé (« Élément archivé… », champ `parentId`).
- Un projet ne peut pas être placé sous lui-même ni sous l’un de ses descendants : « Un projet ne peut pas être placé dans l’un de ses sous-projets. ».
- La profondeur du parent plus la hauteur du sous-arbre déplacé ne doit pas dépasser 5 : « Les projets sont limités à 5 niveaux. ».
- **Héritage du client** : un sous-projet prend toujours le client de son parent ; le `clientId` envoyé est ignoré quand un parent est donné. Quand un projet change de client (déplacement d’une racine), tous ses descendants prennent le nouveau client.
- Frères : même parent, ou, pour les racines, même client (`siblingsWhere`). Un nouveau projet va à la fin de ses frères.

### Modification

- `updateProject` refuse un projet archivé (« Élément archivé… »).
- `undefined` laisse un champ inchangé, `null` l’efface. `parentId: null` fait du projet une racine ; `clientId: null` le détache de son client.
- Changer le parent, ou le client d’une racine, déplace le projet avec son sous-arbre **à la fin** de la nouvelle liste (`placeProject` avec l’index `Number.MAX_SAFE_INTEGER`), et remet `archivedByCascade` à `false`.
- `categoryIds` remplace la liste complète des catégories (`set`).

### Déplacement

`moveProject(id, { parentId, clientId, index })` place le projet (et ses sous-projets) à un index parmi ses **frères actifs** sous un parent ou à la racine d’un client (`clientId: null` = « Sans client »). Mêmes contrôles d’arbre que ci-dessus. Le déplacement n’est pas refusé pour un projet archivé côté API (le web ne le propose pas).

### Favoris

`setProjectFavorite` change le drapeau `favorite` ; aucun contrôle d’archive.

### Archivage

`setProjectArchived(id, archived)` (via `cascadeArchive` de `services/core/archive.ts`) :

- Archiver : le projet est archivé (`archivedByCascade = false`) et tous ses descendants actifs sont archivés avec `archivedByCascade = true`.
- Restaurer : le projet revient, ainsi que ses descendants archivés avec lui (`archivedByCascade = true`). Les descendants archivés seuls restent archivés.
- Restaurer un projet dont un ancêtre est archivé restaure aussi ces ancêtres, **seuls** : leurs autres sous-projets archivés avec eux sont marqués comme archivés « d’eux-mêmes » (`archivedByCascade = false`) et restent archivés.
- Restaurer un projet dont le client est archivé restaure aussi le client ; les autres projets archivés avec ce client restent archivés et perdent leur marque de cascade.

### Suppression

`deleteProject(id)` supprime le projet et tout son sous-arbre (cascade `ON DELETE` de la relation parent). Les icônes orphelines sont supprimées. Avant la suppression, ce qui lui survit en sort (`releaseProjects`) : ses tâches (`releaseProjectTasks`, voir [Tâches](../activities/tasks.md#projet-supprimé)) et ses temps, sans projet (`releaseProjectTime` : seuls ceux qui ne gardent ni tâche, ni routine, ni évènement et ne sont pas facturés sont supprimés ; un temps facturé est toujours gardé). Le reste suit les relations du schéma Prisma :

| Avec le projet                                                                                                                                                                                                  | Sans projet (`SetNull`)                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Supprimés : jalons, sprints, lien GitHub, vues de tâches, tableaux de bord, temps passés sans tâche, ni routine, ni évènement, non facturés (supprimés avant par l'API : un temps a au moins un rattachement), copies de mails (`MailMessage`), ressources | Gardés sans projet : tâches (sorties avant par l'API), temps passés (sortis avant par l'API, avec leurs tâches, routines et évènements ; les facturés même sans rien), alarmes (avec leur tâche), routines, évènements, documents comptables, documents importés, mouvements et lignes de trésorerie, fiches |

L'interface explique, dans la confirmation, que les tâches ne sont pas supprimées mais sortent du projet. Supprimer un client avec ses projets (`deleteClient(id, true)`) fait de même (`releaseProjects`).

## Statuts et catégories de projet

Sources : `services/projects/project-statuses.ts`, `services/projects/project-categories.ts`, service générique `services/core/labels.ts` (`createLabelService`).

- Champs : `label` requis, 250 caractères au plus (`labelTextSchema`, `TEXT_MAX`) ; `color` requise au format `#rrggbb` (`labelFormSchema`). Image facultative via la mutation commune des listes de paramètres (`services/core/settings-lists.ts`).
- Libellé unique dans l’espace (contrainte en base) : « Un statut porte déjà ce libellé. », « Une catégorie porte déjà ce libellé. » (CONFLICT).
- Introuvable : « Statut introuvable. », « Catégorie introuvable. ».
- Un élément archivé n’est pas modifié ; il n’est plus choisi sur un nouveau projet, mais reste sur les projets qui l’ont.
- Un nouvel élément va en fin de liste ; l’ordre est manuel (`position`).
- Suppression : un projet perd simplement la catégorie supprimée ; un projet au statut supprimé reste sans statut.
- Un projet a au plus un statut et peut avoir plusieurs catégories. La requête `projects` rend les catégories triées par libellé.

## Ressources d’un projet

Source : `services/projects/project-resources.ts`. Une ressource est un fichier téléversé (`FILE`) ou un lien (`LINK`).

| Champ        | Règle                                                                        | Message                                                                 |
| ------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `label`      | requis, 250 caractères au plus                                               | « Le libellé est requis. », « 250 caractères maximum. »                 |
| `url` (lien) | URL `http` ou `https`                                                        | « Lien invalide (http ou https). »                                      |
| `note`       | facultative, texte multiligne, 4 000 caractères au plus, vide devient `null` | « 4 000 caractères maximum. »                                           |
| fichier      | non vide, 10 Mo au plus (`MAX_ATTACHMENT_BYTES`)                             | « Ce fichier est vide. », « « x.pdf » est trop lourd (10 Mo maximum). » |

- Ajout (`addProjectLink`, `addProjectFiles`) : le projet doit exister et ne pas être archivé ; chaque ressource va en fin de liste. Le libellé d’un fichier est son nom.
- Modification (`updateProjectResource`) : renomme et change la note ; pour un lien, change aussi l’adresse. Une note ou une adresse omise est conservée, `null` efface la note.
- Suppression : un fichier est supprimé avec sa ressource (cascade depuis la pièce jointe).
- Déplacement : ordre manuel dans la liste du projet.
- Toute modification, suppression ou déplacement est refusé si le projet est archivé (« Élément archivé… ») ; une ressource introuvable donne « Ressource introuvable. ».
- L’adresse exposée (`url`) est le lien lui-même, ou l’adresse de la pièce jointe pour un fichier (`resourceUrl`). Voir [Fichiers et pièces jointes](files-and-attachments.md).

## Contributeurs

Source : `services/projects/contributors.ts`. Vue d’ensemble des personnes dans [Personnes](people.md).

### Champs

| Champ         | Règle                                                                                                                                                                                   | Message                                                                                                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`        | requis, 250 caractères au plus                                                                                                                                                          | « Le nom est requis. »                                                                                                                                                              |
| `handle`      | identifiant de mention : coupé, mis en minuscules, 2 à 39 caractères, lettres, chiffres, « - » et « _ », ni « - » ni « _ » au début ou à la fin (`handleSchema`) ; unique dans l’espace | « Au moins 2 caractères. », « 39 caractères maximum. », « Lettres, chiffres, « - » et « _ » ; ni au début ni à la fin pour « - » et « _ ». », « Cet identifiant est déjà utilisé. » |
| `avatar`      | image, mêmes règles que les icônes                                                                                                                                                      | idem                                                                                                                                                                                |
| `projectIds`  | projets auxquels il est rattaché directement : existants et non archivés (ceux déjà rattachés restent acceptés)                                                                         | « Élément archivé… »                                                                                                                                                                |
| `githubLogin` | voir [GitHub](github.md)                                                                                                                                                                | —                                                                                                                                                                                   |

### Identifiant proposé

`freeHandle(name, { fallback, suffix })` fabrique un identifiant libre depuis un nom (`suggestHandle` : sans accents, non alphanumériques remplacés par « - ») : sous 2 caractères, `fallback` (« membre » par défaut) ; s’il est pris, le suffixe puis un numéro (« tom », « tom-2 » ; avec suffixe « tom-moi », « tom-moi-2 »), en coupant la base pour tenir en 39 caractères.

### Profil « Moi »

- Chaque utilisateur a, dans chaque espace, un contributeur lié (`userId`) appelé « Moi » dans l’interface, créé par `ensureMeContributor` (nom = identifiant de l’utilisateur, handle libre avec repli « moi » et suffixe « moi »).
- Ce profil ne peut pas être supprimé : « Votre propre profil ne peut pas être supprimé. ».
- Ce profil ne peut pas être archivé : « Vous ne pouvez pas vous archiver. » (voir [Archivage](archiving.md#personnes-liées)).
- « Moi » appartient à tous les projets et n’y est jamais rattaché explicitement.

### Modification, archivage, suppression

- `updateContributor` refuse un contributeur archivé (lecture seule). `projectIds` remplace la liste des projets directs ; `link` remplace son lien (voir [Personnes](people.md#lien-dun-contributeur)).
- `deleteContributor` : les tâches perdent simplement cet assigné ; l’avatar orphelin est supprimé.

### Rattachement aux projets

- `setProjectContributors(projectId, ids)` : remplace les contributeurs rattachés directement à un projet non archivé. Un contributeur archivé n’est pas rattaché à nouveau (ceux déjà rattachés restent). Les tâches gardent leurs assignés.
- `attachAssignees` : quand une tâche d’un projet reçoit un assigné qui n’est rattaché ni au projet ni à l’un de ses parents, il est rattaché automatiquement au projet. Exclus : « Moi » (utilisateur), les contributeurs archivés.
- `followProject(before, after, contributorIds)` : une routine ou un évènement qui change de projet y fait rattacher ses assignés ou contributeurs (`attachAssignees`) ; rien si le projet ne change pas ou est retiré.
- Projet hérité : une sous-tâche ou une sous-routine peut hériter le projet de son parent ; il est alors aussi enregistré sur elle, et suit le parent (voir [Tâches](../activities/tasks.md#héritage), [Routines](../activities/routines.md#héritage)). L’« Ouverture » d’un projet (son début) sert de repli à l’« Ouverture » de ses tâches sans jalon précédent ([Dates suivies](../activities/tasks.md#dates-suivies)).
- `assertProjectContributors` : sur un élément d’un projet (routine, évènement…), seuls peuvent être **ajoutés** « Moi », les contributeurs rattachés au projet ou à l’un de ses ancêtres ; ceux déjà choisis restent. Sans projet, aucune restriction. Message : « Seuls les contributeurs du projet peuvent être choisis. ». Un contributeur archivé n’est pas ajouté, sauf lors d’une annulation qui restaure les anciens (`restoring`).

## Requêtes exposées

Source : `apps/api/src/graphql/modules/projects.ts`.

- `clients`, `projects` : tous, archivés compris, en ordre manuel.
- `projectCategories`, `projectStatuses` : par position.
- `projectResources(projectId)` : par position.
- Mutations : `createClient`, `updateClient`, `setClientFavorite`, `setClientArchived`, `deleteClient(deleteProjects)`, `moveClient`, `createProject`, `updateProject`, `setProjectFavorite`, `setProjectArchived`, `deleteProject`, `moveProject`, mutations de libellés `ProjectCategory` / `ProjectStatus` (`labelMutations`), `addProjectLink`, `addProjectFiles`, `updateProjectResource`, `deleteProjectResource`, `moveProjectResource`.
