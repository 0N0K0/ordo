# Code web : mails

Tous les fichiers de `apps/web/src/features/mail/` (api, pages, components, hooks, lib) et ce qu’ils exportent, avec leur rôle et leurs utilisateurs. Fonctionnalités : [Mails](../../../features/resources/mail.md) ; règles : [Règles métier des mails](../../../business-rules/resources/mail.md).

## Vue d’ensemble

- `api/index.ts` : toutes les requêtes et mutations GraphQL des mails, sous la clé de cache `['mail']` ; chaque mutation invalide tout `['mail']`.
- `pages/MailPage.tsx` : la page `/mail` (trois colonnes, état dans l’URL).
- `components/` : navigation (boîtes, dossiers, dossiers de recherche), listes, lecteur, rédaction, paramètres, onglet projet, surveillance des nouveaux mails.
- `hooks/` : ouverture de la rédaction, recherche dans l’URL, sélection d’une page, adresses de l’utilisateur.
- `lib/` : options de rédaction (réponse, transfert, brouillon), formats d’affichage, tris et filtres, glisser-déposer, relevé à la demande.

Briques partagées utilisées (non décrites ici) : `ActionButton`, `IconAction`, `ActionsMenu`, `InlineActions`, `RemoveButton`, `FoldButton`, `FoldHeading` ([actions](../../components/actions.md)) ; `confirmDestructive`, `FormActions`, `openLabelForm` ([dialogs](../../components/dialogs.md)) ; `EmptyState`, `ErrorAlert`, `ListSkeleton`, `DetailSkeleton`, `CountBadge`, `NoticeAlert`, `ArchivedBadge` ([feedback](../../components/feedback.md)) ; `openFormPanel`, `openModal` ([panels](../../components/panels.md)) ; `useDragSensors`, `innermostCollision`, `suppressClickAfterDrop`, `DragLabel` ([dnd](../../components/dnd.md)) ; `SettingsList`, `SettingsSection` ([settings](../../components/settings.md)) ; `BatchMultiSelect`, `StateSwitch`, `LabeledField`, `dateRangeProps`, `formRange` ([inputs](../../components/inputs.md)) ; `useFoldedIds` ([tree](../../components/tree.md)) ; `PageHeader`, `SectionHeader` ([page](../../components/page.md)) ; `FileBadge`, `ItemAvatar`, `ItemBadge`, `listSelectProps` ([items](../../components/items.md)) ; `PersonAvatar` ([people](../../components/people.md)) ; `useAppForm`, `formCallbacks`, `notifySuccess`, `unarchived`, `useSetParams`, `taggedKey`… ([lib](../../lib.md)).

## api

### `api/index.ts`

Types :

| Export                                                    | Rôle                                                                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `MailAccount`                                             | Fragment `MailAccountFields` (réglages d’une boîte, `archived`, signature, sans mots de passe). |
| `MailView`                                                | Fragment `MailViewFields` (mail lu sur le serveur, `linkedProjectIds`).                         |
| `LinkedMail`                                              | Fragment `LinkedMailFields` (copie d’un mail dans un projet).                                   |
| `MailDraft`                                               | Résultat de la requête `MailDraft`.                                                             |
| `MailAccountInput`, `SaveMailDraftInput`, `SendMailInput` | Ré-export des types d’entrée générés.                                                           |
| `MailSearch`                                              | Un dossier de recherche (`mailSearches`).                                                       |
| `MailLabel`                                               | Un drapeau (`mailLabels`).                                                                      |
| `ScheduledMail`                                           | Un envoi programmé (`scheduledMails`).                                                          |

Constantes et fonctions :

| Export           | Rôle                                                                  | Utilisé par                     |
| ---------------- | --------------------------------------------------------------------- | ------------------------------- |
| `mailQueryKey`   | `['mail']`, racine du cache des mails.                                | `MailReader`, hooks ci-dessous. |
| `fetchMailDraft` | Charge un brouillon (`{ accountId, folder, uid }`) pour le reprendre. | `MailReader`.                   |

