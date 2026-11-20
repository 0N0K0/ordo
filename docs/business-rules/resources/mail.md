# Règles métier des mails

Règles appliquées par l’API aux mails : boîtes, connexion IMAP/SMTP, dossiers, drapeaux, état « traité », recherches, rédaction, brouillons, envois programmés, rattachement aux projets et pièces jointes. Sources : `apps/api/src/services/mail/**`, `apps/api/src/graphql/modules/mail.ts`, `apps/api/src/routes/mail.ts`, `packages/shared/src/mail/mail.ts`, et le schéma Prisma (`apps/api/prisma/schema.prisma`).

Voir aussi [Mails (fonctionnalités)](../../features/resources/mail.md), [Archivage](../cross-cutting/archiving.md), [Fichiers et pièces jointes](../cross-cutting/files-and-attachments.md), [Tâches de fond](../cross-cutting/background-jobs.md), [Erreurs](../cross-cutting/errors.md).

## Modèle de données

| Modèle             | Rôle                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `MailAccount`      | Boîte : libellé, adresse, nom d’expéditeur, serveurs IMAP/SMTP, mots de passe chiffrés, `saveSent`, signature, position, `archivedAt`. |
| `MailMessage`      | Copie d’un mail rattaché à un projet (exposée en GraphQL sous le nom `LinkedMail`), avec ses pièces jointes (`Attachment`).            |
| `MailLabel`        | Drapeau : libellé, couleur, image, position, `archivedAt`. Unique par espace (`@@unique([workspaceId, label])`).                       |
| `MailSearch`       | Dossier de recherche : libellé, critères (JSON), position.                                                                             |
| `MailMark`         | Drapeaux et état « traité » d’un mail gardés dans Ordo (serveurs sans mots-clés), clé `(accountId, messageId)`.                        |
| `ScheduledMail`    | Envoi programmé : message construit (`raw`, `copy`), destinataires, références, projet, statut, erreur.                                |
| `MailFolderCursor` | Point de reprise du suivi des conversations par dossier : `uidValidity`, `lastUid`.                                                    |

Tout est rangé par espace (`workspaceId`) : chaque espace a ses boîtes, drapeaux, recherches et envois. Les mails eux-mêmes ne sont pas stockés : ils sont lus en direct sur le serveur.

Cascades à la suppression (Prisma) :

- Boîte supprimée : ses `MailMark`, `ScheduledMail` et `MailFolderCursor` sont supprimés ; ses copies `MailMessage` sont **gardées** (`accountId` passe à null).
- Projet supprimé : ses copies `MailMessage` sont supprimées (et leurs pièces jointes).
- Espace supprimé : tout est supprimé.

## Boîtes mail

Source : `apps/api/src/services/mail/accounts.ts`, `secret.ts`, schéma `mailAccountFormSchema` (`packages/shared/src/mail/mail.ts`).

### Validation

| Champ                          | Règle                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| `label`                        | Requis, 250 caractères maximum (« Le libellé est requis. », « 250 caractères maximum. »). |
| `email`                        | Adresse valide (« Adresse email invalide. »).                                             |
| `displayName`                  | 250 caractères maximum ; vide enregistré à null.                                          |
| `imapHost`, `smtpHost`         | Requis, 255 caractères maximum (« Le serveur est requis. »).                              |
| `imapPort`, `smtpPort`         | Entier de 1 à 65 535 (« Port attendu. », « Port invalide. »).                             |
| `imapSecure`, `smtpSecure`     | Booléens.                                                                                 |
| `imapUser`, `smtpUser`         | Requis, 255 caractères maximum (« L’identifiant est requis. »).                           |
| `imapPassword`, `smtpPassword` | 1 000 caractères maximum ; requis à la création (« Le mot de passe est requis. »).        |
| `saveSent`                     | Booléen.                                                                                  |

- En modification, un mot de passe vide garde celui enregistré.
- **Mot de passe lié au serveur** : si l’hôte, le port, l’identifiant ou le chiffrement IMAP (resp. SMTP) change, le mot de passe correspondant doit être ressaisi, sinon erreur sur le champ : « Saisissez à nouveau le mot de passe : le serveur, le port, l’identifiant ou le chiffrement a changé. ». But : ne jamais envoyer un mot de passe enregistré à un autre serveur. La même règle s’applique au test de connexion d’une boîte existante, et le panneau d’une boîte existante la vérifie avant d’enregistrer sa connexion (`passwordsToRetype`, partagé avec l’API).
- Les mots de passe ne sont jamais renvoyés par l’API (`MailAccount` ne les expose pas).

