# Filtres (composants web)

Éditeur de filtres en arbre (conditions et groupes ET / OU), libellés et choix des opérateurs, et l’interrupteur « Afficher les archivés ». Source : `apps/web/src/components/filters/`. Le modèle des filtres (opérateurs, types de champs, schémas, profondeur maximale, périodes) est dans `@ordo/shared` (voir [shared/tables](../../shared/cross-cutting/tables.md)).

## Principes

- Un filtre est un groupe racine (`FilterGroupOf<F>`) dont les enfants sont des conditions (`field`, `operator`, `value`) ou des sous-groupes, combinés par ET (toutes) ou OU (au moins une).
- La profondeur est bornée par `MAX_FILTER_DEPTH` (`@ordo/shared`) : au-delà, « Ajouter un groupe » n’est plus proposé.
- Une condition incomplète (valeur manquante ou invalide) est signalée (`data-incomplete`) et ne s’applique pas.
- « est vide » / « n’est pas vide » ne sont pas proposés sur un champ obligatoire (`required`), sauf si une condition enregistrée les utilise déjà (elle reste lisible). Une règle eslint impose `operatorsFor` pour ce calcul.
- Les listes déroulantes sont rendues dans le popover (`withinPortal: false`) : en portail, choisir une option compterait comme un clic dehors et fermerait le popover.

Utilisé par : la barre de vue des tableaux ([Tableau de données](data-table.md), `DataViewBar` via `tableFilterFields`), les filtres des tâches (`features/tasks`) et des routines (`features/routines`).

## `filter-meta.ts`

| Export                                  | Rôle                                                                                                                                                                                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPERATOR_LABELS`                       | Libellés des opérateurs par type de champ (voir tableau ci-dessous). Utilisé aussi par `routines`.                                                                                                                                             |
| `operatorsFor(fields, field, current?)` | Opérateurs d’une condition : ceux propres au champ (`fields.operators`) s’il en a, sinon ceux de son type (`FILTER_OPERATORS`) sans les opérateurs de vide si le champ est obligatoire ; l’opérateur courant reste proposé s’il ne l’est plus. |
| `nodeId()`                              | Id aléatoire (8 caractères base 36) d’un nouveau nœud.                                                                                                                                                                                         |
| `defaultValueFor(kind, operator)`       | Valeur de départ : `null` pour un opérateur sans valeur (`VALUELESS_OPERATORS`), `''` (texte), `null` (nombre), `'thisWeek'` (date « pendant ») ou `'today'` (autre date), `[]` (choix).                                                       |
| `newConditionFor(fields, field)`        | Nouvelle condition sur un champ, avec le premier opérateur proposé. Utilisé par `useDataView` (« Filtrer selon cette colonne »).                                                                                                               |
| `countConditions(group)`                | Nombre de conditions, groupes imbriqués compris (le badge du bouton « Filtrer »). Utilisé par `DataViewBar`, `library`.                                                                                                                        |

Libellés (`OPERATOR_LABELS`) :

| Type             | Opérateurs                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `text`           | « contient », « ne contient pas », « est », « n’est pas », « est vide », « n’est pas vide »                                             |
| `number`         | « = », « ≠ », « < », « ≤ », « > », « ≥ », vide / non vide                                                                               |
| `date`           | « le », « avant le », « après le », « au plus tard le », « au plus tôt le », « pendant », vide / non vide                               |
| `reference`      | « est », « n’est pas », « est dans (sous-éléments inclus) », vide / non vide                                                            |
| `multiReference` | « inclut l’un de », « inclut tous », « n’inclut aucun de », vide / non vide                                                             |
| `sprint`         | « est l’un de », « n’est aucun de », « inclut tous », « en cours », « précédent », « suivant », « passé », « à venir », vide / non vide |
| `boolean`        | « oui », « non »                                                                                                                        |
| `category`       | « est », « n’est pas », vide / non vide                                                                                                 |

## `FilterBuilder.tsx`

- `FilterFields<F>` (interface) — ce qu’un éditeur propose : `kinds` (type de chaque champ), `labels`, `groups` (champs du select, par groupe), `first` (champ d’une nouvelle condition), `options(field, values)` (props de select des valeurs d’un champ `reference` / `multiReference` / `sprint` / `category`, valeurs archivées comprises tant qu’elles sont dans le filtre), `isComplete(condition)`, `operatorLabel?(field, op)`, `operators?(field)`, `required?` (champs jamais vides), `emptyText` (texte d’un filtre vide).
- `FieldsFilterBuilder({ filter, fields, onChange })` — l’éditeur d’un arbre de filtres. Utilisé par `DataViewBar`, `tasks`, `routines`.

Composants internes :

- `GroupEditor` — un groupe : sélecteur « ET » / « OU » (avec « Toutes les conditions » / « Au moins une condition ») dès deux enfants ; le mot « ET » ou « OU » entre les enfants ; texte vide (`emptyText` à la racine, « Groupe vide. » dessous) ; boutons « Ajouter une condition », « Ajouter un groupe » (le sous-groupe prend le combinateur inverse et démarre avec une condition) et « Retirer le groupe » (sous-groupes). Les sous-groupes sont encadrés.
- `ConditionEditor` — une condition : select « Champ » (par groupe, cherchable ; changer de champ repart sur sa première condition), select « Opérateur » (d’un champ oui / non, « oui » / « non » précédés de leur icône `YesNoIcon`, dans la liste et dans le champ), éditeur de valeur selon le type, bouton « Retirer » (« Retirer la condition »). Changer d’opérateur garde la valeur si elle convient encore (ex. « est » → « n’est pas » ; pas entre « pendant » et un autre opérateur de date).
- Éditeur de valeur : `TextInput` (texte), `NumberInput` au format français (nombre), `DayValue` / `PeriodValue` (date), `BatchMultiSelect` cherchable (choix).
- `DayValue` — « Aujourd’hui », « Il y a N jours », « Dans N jours » (N de 1 à 3650), « Date précise ». Valeurs stockées : `today`, `today-N`, `today+N`, `YYYY-MM-DD`.
- `PeriodValue` — périodes nommées (`DATE_PERIOD_LABELS`, `@ordo/shared`), « Les N derniers jours » (`past:N`), « Les N prochains jours » (`next:N`) ; N par défaut 7.

`FilterBuilder.module.css` : `.group` (par profondeur), `.child`, `.joiner` (le mot ET / OU), `.condition` (style incomplet).

## `ShowArchivedSwitch.tsx`

`ShowArchivedSwitch({ checked, onChange, count?, label? })` — interrupteur « Afficher les archivés » d’une liste, d’un tableau ou d’un tableau Kanban : les éléments archivés sont cachés tant qu’il est éteint. Masqué quand `count` vaut 0 (aucun archivé). `label` remplace le texte (« Afficher les archivées »). Ses props viennent de `useArchivedToggle(items)` (`lib/archive`, voir [lib](../lib.md)), qu’une règle eslint impose. L’état n’est pas enregistré dans la vue : il revient à « éteint » à chaque visite.

Utilisé par `DataViewBar`, `SettingsList` et de nombreuses features (`tasks`, `shopping`, `accounting`, `calendar`, `dashboards`, `mail`, `sheets`, `stock`, `treasury`). Voir [Archivage](../../business-rules/cross-cutting/archiving.md).