Documents GraphQL internes : `MailAccountsDocument`, `MailFoldersDocument`, `MailMessagesDocument`, `MailMessageDocument`, `UnreadMailCountDocument`, `TodoMailCountDocument`, `ProjectMailsDocument`, `TestMailAccountDocument`, `CreateMailAccountDocument`, `UpdateMailAccountDocument`, `SetMailSignatureDocument`, `DeleteMailAccountDocument`, `MoveMailAccountDocument`, `SetMailSeenDocument`, `DeleteMailsDocument`, `LinkMailDocument`, `UnlinkMailDocument`, `MailDraftDocument`, `SaveMailDraftDocument`, `DeleteMailDraftDocument`, `SendMailDocument`, `MailLabelsDocument`, `ScheduledMailsDocument`, `MarkMailsDocument`, `ReportMailSpamDocument`, `MoveMailsDocument`, `CreateMailFolderDocument`, `RenameMailFolderDocument`, `DeleteMailFolderDocument`, `CreateMailLabelDocument`, `UpdateMailLabelDocument`, `DeleteMailLabelDocument`, `ScheduleMailDocument`, `SendScheduledMailDocument`, `CancelScheduledMailDocument`, `MailSearchesDocument`, `MailSearchResultsDocument`, `MailAdvancedSearchDocument`, `MoveMailFolderDocument`, `CreateMailSearchDocument`, `UpdateMailSearchDocument`, `DeleteMailSearchDocument`. Fonctions internes : `fetchSearches`, `fetchLabels`, `fetchScheduled`, `useMailMutation` (mutation qui invalide `mailQueryKey`, via `useInvalidatingMutation`).

Requêtes (hooks) :

| Hook                                   | Clé / comportement                                                                                                                                                                           | Utilisé par                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `useMailAccounts()`                    | `['mail','accounts']`.                                                                                                                                                                       | Presque tous les composants ; accueil, comptabilité. |
| `useMailFolders(accountId)`            | `['mail','folders',id]`, relu toutes les 10 min (`MAIL_CHECK_MS`), sans nouvel essai ; désactivé si `null`.                                                                                  | `MailPage`, `AccountFolders`, `MailOrganizeActions`. |
| `useMailMessages(params)`              | Page d’un dossier (compte, dossier, page à partir de 0, texte, état, tri, sens) ; garde la page précédente pendant le chargement ; 10 min.                                                   | `MailPage`.                                          |
| `useUnreadMails(accountIds)`           | Non-lus de la réception de chaque boîte (une requête par boîte), réunis du plus récent au plus ancien ; une boîte en erreur n’empêche pas les autres ; renvoie `{ data, isPending, error }`. | `features/home/components/MailCard`.                 |
| `useMailMessage(params)`               | Mail ouvert (le marque comme lu côté API) ; frais 5 min ; sans nouvel essai.                                                                                                                 | `MailReader`.                                        |
| `useUnreadMailCount(enabled)`          | Total des non-lus des réceptions ; 10 min.                                                                                                                                                   | `MailNavBadge`, `HomePage`.                          |
| `useTodoMailCount(enabled)`            | Total des mails à traiter ; 10 min.                                                                                                                                                          | `MailNavBadge`.                                      |
| `useProjectMails(projectId, enabled?)` | Copies rattachées à un projet.                                                                                                                                                               | `MailReader` (depuis un projet, pour détacher).      |
| `useMailSearches()`                    | Dossiers de recherche.                                                                                                                                                                       | `MailSearchFolders`.                                 |
| `useMailSearchResults(params)`         | Résultats d’un dossier (`{ id, page }`) ou d’une recherche avancée (`{ criteria, page, sort?, ascending? }`) ; 10 min ; garde la page précédente.                                            | `MailSearchList`.                                    |
| `useMailLabels()`                      | Drapeaux.                                                                                                                                                                                    | Listes, lecteur, actions, formulaires de recherche.  |
| `useScheduledMails()`                  | Envois programmés ; relu chaque minute.                                                                                                                                                      | `MailPage`, `ScheduledMailsList`.                    |

Mutations :

| Hook                        | Mutations renvoyées                                                                                                                                | Utilisé par                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `useMailAccountMutations()` | `test` (sans invalidation), `create`, `update`, `setSignature`, `remove`, `move`.                                                                  | `MailAccountForm`, `MailAccountsManager`, `SignatureForm`. |
| `useMailActions()`          | `setSeen`, `remove`, `link`, `unlink`, `send`, `saveDraft`, `deleteDraft`, `mark`, `spam`, `move`, `schedule`, `sendScheduled`, `cancelScheduled`. | Lecteur, rédaction, actions, dossiers, envois programmés.  |
| `useMailFolderMutations()`  | `create`, `rename`, `remove`, `move` (dossiers).                                                                                                   | `AccountFolders`.                                          |
| `useMailLabelMutations()`   | `create`, `update`, `remove` (drapeaux).                                                                                                           | `MailLabelsManager`.                                       |
| `useMailSearchMutations()`  | `create`, `update`, `remove` (dossiers de recherche).                                                                                              | `MailSearchForm`, `MailSearchFolders`.                     |
| `useMailRefresh()`          | `{ refresh, fetching }` : `refresh` lance `requestMailCheck()` et invalide `['mail']` ; `fetching` vrai tant qu’une requête mail est en cours.     | `MailHeaderActions`.                                       |

## pages

### `pages/MailPage.tsx`

