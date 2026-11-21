# Code web de la facturation

Tous les fichiers de `apps/web/src/features/accounting/` (api, pages, components, lib) et ce qu’ils exportent, avec leur rôle et leurs principaux utilisateurs. Les écrans sont décrits dans [Facturation](../../../features/finances/accounting.md), les règles de l’API dans [Règles métier de la facturation](../../../business-rules/finances/accounting.md). Le dossier n’a pas de sous-dossier `hooks`.

## Utilisateurs hors du dossier

| Fichier                                                         | Ce qu’il utilise                                                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `app/router.tsx`                                                | `AccountingPage`, `DocumentPage`, `ImportedDocumentPage` (dans `ProOnly`).                                                     |
| `app/layout/QuickActions.tsx`                                   | `openNewDocument` (action rapide « Devis »).                                                                                   |
| `features/projects/pages/ClientPage.tsx`                        | `ClientBillingSection`, `ProjectBillingPanel`.                                                                                 |
| `features/projects/pages/ProjectPage.tsx`                       | `ProjectBillingPanel`, `ProjectResourcesPanel`.                                                                                |
| `features/tasks/api/index.ts`, `features/treasury/api/index.ts` | `accountingQueryKey` (invalidation).                                                                                           |
| `features/treasury/components/EntryForm.tsx`                    | `useAccountingDocuments`, `useImportedDocuments`.                                                                              |
| `features/home/**`                                              | `useAccountingDocuments`, `useImportedDocuments`, `useOverdueInvoices`, types `AccountingDocumentSummary`, `ImportedDocument`. |
| `features/dashboards/**`                                        | `useAccountingDocuments`, `useImportedDocuments`, `useDocumentStatuses`, `DOCUMENT_TYPE_LABELS`, types.                        |
| `features/time/components/TimeLog.tsx`                          | `DRAFT_NAME`.                                                                                                                  |

## api

Requêtes et mutations GraphQL (via `execute` de `lib/graphql-client` et TanStack Query). Toutes les clés commencent par `accountingQueryKey` ; les mutations passent par `useAccountingMutation`, qui invalide toute la facturation (voir [Bibliothèque web](../../lib.md)).

### `api/index.ts`

Société, numérotation et fiche de facturation des clients. Fragment `CompanyProfileFields` ; documents `CompanyProfile`, `DocumentSequences`, `ClientBilling`, `UpdateCompanyProfile`, `SetCompanyLogo`, `SetDocumentSequence`, `UpdateClientDetails`, `CreateClientService`, `UpdateClientService`, `DeleteClientService`, `CreateClientContact`, `UpdateClientContact`, `DeleteClientContact`.

| Export                                                                                                                    | Rôle                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `CompanyProfile` (type)                                                                                                   | Profil de la société (fragment).                                                                                       |
| `ClientBilling`, `ClientService`, `ClientContact` (types)                                                                 | Fiche de facturation d’un client, un service, un contact.                                                              |
| `AccountingDocumentType`, `ClientContactInput`, `ClientDetailsInput`, `ClientServiceInput`, `CompanyProfileInput` (types) | Réexportés.                                                                                                            |
| `accountingQueryKey`                                                                                                      | `['accounting']`, racine de toutes les clés.                                                                           |
| `useCompanyProfile()`                                                                                                     | Profil de la société. Utilisé par `CompanySettings`, `CatalogItemForm`, `DocumentEditor`.                              |
| `useDocumentSequences(year)`                                                                                              | Numérotation d’une année. `NumberingSettings`.                                                                         |
| `useClientBilling(id)`                                                                                                    | Coordonnées, services et contacts d’un client. `ClientBillingSection`, `DocumentEditor`.                               |
| `useClientContacts(enabled?)`, `AnyClientContact` (type) | Tous les contacts de tous les clients (`clientContacts`, clients archivés compris, avec `client { id name archived }`) : ceux auxquels un contributeur peut être lié (pas en PERSO). `ContributorLinkField`. |
| `useAccountingMutation(mutationFn)`                                                                                       | Mutation qui invalide `accountingQueryKey` (`useInvalidatingMutation`). Base de toutes les mutations du dossier.       |
| `useCompanyMutations()`                                                                                                   | `update`, `setLogo`, `setSequence`.                                                                                    |
| `useClientPartyMutations()`                                                                                               | `updateDetails`, `createService`, `updateService`, `deleteService`, `createContact`, `updateContact`, `deleteContact` ; `updateContact` et `deleteContact` rechargent aussi les tâches (le contributeur lié montre l’email et les téléphones du contact). |

### `api/documents.ts`

Documents d’Ordo, récurrentes, documents importés et ressources de projet. Fragments `AccountingDocumentListFields` (listes) et `AccountingDocumentFields` (page : lignes, temps, documents liés, paiements, relances…), `ImportedDocumentFields`.

