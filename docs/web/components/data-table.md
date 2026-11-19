# Tableau de données (composants web)

Le tableau unique de l’app (`DataTable`, TanStack Table) et tout ce qui l’entoure : colonnes `DataColumn`, vues enregistrées, recherche, filtres, tris, regroupements, totaux, exports CSV / PDF, sélection et modification en masse, cellules éditables, barre d’actions de la sélection. Source : `apps/web/src/components/data-table/` (`cells/`, `selection/`, `table/`, `toolbar/`, `views/`). Le modèle des vues enregistrées (`TableViewConfig`, filtres, agrégats, périodes) est dans `@ordo/shared` (voir [shared/tables](../../shared/cross-cutting/tables.md)).

## Comment ça marche

### Le principe

Tous les tableaux de données de l’app sont un seul composant, `DataTable`, alimenté par un seul hook, `useDataView`. Une feature :

1. décrit ses colonnes (`DataColumn<R>[]`) ;
2. appelle `useDataView({ tableKey, columns, rows, title, … })`, qui charge les vues enregistrées du tableau et applique la vue courante aux lignes ;
3. rend `<DataTable view={view} getKey={…} cells={…} actions={…} />`, qui affiche les onglets des vues, la barre d’outils, le tableau, le pied et la barre de sélection.

Utilisé par `accounting`, `calendar`, `routines`, `sheets`, `shopping`, `stock`, `tasks`, `time`, `treasury`. La bibliothèque de documents (`features/library`, à réécrire) utilise `useDataView` et `DataViewBar` mais dessine son propre tableau avec `DataTableHeader`.

### Les colonnes (`DataColumn`)

Une colonne déclare tout ce que le tableau en fait :

- `id`, `label`, `size` (largeur par défaut, px) ; `locked` (toujours affichée : la colonne libellé), `hiddenByDefault` (cachée jusqu’à ce qu’on l’affiche) ;
- `sortValue(row)` : rend la colonne triable (sans elle, pas de tri) ;
- `text(row)` : le texte de la cellule, utilisé pour la recherche, l’export, le nom d’un groupe et le filtre texte par défaut ; une colonne sans `text` est exclue de la recherche et des exports ;
- `cell(row)` : contenu propre de la colonne quand les `cells` du tableau ne la fournissent pas (colonne partagée entre tableaux) ;
- `numeric` (aligné à droite, police monospace ; filtré comme un nombre via `sortValue`) et `formatTotal` (écriture du total du pied) ;
- `filter` : comment filtrer (`text`, `number`, `date`, `boolean`, `choice`, `choices`), `false` pour ne pas filtrer ; par défaut : un nombre pour une colonne `numeric`, du texte si elle a un `text`, sinon rien ;
- `required` : jamais vide, pas de « est vide » dans son filtre ; une colonne de comptage (commentaires, relances, éléments…) l'est toujours : 0 est une valeur ;
- `groupable` (par défaut toutes sauf la colonne verrouillée), `groupTree` (groupes en arbre, ex. catégories), `groupValue` (valeurs de regroupement propres) ;
- `bulk` : ses cellules se modifient en masse.

Les colonnes affichées, leur ordre et leurs largeurs viennent de la disposition (`ColumnLayout` : `columnOrder`, `hiddenColumns`, `columnSizing`) enregistrée dans la vue. Une colonne ajoutée après coup se place à la fin de l’ordre enregistré. Largeurs bornées entre 40 et 1200 px.

Dans l’en-tête : cliquer le titre trie (croissant, décroissant, aucun ; Maj + clic ajoute un niveau de tri, numéroté) ; glisser l’en-tête déplace la colonne ; glisser son bord droit la redimensionne, double-cliquer l’ajuste à son contenu (un second double-clic rend la largeur par défaut) ; son menu sélectionne la colonne, trie, filtre, groupe, masque et déplace (« Au début », « À gauche », « À droite », « À la fin »).

### Les vues enregistrées

Chaque tableau (`tableKey`, et éventuellement un projet) a ses vues : des onglets (`ViewTabs`) réordonnables par glisser-déposer. Une vue enregistre sa configuration (`TableViewConfig`) : recherche, filtre, tris, regroupement (`groupBy`, `groupPeriod`), « Sous-éléments à plat » (`flat`), pied (totaux par colonne), ordre manuel (`manualOrder`), disposition des colonnes, options propres.

- La vue affichée est dans l’adresse (`?<tableKey>-view=<id>`), sinon la vue par défaut (étoile), sinon la première.
- À la première visite, les premières vues sont créées (par défaut une seule : « Toutes » ; une feature peut en fournir d’autres avec `first`, ex. un filtre `withinFilter` / `conditionFilter`).
- Toute modification (filtre, tri, colonne…) va dans une copie de travail propre à chaque vue, conservée en changeant d’onglet : une pastille orange (« Modifications non enregistrées ») apparaît sur l’onglet et sur « Options », avec « Enregistrer les modifications » et « Annuler les modifications ».
- Menu de l’onglet courant : enregistrer / annuler les modifications, « Renommer », « Dupliquer », « Définir par défaut », « Déplacer à gauche / à droite », « Supprimer » (impossible sur la dernière vue ; confirmation : la vue et sa configuration sont supprimées, les lignes ne sont pas modifiées).
- « Nouvelle vue » : « Vue vierge » ou « À partir de l’affichage actuel ».
- Les vues sont stockées côté API comme les vues des tâches (`taskViews`, `kind: 'TABLE'`, `tableKey`). Une configuration invalide redonne les valeurs par défaut ; les anciens ids de colonne libellé et d’anciennes valeurs de filtre (budgets de trésorerie) sont relus (décision BI).

### Recherche et filtres

- La recherche (barre d’outils) cherche sans casse ni accents dans le `text` de toutes les colonnes.
- « Filtrer » ouvre l’éditeur d’arbre de filtres ([Filtres](filters.md)) sur les colonnes filtrables (`tableFilterFields`). « Filtrer selon cette colonne » (menu d’en-tête) ajoute une condition sur la colonne et ouvre l’éditeur.
- Une condition incomplète ou sur une colonne inconnue est ignorée. Les dates se comparent au jour de l’utilisateur ; « pendant » utilise une période (`filterPeriod`, semaine courante comprise).
- Les choix archivés (`withArchived`) gardent leur libellé mais ne sont proposés que s’ils sont déjà dans le filtre ; un parent archivé de choix proposés reste, grisé.
- « Afficher les archivés » (lignes archivées, option `archived` de `useDataView`) n’est pas enregistré dans la vue.
- Aucune ligne gardée : « Aucune ligne ne correspond à cette vue. » avec « Effacer la recherche et les filtres » ; aucune ligne du tout : « Rien pour le moment. » (ou l’état vide `empty` de la feature).