- `MailPage()` : la page `/mail` (route dans `app/router.tsx`). Lit l’URL (`account`, `folder`, `uid`, `page`, `sort`, `state`, `view`, `search`, et via `useMailSearch` `q`, `adv`, `advanced`) ; remplace une boîte archivée ou inconnue par la première active ; convertit l’ancien `?accounts=1` en `?settings=1`. Rend :
  - sans boîte active : `PageHeader`, `EmptyState`, `MailAccountsManager` ;
  - sinon : `PageSettings` (« Paramètres des mails » : `MailSettings`), `PageHeader` avec `MailHeaderActions`, puis un `DndContext` (capteurs partagés, collision la plus intérieure, clic supprimé après dépôt, `DragOverlay` avec `DragLabel`) contenant la grille : navigation (« Envois programmés » et son badge, `MailSearchFolders`, un `AccountFolders` par boîte active), liste (`ScheduledMailsList`, ou recherche avancée `AdvancedSearchHeader` + `AdvancedSearchPanel` + `MailSearchList`, ou dossier de recherche `MailSearchList`, ou dossier `MailListPane` avec `MailSearchBar`, `MailListControls` / `MailSelectionBar` et des `MailListItem` glissables), et lecture (`MailReader`, clé par mail).
  - La sélection (`usePageSelection`) est liée à boîte, dossier, page, filtre et texte.

### `pages/MailPage.module.css`

Classes partagées par la page et les listes : `page`, `grid`, `gridInner`, `column`, `pane`, `paneScroll`, `listHeader`, `listFooter`, `item` (états `data-active`, `data-unread`, `data-done`, `data-selected`), `sender`, `subject`. Aussi importé par `MailListPane`, `MailListItem`, `ProjectMailsPanel`.

## components

### `components/MailFolders.tsx`

- `AccountFolders({ account, selected, onSelect, onDropped })` : entrée d’une boîte dans la navigation et l’arbre de ses dossiers (pliage retenu par `useFoldedIds('ordo.mail.collapsed.<id>')`, profondeur en retrait, icône par usage spécial, `MailCountBadges` compacts, menu « Nouveau sous-dossier / Déplacer vers… / Renommer / Supprimer », « Nouveau dossier » ; nom contrôlé par `mailFolderNameSchema`, partagé avec l’API). Cible de dépôt pour les mails (`useDndMonitor` → `move`) et pour les dossiers (sur un dossier : sous-dossier ; sur la boîte : premier niveau). `onSelect` reçoit `{ accountId, folder }` ; `onDropped` reçoit les mails déposés. Utilisé par `MailPage`.
- Internes : `FOLDER_ICONS` (icône par usage spécial), `SelectedFolder`, `AccountFoldersProps`, `placeFolder`, `askMove` (panneau « Déplacer « X » », alternative clavier au glisser), `within`, `accepts`, `hidden`, `askCreate`, `askRename`, `askDelete`.
- `FolderDnd({ accountId, folder, draggable, children })` (interne) : rend une ligne de dossier à la fois source de glisser (sauf dossier spécial) et cible de dépôt ; `FolderDndProps` = `ref` et `style`.

### `components/AdvancedSearchPanel.tsx`

- `AdvancedSearchPanel({ accountId, folder, value, onSearch, onClear, onSave })` : formulaire de la recherche avancée (où : « Ce dossier » / « Toute la boîte » / « Toutes les boîtes » ; De, À, Objet, Corps, Du, Au ; drapeaux ; état ; non lus ; pièce jointe). Part de `value` ou d’une recherche « ce dossier ». Utilisé par `MailPage`, `ProjectLiveMails`.
- `AdvancedSearchHeader({ open, onToggle, onQuit, ...groupProps })` : titre « Recherche avancée », « Modifier » / « Masquer les critères », « Quitter ». Mêmes utilisateurs.
- Interne : type `Where` (`folder` | `account` | `everywhere`).

### `components/LinkToProject.tsx`

- `LinkToProject({ accountId, folder, uid, linkedProjectIds })` : bouton « Rattacher à un projet » et sa fenêtre (`ProjectSelect` de `features/tasks`, contexte `useTaskContext`) ; désactivé pour un projet déjà rattaché. Utilisé par `MailReader`.

### `components/MailAccountForm.tsx`