| Export                                                  | Rôle                                                                                                                                                                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AccountingDocument` (type)                             | Document complet (page).                                                                                                                                                                                         |
| `AccountingDocumentSummary` (type)                      | Document des listes.                                                                                                                                                                                             |
| `RecurringInvoice` (type)                               | Facture récurrente avec son modèle.                                                                                                                                                                              |
| `ProjectResource` (type)                                | Fichier ou lien d’un projet.                                                                                                                                                                                     |
| `ImportedDocument`, `ImportedDocumentInput` (types)     | Document importé.                                                                                                                                                                                                |
| `RecurringSettings` (interface)                         | `label`, `recurrence`, `startDate`, `autoFinalize`, `active`.                                                                                                                                                    |
| `useLatestDocumentDate(type, documentId, enabled?)`     | Date du dernier document du type (borne de la date d’un brouillon). `DocumentEditor`.                                                                                                                            |
| `useDeductibleDeposits(clientId, documentId, enabled?)` | Acomptes du client restant à déduire ; inactif sans client. `DeductDepositMenu`.                                                                                                                                 |
| `useAccountingDocuments(filter?, enabled?)`             | Documents (hors modèles), filtrés par `clientId` ou `projectId`.                                                                                                                                                 |
| `useAccountingDocument(id)`                             | Un document. `DocumentEditor`.                                                                                                                                                                                   |
| `fetchNewDocumentDefaults(variables)`                   | Valeurs par défaut d’un nouveau document (requête `newDocumentDefaults`). `NewDocumentForm`.                                                                                                                     |
| `useRecurringInvoices()`                                | Factures récurrentes. `RecurringList`, `DocumentEditor`.                                                                                                                                                         |
| `useProjectResources(projectId)`                        | Ressources d’un projet. `ProjectResourcesPanel`.                                                                                                                                                                 |
| `useDocumentMutations()`                                | `create`, `update` (invalide aussi `timeQueryKey`), `remove` (ne recharge pas le document supprimé), `finalize`, `createFrom`, `createDeposit`, `duplicate`, `addAttachments`, `removeAttachment`, `setProject`. |
| `useRecurringMutations()`                               | `create`, `update`, `remove`.                                                                                                                                                                                    |
| `useProjectResourceMutations()`                         | `addLink`, `addFiles`, `update`, `remove`, `move`.                                                                                                                                                               |
| `useImportedDocument(id)`                               | Un document importé (null s’il est introuvable). `ImportedDocumentPage`.                                                                                                                                         |
| `useImportedDocuments(filter?, enabled?)`               | Documents importés, filtrés par client ou projet.                                                                                                                                                                |
| `useImportedDocumentMutations()`                        | `create`, `update`, `remove`, `setStatus`, `markSent`, `setProject`.                                                                                                                                             |

### `api/catalog.ts`

| Export                  | Rôle                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `CatalogItem` (type)    | Article du catalogue.                                                                                           |
| `useCatalogItems()`     | Catalogue (clé `[...accountingQueryKey, 'catalog']`). `CatalogPanel`, `DocumentLinesEditor`, `TimeBillingForm`. |
| `useCatalogMutations()` | `create`, `update`, `remove` ; invalident seulement le catalogue (`useCatalogMutation`, interne).               |

### `api/tracking.ts`

Statuts, factures à relancer et suivi. Documents `DocumentStatuses`, `OverdueInvoices`, `SendDocumentReminders`, `CreateDocumentStatus`, `UpdateDocumentStatus`, `DeleteDocumentStatus`, `SetDocumentTrackingStatus`, `MarkDocumentSent`, `AcceptQuote`, `RemoveSignedQuote`, `AddDocumentReminder`, `DeleteDocumentReminder`, `RecordDocumentPayment`.

| Export                              | Rôle                                                                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `DocumentStatus` (type)             | Statut de suivi.                                                                                                      |
| `OverdueInvoice` (type)             | Facture à relancer.                                                                                                   |
| `useDocumentStatuses()`             | Statuts des deux portées. `TrackingPanel`, `StatusMenu`, `DocumentStatusSettings`, tableaux de bord.                  |
| `useOverdueInvoices(today)`         | Factures à relancer, archivées retirées. `AccountingPage`, `OverdueInvoicesPanel`, accueil.                           |
| `useDocumentStatusMutations(scope)` | `create`, `update`, `remove`, au format du gestionnaire de listes (`SettingsList`).                                   |
| `useTrackingMutations()`            | `setStatus`, `markSent`, `accept`, `removeSigned`, `addReminder`, `sendReminders`, `deleteReminder`, `recordPayment`. |

## pages

### `pages/AccountingPage.tsx`

| Élément                                                       | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AccountingPage` (export)                                     | Page `/accounting` : en-tête avec « Nouveau document » (`newDocumentMenu`), onglets (`PageTabs`, `usePageTab`) par type, « À envoyer », « À relancer », « Récurrentes », « Catalogue » ; paramètres (`PageSettings`, `SettingsTabs` via `useSettingsTab`) « Export ZIP », « Suivi », « Ma société ». Convertit l’ancien paramètre `settingsTab`, redirige l’ancien onglet `tracking`. Calcule les documents « À envoyer » et les années proposées au ZIP. |
| `SETTINGS_TABS`, `TABS`, `PAGE_TABS`, `ACCOUNTING_MOVED_TABS` | Onglets des paramètres, onglets par type, tous les onglets, anciens onglets déplacés.                                                                                                                                                                                                                                                                                                                                                                     |
| `repetitionText(item)`                                        | Phrase de la répétition d’une récurrente (`describeRecurrence`).                                                                                                                                                                                                                                                                                                                                                                                          |
| `RECURRING_COLUMNS`                                           | Colonnes des récurrentes : libellé, client, répétition, prochaine, état, émises, montant.                                                                                                                                                                                                                                                                                                                                                                 |
| `RecurringList`                                               | Tableau des récurrentes : libellé et état modifiables en place et en lot (`bulkSaver`), archivage, suppression (`deleteItemsAction`), « Modifier la planification », « Ouvrir le modèle ».                                                                                                                                                                                                                                                                |

