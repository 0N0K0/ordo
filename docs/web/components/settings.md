# Réglages (composants web)

Briques des réglages : la liste de réglages (plate ou en arbre) utilisée par toutes les listes paramétrables de l’app, le formulaire d’un élément, la création depuis un select, la section en carte, la ligne qui dit qu’un paramètre vaut pour tout l’espace et la grille des sections. Source : `apps/web/src/components/settings/`. Ce que chaque section de réglages gère est décrit dans [Réglages (fonctionnalités)](../../features/cross-cutting/settings.md).

## Principes

- Une seule liste de réglages pour toutes les listes (`SettingsList`) : statuts, priorités, étiquettes et types de tâches, catégories (projets, routines, courses, fiches, trésorerie, agenda), magasins, unités, rangements, emplacements de stock, lieux, comptes, contextes, contreparties, moyens de paiement, agendas, statuts de documents, étiquettes de mail, types de créneaux, listes de base, minuteurs enregistrés. Chaque liste est un `SettingsListKind` côté GraphQL (`CALENDAR`, `CALENDAR_CATEGORY`, `DOCUMENT_STATUS`, `MAIL_LABEL`, `PLACE`, `PROJECT_CATEGORY`, `PROJECT_STATUS`, `ROUTINE_CATEGORY`, `SAVED_COUNTDOWN`, `SCHEDULE_TYPE`, `SHEET_CATEGORY`, `SHOPPING_BASE_LIST`, `SHOPPING_CATEGORY`, `SHOPPING_STORAGE`, `SHOPPING_STORE`, `SHOPPING_UNIT`, `STOCK_LOCATION`, `TASK_PRIORITY`, `TASK_STATUS`, `TASK_TAG`, `TASK_TYPE`, `TREASURY_ACCOUNT`, `TREASURY_CATEGORY`, `TREASURY_CONTEXT`, `TREASURY_COUNTERPARTY`, `TREASURY_PAYMENT_METHOD`).
- Chaque élément a un libellé, une couleur (selon la liste), une image (avatar ; sans image : ses initiales sur sa couleur), un état archivé et, en arbre, un parent.
- Les formulaires s’ouvrent dans le panneau latéral (`openFormPanel`), jamais dans une modale ; les modales servent aux confirmations (règle du projet).
- Archiver / restaurer se fait avec annulation (toast « Annuler ») ; supprimer demande une confirmation qui explique les risques.
- Les éléments archivés sont cachés derrière « Afficher les archivés », en lecture seule : ni modifiés, ni déplacés, ni parents de nouveaux sous-éléments.
- Le genre du nom est dit explicitement (`feminine`), jamais deviné par l’article (règle eslint).

Règles métier côté API : [Nommage](../../business-rules/cross-cutting/naming.md), [Ordre](../../business-rules/cross-cutting/ordering.md), [Archivage](../../business-rules/cross-cutting/archiving.md).

## `settings-api.ts`