### Chiffrement des mots de passe

- AES-256-GCM avec la clé `MAIL_ENCRYPTION_KEY` (base64, 32 octets) du `.env` de l’API ; valeur stockée « iv.tag.data » en base64.
- Clé absente : « MAIL_ENCRYPTION_KEY manque dans le .env de l’API (générez-la avec « openssl rand -base64 32 »). ».
- Secret chiffré avec une autre clé : « Secret enregistré illisible : la clé MAIL_ENCRYPTION_KEY n’est plus celle qui l’a chiffré. Saisissez-le à nouveau. ».

### Actions

- `testMailAccount` : valide les réglages, se connecte en IMAP puis vérifie le SMTP. Erreurs : « Connexion IMAP refusée : identifiant ou mot de passe incorrect. », « Serveur IMAP injoignable ou en erreur (…). », « Connexion SMTP impossible (…). ».
- `createMailAccount` : ajoute la boîte en fin de liste (position suivante).
- `updateMailAccount` : refusé sur une boîte archivée ; ferme la connexion IMAP en cache.
- `setMailSignature` : refusé sur une boîte archivée ; 100 000 caractères maximum (« Signature trop longue. ») ; HTML nettoyé (voir [Nettoyage HTML](#nettoyage-du-html)) ; vide retire la signature.
- `deleteMailAccount` : retire la boîte d’Ordo (le serveur n’est pas touché) ; ferme la connexion ; copies rattachées aux projets gardées.
- `moveMailAccount` : réordonne (refusé sur une boîte archivée), voir [Ordre](../cross-cutting/ordering.md).
- Archivage par la mutation générique (type `MAIL_ACCOUNT`).

### Boîte archivée

Lecture seule, et plus utilisée :

- refusée (« Élément archivé : restaurez-le pour le modifier. ») pour : modifier, signature, déplacer dans la liste, envoyer, programmer, enregistrer ou supprimer un brouillon, marquer lu / non lu, poser drapeaux ou état « traité », spam, déplacer des mails, supprimer des mails, créer / renommer / déplacer / supprimer des dossiers, annuler un envoi programmé ;
- exclue des compteurs (`todoMailCount`, `unreadMailCount`), du suivi des conversations, des recherches « toutes les boîtes » (elle n’est cherchée que si elle est nommée dans les critères) ;
- ses envois programmés en attente ne partent pas tant qu’elle n’est pas restaurée ; un envoi forcé (« Envoyer maintenant ») échoue et passe en `FAILED`.

## Connexion IMAP

Source : `apps/api/src/services/mail/imap.ts`.

- Une connexion par boîte, ouverte à la demande et gardée 5 minutes d’inactivité ; les opérations d’une boîte passent l’une après l’autre.
- Délais : 15 s pour la connexion et l’accueil du serveur (IMAP), 15 s pour la connexion SMTP.
- Une erreur ou une fermeture de la connexion la retire du cache ; la suivante est rouverte.
- Chaque opération sur un dossier le verrouille, puis le libère quoi qu’il arrive.
- La réception est le dossier `INBOX` (sans tenir compte de la casse) ; elle est nommée « Réception ».
- Un dossier `\Noselect` ou `\NonExistent` n’est pas listé.

## Dossiers

Sources : `apps/api/src/services/mail/reader.ts` (`listFolders`), `organize.ts`.

### Liste

- Ordre : la réception, puis Brouillons, Envoyés, Archives, Indésirables, Corbeille, puis les autres par chemin (ordre alphabétique français).
- Pour chaque dossier : chemin, nom, usage spécial, nombre de non-lus, profondeur, parent, et nombre « à traiter ».
- « À traiter » : mails sans le mot-clé « traité » (ou sans marque « traité » gardée dans Ordo) ; `null` pour Envoyés, Brouillons, Archives, Corbeille, Indésirables.

### Dossiers spéciaux

Trouvés par leur drapeau (RFC 6154), ou sinon par leur nom usuel :

| Usage     | Noms reconnus (insensibles à la casse)                                         |
| --------- | ------------------------------------------------------------------------------ |
| `\Drafts` | drafts, brouillons                                                             |
| `\Sent`   | sent, sent items, sent messages, envoyés, éléments envoyés, messages envoyés   |
| `\Trash`  | trash, deleted, deleted items, deleted messages, corbeille, éléments supprimés |
| `\Junk`   | junk, spam, courrier indésirable, indésirable(s)                               |

Brouillons (« Drafts ») et Indésirables (« Junk ») sont créés s’ils manquent, au besoin.

### Création, renommage, déplacement, suppression

- Nom (`mailFolderNameSchema`, partagé par le web et l’API) : requis, 250 caractères maximum, sans `*`, `%`, `"` ni `\` (« Le libellé est requis. », « 250 caractères maximum. », « Caractères interdits : * % " \ ») ; il ne peut pas contenir le séparateur du serveur (« Le nom ne peut pas contenir « / ». » par exemple).
- Création : au premier niveau ou sous un parent (« Dossier parent » introuvable sinon).
- Renommage : reste sous son parent. Refusé sur la réception et les dossiers spéciaux : « Les dossiers spéciaux ne se renomment pas. ».
- Déplacement (avec ses sous-dossiers) : sous un autre dossier ou au premier niveau. Refusé sur les spéciaux (« Les dossiers spéciaux ne se déplacent pas. »), sous lui-même ou un de ses sous-dossiers (« Un dossier ne peut pas aller dans lui-même ou dans un de ses sous-dossiers. »), si un dossier du même nom existe à la destination (« Un dossier « X » existe déjà à cet endroit. »). Sans changement de parent : rien n’est fait.
- Suppression : supprime le dossier, ses sous-dossiers (les plus profonds d’abord) et **tous leurs mails**, définitivement. Refusée sur les spéciaux : « Les dossiers spéciaux ne se suppriment pas. ».
- Toutes ces actions renvoient le nouveau chemin (sauf la suppression).

## Lecture des mails

Source : `apps/api/src/services/mail/reader.ts`.

### Liste d’un dossier (`mailMessages`)

- 50 mails par page (`PAGE_SIZE`), pages à partir de 0 (une page négative vaut 0).
- Recherche texte : objet, expéditeur, destinataires ou corps (recherche IMAP du serveur).
- Filtres : non-lus seulement ; état `all` (défaut), `todo`, `done` (toute autre valeur vaut `all`).
- Tri (`mailSortBy`) : `date` (défaut, valeur inconnue = date), `correspondent`, `subject`, `size` ; descendant par défaut.
  - Par date : ordre d’arrivée (UID).
  - Par objet : sans les préfixes « Re: », « Fwd: », « Fw: », « Tr: » répétés.
  - Par correspondant : nom, sinon adresse du premier expéditeur.
  - Entre égaux : le plus récent d’abord.
- Résumé d’un mail : UID, objet (« (sans objet) » si vide), expéditeurs, destinataires, date (en-tête, sinon date de réception), lu, marqué (`\Flagged`), pièces jointes (une partie `attachment` dans la structure), drapeaux, traité.

### Ouverture d’un mail (`mailMessage`)

- Télécharge et analyse le mail ; « Mail » introuvable sinon.
- **Le marque comme lu** (un échec est ignoré).
- Renvoie Message-ID, In-Reply-To, References (sans chevrons), objet, De, À, Cc, Reply-To, date, HTML nettoyé, texte, pièces jointes, drapeaux, traité, et `linkedProjectIds` (projets ayant une copie de ce Message-ID).
- Les images intégrées (`cid:`) pointent vers `/api/mail/:accountId/attachment?folder=…&uid=…&index=…`.
- Pièces jointes numérotées dans l’ordre ; sans nom : « sans-nom-N » ; `inline` quand c’est une image liée avec un Content-ID.

### Lu / non lu, suppression

- `setMailSeen` : ajoute ou retire `\Seen`.
- `deleteMails` : déplace dans la corbeille ; si les mails sont déjà dans la corbeille, ou si la boîte n’en a pas, ils sont **supprimés définitivement**. Les copies rattachées aux projets restent.

### Compteurs

- `unreadMailCount` : non-lus de la réception de chaque boîte non archivée.
- `todoMailCount` : somme des « à traiter » de tous les dossiers de chaque boîte non archivée (hors Envoyés, Brouillons, Archives, Indésirables, Corbeille).
- Une boîte injoignable compte pour 0.

## Drapeaux et état « traité »

Sources : `apps/api/src/services/mail/keywords.ts`, `organize.ts`.

### Stockage

- Quand le dossier accepte les mots-clés IMAP (PERMANENTFLAGS contient `\*`) :
  - état « traité » = mot-clé `$OrdoDone` ;
  - drapeau = mot-clé `$Ordo_<id du drapeau>` (lu sans tenir compte de la casse).
- Sinon : une ligne `MailMark` par `(boîte, Message-ID)` garde les drapeaux et l’état. Les marques suivent le mail d’un dossier à l’autre (clé par Message-ID). Un mail sans Message-ID ne peut pas être marqué sur un tel serveur.

### `markMails`

- Ajoute / retire un drapeau (`labelId`, `on`, `true` par défaut), ou fixe l’état « traité » (`done`, `true` par défaut).
- Un drapeau archivé ne peut plus être posé (« Élément archivé… ») mais peut être retiré ; un drapeau inconnu : « Drapeau » introuvable.

### Drapeaux (`MailLabel`)

- Service de libellés commun (`createLabelService`) : libellé requis de 250 caractères maximum, couleur requise, unique dans l’espace (« Un drapeau porte déjà ce libellé. »), position en fin de liste, modification refusée s’il est archivé. Voir [Noms et libellés](../cross-cutting/naming.md).
- Suppression : le drapeau est retiré des marques gardées dans Ordo ; ses mots-clés restent sur les mails du serveur, inutilisés.

### Spam (`reportMailSpam`)

- Spam : mots-clés `$Junk` ajouté et `$NotJunk` retiré (indication pour le filtre du serveur, ignorée si refusée), puis déplacement dans le dossier des indésirables (créé « Junk » s’il manque).
- Pas spam : l’inverse, et retour dans la réception.
- Renvoie le dossier où sont maintenant les mails ; pas de déplacement s’ils y sont déjà.

### Déplacement (`moveMails`)

- Dans la même boîte uniquement ; sans effet si la cible est le dossier d’origine ou sans mail ; « Dossier » introuvable si la cible n’existe pas.

## Recherche et dossiers de recherche

Sources : `apps/api/src/services/mail/searches.ts`, `mailSearchCriteriaSchema` et `mailSearchSchema` (`packages/shared/src/mail/mail.ts`).

### Critères

| Critère                         | Règle                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accountIds`                    | 50 au maximum ; vide = toutes les boîtes non archivées.                                                                                           |
| `scope`                         | `inbox` (réceptions), `all` (tous les dossiers sauf Corbeille, Indésirables, Brouillons, Envoyés), `folder`.                                      |
| `folder`                        | 500 caractères maximum ; avec `folder`, requis et une seule boîte : « Choisissez le dossier (d’une seule boîte). ».                               |
| `state`                         | `all`, `todo`, `done`.                                                                                                                            |
| `labelIds`                      | 50 au maximum ; un mail ayant **l’un** de ces drapeaux.                                                                                           |
| `unread`                        | Non-lus seulement.                                                                                                                                |
| `text`                          | 250 caractères maximum ; dans l’objet, l’expéditeur, les destinataires ou le corps.                                                               |
| `from`, `to`, `subject`, `body` | 250 caractères maximum chacun.                                                                                                                    |
| `since`, `until`                | Jours (YYYY-MM-DD) inclus ; la fin doit suivre le début (« La fin doit suivre le début. », sur `until`, voir [Dates](../cross-cutting/dates.md)). |
| `attachments`                   | Avec pièce jointe seulement.                                                                                                                      |
| `projectId`                     | Mails dont une copie est dans ce projet (100 caractères maximum).                                                                                 |

Valeurs d’une nouvelle recherche (`EMPTY_MAIL_SEARCH`) : toutes les boîtes, réceptions, état « tous », rien d’autre.

### Exécution

- Chaque boîte retenue est lue ; une boîte injoignable est ignorée (avertissement dans le journal), sans faire échouer la recherche.
- Dans chaque dossier, seuls les **200 mails les plus récents** correspondant aux critères serveur sont retenus (sauf pour un projet : tous ses mails).
- Sans mots-clés sur le serveur, l’état et les drapeaux sont filtrés avec les marques gardées dans Ordo (sur au plus 1 000 mails récents du dossier).
- « Avec pièce jointe » est filtré d’après la structure des mails retenus.
- Recherche d’un projet : seulement les boîtes ayant des copies du projet ; dossiers sauf Corbeille, Indésirables, Brouillons (**les Envoyés compris**) ; les mails sont retrouvés par leur en-tête Message-ID (25 par requête). Sans copie : résultat vide.
- Résultats de toutes les boîtes réunis, triés (date par défaut, descendant), paginés par 50. Tri possible sur `date`, `correspondent`, `subject` (`mailSearchSortBy` : `size` ou valeur inconnue = date).
- Chaque résultat porte sa boîte, son dossier et le nom du dossier (« Réception » pour la réception).

### Dossiers de recherche (`MailSearch`)

- Libellé requis, 250 caractères maximum ; critères validés comme ci-dessus.
- Créé en fin de liste ; modification ou suppression d’un dossier inconnu : « Dossier de recherche » introuvable.
- Rien n’est créé sur le serveur ; la suppression ne touche aucun mail.
- Critères stockés illisibles : la recherche vaut « réceptions, à traiter ».
- `mailSearchResults` : exécute les critères d’un dossier (tri par date descendant) ; `mailAdvancedSearch` : exécute des critères non enregistrés, avec tri.

## Rédaction et envoi

Sources : `apps/api/src/services/mail/compose.ts`, `sender.ts`.

### Construction du message (`buildMessage`)

- Destinataires (`to`, `cc`, `bcc`) : adresses valides, 100 au maximum par champ (« Adresse email invalide. », « 100 destinataires maximum. »). Pour un brouillon : textes libres de 320 caractères maximum, 100 au maximum.
- Objet : 998 caractères maximum (« Objet trop long. »).
- Envoi (pas brouillon) : au moins un destinataire au total, sinon « Ajoutez au moins un destinataire. » (champ `to`).
- Fichiers : fichiers envoyés, plus ceux repris d’un autre mail (`attachmentsFrom` : les numéros donnés, ou à défaut tous ceux qui ne sont pas des images liées). Sans nom : « sans-nom ». Total limité à **20 Mo** : « Pièces jointes trop lourdes (20 Mo au total maximum). ».
- HTML nettoyé, puis les images d’Ordo (`/api/attachments/…` envoyées dans l’éditeur ou la signature, `/api/mail/…/attachment` citées d’un mail lu) sont intégrées au message comme pièces jointes `cid:` (les destinataires ne peuvent pas les atteindre). Une image introuvable est laissée de côté.
- Version texte générée depuis le HTML (lignes de 100 caractères).
- Message-ID `<uuid@domaine de l’adresse>` ; expéditeur « Nom d’expéditeur \<adresse\> » ; In-Reply-To et References (les références reçues plus le mail répondu, sans doublon).
- Deux versions : `raw` sans en-tête Bcc (envoyée) et `copy` avec Bcc (gardée : Envoyés, brouillons, projets).

### Envoi (`sendMail`)

1. Boîte active requise ; projet d’origine actif s’il est donné (« Élément archivé… » sur `projectId` sinon).
2. Envoi SMTP de `raw` à tous les destinataires (À, Cc, Cci). Échec : « Envoi impossible (…). ».
3. À partir d’ici, le mail est parti : les échecs suivants ne sont plus des erreurs pour l’utilisateur.
4. Si `saveSent` : copie dans le dossier Envoyés (trouvé par drapeau ou par nom ; pas de copie sans dossier Envoyés), marquée lue.
5. Copie dans les projets : le projet d’origine, plus les projets ayant une copie d’un mail cité dans les références (conversation). Voir [Rattachement](#rattachement-aux-projets).
6. Suppression du brouillon d’origine (échec ignoré).
7. Renvoie les projets auxquels le mail a été rattaché.

## Brouillons

Source : `apps/api/src/services/mail/drafts.ts`.

- `saveMailDraft` : boîte active et projet actif requis ; le message est construit en mode brouillon, avec un en-tête `X-Ordo-Draft` (projet d’origine, JSON en base64), puis ajouté au dossier Brouillons (créé « Drafts » s’il manque), marqué `\Draft` et `\Seen`.
- Sans UIDPLUS, le brouillon est retrouvé par son Message-ID ; introuvable : « Brouillon enregistré, mais introuvable dans le dossier Brouillons. ».
- La version précédente (`replace`, éventuellement dans une autre boîte) est supprimée ensuite (échec ignoré).
- Renvoie l’emplacement et les pièces jointes du nouveau brouillon (numérotées comme sur le serveur, pour être reprises à la sauvegarde suivante).
- `mailDraft` : relit un brouillon (destinataires, objet, HTML, texte, fil, projet lu dans `X-Ordo-Draft` — ignoré s’il est illisible —, pièces jointes).
- `deleteMailDraft` : suppression **définitive** (pas de corbeille) ; refusée sur une boîte archivée.
- Le corps d’un mail écrit dans Ordo marque ses parties (`data-ordo-part` : `body`, `signature`, `quote`) pour pouvoir reprendre le brouillon ; un brouillon écrit ailleurs est repris en entier comme corps.

## Envois programmés

Source : `apps/api/src/services/mail/scheduled.ts`.

### Programmation (`scheduleMail`)

- Heure valide et au moins 30 secondes dans le futur, sinon « Choisissez un moment à venir. » (champ `sendAt`).
- Boîte active et projet actif requis.
- Le message est construit **tout de suite** (fichiers compris), daté de son heure d’envoi, et gardé (`raw`, `copy`, destinataires, références, projet). Objet stocké : celui du mail, ou « (sans objet) ».
- Le brouillon d’origine est supprimé.

### Statuts

| Statut    | Sens                                                            |
| --------- | --------------------------------------------------------------- |
| `PENDING` | En attente de son heure.                                        |
| `SENDING` | En cours d’envoi (réservé pour n’être envoyé qu’une fois).      |
| `SENT`    | Envoyé (`sentAt`) ; n’est plus listé.                           |
| `FAILED`  | Échec, avec son message d’erreur ; peut être renvoyé ou annulé. |

### Envoi (`sendScheduledMail` et la tâche de fond)

- Le mail est d’abord réservé (`PENDING` ou `FAILED` → `SENDING`) ; s’il ne l’est pas (déjà envoyé, en cours, inconnu) : « Envoi programmé » introuvable.
- Envoi comme un envoi normal (SMTP, Envoyés, projets), avec la boîte active requise ; succès → `SENT`, échec → `FAILED` avec le message.
- `scheduledMails` liste les `PENDING`, `SENDING` et `FAILED`, par heure d’envoi.

### Annulation (`cancelScheduledMail`)

- Refusée pour un envoi `SENT` ou `SENDING` (« Envoi programmé » introuvable) et sur une boîte archivée.
- La copie (avec Bcc) est remise dans le dossier Brouillons de la boîte (créé s’il manque), marquée `\Draft` et `\Seen` ; l’envoi programmé est supprimé.

### Envoi automatique

- Au démarrage de l’API, pour chaque espace : les envois restés `SENDING` passent en `FAILED` avec « Envoi interrompu (redémarrage) : vérifiez s’il est parti avant de le renvoyer. » (plutôt que d’être envoyés deux fois).
- 10 s après le démarrage, puis toutes les 30 s, pour chaque espace : les envois `PENDING` dont l’heure est passée, d’une boîte non archivée, partent dans l’ordre de leur heure. Un échec est noté et n’arrête pas les autres.

## Rattachement aux projets

Source : `apps/api/src/services/mail/linked.ts`.

### Copie d’un mail (`copyToProject`)

- Une copie par `(projet, Message-ID)` : un mail déjà rattaché n’est pas recopié, la copie existante est renvoyée. Sans Message-ID, un identifiant `ordo-<uuid>` est donné.
- Copie : boîte d’origine, Message-ID, In-Reply-To, références, objet (« (sans objet) » si vide), expéditeur, À, Cc, date (à défaut maintenant), texte, HTML nettoyé, et `sent` (envoyé depuis Ordo ou depuis le dossier Envoyés).
- Les pièces jointes sont copiées comme pièces jointes d’Ordo (nom limité et nettoyé, type détecté sur le contenu, voir [Fichiers](../cross-cutting/files-and-attachments.md)), avec leur Content-ID ; les images intégrées du HTML pointent vers ces copies.
- Le tout dans une transaction.

### Actions

- `linkMail` : projet actif requis (« Élément archivé… » sinon) ; lit le mail sur le serveur et le copie.
- `unlinkMail` : supprime la copie et ses pièces jointes ; le mail reste dans la boîte.
- `projectMails` : copies d’un projet, de la plus récente à la plus ancienne. La page web lit en fait les mails en direct (recherche avec `projectId`).

### Suivi des conversations (tâche de fond)

- 30 s après le démarrage, puis toutes les 5 minutes, pour chaque espace (une seule exécution à la fois).
- Pour chaque boîte non archivée, la réception et le dossier Envoyés (par drapeau, sinon par nom) sont lus depuis le dernier UID vu (`MailFolderCursor`). Premier passage, ou dossier reconstruit (`uidValidity` changé) : les 200 derniers mails sont examinés.
- Un nouveau mail dont In-Reply-To ou References cite un mail rattaché rejoint les projets de ce mail (sauf ceux qui en ont déjà une copie). `sent` vaut vrai s’il vient d’Envoyés.
- Une boîte injoignable est ignorée (journal) sans arrêter les autres.

## Commentaires sur un mail

Source : `apps/api/src/services/core/comments.ts`.

- Cible `MAIL`, identifiée par le Message-ID (le mail n’est pas stocké) ; un identifiant vide : « Élément » introuvable. Pas de verrou d’archivage. Voir [Commentaires](../cross-cutting/comments.md).

## Pièces jointes d’un mail lu

Source : `apps/api/src/routes/mail.ts`.

- Route `GET /api/mail/:accountId/attachment?folder=…&uid=…&index=…`.
- Paramètres manquants ou non entiers : « Pièce jointe mal désignée. ». Pièce absente : 404 (« Pièce jointe » introuvable) ; serveur injoignable : 503 ; autre erreur journalisée (« Pièce jointe de mail impossible. »).
- Type détecté **sur le contenu** (le type déclaré par le mail n’est pas cru). Images et PDF affichés sur place, sauf `?download=1` ; les autres fichiers sont téléchargés.
- Cache `private, max-age=3600` ; politique de sécurité des fichiers de l’app (un PDF affiché sur place peut être encadré par l’app).

## Nettoyage du HTML

Source : `apps/api/src/services/mail/sanitize.ts`.

S’applique aux mails lus, aux copies des projets, aux mails envoyés et aux signatures :

- Retirés : scripts, gestionnaires d’événements, `form`, `input`, `button`, `textarea`, `select`, `iframe`, `frame`, `object`, `embed`, `base`, `meta`, `link`.
- Gardés : styles et images.
- Adresses permises : `http(s):`, `mailto:`, `tel:`, `cid:`, `data:image/` ; `/api/` seulement dans ce que l’utilisateur écrit (mail envoyé, signature). Un mail reçu ne peut pas faire appeler l’API par le navigateur : seules ses images intégrées (`cid:`) reçoivent, après nettoyage, leur adresse `/api/mail/…/attachment` (ou `/api/attachments/…` pour une copie de projet).
- Les liens reçoivent `target="_blank"` et `rel="noopener noreferrer"`.
- Côté web, le mail est en plus affiché dans un cadre isolé sans script, images et polices distantes bloquées (les images peuvent être affichées à la demande).

## Erreurs de connexion

- IMAP : identifiants refusés → « Connexion IMAP refusée : identifiant ou mot de passe incorrect. » ; autre → « Serveur IMAP injoignable ou en erreur (détail). ». Une erreur déjà formatée par l’API est relancée telle quelle.
- SMTP : « Envoi impossible (détail). » à l’envoi, « Connexion SMTP impossible (détail). » au test.
- Erreurs d’entrée de type `BAD_USER_INPUT`, voir [Erreurs](../cross-cutting/errors.md).

## Mails de l’application

`apps/api/src/mail/` (`mailer.ts`, `templates.ts`) est l’envoi des mails de l’application elle-même (comptes, mots de passe…), sans lien avec les boîtes de l’utilisateur ; voir [Authentification](../../features/cross-cutting/auth.md).