### `pages/DocumentPage.tsx`

| Export         | Rôle                                                                        |
| -------------- | --------------------------------------------------------------------------- |
| `DocumentPage` | Page `/accounting/:id` : lit l’id de l’adresse et affiche `DocumentEditor`. |

### `pages/ImportedDocumentPage.tsx`

| Export                 | Rôle                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ImportedDocumentPage` | Page `/accounting/imported/:id` : `DetailHeader` (badge « Importé », télécharger, « Modifier » via `openImportForm`, archiver), aperçu du fichier (`FilePreview`, `viewableKind`) ou état vide, section « Suivi » (`StatusMenu` + `chooseTrackingStatus`, `DocumentBalanceBadge`), « Informations », commentaires (`IMPORTED_DOCUMENT`). |

## components

### `components/DocumentEditor.tsx`

| Élément                                      | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DocumentEditor({ id })` (export)            | Charge le document ; squelette, erreur, introuvable (`DetailNotFound`) ; remonte `Editor` quand l’état change (clé `id-status`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `Editor({ document })`                       | Éditeur : formulaire `useAppForm` avec `accountingDocumentInputSchema`, enregistré champ par champ (`useFieldSave` avec `ON_BLUR` : textes, lignes, remise, acompte en les quittant ; `toSaved` retire les lignes vierges, `withoutBlankLines`, qui ne bloquent rien ; le document entier à chaque fois par `update` ; lecture seule si définitif ou archivé ; `SaveStatus` en tête de la colonne principale ; `settled` avant l’aperçu et la validation ; temps passé, acompte déduit, conditions de règlement avec l’échéance : `commit` de plusieurs champs ensemble), totaux en direct (`computeTotals`), actions d’en-tête (aperçu, PDF, acquittée, envoyer, valider, supprimer, acompte, facturer, avoir, rendre récurrente, dupliquer ; des `ActionButton` sans couleur propre, comme ailleurs, « Supprimer » en `danger`), bandeaux, aperçu / détails d’un définitif, sections « Client et dates », « Contenu », « Conditions et mentions », colonne « Suivi », « Totaux », pièces jointes, documents liés, commentaires (`DOCUMENT`). Fonctions internes : `confirmFinalize`, `confirmDelete`, `preview`, `openDocumentMail` (mail ou relance, `documentMailOptions` + `useMailComposer`), `createFrom`, `openTimeBilling`. |
| `documentValues(document)`                   | Valeurs du formulaire d’un document stocké (aussi `saved`, le document du cache suivi).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `TotalRow`                                   | Ligne du tableau des totaux (montant en centimes).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `AttachmentsSection({ document, readOnly })` | Section « Pièces jointes » : joindre, ouvrir, retirer (`confirmRemoveAttachment`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### `components/DocumentLinesEditor.tsx` (+ `DocumentLinesEditor.module.css`)

| Élément                          | Rôle                                                                                                                                                                                                                                                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DocumentLinesEditor` (export)   | Lignes d’un document : liste de `LineRow`, ajout d’article, débours, texte, depuis le catalogue (articles non archivés), `extraActions` (temps passé, acompte). Props : `lines`, `totals`, `onChange`, `readOnly`, `vatApplicable`, `currency`, `errors` (chemins `lines.N.label`), `extraActions`, `onCommit` (les lignes peuvent être enregistrées : une ligne quittée, une ligne déplacée, retirée ou ajoutée du catalogue). Utilisé par `DocumentEditor`. |
| `LINE_KIND_LABELS`               | « Article », « Débours », « Texte », « Déjà facturé ».                                                                                                                                                                                                                                                                            |
| `newDocumentLine(kind, vatRate)` | Ligne vierge (débours : forfait, TVA 0).                                                                                                                                                                                                                                                                                          |
| `LineRow`                        | Une ligne (`onLeave` quand le focus la quitte) : badge du type (« Acompte » si liée), libellé, menu (description, déplacer, retirer), quantité, unité, prix, TVA, remise, total, description markdown (`MarkdownEditor` / `MarkdownView`).                                                                                                                             |
| `useLineKeys(count)`             | Clés stables des lignes (sans id) à travers déplacements et retraits.                                                                                                                                                                                                                                                             |
| CSS `.line` / `.kind`            | Fond des lignes texte, bord orange des déductions ; badge non rétréci.                                                                                                                                                                                                                                                            |

### `components/DocumentsTable.tsx`

| Élément                                                                                     | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DocumentsTable` (export)                                                                   | Tableau des documents d’Ordo et importés (`DataTable`, `useDataView`) : colonnes, vues (`first`, par défaut `DOCUMENT_VIEWS`), statut et projet modifiables en place et en lot, pièces jointes, commentaires, actions de ligne et de sélection. Props : `tableKey`, `projectId`, `title`, `documents`, `imported`, `showType`, `showClient`, `empty`, `first`. Utilisé par `AccountingPage`, `ProjectBillingPanel`. |
| `Row`, `rowKey`                                                                             | Ligne étiquetée `ordo` / `imported` et sa clé (`taggedKey`).                                                                                                                                                                                                                                                                                                                                                        |
| `trackingText(row)`                                                                         | Statut en texte (« Brouillon » pour un brouillon).                                                                                                                                                                                                                                                                                                                                                                  |
| `documentColumns(env)`                                                                      | Colonnes (numéro, type, date, mois, échéance, mois d’échéance, client, projet, objet, statut, origine, totaux, reste dû, pièces jointes).                                                                                                                                                                                                                                                                           |
| `DOCUMENT_VIEWS`                                                                            | « Cette année », « L’année dernière », « Tous ».                                                                                                                                                                                                                                                                                                                                                                    |
| `StatusChoice`, `scopeOf(type)`                                                             | Statut choisi avec sa portée ; portée d’un type.                                                                                                                                                                                                                                                                                                                                                                    |
| `ImportedTracking`                                                                          | Cellule statut d’un importé : `StatusMenu` et `DocumentBalanceBadge`.                                                                                                                                                                                                                                                                                                                                               |
| `OrdoActions`                                                                               | Actions d’un document d’Ordo : paiement / remboursement (`openPaymentDialog`), dupliquer (`duplicateRowsAction`, copie en brouillon ouverte), PDF, archiver.                                                                                                                                                                                                                                                                                                            |
| `setTracking`, `deleteImported`, `ordoCells`, `importedCells` (internes à `DocumentsTable`) | Statut sur plusieurs lignes (envoi via `openSentDialog`), suppression d’importés, cellules propres à chaque origine.                                                                                                                                                                                                                                                                                                |

### `components/TrackingPanel.tsx`

| Élément                                                         | Rôle                                                                                                                                                                                                      |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TrackingPanel({ document, onRemind, remindPending })` (export) | Section « Suivi » d’un définitif : statut, retard, envoi, acceptation et devis signé, payé / reste dû / paiements, relances. Ouvre ses formulaires dans le panneau latéral. Utilisé par `DocumentEditor`. |
| `AcceptForm`                                                    | Date d’acceptation et devis signé (`accept`).                                                                                                                                                             |
| `ReminderForm`                                                  | Note d’une relance hors Ordo (`addReminder`) : `Textarea` limité à `PLAIN_TEXT_MAX` (4 000).                                                                                                              |
| `Dialog` (type)                                                 | `payment`, `accept`, `reminder`, `sent`.                                                                                                                                                                  |

### `components/TrackingBadge.tsx`

| Export                                                       | Rôle                                                                                                                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `StatusMenu({ type, current, onSelect, pending, readOnly })` | Badge du statut avec menu des statuts non archivés de la portée (l’actuel gardé) ; badge seul en lecture seule ou sans statut (« Sans statut »). Utilisé par `DocumentsTable`, `ImportedDocumentPage`. |
| `DraftBadge()`                                               | Badge « Brouillon ».                                                                                                                                                                                   |
| `TrackingBadge({ document, editable, onSelect })`            | Statut d’un document (brouillon, ou statut modifiable via `DocumentStatusMenu`) et badge « En retard » / « Expiré ».                                                                                   |

Interne : `DocumentStatusMenu` (statut d’un document d’Ordo, par défaut via `chooseTrackingStatus`), type `TrackedDocument`.

### `components/DocumentBalanceBadge.tsx`

| Export                                              | Rôle                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `DocumentBalanceBadge({ balance, currency, size })` | « Reste … » en orange ou « Réglé » en vert. `DocumentsTable`, `ImportedDocumentPage`. |

### `components/document-cells.tsx`

| Export                                                       | Rôle                                                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `DocumentProjectCell({ document, projects, label, onSave })` | Projet modifiable en place (`EditableSelect`), lecture seule si archivé.                |
| `DocumentAttachmentsCell(props)`                             | Pièces jointes d’un document d’Ordo (ouvrir, retirer, joindre) ou fichier d’un importé. |

Les deux sont utilisés par `DocumentsTable`.

### `components/NewDocumentForm.tsx`

| Export                                                   | Rôle                                                                                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `NewDocumentForm({ type, clientId, projectId, onDone })` | Client et projet, puis création du brouillon avec `fetchNewDocumentDefaults` et ouverture (`useAsyncAction`). Ouvert par `openNewDocument`. |

### `components/DepositInvoiceForm.tsx`

| Élément                                                                       | Rôle                                                                                                                                    |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `DepositInvoiceForm({ quoteId, importedQuoteId, clientId, onDone })` (export) | Facture d’acompte depuis un devis d’Ordo ou importé, pourcentage et aperçu de la ligne ; crée puis ouvre. Ouvert par `openDepositForm`. |
| `QuoteChoice`, `DepositInvoiceFormProps`                                      | Devis proposé (valeur `ordo:<id>` / `imported:<id>`), props.                                                                            |

### `components/DeductDepositMenu.tsx`

| Export                                                                               | Rôle                                                                                                                                                                            |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DeductDepositMenu({ clientId, documentId, lines, currency, vatApplicable, onAdd })` | Bouton « Déduire un acompte » et menu des acomptes restant à déduire (moins les lignes en cours) ; ajoute une ligne de déduction par taux. Rien sans acompte. `DocumentEditor`. |

### `components/DiscountInput.tsx`

| Export                 | Rôle                                                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Discount` (interface) | `value`, `type` (tous deux null sans remise).                                                                                                                                                                                                                             |
| `DiscountInput`        | Montant (`AmountInput`) et choix % / devise (`SegmentedControl`) d’une remise ou d’un acompte ; 0 retire la remise ; % par défaut. Props : `value`, `type`, `currency`, `typeLabel`, `onChange`, et celles d’un champ numérique. `DocumentEditor`, `DocumentLinesEditor`. |

### `components/TimeBillingForm.tsx`

| Élément                    | Rôle                                                                                                                                                                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TimeBillingForm` (export) | Temps terminé non facturé d’un projet sur une période, à cocher, transformé en lignes (`timeLines`) : regroupement, unité, prix (ou tarif du catalogue), heures par jour, arrondi, TVA. `onAdd(lines, time, period)`. Ouvert par `DocumentEditor`. |
| `workOf(entry)`            | Tâches et description d’un temps.                                                                                                                                                                                                                  |
| `BILLING_COLUMNS`          | Colonnes « Jour », « Temps », « Durée ».                                                                                                                                                                                                           |
| `TimeBillingFormProps`     | Props.                                                                                                                                                                                                                                             |

### `components/PaymentForm.tsx`

| Élément                                      | Rôle                                                                                                                                   |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `PayableDocument` (interface, export)        | `id`, `type`, `balance`, `paymentMethods`.                                                                                             |
| `PaymentForm({ document, onDone })` (export) | Attend comptes et réglages de trésorerie (squelette), filtre les moyens du bon sens. Utilisé par `openPaymentDialog`, `TrackingPanel`. |
| `PaymentFields`                              | Formulaire (`documentPaymentSchema`) : compte, date, montant, moyen ; message sans compte.                                             |

### `components/SentForm.tsx`

| Export                                            | Rôle                                                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `SentForm({ sentAt, sentVia, onSubmit, onDone })` | Moyen (Chorus Pro par défaut) et date d’envoi (pas après aujourd’hui). `openSentDialog`, `TrackingPanel`. |

### `components/RecurringForm.tsx`

| Élément                                                     | Rôle                                                                                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RecurringForm({ documentId, recurring, onDone })` (export) | Planification : libellé, première facture, répétition (`RuleField` sans hebdomadaire), validation automatique, active ; nouvelle : « Créer » ; existante : enregistrée champ par champ (`useFieldSave`, libellé en le quittant, `SaveStatus`, récurrente du cache `useRecurringInvoices` suivie, archivée en lecture seule). Ouvert par `openRecurringForm`. |
| `recurringValues(recurring?)`                               | Valeurs du formulaire (aussi `saved`). |
| `FORM_SCHEMA`                                               | `recurringInvoiceSchema` avec une répétition obligatoire (« Choisissez une répétition. »).                                                                               |

### `components/ImportedDocumentForm.tsx`

| Export                                       | Rôle                                                                                                                                                                                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ImportedDocumentForm({ document, onDone })` | Import ou modification d’un document importé (`importedDocumentSchema`) : type, numéro, dates, devise, client ou nom, projet, totaux (TTC recalculé), fichier, description, « Déjà réglée hors trésorerie ». Nouveau : « Importer » ; existant : enregistré champ par champ (`useFieldSave` avec `ON_BLUR`, les trois totaux ensemble `TOTALS`, le fichier choisi envoyé avec les valeurs, `SaveStatus`, document du cache suivi par `useCachedItem` sur `[...accountingQueryKey, 'imported']`, archivé en lecture seule). Ouvert par `openImportForm`. |
| `importedValues(document?)`, `importedInput(values)`, `importedOf(data)` | Valeurs du formulaire (aussi `saved`), entrée de l’API (sans le fichier, nom libre seulement sans client), documents importés des données d’une requête. |

### `components/DocumentsZipForm.tsx`

| Élément                                              | Rôle                                                                                                                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DocumentsZipForm({ onDone, year, years })` (export) | Période (`usePeriodRange`, `PeriodRangeFields`, année civile), types, importés ; télécharge `/api/accounting/documents/zip` (`fetchDownload`). `AccountingPage`. |
| `TYPES`, `ZipPeriod`, `ZIP_PERIODS`                  | Types, périodes proposées.                                                                                                                                       |

### `components/OverdueInvoicesPanel.tsx`

| Élément                             | Rôle                                                                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OverdueInvoicesPanel()` (export)   | Onglet « À relancer » : tableau, sélection (`leading`), choix de la boîte mail, « Non relancées depuis 7 jours », confirmation puis `sendReminders` avec bilan. `AccountingPage`. |
| `REMIND_AFTER_DAYS`                 | 7 jours sans relance.                                                                                                                                                             |
| `daysSinceReminder(invoice, today)` | Jours depuis la dernière relance.                                                                                                                                                 |
| `OVERDUE_COLUMNS`                   | Colonnes facture, client, envoi, reste dû, dernière relance, destinataire.                                                                                                        |

### `components/CatalogPanel.tsx`

| Élément                             | Rôle                                                                                                                                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CatalogPanel()` (export)           | Onglet « Catalogue » : tableau modifiable en place et en lot, « Afficher les archivés » (`useArchivedToggle`), nouvel article, archivage, suppression, commentaires. `AccountingPage`. |
| `CATALOG_COLUMNS`                   | Article, nature, unité, prix HT, TVA.                                                                                                                                                  |
| `CatalogItemForm({ item, onDone })` | Formulaire d’un article (`catalogItemSchema`) et ses commentaires (`CATALOG_ITEM`) ; nouveau : « Ajouter » ; existant : enregistré champ par champ (`useFieldSave`, libellé, description et prix en les quittant, `SaveStatus`, article du cache suivi, archivé en lecture seule). `catalogValues(item?, vatApplicable?)` donne ses valeurs.                                                                                                    |

### `components/CompanySettings.tsx`

| Élément                      | Rôle                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `CompanySettings()` (export) | Onglet « Ma société » : profil (`CompanyForm`) et `NumberingSettings`. `AccountingPage`.                                         |
| `companyValues(profile)`     | Valeurs du formulaire.                                                                                                           |
| `CompanyForm({ profile })`   | Profil (`companyProfileSchema`) : identité et logo, adresse (`AddressFields` par `fieldProps`), coordonnées, TVA, RIB, conditions par défaut ; enregistré champ par champ (`useFieldSave` avec `ON_BLUR`, `SaveStatus`), sans bouton. |
| `NumberingSettings()`        | Prochain numéro de chaque type pour une année, aperçu (`documentNumber`), « Enregistrer » par type : la seule exception voulue à l’enregistrement champ par champ, un compteur de numéros se change par une validation délibérée, pas en tapant.                                        |

### `components/DocumentStatusSettings.tsx`

| Élément                              | Rôle                                                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DocumentStatusSettings()` (export)  | Onglet « Suivi » : statuts des devis et des factures. `AccountingPage`.                                                                          |
| `DESCRIPTIONS`                       | Textes d’aide par portée.                                                                                                                        |
| `ScopeStatuses({ scope, statuses })` | `SettingsList` (`DOCUMENT_STATUS`) avec champ « Catégorie » et nombre de documents par statut (voir [Paramètres](../../components/settings.md)). |

### `components/ClientBillingSection.tsx`

| Élément                                       | Rôle                                                                                                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ClientBillingSection({ clientId, readOnly? })` (export) | Section « Facturation » d’un client : carte du client, contacts sans service, cartes des services ; boutons « Coordonnées », « Nouveau service », « Nouveau contact ». `readOnly` (client archivé) : panneaux en lecture seule (« Voir »), ni ajout ni suppression ; donné aux panneaux comme source suivie (`useLiveSource`, interface interne `RowReadOnly` de `ContactRow` / `ServiceCard`) : un panneau ouvert passe en lecture seule quand le client est archivé ailleurs. `ClientPage`. |
| `ContactInfo`                                 | Adresse (`addressLines`, `countryName`), email et téléphones (`ContactLines`), site (lien seulement en http(s)).                                                                                        |
| `ContactRow`                                  | Un contact, modifier ou supprimer (confirmation).                                                                                                                                    |
| `ServiceCard`                                 | Un service et ses contacts ; ajouter un contact, modifier, supprimer.                                                                                                                |

### `components/ClientPartyForms.tsx`

| Élément                                                              | Rôle                                                                                          |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `ClientDetailsForm({ client, readOnly? })` (export)                     | Coordonnées de facturation (`clientDetailsSchema`), champs selon professionnel / particulier ; enregistrées champ par champ (`useFieldSave` avec `DETAILS_ON_BLUR`, adresse et téléphones par `fieldProps`, erreurs par `nestedErrors`, client du cache `useClientBilling` suivi), sans bouton. |
| `ClientServiceForm({ clientId, service, onDone, readOnly? })` (export)          | Service (`clientServiceSchema`) ; nouveau : « Ajouter » ; existant : enregistré champ par champ (même façon).                                                              |
| `ClientContactForm({ client, contact, serviceId, onDone, readOnly? })` (export) | Contact (`clientContactSchema`), service facultatif ; nouveau : « Ajouter » ; existant : enregistré champ par champ (le service dès qu’il change).                                          |
| `detailsValues(client)`, `serviceValues(service?)`, `contactValues(contact?, serviceId?)` | Valeurs des formulaires (aussi `saved`). |
| `DetailsValues`, `ServiceValues`, `ContactValues`, `PartyPanelProps`                    | Valeurs des formulaires ; `readOnly` (client archivé) : `LiveSource<boolean>` lue par `useLiveValue`, suivie le panneau ouvert.                                                                      |

Utilisés par `ClientBillingSection`.

### `components/AddressFields.tsx`

| Export                                               | Rôle                                                                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `AddressFields({ legend, value, onChange, errors, onBlur? })` | Adresse postale : jusqu’à 4 lignes, code postal, ville, région, pays (`COUNTRY_OPTIONS`). `onBlur` : un champ quitté, une ligne retirée, un pays choisi (l’adresse est alors enregistrée). `CompanyForm`, `ClientPartyForms`. Les téléphones : `ContactListField` `kind="phones"` (`components/inputs`, voir [Champs](../../components/inputs.md#contactlistfield)). |

### `components/ProjectBillingPanel.tsx`

| Export                                                     | Rôle                                                                                                                                                                                      |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProjectBillingPanel({ clientId, projectId, projectIds })` | « Documents comptables » d’un projet, ou d’un client et de ses projets (`projectIds` : filtre local) ; « Nouveau document » préremplissant client et projet. `ProjectPage`, `ClientPage`. |

### `components/ProjectResourcesPanel.tsx`

| Élément                                         | Rôle                                                                                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ProjectResourcesPanel({ projectId })` (export) | Ressources d’un projet : ajout de fichiers et de liens, déplacement, modification, suppression (confirmation). `ProjectPage`. |
| `linkIcon(url)`                                 | Icône Figma, GitHub, GitLab ou lien.                                                                                          |
| `ResourceForm({ projectId, resource, onDone })` | Libellé, adresse (liens), note multiligne (`Textarea`, 4 000 caractères) (`projectLinkSchema`) ; nouveau lien : « Ajouter » ; ressource existante : enregistrée champ par champ, chaque champ en le quittant (`useFieldSave`, `SaveStatus`, ressource du cache suivie). `resourceValues(resource?)` donne ses valeurs. |

## lib

### `lib/labels.ts`

| Export                                                                | Rôle                                                                                                 |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `DOCUMENT_TYPE_LABELS`, `documentName`, `documentTitle`, `DRAFT_NAME` | Réexportés de `@ordo/shared` (voir [Partagé : facturation](../../../shared/finances/accounting.md)). |
| `isFeminineDocumentType(type)`                                        | Type au féminin (factures) pour les messages d’archivage.                                            |
| `CLIENT_KIND_LABELS`                                                  | « Professionnel », « Particulier ».                                                                  |
| `NEW_DOCUMENT_TITLES`                                                 | « Nouveau devis », « Nouvelle facture »…                                                             |
| `THE_DOCUMENT_TYPE`                                                   | « Le devis », « La facture »…                                                                        |
| `EMPTY_DOCUMENTS`                                                     | Messages vides par type.                                                                             |
| `vatRateOptions(current)`                                             | Options de TVA : taux usuels plus le taux actuel.                                                    |

### `lib/new-document.tsx`

| Export                           | Rôle                                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `openDepositForm(preset?)`       | Ouvre `DepositInvoiceForm` dans le panneau latéral.                                            |
| `openNewDocument(type, preset?)` | Ouvre `NewDocumentForm` (ou `openDepositForm` pour un acompte).                                |
| `newDocumentMenu(preset?)`       | Entrées du menu « Nouveau document » : un type chacun, puis « Importer un document existant ». |

### `lib/imported-form.tsx`

| Export                      | Rôle                                                   |
| --------------------------- | ------------------------------------------------------ |
| `openImportForm(document?)` | Ouvre `ImportedDocumentForm` (import ou modification). |

### `lib/payment-dialog.tsx`

| Export                        | Rôle                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `openPaymentDialog(document)` | Ouvre `PaymentForm` (« Paiement de … » / « Remboursement de … »). `DocumentsTable`. |

### `lib/recurring-form.tsx`

| Export                       | Rôle                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `openRecurringForm(options)` | Ouvre `RecurringForm` (« Rendre la facture récurrente » / « Facture récurrente »). |

### `lib/sent-dialog.tsx`

| Export                                              | Rôle                                                                                                                                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openSentDialog(options)`                           | Ouvre `SentForm` avec un titre et une sauvegarde.                                                                                                                                                             |
| `chooseTrackingStatus(document, status, mutations)` | Applique un statut ; un statut « Envoyé » demande d’abord quand et comment. Fonctionne avec les mutations d’Ordo ou des importés (type interne `TrackingMutations`). `TrackingBadge`, `ImportedDocumentPage`. |

### `lib/document-pdf.tsx`

| Élément                                  | Rôle                                                                                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `pdfUrl(id, download?, paid?)` (export)  | Adresse du PDF (`/api/accounting/documents/:id/pdf`, `?download=1`, `?paid=1`).                                                               |
| `openPdfPreview(id, title)` (export)     | Ouvre le PDF régénéré (horodatage dans l’adresse) dans le lecteur de fichiers.                                                                |
| `documentMailOptions(document)` (export) | Options du rédacteur : destinataire, objet, texte (ou mail de relance via `reminderMail`), PDF et pièces jointes, `onSent`. `DocumentEditor`. |
| `fetchFile(url, name)`                   | Télécharge un fichier d’Ordo comme `File`.                                                                                                    |
| `DocumentMail`, `PHRASES`                | Ce que le mail demande ; libellés et articles par type.                                                                                       |

### `lib/time-lines.ts`

| Export                        | Rôle                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `TimeGrouping` (type)         | `TOTAL`, `DAY`, `TASK`, `ENTRY`.                                                                                            |
| `BillableTime` (interface)    | Temps à facturer : jour, secondes, description, tâches.                                                                     |
| `timeLines(entries, options)` | Lignes facturant du temps (voir [Règles](../../../business-rules/finances/accounting.md#temps-facturé)). `TimeBillingForm`. |

Internes : `TimeLineOptions`, `quantityOf` (heures ou jours, arrondi au quart d’heure), `doneList` (descriptions en liste markdown).

### `lib/countries.ts`

| Export              | Rôle                                               |
| ------------------- | -------------------------------------------------- |
| `countryName(code)` | Nom français d’un code pays (`Intl.DisplayNames`). |
| `COUNTRY_OPTIONS`   | Pays ISO 3166-1 triés par nom. `AddressFields`.    |

### `lib/remove-attachment.ts`

| Export                                                      | Rôle                                                                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `confirmRemoveAttachment(attachment, documentName, remove)` | Confirmation destructive puis retrait d’une pièce jointe, avec toast. `DocumentEditor`, `DocumentAttachmentsCell`. |

## Briques partagées réutilisées

Le dossier s’appuie sur les briques communes plutôt que sur des variantes : `DataTable`, `useDataView`, `bulkSaver`, `RowActions`, `EditableCells` ([Tableau de données](../../components/data-table.md)), `openFormPanel`, `openModal` ([Panneaux](../../components/panels.md)), `confirmDestructive`, `FormActions` ([Dialogues](../../components/dialogs.md)), `ActionButton`, `IconAction`, `InlineActions`, `ActionsMenu` ([Actions](../../components/actions.md)), `EmptyState`, `NoticeAlert`, `ArchivedBadge`, squelettes ([Retours](../../components/feedback.md)), `AmountInput`, `QuantityInput`, `date-range` ([Champs](../../components/inputs.md)), `MarkdownEditor`, `MarkdownView` ([Markdown](../../components/markdown.md)), `SettingsSection`, `SettingsList` ([Paramètres](../../components/settings.md)), `useAppForm`, `formCallbacks`, `lib/notify`, `lib/archive`, `lib/format` ([Bibliothèque web](../../lib.md)).