| Export                               | Rôle                                                                                                                                                                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SettingsListKind` (type)            | Ré-export du type GraphQL des listes de réglages.                                                                                                                                                                                  |
| `useSettingsItemLook()`              | Mutation `setSettingsItemLook(kind, id, input)` : change la couleur et / ou l’image d’un élément (`{ color?, icon?: File, removeIcon? }`). Invalide toutes les requêtes (l’élément apparaît dans des selects, tableaux, filtres…). |
| `reorderSettingsItems(kind, ids)`    | Mutation `reorderSettingsItems` : met les éléments d’une liste plate dans l’ordre donné (position = index). Utilisé aussi par `shopping`.                                                                                          |
| `useReorderSettingsItems()`          | Même chose en mutation React Query, puis invalide toutes les requêtes. Utilisé par `SettingsList`.                                                                                                                                 |
| `createdId(result)`                  | Id rendu par une création : la chaîne elle-même, `{ id }`, ou `{ createX: { id } }` ; sinon lève « L’élément créé est introuvable. ». Utilisé par `geo`, `mail`, `shopping`, `treasury`.                                           |
| `TreeItemValues` (interface)         | Valeurs du formulaire d’un élément d’arbre : `label`, `color`, `parentId`.                                                                                                                                                         |
| `treeItemInput(values)`              | Input d’un élément d’arbre : `label`, `color` (`null` si vide : hérite du parent), `parentId`. Une règle eslint impose ce helper. Utilisé par `calendar`, `routines`, `stock`, `treasury`.                                         |
| `itemMutations(mutations, toInput?)` | `{ create(values) → id, update(id, values) }` à partir des mutations `create` / `update` d’une liste ; par défaut n’envoie que `label` et `color`. Pour un `SettingsItemKind` (formulaire, création rapide).                       |
| `listMutations(mutations, toInput?)` | Idem plus `remove(id)` : les props d’une `SettingsList`. Utilisé par `accounting`, `calendar`, `projects`, `sheets`, `shopping`, `tasks`.                                                                                          |

## `SettingsItemForm.tsx`

- `SettingsItem` (interface) — élément : `id`, `label`, `color?`, `iconUrl?`, `parentId?`, `position?`, `archived`.
- `SettingsItemValues<E>` (type) — valeurs du formulaire : `label`, `color`, `parentId`, plus les champs propres `E`.
- `SettingsItemKind<C, E>` (interface) — ce que partagent une liste et le formulaire de ses éléments : `kind`, `withColor?` (défaut `true`), `colorRequired?` (défaut : `true` pour une liste plate ; en arbre, vide = couleur du parent), `labelPlaceholder?`, `labelField?` (défaut « Libellé » ; « Nom » pour les personnes physiques ou morales), `schema` (zod de `@ordo/shared`), `extra?` (`initial(item?)`, `render(form, item, commit)` : champs propres à la liste, ex. catégorie de statut ; `commit(champs)` les enregistre tout de suite pour un éditeur sans `getInputProps`, rien sur un nouvel élément ; `onBlur?` : ceux enregistrés en les quittant, textes et nombres), `create(values) → id`, `update(id, values)`, `confirmLoss?` (`LossConfirmation` : demande ce que l'archivage ou la restauration d'un élément perd ; les types de créneaux).
- `SettingsItemForm` — formulaire d’un élément (toutes les listes). Props en plus du `SettingsItemKind` : `item?` (modifié ; absent : nouveau), `parentId?` (parent d’un nouvel élément), `tree?` (éléments de l’arbre ; absent : liste plate), `withParent?` (défaut `true` : choix du parent dans le formulaire, sinon seulement par glisser-déposer), `initial?` (valeurs de départ, ex. une adresse choisie sur une carte), `liveItems?` (`LiveSource` des éléments de la liste, `lib/live-value` : l’élément modifié et l’arbre suivis, passés à `saved` de `useFieldSave` ; absent : `item` et `tree` tels quels), `onDone(createdId?)`. Un élément archivé ailleurs pendant que son panneau est ouvert passe en lecture seule (`readOnly` de `useFieldSave` suit `archived` de l’élément suivi ; `Fieldset` désactivé, sans `SaveStatus`).

Champs, dans l’ordre :

1. « Libellé » (ou `labelField`), obligatoire, autofocus.
2. Couleur (`ColorField`, `commitProps('color')` : choisie, enregistrée aussitôt ; tapée, en la quittant), si `withColor` ; description « Vide : celle de son parent. » quand elle n’est pas obligatoire.
3. Image (`IconField`), aperçu avec le nom et la couleur.
4. « Parent » (select en arbre, placeholder « Aucun (premier niveau) », cherchable, effaçable), en arbre et si `withParent` ; l’élément modifié et ses descendants sont exclus.
5. Les champs propres (`extra.render`).
6. `FormActions` « Créer », « Annuler » : sur un nouvel élément seulement.

Couleur de départ d’un nouvel élément : celle du parent si elle est obligatoire ou si le parent n’en a pas, sinon la première du nuancier (`useColorSwatches`) ; vide en arbre quand le parent a une couleur (héritée).

Nouvel élément : `create`, puis `useSettingsItemLook` pour l’image et la couleur (toujours envoyée quand la liste a une couleur) ; toast « Ajout enregistré. » (`formCallbacks`, `lib/form`). Élément existant : panneau enregistré champ par champ (`useFieldSave`, `SaveStatus`) : le libellé et les champs `extra.onBlur` en les quittant, la couleur par `commitProps`, les autres dès qu’ils changent ; les valeurs de l’élément tel que la liste le tient (`liveItems`, `saved` tiré de `valuesOf(item)`) suivies, changées ailleurs ; la couleur et l’image (`IconField`, `formIconProps` : `icon` / `removeIcon`, valeurs du formulaire) par `useSettingsItemLook`, les autres champs par `update(id, valeurs)` (toutes, sans l’image) ; une confirmation de `update` refusée (`ActionDeclined`, ex. catégorie d’un statut de tâche qui ferme ou rouvre ses tâches) remet le champ sans toast. Internes : `valuesOf(item?)` (valeurs du formulaire d’un élément ou d’un nouveau), `itemValues(values)` (valeurs sans l’image).

Utilisé par `SettingsList`, `create-settings-item` et des features (`calendar`, `geo`, `projects`, `routines`, `shopping`, `stock`, `tasks`, `treasury`).

## `SettingsList.tsx`

`SettingsList` — liste de réglages, plate ou en arbre, dans une `SettingsSection`.

Props (en plus du `SettingsItemKind`) :

| Prop                                                | Rôle                                                                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`, `description`                              | En-tête de la section.                                                                                                                        |
| `noun`, `feminine?`                                 | « le statut », « la catégorie », « l’étiquette » : dans les titres (« Ajouter … », « Modifier … », « Supprimer … ») et les messages accordés. |
| `items`                                             | Éléments.                                                                                                                                     |
| `nested?`                                           | Arbre (défaut `false`).                                                                                                                       |
| `usage?`, `usageNoun?`                              | Nombre d’usages par élément (affiché en gris) et son nom (`{ one: 'de la tâche', many: 'tâches' }`) pour le message de suppression.           |
| `remove(id)`                                        | Suppression.                                                                                                                                  |
| `move?(id, parentId, index)`                        | Déplacement propre à la liste ; absent : l’ordre complet est enregistré (`reorderSettingsItems`).                                             |
| `renderBadges?`, `renderActions?`, `headerActions?` | Badges après le nom, boutons propres d’une ligne (export…), boutons de l’en-tête avant « Ajouter ».                                           |
| `deleteMessage?(item, path)`                        | Message de suppression à la place du message par défaut.                                                                                      |
| `reversibleDelete?(item, path)`                     | Suppression qui ne perd rien (l’action inverse la défait) : sans « Cette action est irréversible. », toast rendu à la place de « « X » supprimé. ». |
| `storageKey?`                                       | Clé des plis mémorisés.                                                                                                                       |
| `menuItems?(item)`                                  | Entrées propres du menu « … » d’une ligne (une conversion…), avant « Supprimer » (`RowMenuEntry[]`).                                         |
| `undeletable?(item)`                                | Raison pour laquelle un élément ne peut pas être supprimé (« le dernier agenda »…) : « Supprimer » désactivé avec cette raison en infobulle.  |
| `loading?`                                          | Squelette (`ListSkeleton`, 3 lignes).                                                                                                         |
| `withParent?`, `canMove?(item, parentId)`           | Choix du parent dans le formulaire ; dépôts permis.                                                                                           |
| `adderRef?`                                         | Reçoit une fonction qui ouvre le formulaire d’un nouvel élément avec des valeurs de départ (clic sur une carte…).                             |

