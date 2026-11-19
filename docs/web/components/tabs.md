# Onglets (composants web)

Onglets de page, onglets des réglages, barre d’onglets triables (vues des tableaux, tableaux de bord, listes de courses) et hooks qui gardent l’onglet choisi dans l’adresse. Source : `apps/web/src/components/tabs/`.

## Principes

- L’onglet affiché est gardé dans l’adresse (`?tab=`, `?section=`, ou un paramètre propre) : un lien ou un rechargement rouvre le même onglet.
- L’onglet par défaut (le premier, sauf indication) n’apparaît pas dans l’adresse : le choisir retire le paramètre.
- Un onglet inconnu dans l’adresse affiche l’onglet par défaut, jamais une page vide. Une règle eslint impose `usePageTab(tabs, fallback)` pour les onglets de page.
- Les anciens onglets déplacés ailleurs (`MovedTab`) sont redirigés : le paramètre est retiré et d’autres paramètres posés à la place.

## `use-url-tab.ts`

- `UrlTabChange` (type) — changement d’onglet : `(tab | null, changes?, { only? })` ; `null` revient à l’onglet par défaut, `changes` modifie d’autres paramètres en même temps (`null` en retire un), `only` supprime tous les autres paramètres.
- `MovedTab` (interface) — ancien onglet déplacé : `changes` (paramètres posés à sa place), `only?`.
- `useUrlTab(param, tabs, fallback?, moved?)` — le hook de base : renvoie `[onglet affiché, changement, onglet demandé brut]`. La redirection d’un ancien onglet se fait dans un `useEffect`. S’appuie sur `useSetParams` (`lib/search-params`, voir [lib](../lib.md)). Utilisé par les trois hooks ci-dessous.
- `knownTab` (interne) — l’onglet demandé s’il est connu, sinon le défaut.

## `use-page-tab.ts`

`usePageTab(tabs, fallback?, moved?)` — onglet d’une page (`PageTabs`), dans `?tab=`. Même retour que `useUrlTab`. Utilisé par `accounting`, `projects`, `routines`, `shopping`, `stock`, `treasury`.

## `use-settings-tab.ts`

- `SETTINGS_TAB_PARAM` = `'section'` — paramètre de l’onglet des réglages d’une page. Lu aussi par `app` (lien vers une section des réglages), `accounting`, `projects`.
- `useSettingsTab(tabs, fallback?)` — onglet des réglages (`SettingsTabs`) : `[onglet, setTab]`. Utilisé par `accounting`, `calendar`, `projects`.

## `use-tab-param.ts`

`useTabParam(param, items)` — onglet choisi parmi des éléments `{ id }` (`?param=id`) : `[élément choisi | undefined, select(id | null)]` ; le premier élément quand rien (ou un id inconnu) n’est demandé. Utilisé par `dashboards` et `shopping` (onglets de tableaux de bord, de listes).

## `PageTabs.tsx` et `PageTabs.module.css`

`PageTabs` — onglets des sections d’une page, distincts des onglets de vues d’un tableau. Mêmes props que `Tabs` de Mantine sauf `classNames`, `variant`, `unstyled`, `orientation` (le look est imposé). Sous-composants : `PageTabs.List`, `PageTabs.Tab`, `PageTabs.Panel` (ceux de Mantine).

Rendu (CSS) :

- sur toute la largeur de la page, au-delà de ses marges (`margin-inline: calc(-1 * var(--page-gutter))`) ;
- onglets répartis également, titres centrés, bordés ; l’onglet actif a le fond de la page et s’ouvre sur son contenu comme un onglet de classeur, les autres ont un fond teinté ;
- hauteur : 2 pas du rythme vertical (`--page-tab-height`) ;
- défilement horizontal quand la fenêtre est trop étroite ;
- collants en haut de la fenêtre (`position: sticky`) seulement en densité large (largeur ≥ tablette et hauteur ≥ `md`).

Utilisé par `accounting`, `projects`, `routines`, `shopping`, `stock`, `treasury`.

## `SettingsTabs.tsx`

- `SettingsTabs` — onglets des réglages d’une page, dans le panneau latéral des réglages (`PageSettings`, `app/layout/PageSettings.tsx`, voir [App](../app.md)) : une section à la fois. Props : `value`, `onChange`, `tabs` (`{ value, label, icon? }[]`), `keepMounted?` (défaut `true`), `children` (les panneaux).
- `SettingsTabPanel({ value, children })` — panneau d’un onglet (`minWidth: 0`).

Utilisé par `accounting`, `calendar`, `projects`.

## `SortableTabs.tsx`

`SortableTabs` — barre d’onglets réordonnés par glisser-déposer, l’onglet sélectionné portant son menu, suivie du bouton d’ajout.

- Props : `items` (`{ id }`), `value`, `onChange(id)`, `onMove(id, index)`, `label(item)`, `leftSection?(item)` (avatar, étoile du défaut…), `name(item)` (pour « Actions de … »), `actions(item)` (premières entrées du menu), `onDelete?(item)`, `deleteDisabled?(item)`, `add` (`{ label, onClick }` ou `{ label, menu }` : un clic ou un menu des façons d’ajouter), `ref?` (la barre, dont la hauteur est publiée).
- Menu de l’onglet sélectionné (`ActionsMenu` imbriqué) : les `actions`, puis « Déplacer à gauche » / « Déplacer à droite » (désactivés aux bouts), puis « Supprimer » (danger, désactivable).
- Glisser au pointeur seulement (`SortableArea` `layout="row"` `pointerOnly`) : les onglets gardent leur navigation clavier, et leur menu les déplace au clavier. Le glisser est horizontal uniquement (`y: 0`).
- `SortableTab` (interne) — un `Tabs.Tab` avec `useSortable` ; un clic le sélectionne toujours (le glisser démarre après quelques pixels).

Utilisé par `ViewTabs` ([Tableau de données](data-table.md)), `dashboards`, `shopping`.

Voir aussi : [Glisser-déposer](dnd.md), [Actions](actions.md).