### Tris et ordre manuel

- Les tris s’appliquent par priorité ; les valeurs vides vont en dernier ; à égalité, l’ordre d’origine est gardé.
- Sans tri, l’ordre est l’ordre manuel : les lignes se glissent par leur poignée. Sans `onMoveRow`, l’ordre est enregistré dans la vue (`manualOrder` ; les lignes cachées par les filtres gardent leur place après) ; avec `onMoveRow`, la feature enregistre elle-même (position, parent, groupe).
- Panneau « Trier » : niveaux « Trier par » / « puis », sens ↑ / ↓, « Monter » / « Descendre », « Ajouter un tri », « Revenir à l’ordre manuel ».

### Regroupement

- « Grouper par » (Options) ou « Grouper selon les valeurs » (menu d’en-tête) regroupe les lignes selon la colonne : une date par période (« Période » : jour, semaine, mois, trimestre, année ; défaut mois), une colonne à valeurs multiples place la ligne dans chacun de ses groupes, un booléen en « Oui » / « Non », sinon le texte. Les lignes sans valeur vont dans « Sans valeur », en dernier.
- Les groupes suivent l’ordre des options de la colonne (ou de la valeur de tri), inversé si la colonne est triée en décroissant.
- Une colonne avec `groupTree` regroupe en arbre de groupes ; une feature peut aussi fournir ses propres groupes (`groupTree` du tableau) quand la vue ne groupe pas.
- Chaque groupe a un en-tête repliable avec son nombre de lignes (et un résumé `groupSummary`), une ligne d’ajout et ses totaux. Avec `onMoveRow`, une ligne lâchée sur un en-tête de groupe y va en premier.

### Arbre de lignes

Avec `parentKey`, les lignes s’affichent sous leur parent (un parent non affiché : à la racine), repliables ; glisser horizontalement change le niveau (au plus un niveau sous la ligne au-dessus). L’option « Sous-éléments à plat » (`flat`) les affiche à plat.

### Sélection et modification en masse

Deux sélections, exclusives :

- **Cellules d’une colonne** (colonnes `bulk`) : Ctrl / ⌘ + clic ajoute ou retire une cellule, Maj + clic sélectionne une plage depuis la dernière, « Sélectionner la colonne » prend toutes les cellules affichées ; un clic simple hors de la sélection ou Échap la quitte.
- **Lignes cochées** (cases à cocher en tête de ligne, présentes dès qu’une colonne est `bulk` ou qu’il y a des `bulkColumns`) : tous les champs `bulk` de ces lignes se modifient ensemble ; elles restent cochées jusqu’à être décochées.

Une modification faite dans une cellule de la sélection s’applique à toutes les lignes sélectionnées (`bulkSaver`, `useEntityCellEdit`), avec le toast « Modification appliquée à N lignes. » (ou le message de la feature, avec annulation). Les listes (étiquettes…) appliquent la différence (`applyDiff`) : ce qui est ajouté est ajouté, ce qui est retiré est retiré, le reste de chaque ligne est gardé. `BulkHint` explique la sélection en cours ; seules les lignes affichées restent sélectionnées.

Les actions que les colonnes ne font pas (archiver, dupliquer, supprimer…) sont dans la `SelectionBar`, collée en bas de la fenêtre, construite avec les fabriques de `selection-actions.tsx`.

### Pied et totaux

L’option « Pied de tableau » affiche sous chaque colonne un total choisi en place : « Compte » (lignes avec une valeur), et pour les colonnes à nombres « Somme », « Moyenne », « Médiane » (`aggregateValues`, `@ordo/shared`), sur les lignes gardées. Les montants (cellules en €) s’écrivent en euros. Chaque groupe répète les totaux sur ses lignes.

### Exports

« Options » → « Exporter » : CSV (point-virgule, UTF-8 avec BOM, pour tableurs en français ; une colonne « Groupe » si groupé) et PDF (construit par l’API : titres de groupes avec leur nombre, montants alignés à droite). Sont exportées les colonnes affichées qui ont un `text`, les lignes de la vue, dans leurs groupes. Titre : celui du tableau ; sous-titre : le nom de la vue. Un montant nul s'exporte « 0 » ; un compte nul reste vide (`fmt.count`).

### Hauteur et performance

Le tableau défile dans sa propre zone, l’en-tête collé en haut : seul sur la page, il prend toute la hauteur jusqu’au bas de la fenêtre (240 px au moins) ; avec d’autres contenus, la zone de contenu moins les onglets de vues, la barre d’outils et une marge (hauteurs publiées en variables CSS). Au-delà de 150 lignes, seules les lignes visibles (et 40 de chaque côté, soit 110 environ) sont rendues (`@tanstack/react-virtual`).

## `table/`

### `data-table.ts`