Comportement :

- En-tête : `ShowArchivedSwitch`, `headerActions`, bouton « Ajouter ».
- États vides : « Aucun élément pour le moment. » ou « Tous les éléments sont archivés. » (icône étiquette).
- Actions d’une ligne (`InlineActions`) : « Ajouter un sous-élément » (arbre, non archivé), « Modifier » (non archivé), « Archiver » / « Restaurer » (toujours dans le menu « … », jamais un bouton), « Supprimer » (danger).
- Archiver / restaurer : `archiveWithUndo` (`lib/archive`) avec « « chemin » » et l’accord.
- Supprimer : `confirmDestructive`, titre « Supprimer {noun} », risques « « X » sera supprimé définitivement [et retiré de la tâche qui l’utilise / des N tâches qui l’utilisent]. [Ses sous-éléments remonteront d’un niveau.] », toast « « X » supprimé. ».
- Déplacer : l’index reçu est parmi les frères affichés ; il est converti en index parmi tous les frères (les archivés cachés gardent leur place). Rien ne va sous un élément archivé.
- Les lignes archivées portent `ArchivedBadge` et sont verrouillées (pas de poignée).

Utilisé par les réglages de `accounting`, `calendar`, `geo`, `mail`, `projects`, `routines`, `sheets`, `shopping`, `stock`, `tasks`, `treasury`.

## `create-settings-item.tsx`

| Export                                             | Rôle                                                                                                                                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createInPanel(title, form)`                       | Ouvre un formulaire dans le panneau latéral et renvoie une promesse : l’id créé, ou `null` si annulé ou panneau fermé (résolue une seule fois). `form(done)` reçoit la fermeture. Utilisé par `treasury`.                                  |
| `createSettingsItem(title, kind, label, options?)` | Crée un élément d’une liste de réglages depuis un select : `SettingsItemForm` dans le panneau, le libellé tapé pré-rempli ; renvoie `{ id, label }` (libellé enregistré) ou `null`. Options : `tree?`, `initial?`. Utilisé par `shopping`. |
| `itemCreator(title, kind, options?)`               | Fabrique le `onCreate(label)` (id créé, ou `null` si annulé) d’un select créable. Utilisé par `calendar`, `projects`, `routines`, `shopping`, `stock`, `tasks`, `treasury`.                                                                |

## `SettingsSection.tsx`

`SettingsSection({ title, description?, actions?, children? })` — section des réglages (et des autres pages faites de cartes) : un `Paper` bordé (`component="section"`), son en-tête `SectionHeader` (titre, description, actions à droite, voir [Page](page.md)), puis son contenu. Utilisé par `SettingsList` et `account`, `accounting`, `calendar`, `github`, `mail`, `projects`, `tasks`, `time`, `treasury`, `workspaces`.

## `SettingsScopeNote.tsx`

`SettingsScopeNote()` — une ligne atténuée, icône « info » : « Ces paramètres valent pour tout l’espace, pas seulement pour ce projet. », au-dessus des paramètres de l’espace repris dans les paramètres d’un projet. Utilisé par `ProjectPage`. Garde eslint : la phrase « … valent pour tout l’espace … » écrite ailleurs est refusée.

## `SettingsGrid.tsx` et `SettingsGrid.module.css`

`SettingsGrid({ children })` — sections d’un onglet de réglages en cartes : un tiers de la largeur chacune, trois côte à côte au plus, moins quand elles seraient plus étroites que leur minimum (20rem ; une seule sur téléphone) ; une rangée incomplète est centrée, alignée en haut. Utilisé par `github`, `projects`, `workspaces`.
