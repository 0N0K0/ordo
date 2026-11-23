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
- `values(row)` : les valeurs d’une colonne qui en a plusieurs (catégories, magasins, projets, créneaux…) ; sans `cell`, elles s’affichent l’une sous l’autre (`StackedLines`), y compris dans les cellules en lecture seule (`readOnlyCells`) ; `multiValues(values)` pose `values` et le `text` qui les joint par « , » ;
- `numeric` (un nombre : police monospace, filtré comme un nombre via `sortValue`, aligné à droite sauf `align`) et `formatTotal` (écriture du total du pied) ;
- `align` (`ColumnAlign` : `start`, `center`, `end`) : alignement de ses cellules et de son en-tête selon le type de sa donnée, posé par les briques de colonnes et les types `BADGE_COLUMN`, `TIME_COLUMN`, `DURATION_COLUMN`, `STACKED_COLUMN`, jamais tableau par tableau (voir « Alignement » ci-dessous) ;
- `filter` : comment filtrer (`text`, `number`, `date`, `boolean`, `choice`, `choices`), `false` pour ne pas filtrer ; par défaut : un nombre pour une colonne `numeric`, du texte si elle a un `text`, sinon rien ;
- `required` : jamais vide, pas de « est vide » dans son filtre ; une colonne de comptage (commentaires, relances, éléments…) l'est toujours : 0 est une valeur ;
- `groupable` (par défaut toutes sauf la colonne verrouillée), `groupTree` (groupes en arbre, ex. catégories, ou dans l’ordre des paramètres), `groupValue` (valeurs de regroupement propres), `groupNoneLabel` (nom du groupe des lignes sans valeur, défaut « Sans valeur »), `groupLabels` (noms des valeurs d’une colonne oui / non, oui d’abord : ses groupes, le nom de ses icônes, les choix de son filtre ; défaut « Oui » / « Non »), `yesNoIcons` (icônes de ses valeurs, posées par `booleanColumn`) ;
- `bulk` : ses cellules se modifient en masse.

