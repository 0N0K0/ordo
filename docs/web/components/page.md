# Structure des pages : en-têtes, sections, tuiles

En-têtes de page et de détail, titres de section, légendes, lien de retour, navigation entre périodes, tuiles de chiffres clés. Source : `apps/web/src/components/page/`.

## En-têtes

### `PageHeader`

En-tête de toute page : son titre (`PageTitle`), une description facultative en dessous, puis ses actions à droite (`ActionButton`, les principales en dernier). Props : `title`, `description`, `actions`. ~19 fichiers.

### `PageTitle`

Titre d'une page (`h1`, taille `h2`) affiché sur téléphone seulement : à partir de la tablette (48em), l'en-tête de l'application l'affiche après l'espace de travail (`HeaderTitle`, voir [App](../app.md)). Styles : `PageTitle.module.css`.

### `DetailHeader`

En-tête de la page (ou du panneau) d'un élément, le même partout (retour, libellé en h3, badges, actions ; « Archiver » et « Supprimer » dans le menu « … ») : document de facturation, document importé, fiche, liste de courses, panneau de tâche, projet, client. Props :

- `back` : `{ to, label }`, lien de retour au-dessus (`BackLink`) ;
- `page` : un `PageHeader` entre le retour et le nom ;
- `avatar` : image de l'élément avant le nom ;
- `title` : nom (taille `h3`) ; `order` : niveau du titre, 1 sur une page sans `PageHeader`, 2 sinon (défaut 2) ;
- `badges` (état, archivé…), `subtitle` (lignes sous le nom) ;
- `actions` : boutons à droite, avant le menu ;
- `menu` : menu « … » (`ActionsSubject` + `items`) ; « Archiver » y va toujours ; bouton `light` de la taille d'un champ (`input-sm`, ou `input-xs` avec `compact`, pour un en-tête de boutons `xs` dans un panneau).

### `SectionHeader`

En-tête d'une section de page ou de panneau latéral : titre (`h2` taille `h4`) et description à gauche, actions toujours à droite (« Nouveau… » d'abord). Sans titre : la description seule introduit la section (panneau d'un onglet). Props : `title`, `description`, `actions`.

### `SubSection`

Petite section d'un panneau ou d'une page (propriété d'une tâche, détail d'un projet, alarmes d'une tâche) : titre en `Caption`, action facultative à droite (« Nouvelle alarme »), puis le contenu. Props : `title`, `action`, `gap` (4), `children`.

### `Caption`

Légende en petites capitales atténuées, graisse 600, la même partout (titre de section, groupe de liste, chiffre clé). Props de `Text`. Imposée par eslint (`Text tt="uppercase"` interdit ailleurs).

## Navigation

### `BackLink`

Retour d'une page de détail, au-dessus du titre comme un fil d'Ariane : « ← Facturation », petit lien texte vers sa liste, le seul retour de ces pages (pas de bouton retour en double). Props : `to`, `children`. Utilisé par `DetailHeader` et `DetailNotFound`.

### `PeriodNav`

Navigation entre périodes (agenda, graphique de la trésorerie, historique des routines), la même partout : « Aujourd'hui » (`secondary`, désactivé si la période du jour est affichée), puis flèche précédente, la période affichée (nom ou sélecteur), flèche suivante (désactivée avec `last`). Props : `children`, `onPrevious`, `onNext`, `onToday`, `current`, `last`, `labels` (défaut « Période précédente » / « Période suivante »).

## Chiffres clés

### `StatTile`

Chiffre clé (accueil, trésorerie) : légende (`Caption`), valeur en gras (couleur `valueColor`, rouge sous zéro par exemple), détail en dessous (`hint`, couleur `hintColor`, défaut atténué) ; lien vers sa page avec `to` (survol : `StatTile.module.css`). `loading` : squelette de titre. Hauteur stable (ligne de détail réservée même vide).
