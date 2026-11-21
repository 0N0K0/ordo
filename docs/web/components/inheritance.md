# Héritage : champs hérités d’un parent

Briques qui montrent et changent ce qu’une sous-tâche ou une sous-routine prend de son parent, en direct, les mêmes dans les tableaux, les panneaux et les formulaires. Source : `apps/web/src/components/inheritance/`. Règles : [Tâches](../../business-rules/activities/tasks.md#héritage), [Routines](../../business-rules/activities/routines.md#héritage).

## `inheritance.ts`

- `FieldOriginValue`, `InheritingRow` : origine d’un champ telle que l’API la donne (`inheritance { field state source sourceId }`), élément qui peut hériter (`parentId`, `inheritedFields`, `inheritance`).
- `INHERITANCE_WORDS` : textes communs : « Vider », « Rétablir l’héritage », « Vidé exprès », « Hérité de … » (« En partie hérité de … : répétition, moments » pour un groupe de champs).
- `originOf(item, field)` : origine d’un champ ; `null` sans parent (rien n’est montré). Garde eslint (web) : pas de `….inheritance.find(…)` à la main.
- `ownedFields(item, fields)` : élément du cache une fois que des champs ont reçu une valeur (affichage immédiat, avant la réponse de l’API) : retirés de sa liste, propres.
- `inheritedRow(item, columns)` : ligne d’un écran, chaque champ hérité avec sa valeur suivie (`effective` de l’API, par `inheritedView` du partagé). Utilisée par `taskRow` et `routineRow` au chargement des données : cellules, panneaux, filtres, tris, groupes et exports lisent la valeur suivie. Garde eslint (web) : pas de `….effective.…` lu à la main (ni déstructuré).

## `InheritedField.tsx`

- `InheritedFieldState` : `origin` (`null` sans parent), `onClear?` (« Vider »), `onInherit?` (« Rétablir l’héritage »), `parts?` (champs hérités d’un groupe quand ils ne le sont pas tous).
- `InheritedField({ origin, from, onClear?, onInherit?, parts?, compact?, readOnly?, children })` : un champ qui peut venir du parent. Hérité : valeur grisée (texte atténué en italique, pastilles et avatars estompés : `InheritedField.module.css`), « Hérité de « #12 … » » dessous avec « Vider » ; vidé exprès : « Vidé exprès » avec « Rétablir l’héritage » ; propre : « Rétablir l’héritage ». `compact` (cellule d’un tableau) : grisé, la mention en infobulle, sans action. Taper ou choisir une valeur la rend propre (le champ l’enregistre comme d’habitude).

## `inherited-cells.tsx`

- `inheritedCells(cells, item, fields, from)` : cellules d’une ligne, chaque colonne d’un champ hérité enveloppée dans `InheritedField` compact. Utilisée par `TaskBoard` et `RoutinesPage`.

## `form-inheritance.ts`

- `formInheritance({ values, columns, parent, list, apply, required? })` : héritage des champs d’un formulaire de sous-élément (nouvelle sous-tâche, nouvelle sous-routine, panneau d’une routine enregistré en entier). Un champ est hérité tant qu’il est dans la liste et a les valeurs du parent ; une autre valeur le rend propre. Donne `field(field)` (état et actions pour `InheritedField`), `group(fields, labels)` (le « Quand » d’une routine), `inheritedFields(values)` (liste envoyée à l’API, avec les champs de la liste que le formulaire ne montre pas, gardés tels quels : les exceptions d’une routine) et `adopt(parent, fields?)` (nouveau parent choisi : ses valeurs reprises ; un champ donné que le formulaire ne montre pas hérite aussi).

## `InheritanceForm.tsx`, `inheritance-action.tsx`

- `InheritanceForm({ fields, about, onApply, onDone })` : formulaire « Héritage » du panneau latéral : pour chaque champ, « Inchangé », « Rétablir l’héritage » ou « Vider » (sauf `required`) ; « Appliquer » (`useAsyncAction`).
- `InheritableFieldOption` : champ offert (`field`, `label`, `required?`).
- `inheritanceRowsAction({ fields, about, withParent, onApply, onDone? })` : action « Héritage… » des lignes cochées et du menu « … » d’une ligne (désactivée sans sous-élément). Utilisée par `useTaskRowsActions` et `useRoutineRowsActions`.