Plusieurs valeurs dans une cellule s’affichent toujours l’une sous l’autre, une par ligne, jamais à la suite sur une ligne (« , », « ; », « · ») ; de même, chaque cas d’horaires ou d’une répétition a sa ligne ; au-delà de 5, 4 puis « X de plus » ; seul le `text` (export, recherche) les joint (voir [Conventions](../app.md#plusieurs-valeurs-dans-une-cellule)). Règle eslint associée : pas de `.join(` dans le rendu d’une cellule, sa `cell` ou ses `values` (fichiers de colonnes, de cellules et de tableaux des features, `components/data-table/cells`).

Une colonne oui / non s’écrit toujours avec `booleanColumn` (règle eslint) : ses cellules montrent une icône nommée d’après sa valeur, jamais les mots « Oui » / « Non » (voir [Conventions](../app.md#colonnes-oui--non), avec le nom des valeurs de chaque colonne) ; son texte (export, recherche) est « Oui » / « Non » ; une valeur vide (`null`, ni oui ni non) laisse la cellule et le texte vides, n’est gardée ni par « oui » ni par « non » et va dans le groupe des lignes sans valeur. Modifiable en place, un oui / non est un bouton d’état (`StateButton`, ci-dessous), aux mêmes couleurs, sens et noms que la colonne (la colonne prend ses `states`) : carré pour la donnée affichée, rond pour la chose à cocher, jamais un interrupteur ni une case à cocher (règle eslint : pas de `Switch`, `StateSwitch` ni `Checkbox` dans les fichiers de colonnes, de cellules et de tableaux).

Alignement : chaque colonne et son en-tête s’alignent selon le type de leur donnée (`columnAlign`, voir [Conventions](../app.md#alignement-des-cellules)) : centrés pour une seule valeur dans une pastille (statut, priorité, type : `...BADGE_COLUMN` ; état : `stateColumn`), un oui / non (`booleanColumn`) ou un bouton d’état, une heure ou une plage horaire (`...TIME_COLUMN`), une durée (`...DURATION_COLUMN`, filtrée et totalisée comme un nombre), une date (colonne au filtre `date`, `monthColumn`) ; à droite pour un nombre (`numeric` : montant, quantité, compte, pourcentage), en police monospace ; à gauche pour un texte et pour plusieurs valeurs dans une cellule (`values`, `multiValues`, ou `...STACKED_COLUMN` pour une date suivie de ses détails). La première colonne d’un arbre (titre et pliage) reste à gauche. `DataTable` pose `data-align` sur la cellule et l’en-tête (`alignAttribute`) ; `DataTable.module.css` aligne leur texte et donne `--cell-justify` / `--cell-text-align` aux champs, pastilles et liens des cellules modifiables (`EditableCells.module.css`, `EditableNumber`, `EditablePopoverCell`, heures d’`EditableTime`), et `CELL_JUSTIFY` aux rangées d’éléments d’une cellule (`Group`) ; une icône seule (un oui / non) est centrée. Les éditeurs ouverts en popover restent alignés à gauche. Le pied (totaux) s’aligne comme sa colonne. Les exports ne changent pas (PDF : montants à droite). Règles eslint : pas d’`align` écrit en dur dans une colonne (→ les types ci-dessus), pas de `ta` / `textAlign` dans les fichiers de colonnes, de cellules et de tableaux.

Les colonnes affichées, leur ordre et leurs largeurs viennent de la disposition (`ColumnLayout` : `columnOrder`, `hiddenColumns`, `columnSizing`) enregistrée dans la vue. Une colonne ajoutée après coup se place à la fin de l’ordre enregistré. Largeurs bornées entre 40 et 1200 px.

Dans l’en-tête : le titre s’aligne comme les cellules de sa colonne (centré : la place de son menu gardée à sa gauche aussi ; à droite : le menu passe à sa gauche, la marque de tri avant le titre, qui finit où finissent les valeurs) ; cliquer le titre trie (croissant, décroissant, aucun ; Maj + clic ajoute un niveau de tri, numéroté) ; glisser l’en-tête déplace la colonne ; glisser son bord droit la redimensionne, double-cliquer l’ajuste à son contenu (un second double-clic rend la largeur par défaut) ; son menu sélectionne la colonne, trie, filtre, groupe, masque et déplace (« Au début », « À gauche », « À droite », « À la fin »).

### Les vues enregistrées

Chaque tableau (`tableKey`, et éventuellement un projet) a ses vues : des onglets (`ViewTabs`) réordonnables par glisser-déposer. Une vue enregistre sa configuration (`TableViewConfig`) : recherche, filtre, tris, regroupement (`groupBy`, `groupPeriod`), « Sous-éléments à plat » (`flat`), pied (totaux par colonne), ordre manuel (`manualOrder`), disposition des colonnes, options propres.

- La vue affichée est dans l’adresse (`?<tableKey>-view=<id>`), sinon la vue par défaut (étoile), sinon la première.
- À la première visite, les premières vues sont créées (par défaut une seule : « Toutes » ; une feature peut en fournir d’autres avec `first`, ex. un filtre `withinFilter` / `conditionFilter`).
- Toute modification (filtre, tri, colonne…) va dans une copie de travail propre à chaque vue, conservée en changeant d’onglet : une pastille orange (« Modifications non enregistrées ») apparaît sur l’onglet et sur « Options », avec « Enregistrer les modifications » et « Annuler les modifications ».
- Menu de l’onglet courant : enregistrer / annuler les modifications, « Renommer », « Dupliquer », « Définir par défaut », « Déplacer à gauche / à droite », « Supprimer » (impossible sur la dernière vue ; confirmation : la vue et sa configuration sont supprimées, les lignes ne sont pas modifiées).
- « Nouvelle vue » : « Vue vierge » ou « À partir de l’affichage actuel ».
- Toute nouvelle vue d’un tableau (premières vues comprises) part des colonnes choisies pour ce tableau dans l’espace (« Colonnes des nouvelles vues », section `ColumnDefaults` des paramètres de la page : ordre et colonnes masquées), sinon de celles de l’application ; les vues existantes gardent les leurs. Ce réglage est propre à chaque `tableKey`, le même pour la page et les projets.
- Les vues sont stockées côté API comme les vues des tâches (`taskViews`, `kind: 'TABLE'`, `tableKey`) ; l’agenda y garde aussi les siennes (`tableKey` `calendar`, configuration `CalendarViewConfig`, voir [Agenda](../../features/activities/calendar.md#vues-de-lagenda)), avec `useSavedViews` et `ViewTabs`. Une configuration invalide redonne les valeurs par défaut ; les anciens ids de colonne libellé et d’anciennes valeurs de filtre (budgets de trésorerie) sont relus : les colonnes libellé s'appellent `label`, les anciens `title` / `name` d'une vue enregistrée sont lus comme lui.

### Recherche et filtres

- La recherche (barre d’outils) cherche sans casse ni accents dans le `text` de toutes les colonnes.
- « Filtrer » ouvre l’éditeur d’arbre de filtres ([Filtres](filters.md)) sur les colonnes filtrables (`tableFilterFields`). « Filtrer selon cette colonne » (menu d’en-tête) ajoute une condition sur la colonne et ouvre l’éditeur.
- Une condition incomplète ou sur une colonne inconnue est ignorée. Les dates se comparent au jour de l’utilisateur ; « pendant » utilise une période (`filterPeriod`, semaine courante comprise).
- Les choix archivés (`withArchived`) gardent leur libellé mais ne sont proposés que s’ils sont déjà dans le filtre ; un parent archivé de choix proposés reste, grisé.
- « Afficher les archivés » (lignes archivées, option `archived` de `useDataView`) n’est pas enregistré dans la vue.
- Aucune ligne gardée : « Aucune ligne ne correspond à cette vue. » avec « Effacer la recherche et les filtres » ; aucune ligne du tout : « Rien pour le moment. » (ou l’état vide `empty` de la feature).

### Tris et ordre manuel

- Les tris s’appliquent par priorité ; les valeurs vides vont en dernier ; à égalité, l’ordre d’origine est gardé.
- Sans tri, l’ordre est l’ordre manuel : les lignes se glissent par leur poignée. Sans `onMoveRow`, l’ordre est enregistré dans la vue (`manualOrder` ; les lignes cachées par les filtres gardent leur place après) ; avec `onMoveRow`, la feature enregistre elle-même (position, parent, groupe), sauf avec `orderInView` : l'ordre reste dans la vue et `onMoveRow` n'est appelé que pour un changement de groupe (utilisé par `ShoppingTable`).
- Panneau « Trier » : niveaux « Trier par » / « puis », sens ↑ / ↓, « Monter » / « Descendre », « Ajouter un tri », « Revenir à l’ordre manuel ».

### Regroupement

- « Grouper par » (Options) ou « Grouper selon les valeurs » (menu d’en-tête) regroupe les lignes selon la colonne : une date par période (« Période » : jour, semaine, mois, trimestre, année ; défaut mois), une colonne à valeurs multiples place la ligne dans chacun de ses groupes, un booléen en son oui puis son non (ses `groupLabels` : « En retard » / « Dans le délai »… ; « Oui » / « Non » sans), sinon le texte. Les lignes sans valeur vont dans « Sans valeur » (ou le `groupNoneLabel` de la colonne : « Sans catégorie »…), en dernier.
- Les groupes suivent l’ordre des options de la colonne (ou de la valeur de tri), inversé si la colonne est triée en décroissant.
- Une colonne avec `groupTree` regroupe en arbre de groupes (un groupe parent s’affiche s’il a des lignes dans ses sous-groupes).
- Le regroupement est seulement celui de la vue (« Grouper par » de `DataViewBar`) : un tableau n’a pas de regroupement à lui par-dessus ou à la place, toujours actif ; il démarre groupé par une vue créée la première fois (`first`, `groupBy`), et l’utilisateur change ou retire le regroupement comme sur tout tableau. Une règle eslint l’impose (pas d’attribut `groupTree`, `grouping` ou `showEmpty` sur un `…Table`, pas d’autre champ « Grouper par »).
- Les groupes sans ligne ne s’affichent jamais, pas même pendant un glisser-déposer : une ligne se lâche sur un groupe qui a déjà des lignes ; pour la mettre dans un groupe vide, on change sa valeur (cellule, modification en lot ou formulaire).
- Chaque groupe a un en-tête repliable avec son nombre de lignes (et un résumé `groupSummary`), une ligne d’ajout et ses totaux. Avec `onMoveRow`, une ligne lâchée sur un en-tête de groupe y va en premier.

### Arbre de lignes

Avec `parentKey`, les lignes s’affichent sous leur parent (un parent non affiché : à la racine), repliables ; glisser horizontalement change le niveau (au plus un niveau sous la ligne au-dessus). La première cellule d’une ligne sans sous-ligne garde la place du chevron (`.chevronSpacer`) seulement quand une ligne du tableau a des sous-lignes : sinon les libellés sont au bord. L’option « Sous-éléments à plat » (`flat`) les affiche à plat.

### Sélection et modification en masse

Deux sélections, exclusives :

- **Cellules d’une colonne** (colonnes `bulk`) : Ctrl / ⌘ + clic ajoute ou retire une cellule, Maj + clic sélectionne les cellules depuis la dernière, « Sélectionner la colonne » prend toutes les cellules affichées ; un clic simple hors de la sélection ou Échap la quitte.
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
| `ColumnFilter<R>` (type)                       | Filtre d’une colonne : `text` (valeur optionnelle, sinon `text`), `number`, `date` (YYYY-MM-DD), `boolean` (`null` : ni oui ni non, gardé par aucune des deux conditions), `choice` (`options`, `none?` : la valeur de l’option « Aucun », vide pour « est vide »), `choices` (plusieurs valeurs ; un filtre enregistré `in` / `notIn`, d’une colonne passée d’un choix à plusieurs, se lit `anyOf` / `noneOf`). |
| `YES_LABEL`, `NO_LABEL`                        | « Oui » / « Non » : texte d’une valeur oui / non (export, recherche), ses noms quand sa colonne n’en donne pas. |
| `yesNoText(value)`                             | « Oui » / « Non » d’une valeur (texte de `booleanColumn`). |
| `YesNoLabels` (interface)                      | Noms des valeurs d’une colonne oui / non : `yes`, `no`. |
| `YesNoIconKind` (type), `YesNoIcons` (interface) | Icône d’une valeur : `check` (carré plein avec une coche), `cross` (carré rouge avec une croix), `warning` (triangle orange avec un point d’exclamation), `empty` (carré gris vide : un état à atteindre, le non par défaut d’un bouton d’état) ; des ronds au lieu des carrés sur un bouton d’état (`YesNoIcon` `shape`) ; icônes d’une colonne : `yes?` (défaut `check`), `no?` (défaut `cross`), chacune un de ces types ou une icône propre (`YesNoIconSpec`), `check?` (couleur de la coche : `success` vert par défaut, `info` bleu pour un oui neutre). |
| `YesNoTone` (type), `YesNoIconSpec` (interface) | Icône propre d’un état : `icon` (icône Phosphor), `tone` (`success`, `info`, `warning`, `error`, `favorite` jaune, `neutral` gris), `outline?` (contour, pas pleine : un état vide), `badge?` (dessinée en blanc dans un carré, ou un rond sur un bouton d’état, de sa couleur, comme la coche et la croix : le chariot de « Manque »). |
| `WARNING_YES_ICONS`, `WARNING_YES_NEUTRAL_NO_ICONS`, `NEUTRAL_YES_WARNING_NO_ICONS` | Variantes d’icônes : triangle orange / coche verte (« En retard », « Bloquée », « Prêt ») ; triangle orange / coche bleue (« Périssable ») ; coche bleue / triangle orange (« Facultatif »). Utilisé par `shopping`, `stock`, `tasks`, `treasury`. |
| `YesNoStates` (interface)                      | États d’un oui / non modifié par un bouton d’état, montrés aussi par sa colonne (`booleanColumn({ states })`) : `labels` (noms des états d’une ligne, au singulier, oui d’abord : « Faite » / « À faire »), `icons?` (ceux de la colonne ; défaut coche verte / carré gris vide), `toggleLabels?` (ce que fait un clic pour atteindre oui / non : « Marquer comme faite » / « Marquer comme à faire » ; défaut « Passer à « état » »). Déclarés à côté des colonnes (voir [Conventions](../app.md#colonnes-oui--non)). |
| `stateIcons(states)`                           | Icônes des états : les leurs, un non sans icône étant le carré gris vide (jamais la croix rouge). Utilisé par `StateButton`, `booleanColumn`. |
| `nextStateLabel(states, value)`                | Ce que fait un clic depuis une valeur (« Marquer comme faite » depuis « À faire ») : infobulle d’un bouton d’état, entrée de menu qui le bascule. Utilisé par `StateButton`, `EntityMenu`. |
| `FAVORITE_STATES`                              | États d’un favori (client, projet) : « Favori » / « Pas favori », étoile jaune pleine / étoile grise vide, « Ajouter aux favoris » / « Retirer des favoris ». Seule source des mots et de l’étoile des favoris (règle eslint). Utilisé par `EntityHeader`, `EntityMenu`. |
| `LATE_GROUP_LABELS`                            | « En retard » / « Dans le délai » : noms des valeurs des colonnes de retard. Utilisé par `tasks`, `treasury`. |
| `TreeGroup` (interface)                        | Groupe d’un arbre de groupes : `key`, `label`, `color?`, `parentKey`.                                                                                                                                                               |
| `DataColumn<R>` (interface)                    | La colonne (voir « Comment ça marche »). Utilisé par toutes les features à tableau, et `comments`.                                                                                                                                  |
| `ColumnAlign` (type)                           | Alignement d’une colonne : `start` (texte, plusieurs valeurs), `center` (une pastille, un oui / non, un bouton d’état, une date, une heure, une durée), `end` (un nombre). |
| `BADGE_COLUMN`, `TIME_COLUMN`, `DURATION_COLUMN`, `STACKED_COLUMN` | Types de colonnes à étaler dans la colonne (`...BADGE_COLUMN`) : une valeur dans une pastille ou un bouton seul (centré), une heure ou une plage horaire (centré), une durée (`numeric` et centré), une date suivie de ses détails sur plusieurs lignes (à gauche). Seuls endroits où un `align` s’écrit (règle eslint). Utilisé par `stateColumn`, `accounting`, `routines`, `shopping`, `stock`, `tasks`, `time`, `treasury`. |
| `columnAlign(column)`                          | Alignement d’une colonne : son `align`, sinon à gauche avec `values`, à droite si `numeric`, centré avec un filtre `date`, à gauche sinon. Utilisé par `DataTable`, `DataTableHeader`, `TableFooter`. |
| `alignAttribute(align)`                        | Attribut `data-align` d’une cellule ou d’un en-tête (aucun à gauche). Utilisé par `DataTable`, `DataTableHeader`. |
| `multiValues(values)`                          | `values` et `text` d’une colonne à plusieurs valeurs, à étaler dans la colonne : ses valeurs l’une sous l’autre, jointes par « , » dans son texte. Utilisé par `routines` (« Créneaux »), `shopping` (« Projet », « Catégories », « Magasins », « Libellés des produits » des listes), `treasury` (pièces justificatives, mouvements liés, documents réglés). |
| `columnCell(column, row)`                      | Cellule d’une colonne que les `cells` du tableau ne fournissent pas : son `cell`, sinon ses `values` l’une sous l’autre (`StackedLines`). Utilisé par `DataTable`.                                                                    |
| `readOnlyCells(columns, row)`                  | Cellules en lecture seule d’une ligne (archivée) : le `cell` d’une colonne partagée, ses `values` l’une sous l’autre, sinon son `text`. Règle eslint associée. Utilisé par `calendar`, `routines`, `shopping`, `tasks`, `treasury`. |
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
| `tableFilterFields(columns)`                           | `FilterFields` de l’éditeur de filtres : un groupe « Colonnes », types (`choice` → `category`, `choices` → `multiReference`), champs obligatoires, options (en arbre via `treeSelectProps` si les choix ont une profondeur, avec avatars via `itemRenderOption` s’ils ont couleur ou image), complétude via `filterConditionSchemaFor` (`@ordo/shared`), noms et icônes des valeurs d’une colonne oui / non (`yesNo` : ses `groupLabels` et `yesNoIcons`), texte vide « Aucun filtre : toutes les lignes sont affichées. ». Utilisé par `DataViewBar`, `useDataView`, `tasks`, `calendar` (sections du filtre de l’agenda). |
| `filterRows(rows, columns, { search, filter }, today)` | Lignes gardées par la recherche et l’arbre de filtres (`matchesFilter`, `meetsCondition` partagés : la règle que l’API applique aussi aux conditions des automatisations des tâches). Utilisé aussi par `tasks` et `calendar` (filtres des vues de l’agenda, sur les colonnes du tableau de chaque sorte).                                                                                                                                                                                                                                                                                                                                                                                            |
| `RowGroup<R>` (interface)                              | Groupe : `key`, `label`, `rows`.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `isGroupable(column)`                                  | Groupable : pas `groupable: false`, pas verrouillée, et a un `text` ou un filtre.                                                                                                                                                                                                                                                                                                                                                                                            |
| `NO_VALUE_LABEL`                                       | « Sans valeur » : nom du groupe des lignes sans valeur, sauf `groupNoneLabel` de la colonne.
| `groupRows(rows, column, sorting, period?)`            | Lignes groupées (voir « Regroupement »). Utilisé aussi par `library`.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `ViewRows<R>` (interface)                              | Lignes d’une vue : `rows` (gardées, triées), `groups` (un seul groupe sans titre sans regroupement), `groupColumn`.
| `viewRows(rows, columns, config, today, alwaysKept?)`  | Une vue appliquée aux lignes : recherche et filtre (`filterRows`), tris (`sortRows`), groupes (`groupRows`) ; `alwaysKept` garde une ligne quels que soient recherche et filtre. Règle eslint associée (pas de `sortRows(filterRows(…))` à la main). Utilisé par `useDataView` et `useViewRows`.
| `groupableColumns(columns)`                            | Colonnes groupables.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

Internes : `FIELD_KINDS`, `filterable`, `offeredChoices` (choix archivés retirés sauf ceux du filtre, parents gardés grisés), `meets` (une condition sur une ligne : la valeur de sa colonne, une date ramenée à son jour, passée à `meetsCondition` de `@ordo/shared` avec la semaine de l’espace ; une condition sur une colonne inconnue ou incomplète est remplie), `weekOf`, `periodGroup` (clés triables et libellés : le jour en toutes lettres, « Semaine N · AAAA (du <lundi>) », le mois, le trimestre, l’année — formats de `lib/format` et `lib/periods`), `groupsOf` (un oui / non vide dans le groupe sans valeur).

### `DataTable.tsx`

- `RowMove` (interface) — déplacement d’une ligne remis à `onMoveRow` : `key`, `beforeKey` (null : en dernier), `parentKey?` (seulement si le niveau a changé), `groupKey?` / `fromGroupKey?` (changement de groupe ; `''` = groupe sans valeur). Utilisé par `routines`, `shopping`, `tasks`.
- `DataTable<R>` — le tableau.

Props de `DataTable` (en plus de celles de `Table` Mantine) :

| Prop                                                       | Rôle                                                                                                                                                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `view`                                                     | La vue (`useDataView`).                                                                                                                                                             |
| `getKey(row)`                                              | Clé d’une ligne.                                                                                                                                                                    |
| `cells(row)`                                               | Contenu des cellules, par id de colonne.                                                                                                                                            |
| `actions?(row)`, `actionsWidth?`                           | Actions en fin de ligne (`RowActions`), largeur (défaut `ROW_ACTIONS_WIDTH`).                                                                                                       |
| `leading?`                                                 | Cellule avant les colonnes (`header`, `cell`, `width`, `id?` pour la sélection en masse, ex. un bouton d’état).                                                                      |
| `rowProps?(row)`                                           | Props d’une ligne (clic, style…).                                                                                                                                                   |
| `groupSummary?(rows)`                                      | Résumé d’un en-tête de groupe (un total…).                                                                                                                                          |
| `bar?`                                                     | Props de `DataViewBar` (sans `view`).                                                                                                                                               |
| `framed?`                                                  | Tableau dans un `Paper` bordé.                                                                                                                                                      |
| `empty?`                                                   | Affiché à la place du tableau quand il n’a aucune ligne.                                                                                                                            |
| `details?(row)`                                            | Contenu déplié sous une ligne, sur toute la largeur.                                                                                                                                |
| `selectionActions?(rows, clear)`, `selectionLabel?(count)` | Actions de la `SelectionBar` sur les lignes cochées, et leur libellé (défaut « N lignes sélectionnées »).                                                                           |
| `parentKey?(row)`                                          | Arbre de lignes.                                                                                                                                                                    |
| `onMoveRow?(move)`                                         | Enregistre un déplacement manuel.                                                                                                                                                   |
| `orderInView?`                                             | Avec `onMoveRow`, l'ordre manuel reste enregistré dans la vue (`manualOrder`) ; `onMoveRow` n'est appelé que pour un changement de groupe. Défaut `false`. Utilisé par `shopping`.   |
| `addRow?(group)`                                           | Ligne d’ajout de chaque groupe, et en fin de tableau (`null`) quand il n’est pas groupé ou qu’il est groupé en arbre sans groupe « sans » affiché.                                     |
| `isActive?`, `isArchived?`, `isDone?`, `isStruck?`, `readOnly?` | Ligne ouverte dans le panneau (surlignée), archivée ou terminée (atténuée, `--onoko-muted-opacity`, règle eslint), au libellé barré (`data-struck` : routine faite, tâche annulée ; le champ « Libellé… » de la ligne), en lecture seule (ni glisser, ni case, ni sélection de cellule). |
| `loading?`                                                 | Squelette (`TableSkeleton`) à la place du tableau (aussi tant que les vues chargent).                                                                                               |
| `toolbar?`                                                 | Onglets et barre affichés (défaut `true` ; `false` dans un formulaire).                                                                                                             |
| `maxHeight?`                                               | Hauteur maximale propre (un tableau dans un formulaire).                                                                                                                            |

Comportement interne notable :

- Colonnes techniques : `__lead` (poignée + case), `__leading`, `__actions` ; ids de glisser préfixés `col:` (colonnes) et `g:` (groupes). Les colonnes ne rencontrent que des colonnes (`pointerWithin`), les lignes que des lignes (`closestCenter`).
- Lignes déplaçables quand la vue est sans tri (et non groupée, sauf si `onMoveRow` gère les groupes) ; les sous-lignes suivent leur parent et sont cachées pendant le glisser ; le nouveau parent se déplie.
- L’état replié / déplié est conservé quand les lignes changent (frappe dans un filtre).
- Internes : `apply`, `collisionDetection`, `getProjection`, `treeOf`, `GroupTree` (arbre de groupes d’une colonne : `groups`, `groupOf`, `noneLabel`), `groupTreeOf` (groupes sans ligne toujours retirés), `HeaderCell` (en-tête glissable, `aria-sort`, titre « Glisser pour déplacer la colonne »), `DataRow` (ligne glissable verticalement, attributs `data-active`, `data-archived`, `data-done`, `data-selected`, `data-dragging`, `data-drop-target`), `GroupHeading` (en-tête de groupe cible de dépôt), `EntryRow` (mémoïsée), `TableBody` (virtualisation au-delà de `VIRTUAL_FROM` = 150 lignes, hauteur estimée 37 px ; la zone qui défile lui est passée comme état, posé par la ref de rappel `scrollerRef` : son virtualiseur la cherche dans un effet de layout, joué avant que React ne pose la ref de l’élément parent, et ne l’observerait jamais sinon — un long tableau monté d’un coup, après le squelette, restait sans ligne jusqu’à un redimensionnement).

### `DataTableHeader.tsx`

`DataTableHeader<R>` — en-tête de tableau autonome (comme celui des tâches) pour un tableau qui n’utilise pas `DataTable` : colonnes déplacées par glisser-déposer ou menu, triées par clic (Maj : un niveau de plus), masquées, redimensionnées par leur bord (pointeur capturé), ajustées par double-clic. Props : `columns`, `shown`, `layout`, `onLayoutChange`, `sorting`, `onSortingChange`, `tableRef`, `leading?`, `leadingCount?`, `trailing?`, `columnExtras?`. Utilisé uniquement par `features/library` (bibliothèque de documents, à réécrire).

### `column-fit.ts`

- `movedColumnOrder(order, shown, id, where)` — ordre avec une colonne mise au début, à la fin, ou d’un cran parmi les colonnes affichées.
- `fittedLayout(table, layout, column, cellIndex, fitted)` — disposition avec une colonne ajustée à son contenu (mesure jusqu’à 400 lignes en disposition automatique, champs comptés à la largeur de leur texte, styles rétablis aussitôt) ; si elle l’est déjà (ou à 2 px près), la largeur enregistrée est retirée (retour au défaut).
- Internes : `textWidth` (mesure sur canvas), `contentWidth`.

### `boolean-column.tsx`

- `booleanColumn({ value, groupLabels, icons?, blank?, ...column })` ou `booleanColumn({ value, states, groupLabels?, blank?, ...column })` — colonne oui / non : `value(row)` vrai, faux ou `null` (ni l’un ni l’autre : une tâche fermée pour « Faisable maintenant ») ; `groupLabels` nomme ses valeurs, oui d’abord (groupes, nom des icônes, choix du filtre) ; `icons` ses variantes d’icônes (`YesNoIcons`, posées dans `yesNoIcons`) ; une colonne dont la valeur se change par un bouton d’état prend ses `states` (`YesNoStates`) à la place : ses icônes sont celles du bouton, en carré (`stateIcons` : non par défaut le carré gris vide, pas la croix rouge), nommées par ses états, et ses groupes par `groupLabels` (défaut : les noms des états) ; cellule `YesNoIcon`, centrée (`align: 'center'`), texte « Oui » / « Non », tri non avant oui, filtre `boolean` ; `blank(row)` laisse vides la cellule et le texte d’une ligne qui garde sa valeur pour le filtre et les groupes (les évènements listés avec les tâches). Règle eslint associée (pas de `text` écrit « Oui » / « Non » à la main, ni de mot seul avec un filtre `boolean`). Utilisé par `routines`, `sheets`, `shopping`, `stock`, `tasks`, `treasury`.
- `BooleanColumnOptions<R>` (type) — la colonne sans `text`, `cell`, `sortValue` ni `filter`, avec `value` et `blank?`, puis `groupLabels` et `icons?`, ou `states` et `groupLabels?`.

### `state-column.tsx`

- `stateColumn({ states, value, ...column })` — colonne de l’état d’une ligne, une valeur parmi une liste fixe (état d’une routine, d’une liste d’achats, d’une facture récurrente, d’un créneau ; catégorie de statut et fermeture d’une tâche ; type d’un mouvement du stock ; origine d’un document de facturation et d’une ligne du prévisionnel ; nature d’un article du catalogue) : `value(row)` donne l’état (`null` : aucun, cellule et texte vides, groupe des lignes sans valeur) ; cellule : sa pastille colorée (`ItemBadge`), centrée (`BADGE_COLUMN`) ; texte : son nom (export, recherche, groupes) ; tri dans l’ordre de `states` ; filtre `choice` parmi eux (noms seuls). Une cellule modifiable passe les mêmes `states` à `ChipChoiceCell`. Règle eslint associée (pas de colonne `state`, `statusCategory`, `closeReason`, `kind` ou `origin` avec un `text` écrit à la main). Utilisé par `accounting`, `calendar`, `routines`, `shopping`, `stock`, `tasks`, `treasury`.
- `ColumnState<V>` (interface) — un état : `id` (valeur gardée dans les filtres enregistrés), `label`, `color` (couleurs du thème, `FEEDBACK_COLORS`) ; aussi un élément de `ChipChoiceCell`.
- `StateColumnOptions<R, V>` (type) — la colonne sans `text`, `cell`, `sortValue`, `filter`, `align`, `values` ni `numeric`, avec `states` et `value`.
- `stateOf(states, value)` — état d’une valeur, aucun sans valeur.

### `month-column.ts`

`monthColumn(id, label, date, size?)` — colonne « Mois » cachée par défaut : triée et groupable par mois (YYYY-MM, un instant pris dans le fuseau de l’utilisateur), affichée « Novembre 2026 », centrée comme une date, non filtrée ; largeur 150 par défaut. Une règle eslint renvoie vers elle (pas de `.slice(0, 7)`). Utilisé par `accounting`, `stock`, `time`, `treasury`.

### `table-height.ts`

`useTableHeight()` — `[ref, maxHeight]` de la zone de défilement : compte les tableaux de la page (ceux d’un panneau ou d’une modale ne comptent pas) ; seul et sans contenu dessous (tolérance 48 px), toute la hauteur restante (240 px au moins) ; sinon `calc(100dvh - en-tête - --onoko-view-tabs-height - --onoko-table-toolbar-height - 2rem)`. S’appuie sur `useRoomBelow` (`lib/fill-height`).

### `table-export.ts`

- `TableExport<R>` (interface) — `title`, `subtitle`, `columns` (affichées), `groups`, `grouped`.
- `downloadTableCsv(table)` — CSV via `downloadCsv` (`lib/download`).
- `downloadTablePdf(table)` — PDF via `postTablePdf` (`lib/download`, rendu par l’API).

### `TableFooter.tsx`

- `TableFooter` — pied : sous chaque colonne qui a des valeurs, un menu « Total » → « Compte », « Somme », « Moyenne », « Médiane » (ces trois si la colonne a des nombres), « Aucun » ; aligné comme sa colonne (`columnAlign`, interne `TEXT_ALIGN`). Props : `shown`, `rows`, `totals`, `onChange`, `before`, `after`.
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

Classes du tableau : `.scroller` (zone de défilement), `.table`, `.head`, `.header`, `.headerContent`, `.label`, `.headerMenu` (révélé au survol), `.sortButton`, `.sortMark`, `.resizer`, `.cell` (`[data-bulk-selected]` : cellule sélectionnée ; `[data-align]` : alignée selon sa colonne, avec `--cell-justify` / `--cell-text-align` pour son contenu ; `.header[data-align]` aligne le titre et son menu, `--header-menu-room`), `.groupRow`, `.details`, `.detailsCell`, `.rowCheck`, `.row` (états `data-*`), `.titleCell` (indentation `--row-depth`), `.chevronSpacer`, `.handleSpacer`, `.handle`, `.addRow`. Importé aussi par `library`.

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

- `DataColumnsPanel<R>({ columns, layout, onLayoutChange, maxHeight? })` — colonnes d’un tableau (`maxHeight` : hauteur au plus de la liste, qui défile au-delà, pour une longue liste dans un panneau de paramètres) : case pour afficher / masquer (désactivée si verrouillée), poignée pour réordonner (pointeur ou clavier), « Colonnes par défaut » (vide la disposition), astuce « cliquez sur un en-tête pour trier, Maj + clic pour ajouter un niveau ; glissez un en-tête pour le déplacer, son bord pour le redimensionner. ». Utilisé par `DataViewBar` et `ColumnDefaults` (seul à passer `maxHeight` : règle eslint associée).
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
- `useTableColumnDefaults(tableKey)` — requête `tableColumnDefaults(tableKey)` (clé `['table-column-defaults', tableKey]`) : colonnes des nouvelles vues d’un tableau dans l’espace (`readTableColumnDefaults`). Utilisé par `useTableViews` et `ColumnDefaults`.
- `useSetTableColumnDefaults(tableKey)` — mutation `setTableColumnDefaults(tableKey, layout)` (`null` : celles de l’app) ; mise à jour optimiste du cache. Utilisé par `ColumnDefaults` seulement (règle eslint associée).

### `use-saved-views.ts`

- `SavedView<C>` (interface) — vue avec sa configuration analysée.
- `useSavedViews<C>({ projectId, kind, tableKey?, parse, blank, first, ready?, param? })` — vues d’une portée et copie de travail de la vue courante : `views` (par position), `current`, `config`, `dirty` (comparaison JSON canonique, clés triées), `isPending`, `error`, `select`, `change`, `save`, `revert`, `createView(label, fromCurrent)`, `rename`, `duplicate` (nom de copie `copyName`, borné à `TEXT_MAX`), `remove` (l’échec est laissé à l’appelant), `setDefault`, `move`. Les premières vues sont créées une seule fois par portée, l’une après l’autre, même en cas d’échec (pas de boucle). Paramètre d’adresse par défaut `view`. Sert aussi aux vues des tâches, des routines et de l’agenda (`useCalendarViews`).
- `SavedViewsState<C>` (type) — son retour.
- `defaultView(views)` — vue qu’une portée ouvre quand aucune n’est demandée : celle choisie par défaut, sinon le premier onglet. Règle eslint associée (pas de `find((view) => view.isDefault)` à la main). Utilisé par `useSavedViews` et `useDefaultTableView`.
- `viewParam(tableKey)` — paramètre d’adresse de la vue choisie d’un tableau (`<tableKey>-view`). Utilisé par `useTableViews`.
- `viewPath(path, tableKey, viewId)` — adresse d’une page ouverte sur une vue d’un de ses tableaux. Utilisé par l’accueil.
- Interne : `canonical`.

### `use-data-view.ts`

| Export                                                               | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FirstTableView` (interface)                                         | Première vue : `label`, `config?`.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `withinFilter(field, period)`                                        | Filtre d’une condition « pendant » une période (« thisMonth », « lastYear »…). Règle eslint associée. Utilisé par `accounting`, `time`, `treasury`.                                                                                                                                                                                                                                                                                                                       |
| `conditionFilter(field, operator, value?, id?)`                      | Filtre d’une seule condition (« closed est faux », « state dans OPEN »…). Utilisé par `routines`, `shopping`, `tasks`.                                                                                                                                                                                                                                                                                                                                                    |
| `RowSelection` (interface)                                           | Lignes cochées : `isChecked`, `check(keys, on)`, `setChecked(keys)`, `keys` (lignes affichées).                                                                                                                                                                                                                                                                                                                                                                           |
| `DataView<R>` (interface)                                            | Ce que rend `useDataView` : `tableKey`, `title`, `views`, `config`, `columns`, `shown`, `layout`, `sorting`, `rows` (gardées et triées), `total` (avant recherche et filtre), `archivedToggle`, `groups`, `groupColumn`, `change`, `setLayout`, `setSorting`, `filterOpened` / `setFilterOpened`, `columnExtras(id)`, `keyOf`, `selection` / `setSelection`, `cellProps(columnId, key)`, `bulkLabel(columnId)`, `rowSelection`.                                           |
| `useTableViews({ tableKey, projectId?, first?, ready? })`            | Vues enregistrées d’un tableau, lues avant ses lignes quand celles-ci dépendent de la vue (les événements listés avec les tâches) ; toute nouvelle vue part des colonnes du tableau dans l’espace (`useTableColumnDefaults`, lues avant qu’une vue soit créée). Paramètre d’adresse `<tableKey>-view`. Utilisé par `useDataView` et `tasks`.                                                                                                                                                                                                                     |
| `useDataView(options)`                                               | Le hook des tableaux (voir « Comment ça marche »). Options : `tableKey`, `projectId?`, `columns`, `rows`, `title`, `first?`, `getKey?` (nécessaire pour la modification en masse), `bulkColumns?` (cellules propres hors colonnes, avec leur nom), `archived?(row)` et `archivedLabel?` (« Afficher les archivés » : l'interrupteur, partout, plutôt qu'une colonne ou des vues « Actifs / Archivés »), `alwaysKept?(row)` (ligne gardée quels que soient recherche et filtre : celle qu’on crée), `views?` (vues lues avant, `useTableViews`). |

Internes : `BUDGET_KEY_VALUES` et `LEGACY_FILTER_VALUES` (anciennes valeurs « none » des filtres « Qui » et « Contexte » des tables `treasury-budgets`, `treasury-budget-report`, `treasury-budget-outside`, relues comme `ME_KEY`), `NEVER_ARCHIVED`.

`parseTableViewConfig(config, tableKey)` (exporté) : configuration d’une vue enregistrée (les valeurs par défaut si elle est invalide), ancien identifiant de la colonne libellé et anciennes valeurs des filtres relus. Utilisé par `useTableViews` et `useDefaultTableView`.

### `ColumnDefaults.tsx`

- `ColumnDefaults<R>({ tableKey, columns, label? })` — section « Colonnes des nouvelles vues » (« Colonnes des nouvelles vues : <label> » quand les paramètres en montrent plusieurs) : `DataColumnsPanel` sur les colonnes du tableau, liste limitée à 288 px de haut (12 pas de la grille) qui défile au-delà, enregistrée par `useSetTableColumnDefaults` ; « Colonnes par défaut » (sous la liste, liste vidée) enregistre `null` : les colonnes de l’app. Texte : « Colonnes affichées et leur ordre (glissez-déposez) quand une vue de ce tableau est créée. Les vues existantes gardent les leurs. » Toujours en dernier dans les paramètres d’une page. Utilisé par les paramètres de chaque page à tableaux (inventaire dans [Paramètres](../../features/cross-cutting/settings.md#colonnes-des-nouvelles-vues)). Règles eslint associées : pas d’anciens hooks des tâches (`useTaskColumnDefaults`…), pas de `useSetTableColumnDefaults` ni de `DataColumnsPanel maxHeight` ailleurs.
- Interne : `SETTINGS_COLUMNS_HEIGHT` (288).

### `use-default-view.ts`

La vue par défaut d’un tableau et ses lignes, montrées ailleurs que dans le tableau (l’accueil), en lecture seule.

- `DefaultTableView` (interface) — `view` (la vue ouverte par défaut, configuration analysée ; `null` pendant le chargement ou tant que le tableau n’a aucune vue), `isPending`.
- `useDefaultTableView(tableKey, projectId?)` — lit les vues du tableau (`useTaskViews`) et garde celle de `defaultView` ; ne crée ni ne change aucune vue.
- `useViewRows({ view, columns, rows, archived? })` — lignes de la vue (`viewRows`) : mêmes recherche, filtre, tris et groupes que le tableau, les colonnes affichées sans effet, les archivées écartées. Aucune ligne sans vue.

Utilisés par les cartes « Tâches » et « Routines » de l’accueil.

### `ViewTabs.tsx`

`ViewTabs<C>({ state, about? })` — onglets des vues (`SortableTabs`) : étoile pleine sur la vue par défaut, pastille des modifications non enregistrées, menus et création (voir « Les vues enregistrées »). Le nom d’une vue se saisit dans le panneau latéral (`openLabelForm`, champ « Libellé de la vue », `viewLabelSchema`). `about` (`ViewWords` : `config`, `untouched`) : les mots de la confirmation de suppression (« La vue « X » et sa configuration (<config>) seront supprimées. <untouched> ») ; défaut ceux d’un tableau (« filtres, tris, colonnes », « Les lignes du tableau ne sont pas modifiées. »), ceux de l’agenda (« affichage, filtres », « Les évènements, tâches, routines, temps, créneaux et éphémérides ne sont pas modifiés. »). Utilisé par `DataViewBar` et `CalendarPage`. Publie sa hauteur dans `--onoko-view-tabs-height`. Interne : `promptLabel`.

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
| `bulkCellLabels(view, nameOf)`                                     | Fabrique de libellés accessibles : « Unité de « Farine » », ou « Unité (appliqué aux 3 cellules sélectionnées) », la même forme sur toutes les cellules modifiables. Règle eslint associée.                                                                                                                                |
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
| `duplicateRowsAction(rows, { duplicate, done, open?, loading?, disabled? })` | « Dupliquer », la seule action de ce rôle (sélection et menu d'un élément, `rowMenuEntry(duplicateRowsAction([item], …))`) : `duplicateItems`. |
| `duplicateItems(rows, { duplicate, done, open? })` | Copie chaque élément, enregistré tout de suite (`duplicate`, « … (copie) »), l'un après l'autre (`forEachRow`), toast `done`, puis ouvre la copie d'un élément seul (`open`). |
| `DuplicateOptions<R, C>` (type) | `duplicate(row) → copie`, `done`, `open?(copie)`. |
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
| `CELL_JUSTIFY`                                  | `var(--cell-justify, flex-start)` : `justify` d’une rangée d’éléments dans une cellule (`Group` : un compte et son icône, une pastille et son bouton), alignée comme sa colonne, au début hors tableau. Utilisé par `CommentCount`, `AlarmsCell` (tâches), `ChronoCell` (routines). |
| `cellTextAlign(fallback)`                       | Style `textAlign` d’une valeur ou d’un champ dans une cellule : `var(--cell-text-align, fallback)`, aligné comme sa colonne, `fallback` (`'left'` / `'right'`) hors tableau. Seul endroit où un alignement de texte s’écrit dans une cellule. Utilisé par `EditableNumber`, `EditablePopoverCell`, `StockCountForm` (« Compté »). |
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
| `EditableNumber`      | Nombre ou montant, aligné comme sa colonne (à droite hors tableau ; centré pour une durée), format français : `decimals` (défaut 2), `amount` (`AmountInput`, jusqu’à 4 décimales, suffixe « € »), `suffix`, `signed`, `min` / `max`, `nullable`, `validate`, `schema`, `saveUnchanged` (une cellule de sélection donne sa valeur aux autres). Erreurs « Nombre invalide. », « Une valeur est requise. ».                                            |
| `EditableTime`        | Heure (HH:MM, 24 h), enregistrée au changement, ses heures et minutes alignées comme sa colonne (classe `timeFields`) ; `clearable`.                                                                                                                                                                                                                                                                                                                                |
| `EditableDate`        | Date (YYYY-MM-DD), enregistrée dès qu’elle est choisie ; `nullable`, `minDate`.                                                                                                                                                                                                                                                                                                              |
| `EditableSelect`      | Un choix dans une liste cherchable, enregistré dès qu’il est choisi ; `data`, `nullable`, `renderOption`, `filter`, `leftSection`, `placeholder`, `nothingFoundMessage`, `onCreate` (crée ce qui est tapé, comme `CreatableSelect`).                                                                                                                                                         |
| `EditableMultiSelect` | Plusieurs choix, affichés l’un sous l’autre (`StackedMultiCell`) ; un clic ouvre la liste (`CellMultiSelect`), enregistrée à sa fermeture ; `items` (rendu propre des valeurs).
| `CellMultiSelect`     | La liste d’une cellule à plusieurs choix (`BatchMultiSelect` sans propagation du clic, enregistrée à la fermeture), ouverte par `StackedMultiCell` : celle d’`EditableMultiSelect`, et celle d’une cellule qui charge ses options à l’ouverture (évènements du jour d’un temps, `TimeEventsCell`).                                                                                                                                                                                                             |
| `EditableMarkdown`    | Texte markdown (note, description) : sa valeur coupée sur une ligne ouvre l'éditeur markdown partagé (`MarkdownEditor`) dans un `EditablePopoverCell` ; enregistré à la fermeture s'il est changé (`markdownSchema` : blanc → `null`). Options : `suggestions` (« # » et « @ », aucune par défaut), `readOnly`. Garde-fou eslint : pas d'`EditableText` sur une `note` ou une `description`. |
| `EditablePopoverCell` | Valeur qui ouvre son éditeur dans un popover (un lieu, des alertes, une règle) : valeur en lien, grisée si vide ; `lines` (plusieurs valeurs l’une sous l’autre à la place de `target`, `StackedLines`, « X de plus » hors du lien), `width`, `truncate`, `opened` / `onOpenedChange`, `onClose` ; en lecture seule, texte simple.                                                                                                                                                                              |

Très utilisées par les features (`accounting`, `calendar`, `routines`, `sheets`, `shopping`, `stock`, `tasks`, `time`, `treasury`, `beneficiaries`, `library`) et par [Montants](money.md).

### `EditableLabel.tsx`

`EditableLabel({ value, label, schema, to?, onOpen?, before?, after?, readOnly?, onSave })` — cellule titre : un clic sur le titre ouvre la ligne (sa page `to`, ou `onOpen`) ; un double-clic ailleurs dans la cellule la renomme en place (infobulle « Double-cliquez pour renommer »), enregistrée en quittant le champ ou par Entrée si valide et changée ; Échap abandonne. Utilisé par `routines`, `tasks`.

### `StackedMultiCell.tsx`

- `StackedItem` (interface) — `id`, `label`, `hint?` (nom complet au survol), `icon?`.
- `StackedMultiCell({ label, readOnly?, items, renderSelect })` — cellule à valeurs multiples : valeurs empilées (`StackedValues` avec `wrap` : 5 au plus ; au-delà 4 et « X de plus », hors du bouton) ; un clic remplace l’affichage par le multi-select, ouvert aussitôt, qui doit appeler `onDropdownClose`.

### `StackedValues.tsx` et `stacked.ts`

- `MAX_STACKED` = 5 ; `stackedCount(count, expanded)` — nombre de valeurs affichées (toutes jusqu’à 5, sinon 4).
- `StackedToggle({ hidden, expanded, onToggle, className?, keepFocus? })` — bouton « X de plus » puis « Réduire » (`foldAction`) ; n’ouvre ni la ligne ni la liste d’un champ. Règle eslint associée. Utilisé aussi par `inputs`.
- `StackedValues({ children, gap?, wrap? })` — valeurs d’une cellule l’une sous l’autre, repliées au-delà de 5 ; `wrap` enveloppe les valeurs affichées (le bouton ou le lien qui ouvre l’éditeur de la cellule), « X de plus » restant hors de lui. Utilisé par de nombreuses features.
- `StackedLines({ lines, size?, c?, empty?, wrap? })` — textes d’une cellule, un par ligne (`StackedValues`), coupés s’ils sont trop longs (entiers au survol) ; `empty` sans ligne. Les valeurs d’une colonne (`values`), les cas des horaires d’une tâche (`TaskHoursCell`), d’un créneau (« Horaires ») et d’une routine (`RepetitionText`), les zones d’un lieu (`LocationCell`, `LocationText`), les routines d’un temps en lecture seule, les tâches d’un temps à facturer. Règle eslint associée (pas de `.join(` dans le rendu d’une cellule).

### `ChildrenCell.tsx`

`ChildrenCell({ children, add? })` — cellule des enfants d’une ligne (sous-tâches, sous-routines) : empilés (`StackedValues`), puis le « + » qui en ajoute un (`{ label, item, onClick }`, absent en lecture seule). Utilisé par `routines`, `tasks`.

### `YesNoIcon.tsx`

`YesNoIcon({ value, labels?, icons?, shape?, size?, decorative? })` — icône d’une valeur oui / non : par défaut carré plein vert avec une coche (`CheckSquareIcon`) pour oui, rouge avec une croix (`XSquareIcon`) pour non ; `icons` (`YesNoIcons`) choisit l’icône de chaque valeur, dont le triangle orange (`WarningIcon`, couleur `FEEDBACK_COLORS.warning`), la coche bleue (`info`), le carré gris vide (`empty`, `SquareIcon`) ou une icône propre (`YesNoIconSpec` : l’étoile jaune ou vide d’un favori, couleur `FAVORITE_COLOR` ; le chariot blanc sur fond bleu de « Manque », `badge`) ; `shape` : `square` (défaut, une donnée affichée : cellule, filtre, marque d’une ligne) ou `round` (une chose à cocher : bouton d’état ; `CheckCircleIcon`, `XCircleIcon`, `CircleIcon`, fond rond d’un `badge`), mêmes couleurs, le triangle dans les deux ; `size` (défaut 18 px) ; nommée d’après `labels` (défaut « Oui » / « Non » ; `aria-label`, infobulle `title`), sauf `decorative` (à côté de son mot ou dans un bouton qui la nomme, cachée aux lecteurs d’écran). `YesNoShape` (type, export) : `square` / `round`. Internes : `KINDS` (icône et couleur de chaque type, par forme), `colorOf`, `yesNoSpec` ; `YesNoIcon.module.css` (carré ou rond de couleur d’un `badge`, aussi grand que ceux de la coche et de la croix). Utilisé par `booleanColumn`, `StateButton`, `FilterBuilder`, `EntityMenu` (étoile d’une entrée), `MailListItem` (marque « Traité »).

### `StateButton.tsx`

`StateButton({ value, labels, icons?, toggleLabels?, label?, hint?, readOnly?, loading?, dashed?, size?, onChange })` — bouton d’état : un oui / non des données modifié en place (fait, payé, acheté, manque, traité, favori…) dans une cellule de tableau, une ligne de liste, un en-tête de page ou une barre d’outils d’un élément, jamais un interrupteur ni une case. Une sorte de case ronde : bouton icône (`IconAction`, mêmes états de survol, focus, désactivé et chargement que les autres boutons) qui montre l’état actuel avec l’icône de sa colonne en rond (`YesNoIcon` `shape="round"`, `stateIcons` : non par défaut un rond gris vide ; un favori : étoile) ; nommé d’après l’état actuel (`labels`, puis `label` : la cellule ou la ligne, « À faire, Se brosser les dents »), `aria-pressed` ; infobulle : ce que fait un clic (`toggleLabels`, défaut « Passer à « état » »), ou `hint` (raison d’une désactivation, date), ou le nom de l’état en lecture seule ; un clic bascule (`onChange(!value)`), sans ouvrir la ligne. `labels`, `icons`, `toggleLabels` viennent d’un `YesNoStates` déclaré à côté de la colonne (`{...ROUTINE_DONE_STATES}`). `dashed` : contour en pointillés (un moment facultatif d’une routine ; `StateButton.module.css`) ; `size` `xs` (icône 14 px), `sm` (défaut, 18 px), `md` (bouton de 28 px, icône 20 px : comme les icônes des boutons voisins d’une barre d’outils, `1.25em`), `input-sm` (bouton de 36 px, icône 26 px : aussi haut que le menu « … » d’un en-tête de page, celui d’un client ou d’un projet) ou `xl` (36 px, au pouce : le mode collecte). Les sauvegardes (optimistes, en masse sur une sélection de cellules, toasts) restent celles de l’appelant. Utilisé par `RoutineDoneToggles`, `ChecklistPanel`, `SheetPage`, `ShoppingTable` (bouton en tête et « Facultatif »), `BaseList`, `StockTable`, `EntryLinesTable`, `EntityHeader` (favori), `MailOrganizeActions` (« Traité »), `StoreMode` (« Acheté »). Règle eslint : `aria-pressed` interdit ailleurs ; pas de `Switch`, `StateSwitch` ni `Checkbox` dans les fichiers de colonnes, de cellules et de tableaux.

### `ChipChoiceCell.tsx`

- `ChipChoice` (interface) — élément d’une liste de paramètres proposé : `id`, `label`, `color?`, `iconUrl?`, `archived?`.
- `ChipChoiceCell({ value, items, label, readOnly?, onChoose })` — cellule d’un élément d’une liste de paramètres (statut, priorité, type d’une tâche ou d’une routine) : sa pastille (`ItemBadge`, « — » sans valeur) ; un clic ouvre la liste des pastilles (« Aucune valeur définie dans les paramètres » si vide) ; re-choisir la valeur actuelle la vide (`onChoose(null)`) ; les éléments archivés ne sont plus proposés, sauf la valeur actuelle ; en lecture seule, la pastille seule. Utilisé par `LabelCell` (tâches), `RoutineLabelChipCell` (routines) l’état des factures récurrentes (`AccountingPage`, sur `RECURRING_STATES`) et la nature d’un article du catalogue (`CatalogPanel`, sur `CATALOG_KINDS`). Règle eslint associée (la classe `chipTrigger` ailleurs est interdite).

### `DependencyIcon.tsx`

`DependencyIcon({ done })` — coche verte (dépendance faite) ou sablier orange (attendue). Utilisé par `routines`, `tasks`.

### `AddRowField.tsx` et `AddRowField.module.css`

- `AddRowField({ label, where?, hint?, schema, onCreate, onCancel?, autoFocus? })` — champ de la ligne d’ajout (fin de tableau ou de groupe) : un libellé puis Entrée ajoute une ligne ; placeholder « {label} ({hint} ; Entrée pour valider) » ; le champ se vide aussitôt pour enchaîner ; un libellé refusé par l’API revient dans le champ (sauf si un autre est en cours de saisie) ; libellé invalide notifié (« Libellé invalide. » par défaut) ; Échap vide (et `onCancel`). Utilisé par `routines`, `sheets`, `shopping`, `tasks`.
- `AddRowButton({ label, ...props })` — bouton « + … » d’une ligne d’ajout qui ouvre autre chose (un formulaire, un menu). Utilisé par `shopping`, `tasks`.

### `RowActions.tsx`

- `ROW_ACTIONS_WIDTH` = 72 — largeur de la cellule d’actions.
- `RowActions({ name, about, primary?, items })` — actions de fin de ligne, les mêmes partout : l’action principale en icône, les autres dans le menu « ⋯ » (destructives en dernier, en rouge, après un séparateur). Une action marquée `inMenu` (« Archiver ») n’est jamais un bouton : elle passe dans le menu. Voir [Actions](actions.md).

### `EditableCells.module.css`

Classes : `.root`, `.input` (texte aligné par `--cell-text-align`), `.chipTrigger` (pastille placée par `--cell-justify`), `.section`, `.timeFields` (heures et minutes d’`EditableTime`), `.placeholder`, `.titleArea` (zone double-cliquable du titre), `.titleLink`.

## Voir aussi

- [Filtres](filters.md), [Onglets](tabs.md), [Glisser-déposer](dnd.md), [Arbres](tree.md), [Actions](actions.md), [Dialogues](dialogs.md), [Retour visuel](feedback.md).
- [lib](../lib.md) : `archive`, `download`, `format`, `periods`, `search-params`, `fill-height`, `notify`.
- [Ordre](../../business-rules/cross-cutting/ordering.md), [Archivage](../../business-rules/cross-cutting/archiving.md), [Dates](../../business-rules/cross-cutting/dates.md).