| Export                                         | Rôle                                                                                                                                                                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ColumnChoice` (interface)                     | Choix d’une colonne filtrée par valeurs : `value`, `label` (chemin complet en arbre), `nodeLabel?`, `depth?`, `parent?`, `color?`, `iconUrl?`, `disabled?` (parent grisé), `archived?`.                                             |
| `withArchived(options, items)`                 | Marque `archived` les choix dont l’élément est archivé (liste d’éléments `{ id, archived }` ou `Set` d’ids). Règle eslint associée. Utilisé par `routines`, `shopping`, `stock`, `tasks`, `treasury`.                               |
| `ColumnFilter<R>` (type)                       | Filtre d’une colonne : `text` (valeur optionnelle, sinon `text`), `number`, `date` (YYYY-MM-DD), `boolean`, `choice` (`options`, `none?` : la valeur de l’option « Aucun », vide pour « est vide »), `choices` (plusieurs valeurs). |
| `TreeGroup` (interface)                        | Groupe d’un arbre de groupes : `key`, `label`, `color?`, `parentKey`.                                                                                                                                                               |
| `DataColumn<R>` (interface)                    | La colonne (voir « Comment ça marche »). Utilisé par toutes les features à tableau, et `comments`.                                                                                                                                  |
| `readOnlyCells(columns, row)`                  | Cellules en lecture seule d’une ligne (archivée) : le `cell` d’une colonne partagée, sinon son `text`. Règle eslint associée. Utilisé par `calendar`, `routines`, `shopping`, `tasks`, `treasury`.                                  |
| `ShownColumn<R>` (interface)                   | Colonne affichée avec sa `width`.                                                                                                                                                                                                   |
| `MIN_WIDTH`, `MAX_WIDTH`                       | 40 et 1200 px.                                                                                                                                                                                                                      |
| `clampWidth(width)`                            | Largeur arrondie et bornée.                                                                                                                                                                                                         |
| `columnOrder(columns, layout)`                 | Ordre complet : l’ordre enregistré (colonnes connues), puis les manquantes dans l’ordre par défaut. Utilisé aussi par `tasks`.                                                                                                      |
| `isHidden(column, layout)`                     | Cachée dans la disposition, ou cachée par défaut et absente de l’ordre enregistré ; jamais pour une colonne verrouillée.                                                                                                            |
| `shownColumns(columns, layout)`                | Colonnes affichées, dans l’ordre, avec leurs largeurs.                                                                                                                                                                              |
| `withVisibility(columns, layout, id, visible)` | Disposition avec une colonne affichée ou masquée (l’ordre est enregistré en entier ; les colonnes cachées par défaut non affichées sont enregistrées cachées).                                                                      |
| `withOrder(columns, layout, order)`            | Disposition avec un nouvel ordre.                                                                                                                                                                                                   |
| `sortRows(rows, sorting, columns)`             | Lignes triées (voir « Tris »). Utilisé aussi par `library`.                                                                                                                                                                         |
| `toggleSort(sorting, id, multi)`               | Tris après un clic d’en-tête : croissant → décroissant → aucun ; `multi` (Maj) ajoute ou modifie au lieu de remplacer.                                                                                                              |
| `tableWidth(shown, extra?)`                    | Largeur d’un tableau à colonnes fixes. Utilisé par `library`.                                                                                                                                                                       |

Interne : `hiddenIds`.

### `table-engine.ts`

| Export                                                 | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LAST_RANK`                                            | Rang de ce qui n’en a pas (valeur hors options, ligne hors ordre) : après les autres. Règle eslint associée. Utilisé par `routines`.                                                                                                                                                                                                                                                                                                                                         |
| `columnFilter(column)`                                 | Filtre effectif d’une colonne (déclaré, sinon nombre pour un montant, sinon texte), `null` sinon.                                                                                                                                                                                                                                                                                                                                                                            |
| `tableFilterFields(columns)`                           | `FilterFields` de l’éditeur de filtres : un groupe « Colonnes », types (`choice` → `category`, `choices` → `multiReference`), champs obligatoires, options (en arbre via `treeSelectProps` si les choix ont une profondeur, avec avatars via `itemRenderOption` s’ils ont couleur ou image), complétude via `filterConditionSchemaFor` (`@ordo/shared`), texte vide « Aucun filtre : toutes les lignes sont affichées. ». Utilisé par `DataViewBar`, `useDataView`, `tasks`. |
| `filterRows(rows, columns, { search, filter }, today)` | Lignes gardées par la recherche et l’arbre de filtres. Utilisé aussi par `tasks`.                                                                                                                                                                                                                                                                                                                                                                                            |
| `RowGroup<R>` (interface)                              | Groupe : `key`, `label`, `rows`.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `isGroupable(column)`                                  | Groupable : pas `groupable: false`, pas verrouillée, et a un `text` ou un filtre.                                                                                                                                                                                                                                                                                                                                                                                            |
| `groupRows(rows, column, sorting, period?)`            | Lignes groupées (voir « Regroupement »). Utilisé aussi par `library`.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `groupableColumns(columns)`                            | Colonnes groupables.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

Internes : `FIELD_KINDS`, `filterable`, `offeredChoices` (choix archivés retirés sauf ceux du filtre, parents gardés grisés), `isEmptyValue`, `meets` (une condition sur une ligne : texte normalisé, nombres, dates relatives `filterDay`, périodes, choix, `anyOf` / `allOf` / `noneOf` ; l’option « Aucun » compte comme vide), `weekOf`, `periodGroup` (clés triables et libellés : le jour en toutes lettres, « Semaine N · AAAA (du <lundi>) », le mois, le trimestre, l’année — formats de `lib/format` et `lib/periods`), `groupsOf`.

### `DataTable.tsx`

- `RowMove` (interface) — déplacement d’une ligne remis à `onMoveRow` : `key`, `beforeKey` (null : en dernier), `parentKey?` (seulement si le niveau a changé), `groupKey?` / `fromGroupKey?` (changement de groupe ; `''` = groupe sans valeur). Utilisé par `routines`, `shopping`, `tasks`.
- `GroupTree<R>` (interface) — groupes propres du tableau : `groups`, `groupOf(row)` (plusieurs : la ligne dans chacun ; aucun : groupe sans, en dernier), `noneLabel`, `showEmpty?` (les groupes vides s’affichent toujours pendant un glisser). Utilisé par `shopping`.
- `DataTable<R>` — le tableau.

Props de `DataTable` (en plus de celles de `Table` Mantine) :

| Prop                                                       | Rôle                                                                                                                                                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `view`                                                     | La vue (`useDataView`).                                                                                                                                                             |
| `getKey(row)`                                              | Clé d’une ligne.                                                                                                                                                                    |
| `cells(row)`                                               | Contenu des cellules, par id de colonne.                                                                                                                                            |
| `actions?(row)`, `actionsWidth?`                           | Actions en fin de ligne (`RowActions`), largeur (défaut `ROW_ACTIONS_WIDTH`).                                                                                                       |
| `leading?`                                                 | Cellule avant les colonnes (`header`, `cell`, `width`, `id?` pour la sélection en masse, ex. un interrupteur).                                                                      |
| `rowProps?(row)`                                           | Props d’une ligne (clic, style…).                                                                                                                                                   |
| `groupSummary?(rows)`                                      | Résumé d’un en-tête de groupe (un total…).                                                                                                                                          |
| `bar?`                                                     | Props de `DataViewBar` (sans `view`).                                                                                                                                               |
| `framed?`                                                  | Tableau dans un `Paper` bordé.                                                                                                                                                      |
| `empty?`                                                   | Affiché à la place du tableau quand il n’a aucune ligne.                                                                                                                            |
| `details?(row)`                                            | Contenu déplié sous une ligne, sur toute la largeur.                                                                                                                                |
| `selectionActions?(rows, clear)`, `selectionLabel?(count)` | Actions de la `SelectionBar` sur les lignes cochées, et leur libellé (défaut « N lignes sélectionnées »).                                                                           |
| `parentKey?(row)`                                          | Arbre de lignes.                                                                                                                                                                    |
| `onMoveRow?(move)`                                         | Enregistre un déplacement manuel.                                                                                                                                                   |
| `addRow?(group)`                                           | Ligne d’ajout en fin de tableau (`null`) et de chaque groupe.                                                                                                                       |
| `isActive?`, `isArchived?`, `isDone?`, `readOnly?`         | Ligne ouverte dans le panneau (surlignée), archivée ou terminée (atténuée, `--onoko-muted-opacity`, règle eslint), en lecture seule (ni glisser, ni case, ni sélection de cellule). |
| `loading?`                                                 | Squelette (`TableSkeleton`) à la place du tableau (aussi tant que les vues chargent).                                                                                               |
| `toolbar?`                                                 | Onglets et barre affichés (défaut `true` ; `false` dans un formulaire).                                                                                                             |
| `maxHeight?`                                               | Hauteur maximale propre (un tableau dans un formulaire).                                                                                                                            |
| `groupTree?`                                               | Groupes propres (`GroupTree`).                                                                                                                                                      |

