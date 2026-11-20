# Code web de la trésorerie

Tous les fichiers de `apps/web/src/features/treasury/` (api, pages, components, hooks, lib) et chacun de leurs exports, avec leur rôle et où ils servent. Fonctionnalités : [Trésorerie](../../../features/finances/treasury.md) ; règles API : [Règles de la trésorerie](../../../business-rules/finances/treasury.md).

Briques partagées les plus utilisées ici : `DataTable`, `useDataView`, cellules éditables et édition en masse ([Tables de données](../../components/data-table.md)), `SettingsList` / `SettingsItemForm` ([Paramètres](../../components/settings.md)), `openFormPanel` / `SidePanel` ([Panneaux](../../components/panels.md)), `SignedAmount` / `signedText` ([Montants](../../components/money.md)), clés de personnes ([Personnes](../../components/people.md)), archivage (`lib/archive`, [Lib](../../lib.md)).

## Arborescence

```text
features/treasury/
  api/index.ts
  pages/TreasuryPage.tsx
  components/
    AccountsSettings.tsx      BudgetsPanel.tsx        DirectionBadge.tsx
    EntriesPanel.tsx          EntryForm.tsx           EntryLinesTable.tsx
    EntryUrl.tsx              LoansPanel.tsx          SettingsPanel.tsx
    StatementForm.tsx         StatementImport.tsx     SupportingDocumentsSelect.tsx
    TeamPanel.tsx             TreasuryItemForms.tsx
    entry-cells.tsx           entry-links.tsx
  hooks/
    use-delete-entries.ts     use-link-candidates.ts  use-settings-items.tsx
  lib/
    categories.ts             direction.ts            entry-columns.tsx
    entry-env.ts              entry-values.ts         lines.ts
```

## api

### `api/index.ts`

Requêtes et mutations GraphQL de la trésorerie (TanStack Query, `execute`). Toutes les clés sont sous la clé de la facturation : un règlement change des documents, et les documents changent le prévisionnel.

Types (déduits des requêtes générées) :

| Export                                                                                                                                                | Rôle                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `TreasuryAccount`                                                                                                                                     | Compte (`treasuryAccounts`) : libellé, couleur, image, solde et date d’ouverture, archivé, `csvMapping`, `entryCount`, `balance`.       |
| `TreasuryEntry`                                                                                                                                       | Mouvement (fragment `TreasuryEntryFields`) : champs, lignes (avec pièces, liens), `linkedEntries`, `linkedByLines`, règlements, pièces. |
| `ForecastEntry`                                                                                                                                       | Mouvement de `forecastEntries` (même fragment).                                                                                         |
| `TreasuryProjection`, `ProjectionItem`                                                                                                                | Prévisionnel (`balance`, `series`, `items`) et un mouvement attendu.                                                                    |
| `TreasurySettings`                                                                                                                                    | Résultat de `TreasurySettings` : catégories, moyens, tiers, membres, contextes (`scheduleTypeId`, `workspaceLabel`), relations, éphémérides des contextes (`treasuryContextEphemerides`).                                    |
| `TreasuryCategory`, `TreasuryPaymentMethod`, `TreasuryCounterparty`, `TreasuryMember`, `TreasuryContext`, `TreasuryRelation`, `TreasuryContextEphemeris` | Éléments des paramètres.                                                                                                                |
| `TreasuryCounterpartyItem`                                                                                                                            | Tiers avec `label` = son nom (pour les listes de paramètres).                                                                           |
| `TreasuryEntryLine`                                                                                                                                   | Ligne d’un mouvement.                                                                                                                   |
| `EntryDocument`                                                                                                                                       | Pièce justificative proposée (`treasuryDocumentOptions`).                                                                               |
| `TreasuryBudget`, `BudgetReportRow`                                                                                                                   | Budget défini, ligne du rapport.                                                                                                        |
| `RelationLoans`                                                                                                                                       | Prêts d’une relation.                                                                                                                   |

Constantes et fonctions :

