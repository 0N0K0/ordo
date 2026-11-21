# Glisser-déposer (composants web)

Briques communes du glisser-déposer de l’app, toutes bâties sur `@dnd-kit` : capteurs, poignée, étiquette qui suit le pointeur, zone triable et style d’un élément trié. Source : `apps/web/src/components/dnd/`.

## Principes

- Un seul glisser-déposer dans l’app : `@dnd-kit` (`useDraggable`, `useDroppable`, `SortableArea`). Le glisser-déposer natif HTML est interdit par une règle eslint (le mail compris).
- Le glisser ne démarre qu’après 5 px de déplacement du pointeur : un clic reste un clic (sur un onglet, une poignée…).
- Un élément glissé est translaté (jamais agrandi), passe au-dessus des autres et s’atténue (`--onoko-dragging-opacity`, 0,5).
- Le clavier déplace aussi les éléments triés (espace, flèches, espace) sur leur poignée.
- Le clic qui suit le lâcher est avalé (`suppressClickAfterDrop`) : il ouvrirait, trierait ou sélectionnerait ce qui est sous le pointeur.

Utilisé par : [Tableau de données](data-table.md) (lignes et colonnes), [Arbres](tree.md), [Onglets](tabs.md) (`SortableTabs`), [Récurrence](recurrence.md), et les features `home`, `dashboards`, `projects`, `tasks`, `mail`.

## `drag.ts`

| Export                      | Rôle                                                                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `suppressClickAfterDrop()`  | Avale (en capture, une fois) le `click` déclenché par le relâchement du pointeur à la fin d’un glisser ; l’écouteur est retiré au bout de 100 ms s’il n’a pas servi. Utilisé par `DataTable`, `features/mail`, `features/projects`.   |
| `useDragSensors(keyboard?)` | Capteurs d’un `DndContext`, les mêmes partout : pointeur après 5 px (`DRAG_DISTANCE`, interne) ; clavier selon `keyboard` : `'sortable'` (coordonnées `sortableKeyboardCoordinates`), `'plain'`, ou `false` (défaut : pointeur seul). |
| `innermostCollision`        | Détection de collision pour des cibles imbriquées (un dossier dans son compte, une ligne dans son groupe) : les cibles sous le pointeur, la plus petite (en surface) d’abord. Utilisé par `features/mail`.                            |

## `DragHandle.tsx`

`DragHandle` — poignée de déplacement d’un élément trié (carte, case, ligne), la même partout, en `ActionIcon` subtil gris avec l’icône `DotsSixVerticalIcon`.

- Props : `item?` (nom de l’élément : `aria-label` « Déplacer « X » »), `hint?` (infobulle, défaut « Déplacer » ; ex. « Déplacer (horizontalement : son niveau) » dans le tableau), `activator`, `attributes`, `listeners` (de `useSortable` / `useDraggable`), `dragging`, `size?`, `className?`, `reveal?` (visible seulement au survol ou au focus de son hôte, via `data-reveal`).
- Curseur `grab` / `grabbing`, `touch-action: none`. L’infobulle est coupée pendant le glisser (l'infobulle dit l'action, comme `IconAction`).
- Utilisé par `DataTable`, `ColumnsPanel`, `CategoryTree`, `recurrence`, `home`, `dashboards`, `projects`, `tasks`.

## `DragLabel.tsx`

`DragLabel({ label })` — ce qui suit le pointeur pendant un glisser (dans un `DragOverlay`) : petite carte (`Paper` ombrée) avec l’icône de poignée et le libellé (« Courses », « 3 mails »). Une règle eslint impose ce composant. Utilisé par `CategoryTree` et `features/mail`.

## `sortable.tsx`

`SortableArea` — zone d’éléments réordonnés par glisser-déposer : un `DndContext` (collision `closestCenter`) et un `SortableContext`.

- Props : `ids` (dans l’ordre), `layout` (`'grid'` → `rectSortingStrategy`, `'list'` → vertical, `'row'` → horizontal, onglets), `pointerOnly?` (défaut `false` : sans capteur clavier, pour des éléments qui gardent leur propre navigation clavier, comme les onglets), `onMove(id, from, to)` appelé quand un élément est lâché sur un autre (rien si lâché sur lui-même ou hors zone).
- Les éléments utilisent `useSortable` / `useSortableItem` avec leur id.
- Utilisé par `ColumnsPanel` (colonnes), `SortableTabs`, `recurrence`, `home`, `dashboards`, `tasks`.

## `sortable-style.ts`

`sortableStyle({ transform, transition, isDragging })` — style d’un élément trié : `CSS.Translate` (jamais `scale`), `position: relative`, `zIndex: 1` et opacité `--onoko-dragging-opacity` pendant le glisser. Utilisé par `useSortableItem`, `SortableTabs`, `features/projects`.

## `use-sortable-item.ts`

- `SortableHandle` (interface) — ce que prend une `DragHandle` : `activator`, `attributes`, `listeners`, `dragging`.
- `useSortableItem(id, disabled?)` — élément d’une `SortableArea` déplacé par sa `DragHandle` : renvoie `ref` (à poser sur le nœud), `style` (`sortableStyle`), `dragging` et `handle` (props à étaler sur la `DragHandle`). `disabled` : non déplaçable (lecture seule). Utilisé par `ColumnsPanel`, `recurrence`, `home`, `dashboards`, `tasks`.