- `MailAccountForm({ account?, onDone })` : formulaire d’une nouvelle boîte (« Ajouter ») ou panneau d’une boîte existante enregistré champ par champ (`useFieldSave`, la boîte entière à chaque fois par `update`, `SaveStatus` ; la boîte du cache `useMailAccounts` suivie) ; schéma `mailAccountFormSchema`, hébergeurs préremplis, « Mêmes identifiants que pour la réception » (recopie IMAP → SMTP et renvoie les erreurs SMTP sur les champs IMAP), « Tester la connexion ». La connexion (`CONNECTION`) s’enregistre ensemble en quittant l’un de ses champs (`connectionProps` ; un interrupteur dès qu’il change), après `passwordsToRetype` (partagé, dans `check` de `useFieldSave`, donc aussi à la fermeture du panneau) : un serveur changé sans son mot de passe met `PASSWORD_AGAIN` sous le mot de passe et n’enregistre rien ; Entrée enregistre les textes. Utilisé par `MailAccountsManager`.
- Internes : `PRESETS` (Gmail, Outlook / Microsoft 365, OVHcloud, Infomaniak, Gandi, IONOS : serveurs, ports, SSL, `saveSent`), `CONNECTION`, `accountValues(account?)`, `toInput(values, sameLogin)`, `saveConnection`, `connectionProps`, `showError`, `applyPreset`.

### `components/MailAccountsManager.tsx`

- `MailAccountsManager()` : section de paramètres « Boîtes mail » : liste (avec archivées sur demande), « Ajouter », « Signature », « Modifier », archiver / restaurer (`archiveEntry`, `useSetArchived('MAIL_ACCOUNT')`), « Retirer » (confirmation). Les formulaires (nouvelle boîte, modification, signature) s’ouvrent dans le panneau latéral large (`openFormPanel`, `lg`). Utilisé par `MailSettings` et `MailPage` (page sans boîte).

### `components/MailBody.tsx` et `MailBody.module.css`

- `MailBody({ html, text })` : corps d’un mail ; HTML dans une `iframe` `sandbox` sans `allow-scripts`, ajustée à la hauteur du contenu ; polices distantes bloquées, images distantes bloquées jusqu’à « Afficher les images » ; texte brut sinon, « Ce mail est vide. ». Utilisé par `MailReader`, `MailComposer` (signature, citation).
- Interne : `frameDocument(html, remoteImages)` (document du cadre, avec sa politique de sécurité et ses styles).
- CSS : `frame`, `text`.

### `components/MailComposer.tsx`

