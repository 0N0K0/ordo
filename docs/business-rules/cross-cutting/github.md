# Règles métier : liaison et synchronisation GitHub

Règles de la connexion à GitHub, de la liaison d’un projet à un tableau GitHub Projects (v2) et de la synchronisation dans les deux sens des tâches, sprints et commentaires. Sources : `apps/api/src/services/github/**` (`client.ts`, `links-admin.ts`, `links.ts`, `board.ts`, `merge.ts`, `sync.ts`), `apps/api/src/graphql/modules/github.ts`, `packages/shared/src/tasks/github.ts`.

## Connexion (jeton)

Source : `links-admin.ts`, `client.ts`.

- Une connexion par espace (`githubConnection`, clé `workspaceId`) : un jeton d’accès personnel et le login de son propriétaire.
- `setGithubToken(token)` : jeton coupé, requis (« Le jeton est requis. ») ; il est vérifié auprès de GitHub (requête `viewer`) puis enregistré **chiffré** (`encryptSecret`, même clé que les mots de passe mail) ; rend le login.
- `removeGithubToken()` : oublie le jeton. Les liaisons restent, leur synchronisation s’arrête.
- Sans connexion, toute action GitHub : « Connectez d’abord GitHub (Paramètres › GitHub). ».
- Jeton indéchiffrable : « Jeton GitHub illisible (MAIL_ENCRYPTION_KEY changée) : enregistrez-le à nouveau dans Paramètres › GitHub. ».

### Erreurs d’appel GitHub

| Cas                                                           | Message                                                                          |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Réseau, délai de 30 s dépassé                                 | « GitHub injoignable (<détail>). »                                               |
| HTTP 401                                                      | « Jeton GitHub refusé : vérifiez-le dans Paramètres › GitHub. »                  |
| HTTP 403 ou 429                                               | « Limite de requêtes GitHub atteinte : réessayez plus tard. »                    |
| Erreur GraphQL de droits (`FORBIDDEN`, `INSUFFICIENT_SCOPES`) | « Le jeton GitHub n’a pas les droits nécessaires (projets, issues) : <message> » |
| Autre erreur GraphQL                                          | « GitHub : <message> »                                                           |
| Autre réponse en erreur                                       | « GitHub a répondu <code>. »                                                     |

## Login GitHub des contributeurs

`setContributorGithubLogin(id, login)` :

- Login coupé, « @ » initial retiré ; vide = effacé.
- Format : 1 à 39 caractères, lettres, chiffres et « - », commençant par une lettre ou un chiffre : « Login GitHub invalide. ».
- Le contributeur doit exister et ne pas être archivé.
- Unique dans l’espace, sans tenir compte de la casse : « Ce login GitHub est déjà celui de <nom>. » (CONFLICT).
- La liste `githubContributors` ne propose que les contributeurs non archivés, par nom.

## Liaison d’un projet

### Adresse du tableau

`resolveBoard` accepte `https://github.com/users/<compte>/projects/<n>` ou `https://github.com/orgs/<organisation>/projects/<n>` :

- Autre forme : « Adresse attendue : https://github.com/users/<compte>/projects/<n> ou https://github.com/orgs/<organisation>/projects/<n>. » (champ `url`).
- Tableau absent ou inaccessible : « Tableau GitHub introuvable, ou le jeton n’y a pas accès. ».
- `githubBoard(url)` rend le tableau, ses champs (type, options, nombre d’itérations, champ d’issue de l’organisation) et les types d’issue de l’organisation, pour configurer la liaison.

### Contrôles de `saveGithubLink`

- Le projet doit exister et ne pas être archivé.
- **Un seul tableau par arbre de projets** : si un ancêtre ou un descendant est déjà lié, « « <projet> » est déjà lié à un tableau GitHub : un projet et ses sous-projets partagent un seul tableau. ».
- Un tableau ne se lie qu’à un projet : « Ce tableau est déjà lié au projet « <projet> ». ».
- Chaque champ choisi doit être un champ du tableau du bon type, sinon « Le champ choisi pour <le statut | la priorité | le sprint | le début | la fin | l’effort | la date max | le temps passé | le type> n’est pas un champ adapté du tableau. » :

| Champ Ordo                              | Type de champ GitHub |
| --------------------------------------- | -------------------- |
| statut, priorité, type (source `FIELD`) | `SINGLE_SELECT`      |
| sprint                                  | `ITERATION`          |
| début, fin, date max                    | `DATE`               |
| effort, temps passé                     | `NUMBER`             |