| Export                                                    | Rôle                                                                                                                                                                                                                                                                                                                                                                          | Utilisé par                                                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `treasuryKey`                                             | Clé racine `[...accountingQueryKey, 'treasury']`.                                                                                                                                                                                                                                                                                                                             | Archivage des mouvements / budgets / relations ; `features/shopping/api`.                     |
| `treasurySettingsKey`                                     | Clé des paramètres.                                                                                                                                                                                                                                                                                                                                                           | `features/beneficiaries/hooks/use-beneficiaries.ts`.                                          |
| `counterpartyItems(counterparties)`                       | Tiers en éléments de liste (nom comme libellé).                                                                                                                                                                                                                                                                                                                               | `SettingsPanel`.                                                                              |
| `useTreasuryAccounts(enabled?)`                           | Comptes avec leur solde du jour.                                                                                                                                                                                                                                                                                                                                              | Page, formulaires, `NavBadges`, `PaymentForm` (facturation), tableaux de bord.                |
| `useTreasuryEntries({ from, to, accountId }, enabled?)`   | Mouvements entre deux dates, plus récents d’abord.                                                                                                                                                                                                                                                                                                                            | `EntriesPanel` (tout, 1900–2999), `StatementImport` (doublons), tableaux de bord.             |
| `useInvoiceTreasuryCategories()`                          | Catégories des règlements de factures et remboursements d’avoirs.                                                                                                                                                                                                                                                                                                             | `SettingsPanel`.                                                                              |
| `useTreasurySettings()`                                   | Paramètres complets.                                                                                                                                                                                                                                                                                                                                                          | Presque tous les composants ; agenda, contributeurs, achats, bénéficiaires, tableaux de bord. |
| `useTreasuryDocumentOptions(enabled?)`                    | Pièces proposées (bibliothèque puis projets).                                                                                                                                                                                                                                                                                                                                 | `EntryForm`, `useEntryEnv`.                                                                   |
| `useTreasuryEntrySearch(text)`                            | Recherche par libellé (au moins 2 caractères, 20 résultats).                                                                                                                                                                                                                                                                                                                  | `useLinkCandidates`, `features/shopping/components/ListActions.tsx`.                          |
| `useForecastEntries()`                                    | Prévisions et mouvements réels futurs.                                                                                                                                                                                                                                                                                                                                        | Page, `StatementImport`.                                                                      |
| `useTreasuryProjection({ today, from, until }, enabled?)` | Prévisionnel.                                                                                                                                                                                                                                                                                                                                                                 | Page, accueil, tableaux de bord.                                                              |
| `useTreasuryMutations()`                                  | Mutations : `setInvoiceCategories`, `createAccount`, `updateAccount`, `deleteAccount`, `createEntry`, `updateEntry`, `deleteEntry`, `createCategory`, `updateCategory`, `moveCategory`, `deleteCategory`, `createMethod`, `updateMethod`, `deleteMethod`, `createCounterparty`, `updateCounterparty`, `deleteCounterparty`, `realize`. Chacune invalide `accountingQueryKey`. | Partout dans la feature.                                                                      |
| `useTreasuryTeamMutations()`                              | `addMember`, `removeMember` (invalident aussi tâches et arbre des projets : un membre est un contributeur), `saveRelation`, `deleteRelation`, `saveContext` (création d’un type d’éphémérides contexte, ou modification de son type ; recharge aussi l’agenda).                                                                                                                                                     | `TeamPanel`.                                                                                  |
| `useTreasuryBudgets(from, to)`                            | Budgets définis et rapport d’une période de mois (garde les données précédentes pendant le chargement).                                                                                                                                                                                                                                                                         | `BudgetsPanel`.                                                                               |
| `useTreasuryBudgetMutations()`                            | `save` (création ou modification), `remove`.                                                                                                                                                                                                                                                                                                                                  | `BudgetsPanel`.                                                                               |
| `useTreasuryLoans()`                                      | Prêts par relation.                                                                                                                                                                                                                                                                                                                                                           | `LoansPanel`.                                                                                 |
| `useImportStatement()`                                    | Import d’un relevé ; renvoie `{ created, realized }`.                                                                                                                                                                                                                                                                                                                         | `StatementImport`.                                                                            |

Internes : fragments `TreasuryEntryFields` et `TreasuryEntryDocumentFields`, documents GraphQL (`AccountsDocument`, `EntriesDocument`, `ForecastEntriesDocument`, `ProjectionDocument`, `SettingsDocument`, `EntrySearchDocument`, `DocumentOptionsDocument`, `InvoiceCategoriesDocument`, `BudgetsDocument`, `LoansDocument` et une constante par mutation), `useTreasuryMutation` (mutation qui invalide `accountingQueryKey` via `useInvalidatingMutation`), `AccountValues`.

## pages

### `pages/TreasuryPage.tsx`

