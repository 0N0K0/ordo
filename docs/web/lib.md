# Bibliothèque web (`lib`)

Fonctions et hooks transverses de l'application web : client GraphQL, mutations, formulaires, toasts, archivage, formats, dates, téléchargements, paramètres d'URL. Source : `apps/web/src/lib/`. Ces briques ne dépendent d'aucune feature (règle eslint), sauf exceptions connues : `query-client.ts` (lit la session de `features/auth`) et `week.ts` (lit les espaces de `features/workspaces`).

## Données

### `graphql-client.ts`

- `pinWorkspace(id)` : épingle les requêtes de cet onglet à un espace (en-tête `x-ordo-workspace`) ; `null` : suivre le cookie. Le cookie est partagé entre onglets, l'épinglage garde chaque onglet dans son espace. Appelé par `features/workspaces`.
- `GraphQLRequestError` (classe) : erreur de l'API, avec `code` (défaut `INTERNAL_SERVER_ERROR`), `fields` (messages par champ, lus par `showFormError`) et `extensions` (les autres, par exemple `lost` de `CONFIRMATION_REQUIRED`).
- `execute(document, variables?)` : lance une opération GraphQL typée (générée par codegen) sur `/api/graphql`, cookie de session compris, dans l'espace de l'onglet. Des `File` dans les variables envoient une requête multipart (spécification GraphQL multipart, fonctions internes `extractFiles`, `buildBody`).
- `executeIn(workspace, document, variables?)` : la même dans un autre espace (notifications d'un autre espace : mails, agenda).
- `onResponseExtensions(listener)` : suit les `extensions` de toute réponse de l’API qui en a (les automatisations des tâches qu’un changement a appliquées, lues par `TaskAutomationToasts`) ; renvoie de quoi arrêter.
- Erreurs : serveur injoignable → « Le serveur est injoignable. » (code `NETWORK_ERROR`) ; première erreur GraphQL relancée ; réponse vide ou en erreur → « Une erreur inattendue est survenue. ». Fonction interne `request`.

Voir [Erreurs](../business-rules/cross-cutting/errors.md).

### `query-keys.ts`

Clés TanStack Query partagées entre features : `tasksQueryKey`, `doableTasksKey`, `taskAutomationsQueryKey`, `routinesKey`, `timeQueryKey`, `runningTimersQueryKey` (chronos en cours, sous `timeQueryKey`), `accountingQueryKey`, `treasuryKey`, `treasurySettingsKey`, `calendarQueryKey`, `SLOT_DEPENDENT_KEYS`, `birthdaysQueryKey`, `documentOptionsKey` (documents qui peuvent être liés, sous la clé de la facturation que les changements des documents de projet rafraîchissent). Chaque `features/<feature>/api` réexporte les siennes. Elles vivent dans ce module sans import parce que les modules `api` des features s'importent en cycle (tâches → routines → temps → agenda → tâches) : une clé dérivée d'une autre en tête de l'un d'eux pouvait la lire avant qu'elle soit définie (« Q is not iterable » au chargement). Garde eslint : une clé exportée (`…Key`, `…KEYS`) construite à partir d'une autre se déclare ici.

### `query-client.ts`

`queryClient` : client TanStack Query de l'application. Toute erreur `UNAUTHENTICATED` d'une requête ou d'une mutation vide la session (`meQueryKey` à `null`) : les gardes renvoient alors vers la connexion. Fonction interne `handleUnauthenticated`.

Fraîcheur des données :

- Une donnée chargée est réutilisée telle quelle pendant 15 s (`FRESH_MS`) quand une page s'ouvre : passer d'une page à l'autre ne recharge pas ce qui vient de l'être.
- Revenir sur l'application (onglet ou fenêtre qui reprend le focus, réseau retrouvé) recharge toujours ce qui est affiché : un changement fait sur un autre appareil apparaît aussitôt.
- Après toute mutation réussie ici (`handleChanged`), plus rien n'est considéré comme frais : la prochaine page ouverte redemande ses données, quoi que la mutation ait touché.
- Les autres onglets du navigateur sont prévenus (`BroadcastChannel` « ordo-data ») et rechargent aussitôt ce qu'ils affichent.

### `lazy.tsx`

`lazyNamed(load, pick)` : composant chargé à sa première apparition, avec son code et les bibliothèques qu'il est seul à utiliser (une page, la carte, l'éditeur de mail) ; à rendre sous un `Suspense` qui donne son état de chargement. Seule façon de charger un composant à la demande (règle eslint : pas de `lazy` de React en direct).

### `mutation.ts`

