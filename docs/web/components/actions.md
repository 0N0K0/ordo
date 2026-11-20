# Actions : boutons, menus, pliage

Briques communes des actions de l'interface : le bouton d'action à priorités, le bouton icône, le menu « … », les boutons de retrait et d'ajout de ligne, le pliage. Source : `apps/web/src/components/actions/`.

Ces briques sont imposées par les règles eslint (voir [Conventions](../app.md#conventions)) : `Button` avec `variant`, `ActionIcon`, `Menu`, les icônes « trois points » et les chevrons écrits à la main sont interdits hors de ce dossier.

## Vue d'ensemble

| Rôle                                                     | Brique          |
| -------------------------------------------------------- | --------------- |
| Bouton avec icône et libellé (page, section, formulaire) | `ActionButton`  |
| Bouton icône seul, avec infobulle                        | `IconAction`    |
| Menu « … » ou menu attaché à une cible                   | `ActionsMenu`   |
| Actions côte à côte en icônes (carte, élément de liste)  | `InlineActions` |
| Retirer / supprimer une ligne ou un élément d'un champ   | `RemoveButton`  |
| Ajouter une ligne à une liste de formulaire              | `AddItemButton` |
| Plier une ligne (bouton icône)                           | `FoldButton`    |
| Plier une section (toute la ligne cliquable)             | `FoldHeading`   |
| Rangée d'actions sans titre, à droite                    | `ActionsRow`    |
| « Dupliquer » dans un formulaire ou une barre d'outils    | `DuplicateButton` |
| Crayon d'une section modifiée en place dans un panneau   | `EditToggle`    |

## `DuplicateButton.tsx`

`DuplicateButton({ item, duplicate, done, open?, hint?, iconOnly?, size? })` : bouton « Dupliquer » (décision D20) : la copie est enregistrée tout de suite (`duplicateItems` de `selection-actions`), annoncée par un toast, puis ouverte ; le bouton attend pendant ce temps (`useAsyncAction`). `iconOnly` : icône seule (`IconAction`) avec son infobulle. Les menus et les sélections prennent `duplicateRowsAction`. eslint interdit « Dupliquer » écrit ailleurs, « Cloner » et les formulaires de copie (attributs `copy` / `copyOf`). Utilisé par `EventForm` et `DocumentEditor`.

## `EditToggle.tsx`

`EditToggle({ editing, onChange, what })` : crayon d'une section modifiée en place dans un panneau de détail enregistré champ par champ (décision D22) : « Modifier {what} » ouvre son éditeur ; pendant la modification, une coche « Terminer la modification de {what} » revient à l'affichage (ce qui a été tapé est déjà enregistré, en quittant l'éditeur). Utilisé par `TaskDescription` (« la description ») et `TaskLinks` (« les liens »).

## `ActionButton.tsx`

### `ActionButton`

Bouton d'action d'une page, d'une vue ou d'une section, le même partout (décision CN). Utilisé dans presque toutes les features (~100 fichiers).

- `priority` : `'primary'` (défaut, plein) pour ajouter un élément, valider une action ou soumettre un formulaire ; `'secondary'` (clair, `light`) pour toute autre action (« Annuler », « Exporter », « Filtrer », un menu, une page) ; `'tertiary'` (discret `subtle`, taille forcée `xs`) pour les petites actions d'une section ou d'un formulaire (« Ajouter une ligne », « Valeurs par défaut », « Retirer »).
- `danger` : action destructive. Rouge plein quelle que soit la priorité ; en `tertiary`, texte rouge discret.
- `icon` : obligatoire, icône avant le libellé (décision 11 : icône et libellé partout).
- `to` (lien interne, `react-router`), `href` (fichier ou page externe), `download` (télécharge `href`, sous ce nom si chaîne).
- `menu` : autres façons de la même action (`RowMenuEntry[]`). Sans `onClick` / `to` / `href`, le bouton ouvre lui-même le menu (avec un `MenuCaret`) ; sinon le menu est attaché par un second bouton caret (`Button.Group`, libellé caché « Autres façons « X » »).
- `menuName` : nom de l'action dans les libellés cachés du menu quand le libellé n'est pas du texte.
- `hint` : infobulle, affichée aussi quand le bouton est désactivé (via `ActionTooltip`).
- `after` : contenu après le libellé (compte d'un filtre, date d'un choix). Quand le bouton est la cible d'un menu ou d'une popover (`aria-haspopup` posé par la cible), un `MenuCaret` est ajouté après (décision DI).
- Les autres props de Mantine `Button` (sauf `variant`, `color`, `leftSection`, `rightSection`) et du `<button>` passent.

Composant interne : `ActionButtonBody` (le bouton sans son infobulle).

## `IconAction.tsx`

### `IconAction`

Bouton fait d'une icône seule, le même partout (décisions 11, W) : l'action en infobulle, l'action et l'élément en libellé caché (« Modifier « Urgent » »). ~40 fichiers.

- `label` : l'action (infobulle). `item` : l'élément concerné (libellé caché « label « item » »). `aria-label` : libellé caché quand l'élément n'est pas un nom (« Fermer le mail »).
- `hint` : infobulle à la place du libellé (raison d'une désactivation, raccourci).
- `indicator` : nombre en pastille sur le coin (`Indicator`), rien à 0.
- `expanded` : bouton qui ouvre quelque chose (panneau, recherche) ; ouvert = `light` et `aria-expanded`, fermé = `subtle`.
- `variant` : par défaut `subtle` gris ; `light` (couleur primaire) à côté de boutons (décision CN).
- `type` : `'button'` par défaut, `'submit'` dans un formulaire.
- Accepte les props de lien (`component`, `to`, `href`, `download`, `target`, `rel`).

## `ActionTooltip.tsx`

### `ActionTooltip`

Infobulle d'un bouton qui s'affiche aussi quand il est désactivé : le bouton est enveloppé dans un `span` (`cursor: not-allowed` s'il est désactivé). Props : `label`, `disabled`, `wrapped` (toujours envelopper : un `Switch` dont la racine ne prend pas de ref). Utilisé par `ActionButton`, `IconAction`, `StateSwitch`.

## `ActionsMenu.tsx`

### Types

- `RowAction` : action d'un menu ou d'une ligne. Champs : `label`, `icon` (facultatif pour une entrée cochée), `checked` (choix d'un menu d'options : coche, sinon alignement ; avec icône, la coche va après le libellé), `description` (seconde ligne atténuée), `indent` (profondeur dans un arbre), `onClick`, `to`, `href`, `download`, `disabled`, `hint` (attribut `title`), `danger` (rouge, en dernier après un séparateur), `inMenu` (toujours dans le menu « … », jamais en bouton : « Archiver » / « Restaurer », décision R).
- `RowMenuEntry` : `RowAction`, titre de section `{ section: string }`, `'divider'`, ou une valeur fausse (`null`, `false`, `undefined`, `''`) pour une entrée non proposée.

### `ActionsMenu`

Menu des actions de quelque chose (ligne, en-tête de page), le même partout. ~45 fichiers.

- Mise en forme des entrées (`menuEntries`, interne) : les entrées fausses retirées ; les actions destructives regroupées à la fin après un séparateur ; pas de séparateur en bout ni deux de suite ; pas de titre de section sans action sous lui. Sans entrée, rien n'est rendu.
- Sujet (`ActionsSubject`) : `name` (cité : « Actions de « X » ») ou `about` (décrit : « Actions de la barre latérale »), décision BF.
- `target` : bouton ouvrant le menu ; par défaut un `ActionIcon` à trois points verticaux (décision T).
- `variant` du bouton par défaut : `subtle` (ligne, liste) ou `light` (à côté de boutons, décision CN).
- `inRow` : dans une ligne cliquable ou glissable, les clics et appuis restent dans le menu. `nested` : à l'intérieur d'un autre bouton (un onglet), le bouton est rendu en `span`.
- `size`, `loading` (le bouton tourne), `position` (défaut `bottom-end`), `opened` / `onChange` (contrôlé), `hover` (ouverture au survol, menus de la barre du haut), `keepOpen` (reste ouvert après un choix), `width`, `maxHeight` (défile au-delà).

### `InlineActions`

Actions côte à côte en icônes (`IconAction`, rouges si destructives) pour une carte ou un élément de liste ; les actions `inMenu` vont dans un `ActionsMenu` « … » après elles. Séparateurs et titres ignorés. Utilisé dans la facturation, la trésorerie, les espaces, les réglages, les mails, les tâches.

Fonction interne : `isAction(entry)`.

## `actions-subject.ts`

- `ActionsSubject` (interface) : `{ name?: string | null; about?: string }`.
- `subjectText(subject)` : texte du sujet dans un libellé caché : `« name »` cité, sinon `about`.
- `actionIconProps(action, subject)` : props d'`IconAction` pour une `RowAction` (libellé, `item` ou `aria-label`, `hint`, rouge si `danger`, désactivation, clic, lien). Utilisé par `InlineActions` et les actions de ligne de `data-table`.

## `link-props.ts`

- `EXTERNAL_LINK` : `{ target: '_blank', rel: 'noopener noreferrer' }`, les props de tout lien vers une page externe ou un fichier dans un nouvel onglet. Imposé par eslint (`rel`, `target="_blank"` interdits ailleurs).
- `linkProps(action)` : props d'un élément qui ouvre une action : `Link` + `to`, ou `a` + `href` (avec `download`, sinon `EXTERNAL_LINK`).

## `MenuCaret.tsx`

### `MenuCaret`

Flèche vers le bas d'un bouton qui ouvre un menu ou un panneau (décision DI). Prop `size` (défaut 12, 10 dans un badge). La cible du menu pose `aria-haspopup` et `aria-expanded`.

## `RemoveButton.tsx`

### `RemoveButton`

Bouton de retrait (décision 5) : corbeille rouge pour une ligne de formulaire ou de liste ; croix grise (`variant="field"`) pour un élément à l'intérieur d'un champ (puce, pièce jointe, lien dans un badge). Props : `label` (« Retirer », « Supprimer »), `item`, `aria-label`, `disabled`, `onClick`, et les props d'`ActionIcon` sauf `variant` / `color`. ~25 fichiers.

## `AddItemButton.tsx`

### `AddItemButton`

Bouton d'ajout d'un élément à une liste de formulaire (numéro, ligne, cas, pause…), décision 16 : `ActionButton` `tertiary`, icône « + » (ou `icon`), libellé précis (« Ajouter une ligne »), aligné à gauche sous la liste. Props : `children`, `onClick`, `icon`, `disabled`.

## `ActionsRow.tsx`

### `ActionsRow`

Rangée d'actions sans titre (sous une liste, au-dessus d'une liste vide), toujours alignée à droite. Utilisé par les tableaux de bord, les achats, les projets.

## Pliage

### `fold-label.ts`

- `foldAction(expanded)` : « Réduire » si déplié, « Développer » sinon (décision AE). Seul endroit où ces mots sont écrits (eslint interdit « Déplier » / « Replier » et les libellés écrits à la main).
- `foldLabel(expanded, about)` : libellé caché quand l'élément n'est pas un nom : « Réduire les lots de « X » ».

### `FoldChevron.tsx`

`FoldChevron` : chevron droit qui tourne vers le bas une fois déplié (`data-expanded`, transition `--onoko-transition`, `FoldChevron.module.css`). Seul chevron de pliage (eslint interdit les rotations et alternances de `Caret*Icon` écrites à la main).

### `FoldButton.tsx`

`FoldButton` : bouton icône de pliage d'une ligne, d'un groupe ou d'une branche (`IconAction` + `FoldChevron`), infobulle « Développer » / « Réduire », `aria-expanded`. Props : `expanded`, `onToggle`, `item`, `about`, `inRow` (clics et appuis gardés du parent), `size` (défaut `sm`). Utilisé par l'arbre des projets, les mails, `tree`, `data-table`, l'agenda.

### `FoldHeading.tsx`

`FoldHeading` : en-tête d'une section, d'un groupe ou d'une liste qui se plie, toute la ligne cliquable (décision CH) : chevron, `icon`, titre, compte (`CountBadge` gris `xs`, décision CI), `aside` à droite. Props : `expanded`, `onToggle`, `children`, `count`, `icon`, `aside`, `inline` (petit bouton dans une cellule, « détails (3) »), `about`, `radius` (défaut `sm`) ; les autres props vont au bouton. Le clic ne remonte pas. Styles : `FoldHeading.module.css`. Imposé par eslint pour tout bouton `aria-expanded` sans `aria-haspopup` et tout en-tête au-dessus d'un `Collapse`.

## `move-entries.tsx`

`moveEntries(index, count, move)` : entrées « Monter » / « Descendre » d'un élément d'une liste ordonnée, désactivées aux extrémités. Utilisé dans la facturation, les espaces et les tableaux de bord.