Comportement interne notable :

- Colonnes techniques : `__lead` (poignée + case), `__leading`, `__actions` ; ids de glisser préfixés `col:` (colonnes) et `g:` (groupes). Les colonnes ne rencontrent que des colonnes (`pointerWithin`), les lignes que des lignes (`closestCenter`).
- Lignes déplaçables quand la vue est sans tri (et non groupée, sauf si `onMoveRow` gère les groupes) ; les sous-lignes suivent leur parent et sont cachées pendant le glisser ; le nouveau parent se déplie.
- L’état replié / déplié est conservé quand les lignes changent (frappe dans un filtre).
- Internes : `apply`, `collisionDetection`, `getProjection`, `treeOf`, `groupTreeOf`, `HeaderCell` (en-tête glissable, `aria-sort`, titre « Glisser pour déplacer la colonne »), `DataRow` (ligne glissable verticalement, attributs `data-active`, `data-archived`, `data-done`, `data-selected`, `data-dragging`, `data-drop-target`), `GroupHeading` (en-tête de groupe cible de dépôt), `EntryRow` (mémoïsée), `TableBody` (virtualisation au-delà de `VIRTUAL_FROM` = 400 lignes, hauteur estimée 37 px).

### `DataTableHeader.tsx`

`DataTableHeader<R>` — en-tête de tableau autonome (comme celui des tâches) pour un tableau qui n’utilise pas `DataTable` : colonnes déplacées par glisser-déposer ou menu, triées par clic (Maj : un niveau de plus), masquées, redimensionnées par leur bord (pointeur capturé), ajustées par double-clic. Props : `columns`, `shown`, `layout`, `onLayoutChange`, `sorting`, `onSortingChange`, `tableRef`, `leading?`, `leadingCount?`, `trailing?`, `columnExtras?`. Utilisé uniquement par `features/library` (bibliothèque de documents, à réécrire).

### `column-fit.ts`

- `movedColumnOrder(order, shown, id, where)` — ordre avec une colonne mise au début, à la fin, ou d’un cran parmi les colonnes affichées.
- `fittedLayout(table, layout, column, cellIndex, fitted)` — disposition avec une colonne ajustée à son contenu (mesure jusqu’à 400 lignes en disposition automatique, champs comptés à la largeur de leur texte, styles rétablis aussitôt) ; si elle l’est déjà (ou à 2 px près), la largeur enregistrée est retirée (retour au défaut).
- Internes : `textWidth` (mesure sur canvas), `contentWidth`.

### `month-column.ts`

`monthColumn(id, label, date, size?)` — colonne « Mois » cachée par défaut : triée et groupable par mois (YYYY-MM, un instant pris dans le fuseau de l’utilisateur), affichée « Novembre 2026 », non filtrée ; largeur 150 par défaut. Une règle eslint renvoie vers elle (pas de `.slice(0, 7)`). Utilisé par `accounting`, `stock`, `time`, `treasury`.

### `table-height.ts`

`useTableHeight()` — `[ref, maxHeight]` de la zone de défilement : compte les tableaux de la page (ceux d’un panneau ou d’une modale ne comptent pas) ; seul et sans contenu dessous (tolérance 48 px), toute la hauteur restante (240 px au moins) ; sinon `calc(100dvh - en-tête - --onoko-view-tabs-height - --onoko-table-toolbar-height - 2rem)`. S’appuie sur `useRoomBelow` (`lib/fill-height`).

### `table-export.ts`

- `TableExport<R>` (interface) — `title`, `subtitle`, `columns` (affichées), `groups`, `grouped`.
- `downloadTableCsv(table)` — CSV via `downloadCsv` (`lib/download`).
- `downloadTablePdf(table)` — PDF via `postTablePdf` (`lib/download`, rendu par l’API).

### `TableFooter.tsx`

- `TableFooter` — pied : sous chaque colonne qui a des valeurs, un menu « Total » → « Compte », « Somme », « Moyenne », « Médiane » (ces trois si la colonne a des nombres), « Aucun ». Props : `shown`, `rows`, `totals`, `onChange`, `before`, `after`.
- `GroupFooter` — ligne des totaux d’un groupe (`aria-label` « Totaux de « X » »), rien si aucun total n’est choisi.
- Internes : `LABELS`, `valuesOf`, `totalOf` (« — » sans valeur ; compte sans décimale ; montant en euros si les cellules contiennent « € », sinon nombre à 2 décimales, sauf `formatTotal`).

Utilisé par `DataTable` et `library`.

### `GroupHeaderRow.tsx`

`GroupHeaderRow` — en-tête de groupe, le même dans tous les tableaux : `FoldHeading` (replie les lignes, affiche leur nombre), pastille de couleur, résumé, indentation selon la profondeur. Props : `label`, `count`, `summary?`, `span`, `collapsed`, `onToggle`, `color?`, `depth?`, `trProps?`. Utilisé par `DataTable` et `library`.

### `NoMatch.tsx`

`NoMatch({ view })` — état vide d’une vue qui ne garde aucune ligne (voir « Recherche et filtres »).

### `RowCheck.tsx`

- `RowCheck({ selection, rowKey, name? })` — case d’une ligne (« Sélectionner « X » » ou « Sélectionner la ligne ») ; son clic n’ouvre pas la ligne.
- `AllRowsCheck({ selection })` — case de l’en-tête : « Tout cocher » / « Tout décocher », indéterminée si partielle, désactivée sans ligne.
- `ROW_CHECK_WIDTH` = 36.

Les cases ne s’affichent qu’au survol ou au focus de leur ligne (`data-reveal`), sauf cochées ou dès qu’une ligne est cochée (`data-checking` sur le tableau).