- Type : `typeSource` vaut `FIELD` (un champ du tableau), `ISSUE_TYPE` (types d’issue de l’organisation) ou `null` (non synchronisé). `FIELD` sans champ : « Choisissez le champ du tableau qui porte le type. ». `ISSUE_TYPE` sans types d’issue : « Ce tableau n’appartient pas à une organisation ayant des types d’issue : choisissez un champ du tableau pour le type. ».
- Correspondances statut / priorité / type (`statusOptions`, `priorityOptions`, `typeOptions` : id Ordo → id d’option ou de type d’issue) : seules les options existantes du champ choisi sont gardées ; sans champ, la correspondance est vidée.
- Dépôt des nouvelles tâches (`repositoryName`, « compte/dépôt ») : facultatif ; « Dépôt attendu sous la forme compte/dépôt. », « Dépôt introuvable, ou le jeton n’y a pas accès. ».
- Options : `syncAssignees`, `syncLabels`, `pushExisting` (envoyer aussi les tâches antérieures à la liaison), `enabled` (synchronisation automatique).
- Le libellé et l’adresse de la liaison sont ceux du tableau.
- Changer de tableau oublie les liens de l’ancien (voir « Déliaison »).

### Déliaison

`unlinkGithubProject(projectId)` (« Lien GitHub introuvable. » sinon) efface, sur l’arbre du projet, les liens des tâches (item, contenu, URL, numéro GitHub, instantané), des sprints (itération) et des commentaires, puis supprime la liaison. Les tâches et sprints restent dans Ordo, les items restent sur GitHub ; une nouvelle liaison les dupliquerait.

## Synchronisation

Source : `sync.ts` (`syncGithubProject`), `merge.ts` (`mergeFields`).

### Déclenchement

- Manuel : mutation `syncGithubProject(projectId)` ; elle rend un résumé.
- Automatique : `scheduleGithubSync` (lancé au démarrage de l’API) synchronise, dans chaque espace connecté à GitHub, chaque liaison `enabled`, **30 s après le démarrage puis toutes les 10 minutes**. Un échec est journalisé, la suivante continue.
- Une seule synchronisation à la fois par liaison : « Une synchronisation de ce projet est déjà en cours. ».
- Après chaque passage : `lastSyncAt`, `lastSyncError` (message de l’erreur, ou effacé), `lastSyncSummary`, et le libellé / l’adresse du tableau mis à jour.

### Périmètre

Les tâches du projet lié **et de ses sous-projets** ; les items du tableau (issues et brouillons d’issue).

### Étapes

1. **Itérations et sprints** (si un champ d’itération est choisi) :
   - un sprint dont l’itération a disparu est dépareillé ;
   - une itération sans sprint prend le sprint Ordo non apparié de même nom (comparaison `sameName`) ; si un sprint avait été créé depuis cette itération par une synchronisation précédente, ses tâches rejoignent le sprint Ordo et il est supprimé ;
   - sinon l’itération devient un nouveau sprint du projet lié, avec ses dates (début, début + durée - 1) et son titre coupé à 120 caractères ;
   - Ordo fait référence pour le nom et les dates d’un sprint apparié ; les itérations ne sont **jamais** écrites sur GitHub (l’API ne sait pas fixer leurs dates). Les sprints sans itération sont seulement comptés (`sprintsSkipped`).
2. **Items disparus** : une tâche dont l’item n’est plus sur le tableau est déliée et marquée `REMOVED` (elle n’est plus renvoyée) ; ses commentaires perdent leur lien.
3. **Items nouveaux** : chaque item inconnu devient une tâche du projet lié (titre coupé à 256 caractères, ou « Item GitHub <n> ») ; ses valeurs arrivent par la fusion qui suit.
4. **Fusion des paires** : chaque paire tâche / item est fusionnée champ par champ (voir plus bas), puis le temps passé est écrit, le numéro de la tâche suit celui de l’issue, et les commentaires sont synchronisés (issues seulement).
5. **Tâches nouvelles** : les tâches de l’arbre non liées, non archivées, jamais retirées du tableau (et, sans `pushExisting`, créées après la liaison) deviennent des items, par numéro croissant : issues du dépôt choisi, sinon brouillons. Seules les valeurs renseignées dans Ordo sont envoyées.

### Champs synchronisés

Toujours : titre, description (corps). Pour les **issues** seulement : ouverture / fermeture, étiquettes (si `syncLabels`), parent (sous-issues), jalon, « bloquée par », « relative à ». Selon les champs choisis : statut, priorité, type, itération (sprint), début, fin, date max, effort. Assignés si `syncAssignees`. Temps passé : Ordo → GitHub uniquement.

Un champ d’issue de l’organisation n’a pas de valeur sur un brouillon : il est ignoré pour les brouillons. Le type par `ISSUE_TYPE` ne concerne que les issues.

### Fusion à trois voies (`mergeFields`)

