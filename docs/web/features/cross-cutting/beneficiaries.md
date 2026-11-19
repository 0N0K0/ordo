# Code web : bénéficiaires

Tous les fichiers de `apps/web/src/features/beneficiaries/` : le champ et la cellule « Bénéficiaires », le hook qui construit les personnes proposées, et le calcul des modifications groupées. Fonctionnalités : [Bénéficiaires](../../../features/cross-cutting/beneficiaries.md).

Les valeurs des selects de personnes sont des clés `contributor:<id>` / `relation:<id>` construites par `components/people/people-keys` (`personKey`, `peopleKeys`, `idsOfKind`) ; voir [Composants › personnes](../../components/people.md).

## `components/`

### `components/BeneficiariesSelect.tsx`

| Élément                                                             | Rôle                                                                                                                                                                                                                                 | Utilisé par                                                                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `BeneficiariesSelect({ value, onChange, description?, disabled? })` | Champ de formulaire « Bénéficiaires » sur `PeopleSelect` : options de `useBeneficiaries(value)`, aide « Pour qui c’est : contributeurs ou <relations / proches>. » (`relationNoun(perso, true)`), texte « Personne en particulier ». | `TaskCreateForm`, `TaskPanel`, `RoutineForm`, `EventForm` ; aussi importé par `inline-cells`, `event-cells`, `routine-cells` |
| `BeneficiariesCell({ value, label, readOnly?, onSave })`            | Cellule de tableau sur `EditableMultiSelect`, enregistrée à la fermeture de la liste.                                                                                                                                                | `inline-cells` (tâches), `event-cells`, `routine-cells`                                                                      |
| `BENEFICIARIES_LABEL` (interne)                                     | Libellé « Bénéficiaires ».                                                                                                                                                                                                           | —                                                                                                                            |

## `hooks/`

### `hooks/use-beneficiaries.ts`

| Export                             | Rôle                                                                                                                                                                                                                                                                                                                         | Utilisé par                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `Beneficiaries`                    | `{ beneficiaryIds, beneficiaryRelationIds }` (contributeurs, relations).                                                                                                                                                                                                                                                     | partout                                                  |
| `beneficiaryKeys(value)`           | Valeurs du select (`contributor:<id>`, `relation:<id>`).                                                                                                                                                                                                                                                                     | `task-columns`, `routine-columns`                        |
| `beneficiariesOf(keys)`            | Bénéficiaires depuis des valeurs du select.                                                                                                                                                                                                                                                                                  | `BeneficiariesSelect`                                    |
| `useBeneficiaries(chosen?)`        | `{ options, names, choices }` : options groupées (`usePeopleOptions`) — contributeurs du contexte des tâches non archivés, relations de la trésorerie (`useTreasurySettings`) non archivées et sans contributeur, les choisis toujours gardés ; `names(value)` ; `choices` des filtres de colonne (tous, archivés signalés). | `BeneficiariesSelect`, `RoutinesPage`, `shopping-format` |
| `beneficiaryNames(value, context)` | Noms hors composant (tri, export, recherche) : contributeurs du contexte (« Prénom (moi) » via `personName`), relations lues dans le cache (`treasurySettingsKey`).                                                                                                                                                          | `task-rows`, `tasks/lib/export`                          |

Interne : `namesOf(value, contributorName, relationName)` (contributeurs d’abord, inconnus ignorés).

## `lib/`

### `lib/beneficiaries-diff.ts`

`beneficiariesDiff(target, before, after)` : bénéficiaires d’une ligne d’une sélection après la modification d’une cellule : ajouts et retraits appliqués par `applyDiff` (`components/data-table/selection/bulk-edit`). Utilisé par `inline-cells`, `event-cells`, `routine-cells`.