### `DataTable.module.css`

Classes du tableau : `.scroller` (zone de défilement), `.table`, `.head`, `.header`, `.headerContent`, `.label`, `.headerMenu` (révélé au survol), `.sortButton`, `.sortMark`, `.resizer`, `.cell` (`[data-bulk-selected]` : cellule sélectionnée), `.groupRow`, `.details`, `.detailsCell`, `.rowCheck`, `.row` (états `data-*`), `.titleCell` (indentation `--row-depth`), `.chevronSpacer`, `.handleSpacer`, `.handle`, `.addRow`. Importé aussi par `library`.

## `toolbar/`

### `DataViewBar.tsx`

- `DataViewBarProps<R>` (interface) — `view`, `searchLabel?` (défaut « Rechercher »), `actions?` (boutons après les onglets, « Nouveau »…), `tools?` (outils après filtres et tris), `displayOptions?`, `exports?`, `manualText?` (défaut « Sans tri : l’ordre choisi à la main (glissez les lignes), sinon celui du tableau. »), `tree?` (propose « Sous-éléments à plat »).
- `DataViewBar<R>` — onglets des vues (`ViewTabs`), `ShowArchivedSwitch`, actions ; puis la `TableToolbar` : recherche, « Filtrer » (`FieldsFilterBuilder`), « Trier » (`SortPanel`, si une colonne est triable), outils, « Options » (`TableOptions` : modifications non enregistrées, « Grouper par » / « Période » / « Sous-éléments à plat », « Pied de tableau », colonnes `DataColumnsPanel`, exports CSV / PDF) ; enfin `BulkHint`. Utilisé par `DataTable`, `library`, `shopping`.
- Internes : `PERIOD_LABELS`, `ExportButtons` (CSV, PDF avec chargement ; désactivés sans ligne), `TableExportButtons`.

### `TableToolbar.tsx`

| Export                                                         | Rôle                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TableToolbar({ search?, children?, options? })`               | Barre d’outils : recherche sur toute la largeur restante (14rem au moins, bouton « Effacer »), outils, puis « Options » à droite. Publie sa hauteur dans `--onoko-table-toolbar-height`.                                                                                                                                                                                               |
| `ToolbarFilter({ count, opened?, onOpenedChange?, children })` | Bouton « Filtrer » (badge du nombre de conditions) et son popover (contrôlable : ouvert aussi depuis les menus d’en-tête).                                                                                                                                                                                                                                                             |
| `ToolbarSort({ count, children })`                             | Bouton « Trier » (badge du nombre de tris) et son popover.                                                                                                                                                                                                                                                                                                                             |
| `TableOptions(props)`                                          | Menu « Options » : en haut, si `dirty`, « Modifications non enregistrées » avec « Annuler les modifications » / « Enregistrer les modifications » ; sections « Affichage » (`display`, interrupteur « Pied de tableau » si `footer`), « Colonnes » (repliable, déplié d’office s’il n’y a pas d’affichage), « Exporter ». Largeur 340 par défaut ; ne dépasse pas la fenêtre (défile). |

### `SortPanel.tsx`

`SortPanel<K>({ sorting, onChange, keys, labels, manualText, hint? })` — niveaux de tri (voir « Tris »). Vide : affiche `manualText`.

### `ColumnsPanel.tsx`

- `DataColumnsPanel<R>({ columns, layout, onLayoutChange })` — colonnes d’un tableau : case pour afficher / masquer (désactivée si verrouillée), poignée pour réordonner (pointeur ou clavier), « Colonnes par défaut » (vide la disposition), astuce « cliquez sur un en-tête pour trier, Maj + clic pour ajouter un niveau ; glissez un en-tête pour le déplacer, son bord pour le redimensionner. ». Utilisé par `DataViewBar` et `tasks`.
- Internes : `ColumnItem`, `ColumnsList`.

### `ColumnHeaderMenu.tsx`

- `ColumnMove` (type) — `'start'`, `'left'`, `'right'` ou `'end'`.
- `ColumnMenuExtras` (interface) — actions optionnelles : `onSelect?`, `onFilter?`, `group?` (`{ active, onToggle }`).
- `ColumnHeaderMenu` — menu d’en-tête : « Sélectionner la colonne », « Trier par ordre croissant », « Trier par ordre décroissant », « Retirer ce tri », « Filtrer selon cette colonne », « Grouper selon les valeurs » / « Ne plus grouper », « Masquer la colonne », puis section « Déplacer » : « Au début », « À gauche », « À droite », « À la fin ».

## `views/`

### `api.ts`

- `ViewKind` (type) — ré-export GraphQL (tâches, routines, listes de courses, `TABLE`…).
- `TaskViewRecord` (interface) — `id`, `label`, `config` (brut), `isDefault`, `position`.
- `useTaskViews(projectId, kind?, tableKey?)` — requête `taskViews` (clé `['taskViews', kind, tableKey, projectId]`).
- `useTaskViewMutations()` — `create`, `update`, `duplicate`, `remove`, `setDefault`, `move` (mutations `createTaskView`, `updateTaskView`, `duplicateTaskView`, `deleteTaskView`, `setDefaultTaskView`, `moveTaskView`) ; toutes invalident les vues ; `move` est optimiste (l’onglet reste où il est lâché).

### `use-saved-views.ts`

- `SavedView<C>` (interface) — vue avec sa configuration analysée.
- `useSavedViews<C>({ projectId, kind, tableKey?, parse, blank, first, ready?, param? })` — vues d’une portée et copie de travail de la vue courante : `views` (par position), `current`, `config`, `dirty` (comparaison JSON canonique, clés triées), `isPending`, `error`, `select`, `change`, `save`, `revert`, `createView(label, fromCurrent)`, `rename`, `duplicate` (nom de copie `copyName`, borné à `TEXT_MAX`), `remove` (l’échec est laissé à l’appelant), `setDefault`, `move`. Les premières vues sont créées une seule fois par portée, l’une après l’autre, même en cas d’échec (pas de boucle). Paramètre d’adresse par défaut `view`. Sert aussi aux vues des tâches et des routines.
- `SavedViewsState<C>` (type) — son retour.
- Interne : `canonical`.

### `use-data-view.ts`

| Export                                                               | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FirstTableView` (interface)                                         | Première vue : `label`, `config?`.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `withinFilter(field, period)`                                        | Filtre d’une condition « pendant » une période (« thisMonth », « lastYear »…). Règle eslint associée. Utilisé par `accounting`, `time`, `treasury`.                                                                                                                                                                                                                                                                                                                       |
| `conditionFilter(field, operator, value?, id?)`                      | Filtre d’une seule condition (« closed est faux », « state dans OPEN »…). Utilisé par `routines`, `shopping`, `tasks`.                                                                                                                                                                                                                                                                                                                                                    |
| `RowSelection` (interface)                                           | Lignes cochées : `isChecked`, `check(keys, on)`, `setChecked(keys)`, `keys` (lignes affichées).                                                                                                                                                                                                                                                                                                                                                                           |
| `DataView<R>` (interface)                                            | Ce que rend `useDataView` : `tableKey`, `title`, `views`, `config`, `columns`, `shown`, `layout`, `sorting`, `rows` (gardées et triées), `total` (avant recherche et filtre), `archivedToggle`, `groups`, `groupColumn`, `change`, `setLayout`, `setSorting`, `filterOpened` / `setFilterOpened`, `columnExtras(id)`, `keyOf`, `selection` / `setSelection`, `cellProps(columnId, key)`, `bulkLabel(columnId)`, `rowSelection`.                                           |
| `useTableViews({ tableKey, projectId?, first?, defaults?, ready? })` | Vues enregistrées d’un tableau, lues avant ses lignes quand celles-ci dépendent de la vue (les événements listés avec les tâches) ; `defaults` : ce par quoi commence toute nouvelle vue. Paramètre d’adresse `<tableKey>-view`. Utilisé par `tasks`.                                                                                                                                                                                                                     |
| `useDataView(options)`                                               | Le hook des tableaux (voir « Comment ça marche »). Options : `tableKey`, `projectId?`, `columns`, `rows`, `title`, `first?`, `getKey?` (nécessaire pour la modification en masse), `bulkColumns?` (cellules propres hors colonnes, avec leur nom), `archived?(row)` et `archivedLabel?` (« Afficher les archivés », décision AH), `alwaysKept?(row)` (ligne gardée quels que soient recherche et filtre : celle qu’on crée), `views?` (vues lues avant, `useTableViews`). |