- `MailComposer({ options, onDone })` : rédaction (voir [Rédaction](../../../features/resources/mail.md#rédaction)) : boîte « De » (non archivées), À / Cc / Cci, objet, `RichEditor`, signature, citation repliable, fichiers (envoyés et repris), sauvegarde automatique du brouillon (4 s, sauvegardes en file, version précédente remplacée), avertissement en quittant la page, fermeture avec question (« Fermer le mail »), Échap, « Envoyer », « Programmer » (« Date et heure » : `DateTimeField` `minInstant={earliestSchedule(now)}`, `useNow` toutes les `SCHEDULE_MIN_DELAY_MS` tant qu’il est ouvert ; un moment passé refusé au clic par l’interne `scheduleChosen` (`canScheduleAt`, `SCHEDULE_IN_PAST` sous le champ, état `sendAtError`)). Appelle `options.onSent` après envoi. Utilisé par `useMailComposer`.
- Internes : `EMAIL` (contrôle d’adresse côté web), `AUTOSAVE_MS` (4 000), `schedulePresets()` (cet après-midi, demain matin, premier jour de la semaine de l’espace à 8 h), `RecipientsInput({ label, value, onChange, autoFocus })` (`TagsInput` d’adresses), type `SaveState`, `fields`, `save`, `submit`, `scheduleAt`, `discard`, `requestClose`.

### `components/MailCountBadges.tsx`

- `MailCountBadges({ todo, unread, compact? })` : badges « N à traiter » (orange clair) et « N non lus », chacun seulement s’il est non nul, avec info-bulle. Utilisé par `MailNavBadge`, `AccountFolders`.

### `components/MailHeader.tsx`

- `MailHeader({ subject, from, to, cc, date, actions?, extra? })` : en-tête d’un mail ouvert (objet, avatar, adresses, date, actions à droite, ligne en plus). Utilisé par `MailReader`.
- `MailFiles({ files })` : pièces jointes en `FileBadge` ; PDF et images ouverts dans la visionneuse (`handleFileClick`, `viewableKind`), les autres téléchargés (`downloadUrl`). Utilisé par `MailReader`.

### `components/MailHeaderActions.tsx`

- `MailHeaderActions({ onCompose, composeDisabled? })` : boutons « Relever » (`useMailRefresh`) et « Nouveau mail ». Utilisé par `MailPage`, `ProjectMailsPanel`.

### `components/MailLabelsManager.tsx`

- `MailLabelsManager()` : section « Drapeaux », un `SettingsList` de type `MAIL_LABEL` (schéma `labelFormSchema`). Utilisé par `MailSettings`.

### `components/MailSettings.tsx`

- `MailSettings()` : paramètres des mails : `MailAccountsManager` puis `MailLabelsManager`. Utilisé par `MailPage` (« Paramètres des mails ») et l’onglet « Mails » des paramètres d’un projet.

### `components/MailListControls.tsx`

- `MailListControls({ sorts, sort, onSort, done, onDone? })` : choix du tri et filtre « Tous / À traiter / Traités » (absent sans `onDone`). Utilisé par `MailPage` (`MAIL_SORTS`), `ProjectLiveMails` (`MAIL_SORTS_ACROSS`).

### `components/MailListItem.tsx`

- `MailListItem({ message, labels, ownAddresses, active, ticked, onTick, onOpen, drag?, footer? })` : ligne d’une liste de mails (case, marque « Traité » `YesNoIcon` de `MAIL_DONE_STATES`, correspondant, drapeaux, trombone, date, objet, pied facultatif) ; glissable si `drag` est donné ; ouverture au clic ou à Entrée. Utilisé par `MailPage`, `MailSearchList`.
- Internes : `MailListMessage` (champs affichés), `MailListItemProps`.

### `components/MailListPane.tsx`

- `MailListPane({ top?, selection, toolbar, status?, stale, page, pages, onPage, children })` : cadre d’une liste : en-tête (`top`, case « Tout sélectionner sur la page », barre), lignes défilantes (grisées si `stale`) ou `status` à la place, pagination s’il y a plusieurs pages. Utilisé par `MailPage`, `MailSearchList`.

### `components/MailNavBadge.tsx`

- `MailNavBadge()` : compteurs « à traiter » et « non lus » de l’entrée « Mails » du menu ; rien sans boîte active ou sans compte. Utilisé par `features/projects/components/Sidebar.tsx`.

### `components/MailOrganizeActions.tsx`

- `MailOrganizeActions({ groups, done, labelIds, onMoved?, onManageLabels, noMove? })` : actions d’organisation sur des mails groupés par boîte et dossier : bouton d’état `StateButton` « Traité » (`MAIL_DONE_STATES`, taille `md`), menu « Drapeaux » (drapeaux non archivés, plus ceux déjà posés ; « Gérer les drapeaux… »), spam / pas spam (pas spam quand tous sont dans le dossier des indésirables d’une seule boîte), « Déplacer vers… » (une seule boîte, sauf `noMove`). Utilisé par `MailReader`, `MailSelectionBar`.
- `MailSelectionBar({ groups, done, labelIds, onGone, onClear, onManageLabels, noMove? })` : barre de la sélection : compte, `MailOrganizeActions`, lu / non lu, « Supprimer » (confirmation), « Désélectionner ». Utilisé par `MailPage`, `MailSearchList`.

### `components/MailReader.tsx`

- `MailReader({ accountId, folder, uid, isDraft?, onDeleted, onManageLabels, projectId? })` : lecteur d’un mail : `MailHeader` (badges Traité, drapeaux, projets liés), actions, « Répondre », « Répondre à tous », « Transférer », `LinkToProject` ou « Détacher du projet » (avec `projectId`), brouillon (« Reprendre le brouillon » via `fetchMailDraft` + `splitDraftHtml`, « Supprimer le brouillon »), `MailFiles`, `MailBody`, `Comments` (cible `MAIL`, id = Message-ID). À l’ouverture, invalide les requêtes mail sauf celle du mail. Utilisé par `MailPage`, `ProjectLiveMails`.
- Internes : `sourceOf(mail)` (mail lu → `SourceMail` avec son emplacement), `MailReaderProps`, `confirmUnlink`, `resume`, `confirmDelete`, `confirmDeleteDraft`.

### `components/MailSearchBar.tsx`

- `MailSearchBar({ value, onChange, label, advancedOpen, onToggleAdvanced })` : champ de recherche rapide et bouton « Recherche avancée ». Utilisé par `MailPage`, `ProjectLiveMails`.

### `components/MailSearchFolders.tsx`

- `MailSearchFolders({ selectedId, onSelect })` : section « Dossiers de recherche » de la navigation (ouvrir, « Modifier », « Supprimer » avec confirmation, « Nouveau dossier de recherche »). Utilisé par `MailPage`.
- `MailSearchList({ query, empty?, noMove?, page, onPage, open, onOpen, onOpenGone, onManageLabels })` : résultats d’un dossier de recherche (`{ id }`) ou de critères (`{ criteria, sort?, ascending? }`) : `MailListPane`, sélection par clé `boîte·dossier·uid` (`usePageSelection`), `MailSelectionBar` avec `groupMails`, nombre de mails, badge « Boîte · Dossier » par ligne. Utilisé par `MailPage`, `ProjectLiveMails`.
- Interne : `mailKey(mail)` (clé unique entre boîtes et dossiers), `MailSearchListProps`.

### `components/MailSearchForm.tsx`

- `MailSearchForm({ search?, initial?, onDone })` : formulaire d’un nouveau dossier de recherche (« Créer » ; libellé par défaut « À traiter », ou « Recherche » pour une recherche avancée enregistrée ; `onDone(id?)` reçoit l’id du nouveau dossier) ou panneau d’un dossier existant enregistré champ par champ (`useFieldSave`, le dossier entier par `update`, textes en les quittant, `SaveStatus` ; le dossier du cache `useMailSearches` suivi) ; schéma `mailSearchSchema`. Interne : `searchValues(search)`. Utilisé par `openSearchForm`.

### `components/MailWatcher.tsx`

- `MailWatcher({ workspace? })` : ne rend rien ; toutes les 10 minutes et à chaque `requestMailCheck`, lit les non-lus de la réception de chaque boîte non archivée et annonce les nouveaux (le carillon une fois, `playRingtone`, `systemNotification`, toast `notifyInfo` avec lien ; au-delà de `MAX_MAIL_TOASTS` = 3, un toast récapitulatif). Le premier passage ne fait qu’apprendre les mails présents ; `claim` évite les doublons entre onglets (24 h). Avec `workspace`, lit cet autre espace (`executeIn`), ajoute sa ligne (`workspaceRingLine`, partagé) et ses liens basculent d’espace (`switchWorkspace`). Utilisé par `app/layout/AppLayout.tsx` (espace ouvert) et `features/workspaces/components/ElsewhereNotifier.tsx` (autres espaces notifiés pour `MAILS`).
- Internes : `WatchedMailAccountsDocument`, `WatchedUnreadMailsDocument`, type `UnreadMail`, `MAX_MAIL_TOASTS`, `MailWatcherProps`, `link`, `announce`, `check`.

### `components/ProjectMailsPanel.tsx` et `ProjectMailsPanel.module.css`

- `ProjectMailsPanel({ projectId })` : onglet « Mails » d’un projet : `SectionHeader` (description, `MailHeaderActions` ; rédaction rattachée au projet) et `ProjectLiveMails`. Utilisé par `features/projects/pages/ProjectPage.tsx`.
- `ProjectLiveMails({ projectId })` (interne) : liste et lecteur des mails du projet lus en direct (critères `projectId`, `scope: 'all'`), recherche (`useMailSearch('mail')`), recherche avancée, tri `MAIL_SORTS_ACROSS`, filtre traité, page et mail ouvert en état local, hauteur ajustée (`useFillHeight`) ; « Gérer les drapeaux… » mène à `settingsPath('/mail')`.
- CSS : `panes`, `grid`, `scroll`.

### `components/LazyRichEditor.tsx`

- `LazyRichEditor(props)` : `RichEditor` chargé avec sa bibliothèque d’édition à sa première apparition (`lazyNamed`), `BlockSkeleton` en attendant. C’est lui qu’utilisent `MailComposer` et `SignatureForm` (règle eslint : pas d’import direct de `RichEditor`).

### `components/RichEditor.tsx`

- `RichEditor({ value, onChange, label?, minHeight?, sourceCode?, autoFocus?, error?, onBlur? })` : éditeur Tiptap (Mantine) produisant du HTML : mise en forme, titres, citation, listes, liens, alignement, images envoyées (bouton, dépôt, collage) et redimensionnables, annuler / rétablir, code HTML si `sourceCode`. Le contenu suit `value` quand il change de l’extérieur. `error` : erreur dessous ; `onBlur` : le focus sort de tout l’éditeur (pas de son texte vers sa barre d’outils), pour un enregistrement en le quittant (`fieldProps` de `useFieldSave` ; règle eslint : pas de `onBlur={() => commit(…)}`). Utilisé par `MailComposer`, `SignatureForm`.
- Internes : `uploadImage` (via `uploadAttachment`), `imageUploadError` (« Image non envoyée. »), `UploadImage` (extension image avec envoi).

### `components/ScheduledMailsList.tsx`

- `ScheduledMailsList()` : liste des envois programmés (objet, destinataires, boîte, statut, erreur) avec « Envoyer maintenant » et « Annuler l’envoi (retour aux brouillons) » ; état vide. Utilisé par `MailPage`.

### `components/SignatureForm.tsx`

- `SignatureForm({ account })` : signature HTML d’une boîte (`LazyRichEditor` avec code HTML), enregistrée en quittant l’éditeur (`useFieldSave` sur `signatureFormSchema`, `fieldProps('signature')`, `SaveStatus`, sans bouton ; la boîte du cache suivie) ; un `<p></p>` vide est envoyé comme vide. Utilisé par `MailAccountsManager`.

## hooks

### `hooks/use-mail-composer.tsx`

- `useMailComposer()` : renvoie `(options?: ComposeOptions) => void`, qui ouvre `MailComposer` dans le panneau latéral (`openFormPanel`, taille `lg`, verrouillé), titré « Brouillon », « Transférer », « Répondre » ou « Nouveau mail ». Utilisé par `MailPage`, `MailReader`, `ProjectMailsPanel`, `app/layout/QuickActions.tsx`, `features/accounting/components/DocumentEditor.tsx`.

### `hooks/use-mail-search.ts`

- `useMailSearch(prefix = '')` : recherche d’une liste gardée dans l’URL : texte `q` (saisi et différé de 400 ms), critères avancés `adv` (JSON validé par `mailSearchCriteriaSchema`, `null` si invalide), ouverture `advanced=1` ; avec préfixe, `mailQ`, `mailAdv`, `mailAdvanced`. Renvoie `{ text, debouncedText, setText, advanced, setAdvanced, advancedOpen, setAdvancedOpen }` ; chaque setter accepte d’autres paramètres à changer dans la même entrée d’historique ; `setAdvanced(null)` referme aussi le panneau. Utilisé par `MailPage`, `ProjectLiveMails`.

### `hooks/use-own-addresses.ts`

- `useOwnAddresses()` : ensemble des adresses des boîtes, en minuscules (correspondant affiché « À : … » pour un mail envoyé ; adresses exclues de « Répondre à tous »). Utilisé par `MailPage`, `MailSearchList`, `MailReader`.

### `hooks/use-page-selection.ts`

- `usePageSelection<K>(pageKey)` : mails cochés de la page affichée, oubliés dès que `pageKey` change ; renvoie `{ selected, setSelected, tick }`. Utilisé par `MailPage`, `MailSearchList`.
- `selectionFlags(messages, labels)` : `{ done, labelIds }` des mails cochés (tous traités ; drapeaux présents sur tous). Mêmes utilisateurs.

## lib

### `lib/compose-options.ts`

| Export                                     | Rôle                                                                                                                                                                                           | Utilisé par                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `SourceMail`                               | Mail répondu ou transféré (lu sur le serveur ou copie d’un projet), avec son emplacement facultatif.                                                                                           | `MailReader`.                                                  |
| `MailLocation`                             | `{ accountId, folder, uid }`.                                                                                                                                                                  | `MailComposer`.                                                |
| `SourceFiles`                              | Fichiers d’un mail du serveur à rejoindre (`from`, `files`).                                                                                                                                   | `MailComposer`.                                                |
| `ComposeOptions`                           | Options d’ouverture de la rédaction : boîte, destinataires, objet, corps, signature, citation, fil, projet, transfert, fichiers repris, fichiers joints (`files`), `onSent`, brouillon repris. | `useMailComposer`, `features/accounting/lib/document-pdf.tsx`. |
| `mailHtml(body, signature, quote)`         | HTML d’un mail écrit dans Ordo, parties marquées `data-ordo-part`.                                                                                                                             | `MailComposer`.                                                |
| `splitDraftHtml(html)`                     | Découpe un brouillon en `{ body, withSignature, quote }` ; brouillon écrit ailleurs = tout le corps.                                                                                           | `MailReader`.                                                  |
| `replyOptions(mail, all, own, projectId?)` | Options de « Répondre » / « Répondre à tous ».                                                                                                                                                 | `MailReader`.                                                  |
| `forwardOptions(mail, files, projectId?)`  | Options de « Transférer » (fichiers repris).                                                                                                                                                   | `MailReader`.                                                  |

Internes : `PART` (noms des parties), `bodyOf(mail)` (HTML à citer, texte échappé à défaut), `emails(addresses)`.

### `lib/mail-check.ts`

- `MAIL_CHECK_MS` : 10 minutes, rythme de relevé des requêtes et de `MailWatcher`.
- `requestMailCheck()` : émet l’évènement `ordo:mail-check` (bouton « Relever »).
- `onMailCheck(fn)` : écoute cet évènement ; renvoie la fonction d’arrêt. Utilisé par `MailWatcher`.
- Interne : `EVENT`.

### `lib/mail-dnd.ts`

Le glisser-déposer des mails et des dossiers repose sur les briques communes de `components/dnd` (`useDragSensors`, `innermostCollision`, `suppressClickAfterDrop`, `DragLabel`), comme le reste de l’app.

- `DraggedMails` (`accountId`, `folder`, `uids`), `DraggedFolder` (`path`, `name`, `parent`).
- `MailDrag` : ce qui est glissé (`{ kind: 'mails' }` ou `{ kind: 'folder' }`).
- `MailDrop` : où c’est déposé (un dossier, ou la boîte).
- `mailsDrag(mails)` : données de glisser de mails. Utilisés par `MailPage`, `AccountFolders`.

### `lib/mail-format.ts`

| Export                             | Rôle                                                                                         | Utilisé par                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `Address`                          | Adresse renvoyée par l’API (`name?`, `address`).                                             | Partout dans la feature.                                     |
| `addressLabel(address)`            | « Nom \<adresse\> » ou l’adresse seule.                                                      | `MailHeader`, `forwardOptions`.                              |
| `accountLabel(account)`            | Une boîte affichée partout : « Nom \<adresse\> ».                              | Navigation, rédaction, formulaires ; `OverdueInvoicesPanel`. |
| `senderName(addresses)`            | Nom, sinon adresse du premier ; « (inconnu) » sans adresse.                                  | `MailHeader`, `replyOptions`.                                |
| `MAIL_DONE_STATES`                 | États « Traité » / « À traiter » des mails, « Marquer comme traité » / « Marquer comme à traiter » (`YesNoStates`). | `MailOrganizeActions`, `MailListItem`.                       |
| `correspondent(mail, own)`         | « À : destinataire » pour un mail envoyé d’une adresse de l’utilisateur, sinon l’expéditeur. | `MailListItem`.                                              |
| `listDate(iso)`                    | Heure aujourd’hui, jour court cette année, date complète avant.                              | `MailListItem`.                                              |
| `escapeHtml(text)`                 | Échappe `&`, `<`, `>`, `"`.                                                                  | `compose-options`, `MailReader`, `document-pdf.tsx`.         |
| `prefixedSubject(subject, prefix)` | Préfixe « Re : » ou « Tr : » sans le doubler (Re/Ré/Aw ; Tr/Fw/Fwd).                         | `compose-options`.                                           |
| `movedMailsMessage(count, folder)` | « Mail déplacé dans « X ». » / « N mails déplacés dans « X ». ».                             | `AccountFolders`, `MailOrganizeActions`.                     |

### `lib/mail-groups.ts`

- `MailGroup` : mails d’un dossier d’une boîte (`accountId`, `folder`, `uids`).
- `groupMails(mails)` : regroupe des mails par boîte et dossier (actions sur une sélection de recherche). Utilisé par `MailSearchList` ; le type par `MailOrganizeActions`.

### `lib/mail-list.ts`

- `DoneFilter` : `'all' | 'todo' | 'done'`.
- `DONE_FILTERS` : « Tous », « À traiter », « Traités ». Utilisé par `MailListControls`.
- `MAIL_SORTS` : les huit ordres (`date-desc` … `size-asc`). Utilisé par `MailPage`.
- `MAIL_SORTS_ACROSS` : les mêmes sans la taille (recherches entre dossiers). Utilisé par `ProjectLiveMails`.

### `lib/open-search-form.tsx`

- `openSearchForm(search?, onCreated?, initial?)` : ouvre `MailSearchForm` dans le panneau latéral (« Nouveau dossier de recherche » / « Modifier le dossier de recherche ») ; `onCreated(id)` après création. Utilisé par `MailPage`, `MailSearchFolders`, `ProjectLiveMails`.

## Utilisations hors de la feature

| Fichier                                                   | Ce qu’il utilise                                                        |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| `app/router.tsx`                                          | `MailPage` sur `PAGES.mail.path` (`/mail`).                             |
| `app/pages.ts`                                            | `PAGES.mail`, `mailPath(account, folder, uid?)` (lien vers un mail).    |
| `app/layout/AppLayout.tsx`                                | `MailWatcher` (espace ouvert).                                          |
| `app/layout/QuickActions.tsx`                             | `useMailComposer` (action rapide « Mail », rattachée au projet ouvert). |
| `features/projects/components/Sidebar.tsx`                | `MailNavBadge`.                                                         |
| `features/projects/pages/ProjectPage.tsx`                 | `ProjectMailsPanel` (onglet `mail`).                                    |
| `features/home/pages/HomePage.tsx`                        | `useMailAccounts`, `useUnreadMailCount`.                                |
| `features/home/components/MailCard.tsx`                   | `useMailAccounts`, `useUnreadMails`.                                    |
| `features/workspaces/components/ElsewhereNotifier.tsx`    | `MailWatcher` pour un autre espace.                                     |
| `features/accounting/components/DocumentEditor.tsx`       | `useMailComposer` (envoi d’un document, relance).                       |
| `features/accounting/lib/document-pdf.tsx`                | `ComposeOptions`, `escapeHtml`.                                         |
| `features/accounting/components/OverdueInvoicesPanel.tsx` | `useMailAccounts`, `accountLabel`.                                      |