Pour chaque champ, comparé à la valeur de la dernière synchronisation (instantané `githubSnapshot`) :

- Égaux des deux côtés : rien à faire.
- Modifié d’un seul côté : la valeur passe de l’autre côté.
- Modifié des deux côtés : le côté modifié **le plus récemment** gagne (`updatedAt` de la tâche contre celui de l’item).
- Sans instantané pour ce champ (première synchronisation d’une paire, champ ajouté depuis) : les listes sont **réunies** (rien n’est retiré d’aucun côté) ; pour une valeur simple, une valeur l’emporte sur une valeur vide, sinon le côté le plus récent gagne.
- Une valeur sans équivalent de l’autre côté (statut, priorité, type ou sprint Ordo sans option ni itération, préfixe `ordo:` ; option GitHub sans statut ou priorité Ordo, préfixe `gh:`) n’est pas appliquée ; elle est enregistrée dans l’instantané comme valeur de l’autre côté pour ne pas être renvoyée à chaque passage.
- Une itération de l’instantané qui n’existe plus sur le tableau est ignorée : le sprint de la tâche gagne.

### Correspondances et cas particuliers

- **Statut, priorité, type** : par les correspondances de la liaison ; une même option associée à plusieurs valeurs Ordo revient vers la première de la liste.
- **Sprint** : un item a une itération, une tâche peut avoir plusieurs sprints. Côté Ordo, la valeur est l’itération actuelle de l’item si c’est l’un des sprints de la tâche, sinon le sprint le plus récent de la tâche. Une itération reçue **ajoute** son sprint à la tâche, sans retirer les autres.
- **Assignés** : par le login GitHub des contributeurs. Les logins sans contributeur sont laissés tels quels des deux côtés ; les assignés Ordo sans login restent.
- **Étiquettes / tags** : comparées par clé de nom (`nameKey`, « Été » = « ete »). Une étiquette reçue sans tag crée un tag (nom coupé à 50 caractères, couleur grise par défaut `DEFAULT_LABEL_COLOR`). Un tag envoyé sans étiquette dans le dépôt crée l’étiquette avec le nom et la couleur du tag.
- **Jalon** : par titre (coupé à 120 caractères) ; un jalon absent est créé du côté qui ne l’a pas (dans le projet de la tâche, ou dans le dépôt : « Jalon « X » non créé sur GitHub : <détail>. »).
- **Parent** : une issue parente du tableau ↔ la tâche parente ; une tâche n’est jamais placée sous elle-même ou l’une de ses sous-tâches.
- **Dépendances et relations** : seules les issues liées à des tâches sont comparées ; une dépendance refusée par Ordo (circulaire, autre arbre de projets) est ignorée. Une relation symétrique n’est envoyée qu’une fois par paire.
- **Fermeture** : une issue fermée ferme la tâche (date de fermeture conservée si elle l’était déjà).
- **Temps passé** : somme des entrées de temps terminées de la tâche, chaque entrée partagée à parts égales entre ses tâches, en heures à deux décimales ; écrit seulement s’il diffère.
- **Numéro** : une tâche liée à une issue prend le numéro de l’issue ; la tâche du même projet qui l’avait reçoit le numéro libre suivant, sauf si elle est elle-même liée à une issue de ce numéro (autre dépôt).

### Commentaires (issues)

- Un commentaire Ordo jamais envoyé est publié sur l’issue.
- Un commentaire modifié d’un côté est recopié de l’autre ; modifié des deux côtés, la modification la plus récente gagne.
- Un commentaire supprimé sur GitHub est supprimé dans Ordo. Un commentaire supprimé dans Ordo est supprimé sur GitHub tout de suite, en arrière-plan (`forgetGithubComment`).
- Un commentaire GitHub nouveau est créé dans Ordo avec sa date ; son auteur est gardé sauf si c’est le compte connecté.

### Suppressions côté Ordo

`forgetGithubItems` (appelé par la suppression de tâches et le déplacement de tâches hors projet, `services/tasks/tasks.ts`) retire en arrière-plan les items correspondants du tableau du projet (ou du plus proche ancêtre lié) : un brouillon est supprimé, une issue reste dans son dépôt. Un échec GitHub ne bloque pas la suppression (avertissement journalisé « Items GitHub non retirés. »).

### Résumé rendu

`GithubSyncSummary` : `pulledNew` (tâches créées depuis GitHub), `pushedNew` (items créés), `pulled` (tâches mises à jour), `pushed` (items mis à jour), `unlinked` (tâches déliées), `sprints` (créés ou appariés), `sprintsSkipped` (sprints sans itération), `renumbered`, `comments` (créés, modifiés ou supprimés). `linkedTaskCount` d’une liaison compte les tâches liées de l’arbre.