Internes : `BUDGET_KEY_VALUES` et `LEGACY_FILTER_VALUES` (anciennes valeurs « none » des filtres « Qui » et « Contexte » des tables `treasury-budgets`, `treasury-budget-report`, `treasury-budget-outside`, relues comme `ME_KEY`), `parseConfig`, `NEVER_ARCHIVED`.

### `ViewTabs.tsx`

`ViewTabs<C>({ state })` — onglets des vues (`SortableTabs`) : étoile pleine sur la vue par défaut, pastille des modifications non enregistrées, menus et création (voir « Les vues enregistrées »). Le nom d’une vue se saisit dans le panneau latéral (`openLabelForm`, champ « Libellé de la vue », `viewLabelSchema`). Publie sa hauteur dans `--onoko-view-tabs-height`. Interne : `promptLabel`.

### `UnsavedIndicator.tsx`

- `UNSAVED_CHANGES` = « Modifications non enregistrées ».
- `UnsavedIndicator({ dirty, offset, children })` — pastille orange (8 px) en haut à droite, sur l’onglet et sur « Options ». Une règle eslint l’impose.

### `published-height.ts`

`usePublishedHeight<T>(name)` — publie la hauteur d’un élément dans une variable CSS de la page (`document.documentElement`), tenue à jour par `ResizeObserver` ; le dernier élément monté sous un nom gagne ; la variable est retirée quand il n’y en a plus. Utilisé par `TableToolbar` et `ViewTabs`.

## `selection/`

### `bulk-selection.ts`

- `ALL_COLUMNS` = `'*'` — colonne d’une sélection de lignes cochées (toutes les colonnes en masse).
- `BulkSelection` (interface) — `column`, `keys`.
- `BulkCellProps` (interface) — `data-bulk-selected`, `onClickCapture`.
- `useBulkSelection({ keys, isBulk })` — la sélection d’un tableau (voir « Sélection et modification en masse ») : `selection`, `setSelection`, `selectColumn`, `cellProps`, `isChecked`, `check`, `setChecked`, `keys`. Seules les lignes affichées restent sélectionnées ; Échap vide la sélection.

### `bulk-edit.ts`