| Élément                                     | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TreasuryPage` (export)                     | Page `/treasury` (route dans `app/router.tsx`) : en-tête (« Nouveau compte » ou « Nouveau mouvement » + « Nouvelle prévision »), état vide sans compte, 4 tuiles, graphique « Évolution du solde » (`AreaChart` Mantine, `PeriodNav`, sélecteur mois / année, échelle), onglets `PageTabs` (`forecast`, `entries`, `budgets`, `loans`) et barre de paramètres `PageSettings` avec `SettingsPanel`. Contient la table du prévisionnel : vue `treasury-forecast`, édition en place et en masse des prévisions (chaque entrée une fois), lignes dépliées (`EntryLinesTable`), actions de ligne et de sélection. |
| `FORECAST_KINDS`                            | Libellé et couleur de chaque origine (`FORECAST`, `ACTUAL`, `INVOICE`, `CREDIT_NOTE`, `IMPORTED`, `RECURRING_INVOICE`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ForecastRow`                               | Ligne du prévisionnel : `{ item, index }`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `NO_ACCOUNTS`                               | Liste vide stable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `forecastColumns(entryOf, env)`             | Colonnes du prévisionnel : « Mois », « Date d’exécution », « Libellé », « Origine », « En retard », colonnes partagées (avec « Répétition »), « Montant ».                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `RealizeForm({ item, onDone })`             | Formulaire « Réaliser la prévision » : date réelle et montant, mutation `realize` (une action : reste un formulaire, décision FH).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `AmountTile({ label, value, hint, color })` | Tuile de chiffre (`StatTile`), rouge si négatif.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `Dialog`                                    | Formulaire ouvert : mouvement (nouveau, modifié, copié) ou réalisation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `TREASURY_TABS`                             | Onglets de la page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `TREASURY_MOVED_TABS`                       | Anciens onglets `settings` et `accounts` redirigés vers la barre de paramètres (`usePageTab`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

Fonctions internes de `TreasuryPage` : `forecastOf` (mouvement d’une ligne), `forecastKey` (clé unique par origine, document, échéance, rang), `unfold` (déplie une répartition), `saveForecasts` / `forecastBulk` / `forecastSave` (enregistrement en place et en masse, prévisions archivées ignorées), `openDialog` (titre et taille du panneau : `lg` pour un mouvement).

## components

### `components/AccountsSettings.tsx`

- `AccountsSettings` : liste de paramètres « Comptes » (`SettingsList` + `useAccountItems`), badges solde du jour / ouverture, suppression via `deleteAccount`, refus local « A des mouvements : archivez-le ». Utilisé par `SettingsPanel`.

### `components/BudgetsPanel.tsx`

| Élément                                     | Rôle                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BudgetsPanel` (export)                     | Onglet « Budgets » : mois choisi, rapport « Budgets de [mois] » (vue `treasury-budget-report`, barres `Progress`), « Hors budget » (vue `treasury-budget-outside`, action « Créer le budget »), « Budgets définis » (vue `treasury-budgets`, édition en place et en masse, commentaires, archivage, suppression). |
| `REPEAT_MODES`                              | Choix de répétition du formulaire : `ONCE`, `MONTHS`, `YEAR`.                                                                                                                                                                                                                                                     |
| `REPEAT_CHOICES`                            | Choix de répétition d’une cellule (une fois, 1, 2, 3, 6, 12 mois).                                                                                                                                                                                                                                                |
| `repeatLabel(every)`                        | Répétition en mots (« Tous les 3 mois »…).                                                                                                                                                                                                                                                                        |
| `monthLabel(month)`, `monthCellText(month)` | Mois en mots, capitalisé pour les cellules.                                                                                                                                                                                                                                                                       |
| `MonthCell`                                 | Cellule de mois (`MonthPickerInput` discret), effaçable si `nullable`, `minMonth`.                                                                                                                                                                                                                                |
| `BudgetValues`                              | Valeurs d’un budget (formulaire et cellules).                                                                                                                                                                                                                                                                     |
| `budgetKeyOf(row)`                          | Clé d’une ligne de rapport (bénéficiaire, contexte, catégorie).                                                                                                                                                                                                                                                   |
| `budgetValues(budget)`                      | Valeurs d’un budget enregistré.                                                                                                                                                                                                                                                                                   |
| `BudgetForm({ budget, defaults, onDone })`  | Formulaire de budget (mois, montant, sens, catégorie créable, bénéficiaire, contexte, répétition, fin) et commentaires `BUDGET`. « Moi » est envoyé sans membre. Nouveau : « Créer » ; existant : enregistré champ par champ (décision D22, `useFieldSave`, montant et « Tous les » en les quittant, `SaveStatus`, budget du cache suivi par `useCachedItem` (`budgetsOf`), archivé en lecture seule).                                                                                                                                                  |
| `Dialog`                                    | Budget modifié, ou valeurs d’un nouveau (« Dupliquer » : copie enregistrée par `save` puis ouverte, `cachedItem`, décision D20).                                                                                                                                                                                                                                                                      |

Fonctions internes de `BudgetsPanel` : `deleteBudgets` (action « Supprimer » avec risques), `saveBudget` (cellule ; sans répétition, `repeatUntil` vidé), `openBudget`, `used` / `outsideUsed` / `outsideText` (montants lus dans le sens de la catégorie), `whoKey`, `whoChoices`, `keyContent`, `whoText`, `contextText`, `keyColumns`.

### `components/DirectionBadge.tsx`

- `DirectionBadge({ direction, plural? })` : badge « Entrée » (vert) / « Sortie » (rouge), « Entrées » / « Sorties » au pluriel ; rien pour un autre sens. Utilisé par `BudgetsPanel` (catégories) et `SettingsPanel` (moyens de paiement).

### `components/EntriesPanel.tsx`

| Élément                                                    | Rôle                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EntriesPanel({ accounts, onEdit, onDuplicate })` (export) | `onDuplicate` : `DuplicateOptions` de `useEntryDuplicate`. Onglet « Mouvements » : vue `treasury-entries` des mouvements réels, vues de départ, colonne de commentaires `TREASURY_ENTRY`, édition en place et en masse, répartitions dépliées, totaux compensés, export PDF (`StatementForm`), import (`StatementImport`), archivage, suppression. |
| `periodTotals(entries)`                                    | Entrées, sorties et montant compensé par les liens (`offsetLinkedMovements`).                                                                                                                                                                                                           |
| `EntriesPanelProps`                                        | Comptes, ouverture du formulaire, duplication.                                                                                                                                                                                                                                          |
| `ACTIONS_WIDTH`                                            | Largeur de la colonne d’actions (`ROW_ACTIONS_WIDTH`).                                                                                                                                                                                                                                  |
| `entryColumns(env)`                                        | Colonnes : « Mois », « Date d’exécution », « Libellé », colonnes partagées, « Documents réglés », « Montant ».                                                                                                                                                                          |
| `ENTRY_VIEWS`                                              | Vues créées la première fois : « Ce mois-ci », « Cette année », « Tous ».                                                                                                                                                                                                               |

### `components/EntryForm.tsx`

| Élément                                                  | Rôle                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EntryForm({ entry?, status?, onDone })` (export) | Formulaire de mouvement ou de prévision (voir [Formulaire de mouvement](../../../features/finances/treasury.md#formulaire-de-mouvement)) : `useAppForm` + `treasuryEntrySchema`, pièces, liens, répétition (`RuleField`), règlements de documents (PRO, réel), commentaires. Envoie `entryPayload`. Nouveau : « Ajouter » ; existant : enregistré champ par champ (décision D22, `useFieldSave` avec `ON_BLUR` : libellé, montant, description, lien, montants réglés ; `changeTogether` pour les champs qui vont ensemble ; le mouvement entier chaque fois, sa répartition comme le cache la tient ; mouvement du cache suivi par `useCachedItem` sur `treasuryKey` (`entriesOf`) ; archivé en lecture seule ; erreur de la répartition par `nestedErrors`). Utilisé par `TreasuryPage`. |
| `DOCUMENT_KEY`, `IMPORTED_KEY`                           | Préfixes `doc:` / `imp:` d’un document réglé dans le choix.                                                                                                                                                                                                                                                                     |
| `settledKey(id, imported)`                               | Clé d’un document.                                                                                                                                                                                                                                                                                                              |
| `allocationKey(allocation)`, `allocationOfKey(key)`      | Règlement ↔ clé.                                                                                                                                                                                                                                                                                                                |
| `LinkedSummary`                                          | Mouvement lié tel que montré.                                                                                                                                                                                                                                                                                                   |
| `entryLink(entry)`                                       | Mouvement lié en `LineLink` (son badge).                                                                                                                                                                                                                                                                                        |
| `EntryFormProps`                                         | Props.                                                                                                                                                                                                                                                                                                                          |

Internes : `settleOption` (option d’un document avec son reste dû), `settleable` (documents réglables), `handleSubmit`.

### `components/EntryLinesTable.tsx`

| Élément                                          | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EntryLinesTable({ entry, env, save })` (export) | Répartition d’un mouvement, dépliée sous lui, en table (vue `treasury-entry-lines`) : seul endroit où ses lignes s’ajoutent (ligne d’ajout, `linesChange`), se modifient en place et en masse, se retirent (menu de la ligne, confirmation) et se répartissent à parts égales (`equalShares`) ; sélections créables (relation, catégorie, contexte) ; chaque modification enregistre le mouvement entier ; « Non réparti » dans la barre ; état vide pour un mouvement non décomposé. Utilisé par `TreasuryPage` et `EntriesPanel`. |
| `LineRow`                                        | Ligne : rang, valeurs, montant signé, pièces.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `lineKey(row)`                                   | Clé : id ou rang.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `ME`                                             | Clé de « Moi » (`ME_KEY`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `whomKey(line)`                                  | Clé du bénéficiaire (`m:`, `r:` ou `ME`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `lineColumns(env)`                               | Colonnes : « Libellé », « Bénéficiaire », « Catégorie », « Contexte », « Unité », « Valeur », « Montant », « Prêt », « Date », « Projet », « Pièces justificatives », « Relative à un autre mouvement ».                                                                                                                                                                                                                                                                                                                            |

Internes : `saveLines`, `saveLine` (avec `bulkSaver`, `applyDiff` pour les pièces et les liens).

### `components/EntryUrl.tsx`

- `EntryUrl({ url, label })` : bouton « Ouvrir le lien » (nouvel onglet) vers la page web d’un mouvement ; rien sans lien. Utilisé dans les libellés du prévisionnel et des mouvements.

### `components/LoansPanel.tsx`

| Élément                     | Rôle                                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `LoansPanel` (export)       | Onglet « Prêts » : totaux « On vous doit » / « Vous devez », table en arbre (vue `treasury-loans`, `parentKey`), commentaires `RELATION`. |
| `LoanRow`                   | Ligne : relation ou ligne de prêt.                                                                                                        |
| `BalanceBadge({ balance })` | « Soldé », « Vous doit X », « Vous lui devez X ».                                                                                         |
| `loanColumns(words)`        | Colonnes « Relation / ligne » (ou « Proche / ligne »), « Solde », « Sorti vers elle », « Reçu d’elle », « Date », « Montant ».            |

### `components/SettingsPanel.tsx`

| Élément                                   | Rôle                                                                                                                                                                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SettingsPanel` (export)                  | Contenu de la barre « Paramètres de la trésorerie » : `AccountsSettings`, `TeamPanel` (contextes), catégories d’entrées et de sorties, « Factures et avoirs » (PRO), moyens de paiement, tiers. Squelette pendant le chargement. |
| `entries(count)`                          | « N mouvements ».                                                                                                                                                                                                                |
| `CategoryList({ direction, categories })` | Liste en arbre des catégories d’un sens (`nested`, `move`, `storageKey` `treasury-categories-IN/OUT`).                                                                                                                           |
| `MethodList({ methods })`                 | Liste des moyens de paiement, badges de sens.                                                                                                                                                                                    |
| `CounterpartyList({ counterparties })`    | Liste des tiers, message de suppression adapté au nombre de mouvements.                                                                                                                                                          |
| `InvoiceCategories({ categories })`       | Choix des catégories des factures et avoirs (`setInvoiceCategories`, toast « Catégorie enregistrée. »).                                                                                                                          |

### `components/StatementForm.tsx`

- `StatementForm({ accounts, accountId, onDone })` : export du relevé PDF (période `usePeriodRange`, défaut `lastMonth`, compte facultatif) via `fetchDownload('/api/treasury/statement.pdf?…')`. Utilisé par `EntriesPanel`.
- `StatementFormProps`.

### `components/StatementImport.tsx`

| Élément                                          | Rôle                                                                                                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StatementImport({ accounts, onDone })` (export) | Import CSV en trois étapes (`file`, `columns`, `preview`) ; utilise `parseCsv`, `readStatement`, `statementMappingSchema`, `occurrenceDates` de `@ordo/shared`. Utilisé par `EntriesPanel`. |
| `DUPLICATE_DAYS` (3), `FORECAST_DAYS` (7)        | Écart de jours pour un doublon et pour une prévision de même montant.                                                                                                                       |
| `readText(file, encoding)`                       | Texte du fichier ; UTF-8 sauf caractère de remplacement, alors Windows-1252.                                                                                                                |
| `guessMapping(text, encoding)`                   | Mapping deviné : séparateur le plus fréquent, ligne d’en-tête, colonnes par nom.                                                                                                            |
| `PreviewRow`                                     | Opération de l’aperçu : doublon éventuel, prévision proposée.                                                                                                                               |
| `PREVIEW_COLUMNS`                                | Colonnes de l’aperçu (date, libellé, montant).                                                                                                                                              |
| `StatementImportProps`                           | Props.                                                                                                                                                                                      |

Internes : `load`, `remap` (relit le fichier si l’encodage change), `submit`, `ticked`, vues `statement-import-file` et `statement-import-preview`.

### `components/SupportingDocumentsSelect.tsx`

- `SupportingDocumentsSelect({ data, value, onChange, error })` : multi-choix « Pièces justificatives » (`BatchMultiSelect`, clés `lib:` / `res:`). Utilisé par `EntryForm`.
- `SupportingDocumentsSelectProps`.

### `components/TeamPanel.tsx`

| Élément                                               | Rôle                                                                                                                                                         | Utilisé par                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `TeamMembers` (export)                                | Section « Équipe » / « Foyer » : membres (noms et avatars à jour des contributeurs), archivage, « Retirer », ajout d’un contributeur ou d’un nouveau membre. | `features/projects/pages/SettingsPage.tsx`. |
| `ContextForm({ label?, onDone })` (export)  | Nouveau contexte (libellé, couleur), « Créer » ; rend l’id créé (un contexte se modifie dans `SettingsList`).                                                                                                  | `EntryLinesTable` (création à la volée).    |
| `Contexts`                                            | « Contextes » : `SettingsList` des types d’éphémérides « Sert de contexte au budget » (`SCHEDULE_TYPE`, `useScheduleTypeItems({ ephemeris: true, budgetContext: true })`, `removeType`), bouton « Périodes » (`openSchedulesManager(true, perso)`), et « Contextes partagés par d’autres espaces » (lecture seule, `workspaceLabel`) ; lot 16. | `TeamPanel`.                                |
| `TeamPanel` (export)                                  | Contextes (leurs périodes : éphémérides), barre de paramètres.                                                                                                          | `SettingsPanel`.                            |
| `RelationForm({ relation?, name?, onDone })` (export) | Relation (nom, contributeur, description multiligne : `Textarea`, 4 000 caractères) ; nouvelle : « Ajouter » ; existante : enregistrée champ par champ (décision D22, nom et description en les quittant, le contributeur avec le nom qu’il donne, relation du cache suivie, archivée en lecture seule).                                                           | `EntryLinesTable`, `TeamRelations`.         |
| `TeamRelations` (export)                              | Section « Relations » / « Proches » : liste, usages, modification, archivage, suppression.                                                                   | `features/projects/pages/SettingsPage.tsx`. |

### `components/TreasuryItemForms.tsx`

- `AccountItemForm({ onDone })` : formulaire de nouveau compte (`SettingsItemForm` + `useAccountItems`), pour le premier compte depuis la page.

### `components/entry-cells.tsx`

Cellules des tables de mouvements.

| Export                                                | Rôle                                                                                                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `PayerCell({ entry, env, label, save })`              | Émetteur / destinataire modifiable (clients et tiers).                                                                                        |
| `ProjectCell({ value, env, label, onSave })`          | Projet modifiable (arbre).                                                                                                                    |
| `DocumentsCell({ documents, env, label, onSave })`    | Badges des pièces (fichier ouvert dans la visionneuse) et popover de choix ; les pièces déjà choisies restent proposées (groupe « Choisis »). |
| `LinksCell({ links, entryId, lines, label, onSave })` | Badges des liens (délier), popover de recherche pour lier.                                                                                    |
| `SettledCell({ entry })`                              | Badges des documents réglés (lien vers un document Ordo, cyan pour un importé).                                                               |
| `RecurrenceCell({ entry, save })`                     | Répétition d’une prévision (`RuleField`).                                                                                                     |
| `DetailsToggle({ opened, count, label, onToggle })`   | Bouton discret « détails » qui déplie la répartition (`FoldHeading`).                                                                         |

### `components/entry-links.tsx`

| Export                                                                              | Rôle                                                                                                               |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `EntryLinkSelect({ entryId, links, lines?, withAccount?, onLink, ...selectProps })` | Recherche d’une ligne ou d’un mouvement à lier (filtrée par le serveur, au moins 2 caractères), vidée après choix. |
| `LinkBadge({ link, onUnlink?, variant?, size?, children?, withTooltip? })`          | Badge d’un lien, rouge (sortie) ou vert (entrée), croix « Délier ».                                                |

Utilisés par `EntryForm`, `LinksCell`. Interfaces internes : `EntryLinkSelectProps`, `LinkBadgeProps`.

## hooks

### `hooks/use-delete-entries.ts`

- `useDeleteEntries()` : actions « Supprimer » avec confirmation (`deleteItemsAction`) : `movements(rows, clear?)` (risques : documents de nouveau dus, liens retirés) et `forecasts(rows, clear?, note?)` (« et toutes ses répétitions »). Utilisé par `TreasuryPage` et `EntriesPanel`.

### `hooks/use-link-candidates.ts`

- `useLinkCandidates(search, { entryId, links, lines? })` : candidats à lier trouvés par `useTreasuryEntrySearch` : pas le mouvement édité, pas déjà liés ; un mouvement décomposé par ses lignes (si permis), sinon en entier. Utilisé par `EntryLinkSelect`.

### `hooks/use-settings-items.tsx`

Définitions de listes de paramètres et créateurs à la volée.

| Export                            | Rôle                                                                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `useAccountItems()`               | Comptes (`TREASURY_ACCOUNT`) : couleur facultative, champs « Solde d’ouverture » (enregistré en le quittant : `extra.onBlur`) et « Au ». |
| `useCategoryItems(direction)`     | Catégories d’un sens (`TREASURY_CATEGORY`), sens fixé par la liste.                                                                    |
| `useMethodItems()`                | Moyens de paiement (`TREASURY_PAYMENT_METHOD`) : cases « Pour les entrées » / « Pour les sorties ».                                    |
| `useCounterpartyItems()`          | Tiers (`TREASURY_COUNTERPARTY`) : champ « Nom », description (enregistrée en la quittant : `extra.onBlur`).                            |
| `useCategoryCreators(categories)` | Créateurs de catégorie par sens pour un `CreatableSelect` (« Nouvelle catégorie », parent parmi les catégories non archivées du sens). |
| `useEntryCreators(direction)`     | Créateurs de moyen de paiement (servant le sens) et de tiers.                                                                          |

Internes : `AccountExtra`, `CategoryExtra`, `MethodExtra`, `CounterpartyExtra`, `COUNTERPARTY_FORM_SCHEMA` (nom dans le champ libellé), `Creator`. Utilisés par `AccountsSettings`, `TreasuryItemForms`, `SettingsPanel`, `EntryForm`, `EntryLinesTable`, `BudgetsPanel`.

## lib

### `lib/categories.ts`

| Export                                                    | Rôle                                                                           | Utilisé hors feature                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------ |
| `categoryPaths`                                           | Ré-export de `components/tree/category-tree` : chemins complets par id.        | Tableaux de bord.                    |
| `categoryTree(categories, direction?)`                    | Catégories d’un sens dans l’ordre de l’arbre.                                  | Tableaux de bord, routines.          |
| `categoryOptions(categories, direction, exclude?, keep?)` | Options d’un select en arbre ; archivées non proposées sauf valeurs actuelles. | —                                    |
| `categoryChoices(categories)`                             | Choix d’un filtre de colonne (sorties puis entrées), archivées marquées.       | —                                    |
| `categoryPathLineage(byId, id)`                           | Chemins d’une catégorie et de ses parentes (« A › B », « A »).                 | `dashboards/lib/finance-records.ts`. |
| `categoryLineage(byId, id)`                               | Noms d’une catégorie et de ses parentes.                                       | `dashboards/lib/finance-records.ts`. |

### `lib/direction.ts`

| Export              | Rôle                                                                              |
| ------------------- | --------------------------------------------------------------------------------- |
| `DIRECTION_LABELS`  | « Entrée » / « Sortie ».                                                          |
| `DIRECTION_PLURALS` | « Entrées » / « Sorties » (décision BH) ; utilisé aussi par les tableaux de bord. |
| `DIRECTION_COLORS`  | Vert / rouge.                                                                     |
| `DIRECTION_OPTIONS` | Choix d’un contrôle segmenté (formulaire de mouvement).                           |

### `lib/entry-columns.tsx`

| Export                                                                     | Rôle                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entryFieldColumns(entryOf, env, { payerName, recurrence?, allEntries? })` | Colonnes partagées des tables de mouvements : « Compte », « Date de valeur », « Mois de valeur », « Émetteur / destinataire », « Catégories », « Moyen de paiement », « Projet », « Pièces justificatives », « Mouvements liés », et « Répétition » sur demande. |
| `entryFieldCells(entry, env, save, labelOf)`                               | Cellules modifiables de ces colonnes ; un mouvement décomposé montre catégories, projets, pièces et liens de ses lignes en lecture seule (« Sur les lignes ») ; en masse, ce qui ne convient pas (décomposé, autre sens) est ignoré.                             |

Internes : `NONE` (valeur « Aucun » d’un filtre), `entryRefs` (catégories ou projets du mouvement ou de ses lignes), `allDocuments`. Utilisés par `TreasuryPage` et `EntriesPanel`.

### `lib/entry-env.ts`

| Export                                                | Rôle                                                                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AnyEntry`                                            | `TreasuryEntry` ou `ForecastEntry`.                                                                                                               |
| `EntrySave`                                           | Enregistrement d’une cellule (même changement en masse, ou calculé par mouvement).                                                                |
| `EntryUpdate`                                         | Enregistrement d’un mouvement.                                                                                                                    |
| `EntryDocument`                                       | Pièce d’un mouvement ou d’une ligne.                                                                                                              |
| `Choice`                                              | Option de select (avec `archived`).                                                                                                               |
| `EntryEnv`                                            | Ce que les tables nomment et proposent : paramètres, comptes, chemins de catégories, émetteurs, projets, pièces, noms des personnes et contextes. |
| `useEntryEnv(accounts)`                               | Construit l’`EntryEnv` (paramètres, arbre des projets, pièces).                                                                                   |
| `payerGroups(clients, counterparties)`                | Groupes « Clients » puis « Tiers » (clés `client:` / `tiers:`).                                                                                   |
| `documentGroups(documents, projectId?)`               | Pièces groupées : « Bibliothèque », puis « Projet X » (celui du mouvement d’abord) ; dossier entre parenthèses hors « Documents ».                |
| `documentKey(document)`                               | `lib:<id>` ou `res:<id>`.                                                                                                                         |
| `SupportingDocuments`                                 | `libraryDocumentIds`, `projectResourceIds`.                                                                                                       |
| `supportingKeys(documents)`, `supportingOfKeys(keys)` | Pièces ↔ clés.                                                                                                                                    |
| `payerKey(entry)`, `payerOfKey(key)`                  | Émetteur ↔ clé.                                                                                                                                   |
| `entryLinks(entry)`                                   | Liens d’un mouvement en `LineLink`.                                                                                                               |
| `linkedLabels(entry)`                                 | Libellés liés au mouvement et à ses lignes.                                                                                                       |
| `recurrenceText(entry)`                               | Règle de répétition en mots (`describeRecurrence`).                                                                                               |

Internes : `PayerSource`, `DocumentSource`.

### `lib/entry-values.ts`

| Export                                            | Rôle                                                                                                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `EntryValues`                                     | Valeurs du formulaire de mouvement : montant positif + `direction`, lignes relatives au sens.                                                                            |
| `entryValues(entry, { status, copy, accountId })` | Valeurs d’un mouvement (ou d’un nouveau, à aujourd’hui) ; une copie n’a ni règlements ni ids de lignes ; les montants des lignes deviennent relatifs au sens.            |
| `useEntryDuplicate(open)` | « Dupliquer » d’un mouvement ou d’une prévision (décision D20) : copie « … (copie) » enregistrée par `createEntry` (`entryValues` en copie + `entryPayload`), puis `open` sur elle (`cachedItem`). Utilisé par `TreasuryPage` et `EntriesPanel`. |
| `linesChange(values, lines, linked)`              | Changement d’un mouvement dont les lignes sont remplacées : aux premières lignes, catégorie et projet passent sur elles, pièces et liens sur la première.                |
| `entryPayload(input)`                             | Entrée de la mutation : montant et lignes en montant signés par le sens, pas de répétition pour un réel, pas de règlement pour une prévision, `links` retiré des lignes. |
| `useEntryCellSave()`                              | Enregistre un changement de cellule : le reste du mouvement tel quel (`updateEntry`, erreurs en toast).                                                                  |

### `lib/lines.ts`

| Export                                            | Rôle                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `LineValues`                                      | Ligne éditée (valeur relative au sens du mouvement, `links` affichés).                      |
| `LineLink`                                        | Ligne d’un autre mouvement ou mouvement entier lié (`kind`, libellés, date, montant signé). |
| `newSplitLine(fields)`                            | Nouvelle ligne (défauts : montant, 0, sans bénéficiaire).                                   |
| `plannedLineContext(settings, date)`              | Contexte proposé ce jour-là à une nouvelle ligne (`contextPlanner` sur les éphémérides des contextes non archivés). |
| `settingsContextEphemerides(settings, withArchived?)` | Éphémérides des contextes en `ContextEphemeris` (`scheduleRules`), ceux des contextes archivés exclus sauf demande. Utilisé ici et par `chart-data` (tableaux de bord). |
| `equalShares(members, contextId)`                 | Lignes à parts égales : une en % par membre, la dernière prend l’arrondi.                   |
| `describeLink(link)`                              | « 12 mars 2026 · Courses › Glace · −4,50 € ».                                               |
| `valueInMode(mode, share, entryAmount)`           | Valeur dans une autre unité en gardant la part (0 pour un mouvement de 0).                  |
| `categoryForDirection(categories, id, direction)` | Garde une catégorie seulement si elle est du sens de la ligne.                              |
| `LinkCandidate`                                   | Lien trouvé, avec le compte de son mouvement.                                               |
| `linkKey(link)`                                   | `line:<id>` ou `entry:<id>`.                                                                |