- `useInvalidatingMutation(mutationFn, { invalidate, optimistic, background, queue })` : mutation de l'application : la requête, puis les requêtes dont la clé commence par `invalidate` rafraîchies ; `optimistic(queryClient, variables)` change les données affichées tout de suite (requêtes annulées puis remises comme avant en cas d'erreur) ; `background` : la mutation n'attend pas le rechargement ; `queue` (`{ id, superseded? }`, un jeu de réglages enregistré en entier) : les mutations du même `id` passent l'une après l'autre (`scope` de TanStack Query) et les requêtes ne sont rafraîchies qu'après la dernière (un rechargement entre deux enregistrements remontrerait le premier), une mutation qui échoue pendant qu'une plus récente attend ne remet pas les données d'avant (la plus récente les tient) ; avec `superseded(variables)`, une mutation qu'une plus récente attend n'envoie rien et rend `superseded(variables)`. Utilisé avec `queue` par `useSaveMyDaySettings`. Sous toutes les mutations de l'application ; imposée par eslint (`invalidateQueries` dans `onSuccess` interdit).
- `patchQuery(queryClient, queryKey, patch)` : change en place les données d'une requête chargée (changement optimiste).
- `cachedItem(queryClient, queryKey, id, items)` : élément d'un identifiant dans les requêtes d'une clé (et celles qu'elle préfixe), tel que le cache le tient : une copie qui vient d'être enregistrée, une fois sa mutation rafraîchie, pour l'ouvrir (« Dupliquer » enregistre la copie puis ouvre son panneau).
- `useCachedItem(queryKey, items, match)` : même recherche (premier élément qui répond à `match`), suivie à chaque changement du cache (`useSyncExternalStore` sur le cache des requêtes) : l'élément d'un panneau enregistré champ par champ ouvert sur une copie, quelle que soit la requête qui le tient (`saved` de `useFieldSave`). Utilisé par `TimeEntryForm`, `RoutineOccurrenceForm`, `ShoppingForm`, `ImportedDocumentForm`, `EntryForm`, `BudgetForm`. Interne `cachedFind`, partagée avec `cachedItem`.
- `moveToIndex(list, id, index)` : liste avec un élément déplacé à un indice (ordre optimiste d'un glisser-déposer), borné comme le serveur (`movedTo` partagé) ; `null` si l'élément n'y est pas. Voir [Ordre](../business-rules/cross-cutting/ordering.md).

### `live-value.ts`

- `useLiveSource(value)` : source (`LiveSource` : `get`, `subscribe`) d'une valeur du composant, le même objet à chaque rendu, annoncée à chaque changement : donnée au contenu d'un panneau ouvert sur une copie (un panneau ne se rend qu'une fois à son ouverture), pour qu'il suive la valeur sans connaître la requête qui la tient. Utilisé par `SettingsList` (ses éléments, pour `SettingsItemForm`), `ClientBillingSection` (client archivé, pour `ClientPartyForms`).
- `useLiveValue(source?)` : la valeur d'une source, suivie (`useSyncExternalStore`) ; rien sans source. Utilisé par `SettingsItemForm`, `ClientDetailsForm`, `ClientServiceForm`, `ClientContactForm`.
- Interne : `liveStore(initial)`.
À préférer à `useCachedItem` quand le composant qui ouvre le panneau tient déjà la liste à jour (une liste reçue en props, de requêtes différentes selon la liste).

### `search-params.ts`

- `useSetParams()` : change des paramètres d'URL en gardant les autres (`only` : retire les autres), en remplaçant l'entrée d'historique (`push` : en ajoute une) ; valeur `null`, `undefined` ou vide = paramètre retiré.
- `useSearchParam(key)` : `[valeur, setter]` d'un paramètre (null le retire). Imposé par eslint (`useSearchParams()[0].get('…')` interdit).

## Formulaires et actions

### `form.ts`

- `useAppForm({ initialValues, schema })` : formulaire Mantine aux règles de l'application : validation par schéma (zod, `schemaResolver` synchrone) au blur, puis à chaque changement d'un champ qui a une erreur ; pas de validation au montage.
- `showFormError(form, error)` : erreur de l'API : messages par champ sur le formulaire si l'un des champs y est (`GraphQLRequestError.fields`, préfixe avant le premier « . »), sinon un toast.
- `nestedErrors(errors, field)` : erreurs sous un champ du formulaire, par chemin à l'intérieur (`address.city` → `city`, `phones.0.number` → `0.number`) : pour un éditeur d'un objet ou d'une liste (adresse, téléphones, répartition). `CompanyForm`, `ClientPartyForms`, `EntryForm`. Imposé par eslint (pas de `startsWith('champ.')` écrit à la main).
- `formCallbacks(form, message, onDone?, { then })` : `onSuccess` / `onError` de la mutation d'un formulaire : toast de succès (`message`, ou fonction du résultat ; `null` : pas de toast), fermeture (`onDone(result)`), suite (`then`) ; erreur sur les champs (ou en toast, et toujours en toast sans formulaire). ~53 fichiers ; imposé par eslint.
- `useFieldSave(base, { save, schema, saved?, onBlur?, readOnly?, onSaved?, toSaved?, check? })` : panneau de détail d'un élément existant enregistré champ par champ, comme celui des tâches : tous les panneaux de détail d'un élément existant s'enregistrent ainsi, la création reste un formulaire avec son bouton. Prend le formulaire `useAppForm` de l'élément et rend `{ form, saving, commit, settled, fieldProps, commitProps }` (interface `FieldSave`, options `FieldSaveOptions`) :
  - `form` : le même formulaire, dont chaque champ est enregistré dès qu'il change (listes, dates, interrupteurs, `getInputProps` d'un champ de choix, `setFieldValue`, `setValues`), ou en le quittant pour ceux de `onBlur` (textes, nombres, description, liens, lieu ; Entrée dans un texte les enregistre aussi : `onSubmit` remplacé). Les champs passés à `LinksField`, `optionalNumberProps` ou un composant qui prend `form` marchent tels quels.
  - Chaque champ est d'abord vérifié par le schéma, sur toutes les valeurs (une règle entre champs compte) : son erreur s'affiche sous lui (règles de `useAppForm` : en le quittant, puis à chaque changement) et il n'est pas enregistré.
  - Le changement s'affiche tout de suite ; les enregistrements passent l'un après l'autre (`save(changes, values)` : les champs changés et toutes les valeurs telles qu'enregistrées, pour une mise à jour qui prend l'élément entier). Un échec remet le champ comme il était enregistré, dans un toast d'erreur (qui reste) ; une erreur de l'API sur l'un des champs va sous lui (la saisie reste) ; une confirmation refusée (`ActionDeclined`, par exemple `withLossConfirmation`) remet le champ sans toast. `onSaved(result, changes)` suit un enregistrement réussi.
  - `saved` : valeurs de l'élément dans le cache, suivies quand elles changent ailleurs (une cellule, un autre onglet), sauf pour un champ en cours de saisie.
  - `commit(fields)` : vérifie et enregistre des champs tout de suite (un éditeur sans `getInputProps` : la description en la quittant, un lieu choisi, un lien retiré) ; rend `false` quand l'un est invalide (pas enregistré).
  - `check(values, fields)` : erreurs que le schéma ne peut pas trouver, sur les champs sur le point d'être enregistrés (une connexion dont un serveur a changé attend son mot de passe : `MailAccountForm`, `passwordsToRetype`) ; les champs ne sont pas enregistrés, les erreurs dessous.
  - Ce qui n'est pas encore enregistré (un texte tapé sans quitter le champ, tout champ qui diffère de ce qui est enregistré) l'est quand le panneau qui tient le formulaire se ferme (bouton, Échap, clic dehors : un champ invalide le garde ouvert une fois, son erreur dessous), quand le formulaire disparaît (panneau fermé par son contenu ou remplacé, page quittée dans l'app) et quand le navigateur quitte la page (`pagehide`) : `usePanelFlush` (`components/panels`), sans rien à écrire dans les panneaux. Rien en lecture seule ni sur un nouvel élément. Imposé par eslint : pas de `onBlur` qui lit `event.currentTarget.value` dans un panneau enregistré champ par champ (liste `D22_PANELS` de la règle).
  - `fieldProps(field)` : `{ value, onChange, onBlur }` d'un éditeur sans `getInputProps` lié à un champ enregistré en le quittant (une description `MarkdownEditor`, une adresse `AddressFields`, des téléphones ou des adresses mail `ContactListField`, une signature `RichEditor` / `LazyRichEditor`). Imposé par eslint (pas de `onBlur={() => commit(...)}` sur ces éditeurs).
  - `commitProps(field)` : props `getInputProps` du champ plus `onCommit`, enregistré seulement quand le champ annonce sa valeur choisie, quelle que soit la liste `onBlur` : une couleur (`ColorField` : prise dans le nuancier, aussitôt ; tapée, en la quittant). Imposé par eslint (pas de `getInputProps` sur `ColorField` dans un panneau enregistré champ par champ). Utilisé par `ProjectForm`, `ClientForm`, `SettingsItemForm`.
  - `settled()` : promesse tenue une fois les enregistrements demandés passés (réussis ou non) : avant une action sur l'élément tel qu'enregistré (aperçu du PDF, validation d'un document).
  - `toSaved(values)` : les valeurs telles qu'elles sont enregistrées, tirées de celles du formulaire (une ligne vierge retirée : `withoutBlankLines` dans `DocumentEditor`) : comparées aux valeurs enregistrées et envoyées ; le formulaire garde ce qui a été saisi (ses erreurs trouvées dessus, à leur place).
  - `saving` : un enregistrement est en cours (`SaveStatus`).
  - Sans `save` (un nouvel élément) ou en lecture seule : le formulaire tel quel, enregistré par son bouton (`commit` ne fait rien).
  Utilisé par `RoutineForm`, `EventForm`, `RoutineOccurrenceForm`, `TimeEntryForm`, `AlarmForm`, `TaskLinks`, `TaskDescription`, l'effort du panneau d'une tâche (`TaskDetail`), les fiches d'une routine, d'un évènement ou d'une tâche (`SheetLinksField`), les panneaux de l'économat (`ShoppingForm`, `ListForm`, `DeliveryForm`, `SheetFields`) et des finances (`RecurringForm`, `ImportedDocumentForm`, `ResourceForm`, `ClientDetailsForm`, `ClientServiceForm`, `ClientContactForm`, `CatalogItemForm`, `CompanyForm`, `DocumentEditor`, `EntryForm`, `BudgetForm`, `PeriodForm`, `RelationForm`), des ressources et du transversal (`ProjectForm`, `ClientForm`, `MilestoneForm`, `SprintForm`, `ContributorForm`, `ChartEditor`, `MailAccountForm`, `MailSearchForm`, `SignatureForm`, `SettingsItemForm`, `ScheduleForm`, `SlotEditForm`, `LinkForm`) : tous les panneaux de détail de l'app. Imposé par eslint : pas de bouton « Enregistrer » (`FormActions` sans `submitLabel`, ou « Enregistrer… ») dans ces panneaux (liste des composants dans la règle). Seule exception voulue : « Enregistrer » de la numérotation des documents (`NumberingSettings`), qui change un compteur.

### `use-async-action.ts`

`useAsyncAction(action, { success, fallback, onDone, onError })` : action d'un formulaire envoyée au serveur (mutation, téléchargement) : `loading` pendant l'exécution, toast de succès (`success`) puis `onDone(result)`, ou échec en toast (`fallback` défaut « Action impossible. ») ou par `onError`. Rend `{ run, loading }`. Imposé par eslint (un `setLoading(false)` dans `finally` est interdit).

### `notify.tsx`

Toasts (en haut à droite, `Notifications` de `main.tsx`) : une erreur reste jusqu'à fermeture ; les autres se ferment seules (4 s, 8 s avec un titre, du texte à lire ou des actions ; en pause au survol).

- `NotifyAction` (interface) : bouton d'un toast (`label`, `icon` défaut flèche, `onClick`), qui ferme le toast puis agit.
- `notifyInfo({ id, title, lines, actions, icon })` : toast d'information (nouveau mail, nouvelle version) ; un même `id` remplace le toast affiché.
- `notifyAlarm({ id, title, lines, actions, icon, ringing })` : toast d'une alarme ou d'un rappel qui sonne : reste jusqu'à une de ses actions, sans bouton de fermeture, couleur d'avertissement pendant qu'il sonne ; un même `id` le met à jour sur place. Seul `startRinging` l'appelle (garde eslint).
- `closeToast(id)` : ferme un toast (une sonnerie arrêtée dans un autre onglet).
- `notifySuccess(message)` : succès (4 s).
- `notifyWarning(title, message)` : avertissement (8 s).
- `notifyError(message, actions?)` : erreur, titre « Erreur », persistante ; avec ses actions (`NotifyAction`, ex. « Réessayer »), chacune fermant le toast d'abord.
- `onMutationError(error)` : le gestionnaire de tout `onError` (→ `notifyFailure`).
- `ON_ERROR` : `{ onError: onMutationError }`, options d'une mutation sans toast de succès.
- `toastCallbacks(message)` : `onSuccess` (toast) et `onError` d'une mutation sans formulaire ; `message` peut être fait du résultat de la mutation : `{ info }` pour un toast d'information quand rien n'a été fait mais que c'est à dire (« Ce chrono était déjà arrêté. »), `null` pour ne pas afficher de toast.
- `notifyFailure(error, fallback?, actions?)` : échec d'une action quelconque en toast d'erreur : son message, ou « Une erreur inattendue est survenue. » ; une session expirée (`UNAUTHENTICATED`) reste silencieuse (retour à la connexion), une action refusée à sa confirmation (`ActionDeclined`) aussi.
- `ActionDeclined` (classe) : erreur d'une action que l'utilisateur a refusée à sa confirmation (« Action annulée. ») ; elle s'arrête sans toast. Lancée par `withLossConfirmation`.
- `notifyWithUndo(message, onUndo)` : succès avec bouton « Annuler » (8 s).
- `notifyProgress(message)` → `ProgressToast` `{ success, error, failure }` : toast avec roue d’attente, sans bouton de fermeture, pendant une action longue (« Envoi sur GitHub… »), changé sur place en toast de succès ou d’erreur (`failure` : règles de `notifyFailure`, fermé quand l’échec est silencieux) ; écarté entre-temps (glissé), l’issue est montrée dans un nouveau toast.
- Internes : `toastBody` (lignes de texte et boutons `tertiary`), `successToast`, `errorToast` (les toasts de succès et d’erreur, partagés avec `notifyProgress`), `failureMessage` (message d’un échec, `null` quand il est silencieux).

eslint interdit `notifications.show` / `update` hors de ce fichier, `notifySuccess` seul dans un `onSuccess`, `{ onError: onMutationError }` écrit à la main, et `notifyError(error.message)`.

## Archivage (`archive.tsx`)

Voir [Règles : archivage](../business-rules/cross-cutting/archiving.md).

- `ArchivableKind` (type, réexporté du schéma GraphQL) : sortes d'éléments archivables.
- `ARCHIVED_MESSAGE` : « Élément archivé : restaurez-le pour le modifier. » (le même que l'API : le seul message d'un élément archivé, affiché en erreur sous le champ).
- `setArchived(kind, ids, archived, confirmLoss?)` : archive (masqué par défaut, lecture seule) ou restaure des éléments d'une sorte, tous d'un coup (mutation `setArchived` ; `confirmLoss` : occurrences de routines perdues confirmées).
- `useSetArchived(kind, invalidate = [[]], confirmLoss?)` : la mutation, puis les requêtes rafraîchies (par défaut toutes : l'élément peut apparaître dans beaucoup de listes, sélections, filtres) ; `confirmLoss` (`LossConfirmation`, en pratique `withLossConfirmation` des features) demande ce que l'archivage perd quand l'API le refuse sans confirmation (créneaux, types, personnes : `useSlotSourceArchiving`, garde eslint).
- `LossConfirmation` (type) : exécute un changement refusable par `CONFIRMATION_REQUIRED` en demandant d'abord.
- `unarchived(items, keep?, idOf?)` : éléments non archivés, comme une sélection ou un filtre les propose, en gardant les valeurs en cours `keep`. ~90 fichiers ; imposé par eslint (`filter(x => !x.archived)` interdit).
- `ArchivedToggle` (interface) et `useArchivedToggle(items, isArchived?)` : « Afficher les archivés » d'une liste, d'un tableau, d'un tableau de bord : éléments affichés (`shown`), état (`showArchived`) et props de l'interrupteur (`toggle` : `checked`, `onChange`, `count` ; sans archivé, l'interrupteur ne s'affiche pas).
- `archivedMessage(label, archived, { feminine, count, cascade })` : « « Courses » archivée. », « 3 listes restaurées. », avec ce qui est archivé avec (« avec ses projets »).
- `ArchiveMutation` (interface) : `{ mutateAsync }`.
- `archiveWithUndo(mutation, { ids, archived, label, feminine, cascade })` : archive ou restaure, puis toast avec « Annuler » ; échec en toast d'erreur.
- `archiveEntry(element, mutation, id, onDone?)` : entrée « Archiver » / « Restaurer » du menu « … » d'un élément (icône archive ou flèche de retour, `inMenu: true` : « Archiver » n'est jamais un bouton, toujours dans le menu « … »), message « Liste « Courses » archivée. » (type puis libellé) avec annulation. Imposé par eslint (« Archiver » écrit à la main interdit). ~23 fichiers.
- `unarchivedOffered(items, keep?)` : quels nœuds d'un arbre peuvent être choisis (non archivés, plus les valeurs en cours ; un parent archivé reste grisé au-dessus).
- `archivedIds(items)` : ids des éléments archivés.
- `archivedLabel(item, feminine?)` : libellé suivi de « (archivé) » / « (archivée) ».

## Formats (`format.ts`)

Un format par rôle (importé en `fmt`) ; à l'écran la forme lisible, la forme numérique seulement dans les exports. Les dates acceptent un jour calendaire (YYYY-MM-DD, affiché tel quel) ou un instant (affiché à l'heure de Paris, quel que soit le fuseau du navigateur). eslint interdit `Intl.*Format` avec options et `toLocale*String` ailleurs.

| Fonction                       | Exemple                                 | Rôle                                                              |
| ------------------------------ | --------------------------------------- | ----------------------------------------------------------------- |
| `day`                          | « 13 nov. 2026 »                        | Date dans un tableau, une liste, un texte                         |
| `dayInWords`                   | « 13 novembre 2026 », « 1er juin 2026 » | Date dans une phrase, sans jour de semaine                        |
| `dayShort`                     | « 13 nov. »                             | Date de l'année en cours, axe de graphique                        |
| `weekday`                      | « ven. 13 nov. »                        | Jour à planifier (agenda, routines, accueil)                      |
| `dayLong`                      | « vendredi 13 novembre 2026 »           | Titre de jour                                                     |
| `dateTime`                     | « 13 nov. 2026, 14:05 »                 | Instant (créé, envoyé, synchronisé)                               |
| `dateTimeShort`                | « ven. 13 nov., 14:05 »                 | Instant à venir (alarme, envoi)                                   |
| `time`                         | « 14:05 »                               | Heure (24 h)                                                      |
| `month`                        | « novembre 2026 »                       | Mois (YYYY-MM accepté)                                            |
| `monthShort`                   | « nov. 2026 »                           | Mois sur un axe                                                   |
| `exportDay`                    | « 13/11/2026 »                          | Export seulement                                                  |
| `exportDateTime`               | « 13/11/2026 14:05 »                    | Export seulement                                                  |
| `capitalize`                   | « Novembre 2026 »                       | Première lettre en capitale                                       |
| `money(amount, currency)`      | « 1 234,50 € »                          | Montant en unités                                                 |
| `moneyCents(cents, currency)`  | « 1 234,50 € »                          | Montant en centimes (documents comptables), `formatMoney` partagé |
| `currencySymbol(currency)`     | « € »                                   | Symbole après un montant saisi (code ISO pour les autres devises) |
| `moneyCompact`                 | « 1,2 k€ »                              | Montant où la place manque                                        |
| `moneyRound`                   | « 1 235 € »                             | Montant sans centimes (graphique)                                 |
| `count(value)`                 | « 3 », « »                              | Compte dans une colonne ou un export, vide pour 0 (un montant exporté vaut « 0 »)|
| `number(value, decimals = 2)`  | « 1 234,5 »                             | Nombre                                                            |
| `quantity({ quantity, unit })` | « 250 g », « 1,5 kg »                   | Quantité (3 décimales) et unité                                   |
| `percent(value, decimals = 2)` | « 12,5 % »                              | Taux donné en pour cent                                           |
| `fileSize(bytes)`              | « 12 Ko », « 1,5 Mo »                   | Taille de fichier (1 Ko au moins)                                 |
| `daysAgo(days)`                | « aujourd'hui », « il y a 3 jours »     | Ancienneté en jours                                               |
| `daysLate(due, today)`         | « 3 j de retard »                       | Retard                                                            |
| `fromNow(date)`                | « il y a 3 heures », « hier »           | Temps relatif (commentaire)                                       |
| `countdown(seconds)`           | « 12 min », « 2 h », « 3 j »            | Temps jusqu’à un moment, dans sa plus grande unité entière (minutes arrondies au-dessus, 1 min au moins) : pastille « Alarmes » |

`PICKER_FORMATS` : formats d'affichage des sélecteurs de dates Mantine (`D MMM YYYY`, `ddd D MMM YYYY`, `D MMM YYYY HH:mm`, `MMMM YYYY`, `YYYY`), appliqués par défaut dans `app/theme.ts`.

## Dates et périodes

### `dates.ts`

Tout jour et toute heure du web sont ceux de Paris, comme l'API, quel que soit le fuseau du navigateur ; un jour `YYYY-MM-DD` (ou un mois `YYYY-MM`) est gardé tel quel.

- `parisDay(value)` : jour à Paris d'un instant (date, texte ISO ou horodatage), un jour ou un mois tel quel : jour d'un temps, d'une ligne d'un tableau, filtres et groupes par date, colonne « Mois »…
- `parisToday()` : aujourd'hui à Paris (`useToday()` de `use-now.ts` le suit au passage de minuit).
- `parisParts(instant)` : `{ date: 'YYYY-MM-DD', time: 'HH:MM' }` à Paris d'un instant (date ou texte ISO).
- `parisMidnight(day)` : minuit à Paris d'un jour, en date-heure ISO.
- `untilNextParisDay()` : millisecondes jusqu'au prochain jour à Paris, plus une seconde (`refetchInterval` de `useRoutinesData` : rechargées au changement de jour).
- `localDay` : `parisDay` sous son ancien nom, lu seulement par la bibliothèque de documents (à réécrire) ; eslint l'interdit ailleurs.
- Réexports de `@ordo/shared` (seul chemin autorisé par eslint) : `monthOfDay`, `yearOfDay`, `parisInstant` (instant d'un jour et d'une heure de Paris : saisie d'un temps, envoi programmé, coche après coup…).

eslint interdit `.slice(0, 10)`, `.slice(0, 7)`, `.split('T')[0]` et `new Date('…T00:00')`, l'import de `dayIn`, `timeIn`, `zonedInstant`, `parisInstant`, `parisParts` depuis `@ordo/shared`, et la lecture d'une `Date` dans le fuseau du navigateur (`get`/`set` `FullYear`, `Month`, `Date`, `Day`, `Hours`, `Minutes`, `Seconds`, `getTimezoneOffset`, `toDateString`, `toTimeString`, `new Date(année, mois, …)`, `dayjs()` avec ou sans argument, une date et une heure sans fuseau dans `new Date(…)` / `Date.parse(…)`, `Intl.DateTimeFormat()` sans argument, le texte d'une `Date` (`new Date().toString()`, `date.toString()`, `String(new Date())`, `` `${new Date()}` ``) ; règle `PARIS_TIME_RULES` de `packages/shared/eslint-rules.js`, commune au web, au paquet partagé et à l'API) : utiliser ces aides. Voir [Dates](../business-rules/cross-cutting/dates.md).

### `periods.ts`

- `PeriodPreset` (type) et `PERIOD_PRESETS` : périodes des formulaires d'export : « Ce mois-ci », « Le mois dernier », « Ce trimestre », « Le trimestre dernier », « Cette année », « L’année dernière » (libellés `DATE_PERIOD_LABELS` de `@ordo/shared`) et « Dates choisies ».
- `presetRange(preset, today)` : premier et dernier jours (inclus) d'une période prédéfinie.
- `quarterName(day)` : « T4 2026 ».
- `periodName(scale, start)` : « Novembre 2026 », « T4 2026 », « 2026 ».
- `relativePeriodName(scale, previous)` : « Ce mois-ci », « Le trimestre dernier »…
- `PeriodState`, `PERIOD_STATES` et `periodState(start, end, now, { endExclusive })` : où en est une période (sprint, évènement, créneau) : « À venir » (bleu), « En cours » (vert), « Passée » (gris), partout.

### `week.ts`

- `currentWeek()` : semaine de l'espace affiché (premier et dernier jours), lue dans les espaces chargés ; lundi-dimanche (`DEFAULT_WEEK`) avant.
- `calendarFirstDay(week)` : premier jour de la semaine de l'agenda (FullCalendar, 0 = dimanche à 6) ; les sélecteurs de date commencent toujours le lundi (`WeekDatesProvider`).

### `use-now.ts`

`useNow(active, everyMs = 1000)` : heure courante, rafraîchie à intervalle tant que `active` (juste après chaque changement de seconde, de minute… : une heure affichée à la minute n'est jamais en retard), figée sinon. Utilisé par l'horloge de l'en-tête, les chronos, les routines, l'agenda.

`useToday()` : jour courant de l'utilisateur, qui change tout seul à minuit (vérifié chaque minute) : les pastilles du menu (`NavBadges`), l’accueil (`HomePage`) et « Prévu et réalisé » (`PlannedTime`) suivent le jour sans recharger ni naviguer.

## Sonneries (`alarm-sound.ts`)

La banque de sonneries, générées en Web Audio, sans fichier (une brique commune : les alarmes, les mails et `RingtoneSelect` s’en servent).

- `unlockAudioOnGesture()` : crée/reprend l’`AudioContext` au premier `pointerdown` ou `keydown` ; renvoie le nettoyage. Utilisé par `AlarmCenter`.
- `startRingtone(id, { loop, durationMs })` : joue une sonnerie en boucle (toutes les `period` secondes) ou une fois, pendant la durée ; renvoie l’arrêt. Silencieuse tant que l’audio n’est pas débloqué. Seul `startRinging` l’appelle (garde eslint).
- `playRingtone(id)` : une fois (nouveau mail, `MailWatcher`, le carillon).
- `setSettingsRingtone(id)` : la sonnerie des réglages de l’utilisateur (`configureRinging`), jouée par « Écouter » sur « Celle des réglages ».
- `previewRingtone(id)` : « Écouter », depuis le clic (crée l’audio au besoin) ; `null` : la sonnerie des réglages. Seul `RingtoneSelect` l’appelle (garde eslint).
- Internes : `resumedAudio()`, `Note`, `arpeggio(...)`, `RINGTONE_NOTES` (notes et période de chaque sonnerie : carillon 880 / 1 175 / 1 568 Hz, bip carré, marimba triangle, cloche avec harmoniques, réveil alterné, harpe en arpège), `playNotes(context, destination, id)` ; variables de module `audio`, `settingsRingtone`.

## Téléchargements (`download.ts`)

- `download(content, filename)` : enregistre un fichier dans le navigateur (blob, ou data URL convertie en blob).
- `fileName` : réexport de `@ordo/shared`, nom de fichier nettoyé (eslint impose `fileName(titre, extension)`).
- `fetchDownload(url, filename, fallback)` : télécharge un fichier servi par l'API (archive, relevé) ; erreur de l'API (JSON `error` ou texte) relancée.
- `postExport(path, body, filename, fallback?)` : télécharge un export construit par l'API à partir de ce qui est envoyé (PDF d'un tableau, de graphiques, de l'agenda) ; défaut « Le PDF n'a pas pu être créé. ».
- `PdfTableRow` (interface) et `postTablePdf(table)` : PDF d'un tableau (`/api/exports/table.pdf`) : titre, sous-titre, colonnes, lignes (groupes et lignes indentés), alignements.
- `downloadCsv(lines, title)` : CSV pour tableurs français : points-virgules, virgules décimales, UTF-8 avec BOM, textes entre guillemets.

## Texte, liens, ensembles, clés

- `text.ts` : réexports de `@ordo/shared` (seul chemin pour `collator` et `normalize`) : `collator`, `copyName`, `countOf`, `countWith`, `ellipsis`, `fitName`, `nameKey`, `normalize`, `plural`, `sameName` ; et `removedLinksNote(count)` : fin du message d’un changement de projet qui a retiré des liens, « 2 liens retirés. » (rien sans lien), pour les tâches transférées et les routines déplacées (venu de `features/tasks/lib/bulk-label.ts`). Voir [Partagé : core](../shared/cross-cutting/core.md) et [Noms](../business-rules/cross-cutting/naming.md).
- `links.ts` : `linkInputs(links)` : liens d'un élément (évènement, tâche, routine) reçus de l'API, renvoyés en entrée (adresse et libellé seuls). Imposé par eslint. Utilisé par `occurrenceInput` (agenda), `routineInputOf`, `RoutineForm`, `TaskLinks`.
- `sets.ts` : `toggledIn(set, value)` (ensemble avec une valeur basculée), `toggledInList(list, value, on?)` (liste avec une valeur ajoutée en fin ou retirée, ou mise selon `on`). Imposés par eslint.
- `tagged-key.ts` : réexporte de `@ordo/shared` (`core/tagged-key.ts` : les clés des sonneries servent aussi au serveur) `taggedKey(tag, id)` (`<sorte>:<id>`, valeur d'une liste mêlant des sortes : clients et tiers, ids de glisser-déposer), `parseTaggedKey(key)` (l'id peut contenir « : »), `taggedIds(keys, tag)`. Imposés par eslint.

## Mise en page

- `fill-height.ts` : `useRoomBelow(ref, onMeasure)` (place restante sous un élément pour que la page tienne dans la fenêtre, remesurée au redimensionnement et quand le contenu de la page change ; utilisé par `data-table`) et `useFillHeight(minimum = 320)` (ref + hauteur disponible, au moins le minimum ; mails, carte).
- `use-is-phone.ts` : `PHONE_QUERY` (sous le point de rupture tablette, `styles/breakpoints.json`, 48em) et `useIsPhone()` ; `BELOW_DESKTOP_QUERY` (sous le point de rupture `desktop`, 70em) et `useIsBelowDesktop()` : des colonnes côte à côte deviennent des onglets (page « Alarmes »).
- `routine-hours.ts` : `RoutineHoursFields` (type) et `routineHasHoursOf(routine)` : `routineHasHours` sur les champs d’une routine tels que GraphQL les donne (heures, moments, condition, cas) ; sans heure, ses rappels ne sont qu’à une heure du jour. Utilisé par `RemindersCell` (routines) et `ReminderItemPanel` (alarmes).
- `use-color-swatches.ts` : `useColorSwatches()`, la palette des sélecteurs de couleur : nuance 6 de chaque couleur Mantine sauf `dark` et `gray`.