| Export                                                             | Rôle                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BulkTableContext`                                                 | Contexte fourni par `DataTable` à ses cellules : sélection, clé et ordre des lignes.                                                                                                                                                                                                  |
| `useBulkTable()`                                                   | Lit ce contexte (`null` hors tableau). Utilisé par `tasks`.                                                                                                                                                                                                                           |
| `bulkTargets(view, column, row)`                                   | Lignes concernées par un changement dans une cellule : celles de la sélection (de la colonne, ou cochées) si la ligne en fait partie et qu’il y en a au moins deux, sinon la ligne seule.                                                                                             |
| `bulkCellLabels(view, nameOf)`                                     | Fabrique de libellés accessibles : « Unité de « Farine » », ou « Unité (appliqué aux 3 cellules sélectionnées) » (décision BD). Règle eslint associée.                                                                                                                                |
| `BulkChange<R, C>` (type)                                          | Changement identique pour toutes les lignes, ou calculé par ligne.                                                                                                                                                                                                                    |
| `changeOf(change, row)`                                            | Changement d’une ligne.                                                                                                                                                                                                                                                               |
| `bulkSaver(view, save, saveMany?, { label?, notify? })`            | Enregistrement des cellules d’un tableau : `(colonne) => (row, change) => void` ; une ligne seule → `save` ; plusieurs → `saveMany` ou `save` ligne par ligne, puis « Modification appliquée à N lignes. » (sauf `notify: false`). Utilisé par presque toutes les features à tableau. |
| `applyDiff(current, before, after)`                                | Valeurs d’un champ multiple après un changement fait dans une cellule (ajouts et retraits appliqués, le reste gardé).                                                                                                                                                                 |
| `listDiff(before, after)`                                          | `{ added, removed }` entre deux listes.                                                                                                                                                                                                                                               |
| `useEntityCellEdit(row, columns, { rows, save, saveMany, label })` | Édition des cellules d’un tableau d’entités à `id` (tâches, routines) : `{ apply(single, bulk?), count, targets }` ; un changement vide ne modifie pas la ligne ; avec `bulk`, une seule requête groupée (avec annulation, message laissé à `saveMany`).                              |

Interne : `onColumn`.

### `selection-actions.tsx`

| Export                                                                                                           | Rôle                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `forEachRow(rows, run, done)`                                                                                    | Exécute une action ligne après ligne, puis notifie le succès ou la première erreur (les lignes précédentes restent faites) ; renvoie `true` si tout est fait.                                                                                               |
| `outermost(rows, idOf, parentOf)`                                                                                | Lignes cochées qu’aucune autre ligne cochée ne contient (une sous-tâche sous une tâche cochée part avec elle). Utilisé par `routines`, `tasks`.                                                                                                             |
| `deleteRowsAction(rows, { title, risks, remove?, removeAll?, done, clear, label?, loading? })`                   | « Supprimer » destructif : confirmation, puis suppression (en une requête avec `removeAll`, sinon une par une), sélection vidée si tout a réussi.                                                                                                           |
| `rowLabel(row)`                                                                                                  | Le `label` d’une ligne (règle eslint : `name: rowLabel`).                                                                                                                                                                                                   |
| `deleteItemsAction(rows, { noun, many?, feminine?, the, label?, risks, remove?, removeAll?, clear?, loading? })` | « Supprimer » avec les mêmes textes sur une ligne et sur une sélection : titres « Supprimer l’article » / « Supprimer les articles », messages « Article supprimé. » / « 3 articles supprimés. » ; sans `label`, une ligne est « Ce budget » / « Cette … ». |
| `switchRowsAction({ on, labels, icons, apply, done, undo?, clear?, loading? })`                                  | Bascule d’un état (fermé, fait, archivé…) : vers « on » sauf si toutes les lignes y sont déjà, alors retour ; succès notifié avec annulation (par défaut la bascule inverse).                                                                               |
| `archiveRowsAction({ archived, apply, label, count, feminine?, undo?, clear?, loading? })`                       | « Archiver » / « Restaurer » (icônes archive / flèche), message `archivedMessage` (`lib/archive`).                                                                                                                                                          |
| `archiveItemsAction(rows, mutation, { noun, many?, feminine?, clear? })`                                         | Même chose avec la mutation d’archivage du type (`useSetArchived`) : « 3 fiches archivées. » avec annulation.                                                                                                                                               |
| `duplicateRowsAction(rows, { duplicate, done, label?, loading? })`                                               | « Dupliquer » : chaque ligne copiée.                                                                                                                                                                                                                        |
| `rowMenuEntry(action)`                                                                                           | Entrée du menu d’une ligne faite d’une action de la barre de sélection (sur cette ligne seule), confirmation comprise.                                                                                                                                      |

Voir [Archivage](../../business-rules/cross-cutting/archiving.md) et [Dialogues](dialogs.md) (`confirmDestructive`).

### `SelectionBar.tsx` et `SelectionBar.module.css`

- `SelectionAction` (interface) — `label`, `icon`, `onClick`, `destructive?` (`{ title, risks, confirmLabel? }` : rouge, après confirmation), `danger?` (rouge, avec son propre dialogue), `loading?`, `disabled?`.
- `SelectionBar({ label, actions, onClear })` — barre des actions sur les lignes sélectionnées (région « Actions de la sélection »), collée en bas de la fenêtre, centrée : le libellé (« 3 tâches sélectionnées »), les actions, « Désélectionner ». Seules les actions que les colonnes ne font pas.

### `selection-label.ts`

`selectedLabel(count, names?, feminine?)` — « 3 lignes sélectionnées », « 1 fiche sélectionnée » (défaut : « ligne(s) », féminin).

### `BulkHint.tsx`

`BulkHint({ selection, labelOf, onClear })` — explication de la sélection en cours (annoncée, `aria-live`) : « N lignes cochées » + « Modifiez un champ de l’une d’elles : le changement s’applique à toutes (autant de champs que voulu). » + « Tout décocher » ; ou « N cellules « Colonne » sélectionnées » + « Modifiez-en une : le changement s’applique à toutes. Ctrl / ⌘ + clic ou Maj + clic pour en ajouter, Échap pour quitter. » + « Quitter la sélection ».

## `cells/`

### `cell-field.ts`

| Export                                          | Rôle                                                                                                                                                                                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cellField`                                     | Props d’un champ sans bordure qui remplit la cellule (`variant="unstyled"`, `size="xs"`, classes `EditableCells.module.css`) ; bordure au survol et au focus. Utilisé par `shopping`.                                             |
| `cellCombobox`                                  | Idem pour un select : liste aussi large que ses options, en portail.                                                                                                                                                              |
| `stopClick(event)`                              | Arrête la propagation (un clic ne doit pas ouvrir la ligne).                                                                                                                                                                      |
| `stoppedCellField`, `stoppedCellCombobox`       | `cellField` / `cellCombobox` avec `onClick: stopClick`. Règle eslint associée.                                                                                                                                                    |
| `cellPicker(readOnly)`                          | Props d’un sélecteur en cellule (un parent, un lien) : sans bordure, « — » si vide, effaçable sauf en lecture seule, en portail. Utilisé par `routines`, `tasks`.                                                                 |
| `CellDraft<T>` (interface), `useCellDraft<T>()` | Brouillon d’une cellule saisie : `draft`, `setDraft`, `take()` (au blur ; `null` si aucun ou abandonné), `onKeyDown` (Entrée enregistre en quittant le champ, Échap abandonne et quitte sans enregistrer). Règle eslint associée. |
| `CellSchema<T>` (interface)                     | Règle d’un champ (`safeParse`, schéma zod de `@ordo/shared`).                                                                                                                                                                     |
| `accepted(error)`                               | `true` sans erreur ; sinon notifie « {erreur} Rien n’a été modifié. » et renvoie `false`.                                                                                                                                         |
| `checked(schema, value, fallback)`              | Valeur validée et normalisée (`{ value }`), ou `null` après notification de l’erreur.                                                                                                                                             |
| `cellLabel(field, of, count)`                   | « Statut de la tâche #12 » ou « Statut (appliqué aux 3 cellules sélectionnées) ».                                                                                                                                                 |
| `itemCellLabel(field, item, count)`             | Idem pour un élément nommé (« Lieu de « Ménage » »). Règle eslint associée.                                                                                                                                                       |

### `EditableCells.tsx`

Cellules éditables, toutes avec `label` (nom accessible), `readOnly?` et `onSave` :

| Composant             | Comportement                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EditableText`        | Texte saisi en place, enregistré en quittant le champ (ou Entrée) s’il est valide et changé ; Échap abandonne. Options : `nullable` (vide → `null` ; sinon « Une valeur est requise. »), `validate`, `schema` (prioritaire), `placeholder` (« — »), `link` (champ URL + bouton « Ouvrir le lien »), `strong`.                                                                                |
| `EditableNumber`      | Nombre ou montant, aligné à droite, format français : `decimals` (défaut 2), `amount` (`AmountInput`, jusqu’à 4 décimales, suffixe « € »), `suffix`, `signed`, `min` / `max`, `nullable`, `validate`, `schema`, `saveUnchanged` (une cellule de sélection donne sa valeur aux autres). Erreurs « Nombre invalide. », « Une valeur est requise. ».                                            |
| `EditableTime`        | Heure (HH:MM, 24 h), enregistrée au changement ; `clearable`.                                                                                                                                                                                                                                                                                                                                |
| `EditableDate`        | Date (YYYY-MM-DD), enregistrée dès qu’elle est choisie ; `nullable`, `minDate`.                                                                                                                                                                                                                                                                                                              |
| `EditableSelect`      | Un choix dans une liste cherchable, enregistré dès qu’il est choisi ; `data`, `nullable`, `renderOption`, `filter`, `leftSection`, `placeholder`, `nothingFoundMessage`, `onCreate` (crée ce qui est tapé, comme `CreatableSelect`).                                                                                                                                                         |
| `EditableMultiSelect` | Plusieurs choix, affichés l’un sous l’autre (`StackedMultiCell`) ; un clic ouvre la liste (`BatchMultiSelect`), enregistrée à sa fermeture ; `items` (rendu propre des valeurs).                                                                                                                                                                                                             |
| `EditableCheck`       | Oui / non, case cochée en place, enregistrée aussitôt.                                                                                                                                                                                                                                                                                                                                       |
| `EditableMarkdown`    | Texte markdown (note, description) : sa valeur coupée sur une ligne ouvre l'éditeur markdown partagé (`MarkdownEditor`) dans un `EditablePopoverCell` ; enregistré à la fermeture s'il est changé (`markdownSchema` : blanc → `null`). Options : `suggestions` (« # » et « @ », aucune par défaut), `readOnly`. Garde-fou eslint : pas d'`EditableText` sur une `note` ou une `description`. |
| `EditablePopoverCell` | Valeur qui ouvre son éditeur dans un popover (un lieu, des alertes, une règle) : valeur en lien, grisée si vide ; `width`, `truncate`, `opened` / `onOpenedChange`, `onClose` ; en lecture seule, texte simple.                                                                                                                                                                              |

Très utilisées par les features (`accounting`, `calendar`, `routines`, `sheets`, `shopping`, `stock`, `tasks`, `time`, `treasury`, `beneficiaries`, `library`) et par [Montants](money.md).

### `EditableLabel.tsx`

`EditableLabel({ value, label, schema, to?, onOpen?, before?, after?, readOnly?, onSave })` — cellule titre : un clic sur le titre ouvre la ligne (sa page `to`, ou `onOpen`) ; un double-clic ailleurs dans la cellule la renomme en place (infobulle « Double-cliquez pour renommer »), enregistrée en quittant le champ ou par Entrée si valide et changée ; Échap abandonne. Utilisé par `routines`, `tasks`.

### `StackedMultiCell.tsx`

- `StackedItem` (interface) — `id`, `label`, `hint?` (nom complet au survol), `icon?`.
- `StackedMultiCell({ label, readOnly?, items, renderSelect })` — cellule à valeurs multiples : valeurs empilées (5 au plus ; au-delà 4 et « X de plus ») ; un clic remplace l’affichage par le multi-select, ouvert aussitôt, qui doit appeler `onDropdownClose`.

### `StackedValues.tsx` et `stacked.ts`

- `MAX_STACKED` = 5 ; `stackedCount(count, expanded)` — nombre de valeurs affichées (toutes jusqu’à 5, sinon 4).
- `StackedToggle({ hidden, expanded, onToggle, className?, keepFocus? })` — bouton « X de plus » puis « Réduire » (`foldAction`) ; n’ouvre ni la ligne ni la liste d’un champ. Règle eslint associée. Utilisé aussi par `inputs`.
- `StackedValues({ children, gap? })` — valeurs d’une cellule l’une sous l’autre, repliées au-delà de 5. Utilisé par de nombreuses features.

### `ChildrenCell.tsx`

`ChildrenCell({ children, add? })` — cellule des enfants d’une ligne (sous-tâches, sous-routines) : empilés (`StackedValues`), puis le « + » qui en ajoute un (`{ label, item, onClick }`, absent en lecture seule). Utilisé par `routines`, `tasks`.

### `DependencyIcon.tsx`

`DependencyIcon({ done })` — coche verte (dépendance faite) ou sablier orange (attendue). Utilisé par `routines`, `tasks`.

### `AddRowField.tsx` et `AddRowField.module.css`

- `AddRowField({ label, where?, hint?, schema, onCreate, onCancel?, autoFocus? })` — champ de la ligne d’ajout (fin de tableau ou de groupe) : un libellé puis Entrée ajoute une ligne ; placeholder « {label} ({hint} ; Entrée pour valider) » ; le champ se vide aussitôt pour enchaîner ; un libellé refusé par l’API revient dans le champ (sauf si un autre est en cours de saisie) ; libellé invalide notifié (« Libellé invalide. » par défaut) ; Échap vide (et `onCancel`). Utilisé par `routines`, `sheets`, `shopping`, `tasks`.
- `AddRowButton({ label, ...props })` — bouton « + … » d’une ligne d’ajout qui ouvre autre chose (un formulaire, un menu). Utilisé par `shopping`, `tasks`.

### `RowActions.tsx`

- `ROW_ACTIONS_WIDTH` = 72 — largeur de la cellule d’actions.
- `RowActions({ name, about, primary?, items })` — actions de fin de ligne, les mêmes partout : l’action principale en icône, les autres dans le menu « ⋯ » (destructives en dernier, en rouge, après un séparateur). Une action marquée `inMenu` (« Archiver ») n’est jamais un bouton (décision R) : elle passe dans le menu. Voir [Actions](actions.md).

### `EditableCells.module.css`

Classes : `.root`, `.input`, `.chipTrigger`, `.section`, `.placeholder`, `.titleArea` (zone double-cliquable du titre), `.titleLink`.

## Voir aussi

- [Filtres](filters.md), [Onglets](tabs.md), [Glisser-déposer](dnd.md), [Arbres](tree.md), [Actions](actions.md), [Dialogues](dialogs.md), [Retour visuel](feedback.md).
- [lib](../lib.md) : `archive`, `download`, `format`, `periods`, `search-params`, `fill-height`, `notify`.
- [Ordre](../../business-rules/cross-cutting/ordering.md), [Archivage](../../business-rules/cross-cutting/archiving.md), [Dates](../../business-rules/cross-cutting/dates.md).
