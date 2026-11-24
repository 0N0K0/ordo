# Règles métier : liaison et synchronisation GitHub

Règles de la connexion à GitHub, de la liaison d’un projet à un tableau GitHub Projects (v2) et de la synchronisation dans les deux sens des tâches, sprints et commentaires. Sources : `apps/api/src/services/github/**` (`client.ts` dont `stopsSync` et `isGoneOnGithub`, `links-admin.ts`, `links.ts` dont `forgetGithubItems` et `githubItemsLeaving`, `board.ts` dont `addIssueToBoard` et `issueGone`, `sync.ts`), `apps/api/src/graphql/modules/github.ts`, `packages/shared/src/tasks/github.ts`, `packages/shared/src/tasks/github-merge.ts`.

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

GitHub injoignable, jeton refusé (401), limite de requêtes (429, 403 que GitHub dit dû à la limite — plus aucune requête restante ou délai à attendre —, ou erreur GraphQL `RATE_LIMITED`) et jeton sans les droits nécessaires (`INSUFFICIENT_SCOPES`) arrêtent toute la synchronisation, même au milieu de la fusion d’une paire (`stopsGithubSync`, `packages/shared/src/tasks/github.ts`) : chaque appel suivant échouerait de même. Les autres erreurs ne concernent qu’une tâche (voir « Étapes »), dont un droit manquant sur un seul dépôt ou une seule issue (`FORBIDDEN`, autre 403).

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
- Chaque champ choisi doit être un champ du tableau du bon type, sinon « Le champ choisi pour <le statut | la priorité | le sprint | le début | la fin | l’effort | l’échéance | le temps passé | le type> n’est pas un champ adapté du tableau. » :

| Champ Ordo                              | Type de champ GitHub |
| --------------------------------------- | -------------------- |
| statut, priorité, type (source `FIELD`) | `SINGLE_SELECT`      |
| sprint                                  | `ITERATION`          |
| début, fin, échéance                    | `DATE`               |
| effort, temps passé                     | `NUMBER`             |

- Type : `typeSource` vaut `FIELD` (un champ du tableau), `ISSUE_TYPE` (types d’issue de l’organisation) ou `null` (non synchronisé). `FIELD` sans champ : « Choisissez le champ du tableau qui porte le type. ». `ISSUE_TYPE` sans types d’issue : « Ce tableau n’appartient pas à une organisation ayant des types d’issue : choisissez un champ du tableau pour le type. ».
- Correspondances statut / priorité / type (`statusOptions`, `priorityOptions`, `typeOptions` : id Ordo → id d’option ou de type d’issue) : seules les options existantes du champ choisi sont gardées ; sans champ, la correspondance est vidée.
- Dépôt des nouvelles tâches (`repositoryName`, « compte/dépôt ») : facultatif ; « Dépôt attendu sous la forme compte/dépôt. », « Dépôt introuvable, ou le jeton n’y a pas accès. ».
- Options : `syncAssignees`, `syncLabels`, `pushExisting` (envoyer aussi les tâches antérieures à la liaison), `enabled` (synchronisation automatique).
- Le libellé et l’adresse de la liaison sont ceux du tableau.
- Changer de tableau oublie les liens de l’ancien (voir « Déliaison »).

### Déliaison

`unlinkGithubProject(projectId)` (« Lien GitHub introuvable. » sinon) efface, sur l’arbre du projet, les liens des tâches (item, contenu, URL, numéro GitHub, instantané), des sprints (itération) et des commentaires, puis supprime la liaison. Rien n’est supprimé ni d’un côté ni de l’autre : les tâches, sprints et commentaires restent dans Ordo, les items restent sur le tableau (les issues dans leur dépôt), mais plus rien ne passe de l’un à l’autre. Une nouvelle liaison ne les rapparie pas (Ordo a oublié quel item était quelle tâche) : chaque item non archivé du tableau devient une nouvelle tâche, à côté de l’ancienne, et avec `pushExisting` chaque tâche active devient un nouvel item, à côté de l’ancien (une nouvelle issue dans le dépôt, ou un brouillon) ; seuls les sprints retrouvent leur itération, par leur nom (étape 1). Le panneau du projet le dit dans la confirmation de « Délier ».

## Synchronisation

Source : `sync.ts` (`syncGithubProject`), `packages/shared/src/tasks/github-merge.ts` (`mergeFields`, `upgradedSnapshot`, `readdedItemSnapshot`, `taskParentValue`, `itemParentValue`, `removedFromBoardComment`).

### Déclenchement

- Manuel : mutation `syncGithubProject(projectId)` ; elle rend un résumé.
- Automatique : `scheduleGithubSync` (lancé au démarrage de l’API) synchronise, dans chaque espace connecté à GitHub, chaque liaison `enabled`, **30 s après le démarrage puis toutes les 10 minutes**. Un échec est journalisé, la suivante continue.
- Une seule synchronisation à la fois par liaison : « Une synchronisation de ce projet est déjà en cours. ».
- Après chaque passage : `lastSyncAt`, `lastSyncError` (message de l’erreur, ou effacé), `lastSyncSummary`, et le libellé / l’adresse du tableau mis à jour.
- Ce que le passage a changé sur les tâches (valeurs reçues, tâches créées) déclenche les [automatisations des tâches](../activities/task-automations.md), une fois à la fin du passage ; la synchronisation de fond n’a pas de notification.

### Périmètre

Les tâches du projet lié **et de ses sous-projets** ; les items du tableau (issues et brouillons d’issue).

### Étapes

1. **Itérations et sprints** (si un champ d’itération est choisi) :
   - un sprint dont l’itération a disparu est dépareillé ;
   - une itération sans sprint prend le sprint Ordo non apparié de même nom (comparaison `sameName`) ; si un sprint avait été créé depuis cette itération par une synchronisation précédente, ses tâches rejoignent le sprint Ordo et il est supprimé ;
   - sinon l’itération devient un nouveau sprint du projet lié, avec ses dates (début, début + durée - 1) et son titre coupé à 250 caractères (`clipText`) ;
   - Ordo fait référence pour le nom et les dates d’un sprint apparié ; les itérations ne sont **jamais** écrites sur GitHub (l’API ne sait pas fixer leurs dates). Les sprints sans itération sont seulement comptés (`sprintsSkipped`).
2. **Issues revenues** : une tâche de l’arbre dont l’issue a quitté le tableau avec elle (transfert hors de l’arbre, voir « Suppressions côté Ordo ») et qui y est revenue (annulation du transfert, nouveau transfert, liaison de sa nouvelle arborescence) voit la même issue ajoutée de nouveau au tableau (`addProjectV2ItemById` ; une issue encore sur le tableau garde son item) et liée, archivée ou non, quelle que soit sa date de création (elle a déjà été sur un tableau : `pushExisting` ne la concerne pas) ; puis elle est fusionnée comme toute paire (étape 5), Ordo donnant les valeurs que porte l’item lui-même (archivage, champs du tableau hors champs d’issue de l’organisation) : ce que montre le nouvel item (vide, ou une valeur posée par une automatisation du tableau) n’est pas un changement fait sur GitHub ; les valeurs de l’issue (titre, description, fermeture, étiquettes, parent, jalon, liens, commentaires…) se fusionnent contre l’instantané de la dernière synchronisation ; changées des deux côtés, la date du dernier changement de la tâche (gardée quand elle est liée de nouveau) est comparée à celle de l’issue elle-même, pas à celle du nouvel item (`readdedItemSnapshot`, `remoteChangeDate`). L’instantané écrit quand la tâche est liée de nouveau porte une marque (`readded`, `wasReadded`) : tant qu’une fusion complète n’a pas écrit le suivant (paire en échec, synchronisation arrêtée), la paire est fusionnée ainsi aux synchronisations suivantes. Comptée comme item créé (`pushedNew`) ; une issue remise n’est pas comptée comme disparue dans le même passage. Cas particuliers :
   - l’issue est introuvable (`NOT_FOUND`) : elle n’est oubliée que si elle a disparu à coup sûr, son dépôt étant lisible avec le jeton sans issue de ce numéro (supprimée, ou transférée ailleurs ; `issueGone`) : la tâche oublie son issue (contenu, URL, numéro, instantané, liens de ses commentaires) et est envoyée comme une tâche nouvelle (étape 6) ; ses commentaires écrits dans Ordo sont publiés sur la nouvelle issue, ceux d’autres auteurs venus de GitHub restent dans Ordo seulement (voir « Commentaires »). Un dépôt hors de portée (supprimé, rendu privé, jeton restreint) ne permet pas de savoir : la tâche est comptée en échec et réessayée à la synchronisation suivante ;
   - l’item rendu est déjà lié à une autre tâche (prise depuis l’item par une synchronisation précédente) : cette paire reste ; la tâche revenue oublie son issue de même, est marquée `REMOVED` (plus renvoyée, comme une tâche dont l’item a quitté le tableau), n’est pas archivée et reçoit le commentaire « Déliée de GitHub le JJ/MM/AAAA : son issue est déjà liée à une autre tâche. » (`alreadyLinkedComment` ; avertissement journalisé « Synchronisation GitHub : issue déjà liée à une autre tâche. »).

   Un brouillon, supprimé avec son item, est renvoyé comme une tâche nouvelle (étape 6).
3. **Items disparus** : une tâche dont l’item n’est plus sur le tableau (retiré du tableau, ou supprimé ; un item **archivé** sur le tableau y est toujours, voir « Archivage ») est archivée comme par l’action « Archiver » (`setTaskArchived`, les tâches du haut d’abord, puis les autres : une sous-tâche disparue sous un parent déjà archivé l’est aussi) : ses sous-tâches actives sont archivées avec elle (`archivedByCascade`), et celles encore sur le tableau voient leur item archivé dans le même passage (étape 5). Ensuite, en une transaction, elle est déliée et marquée `REMOVED` (elle n’est plus renvoyée, même restaurée), ses commentaires perdent leur lien et elle reçoit le commentaire « Retirée du tableau GitHub le JJ/MM/AAAA : tâche archivée. » (jour de la synchronisation, heure de Paris, `removedFromBoardComment`). Une tâche déjà archivée reçoit le commentaire et garde sa date d’archivage. Brouillon ou issue, la règle est la même (un brouillon retiré n’existe plus sur GitHub, une issue reste dans son dépôt). Si la transaction échoue, la tâche reste archivée et liée : la synchronisation suivante la retrouve disparue et recommence (l’archivage ne change plus rien, le commentaire n’est ajouté qu’une fois) ; si son item est revenu sur le tableau entre-temps, la paire est de nouveau fusionnée, et l’archivage fait dans Ordo archive l’item.
4. **Items nouveaux** : chaque item inconnu non archivé devient une tâche du projet lié (un item archivé qu’aucune tâche ne connaît est laissé de côté) (titre coupé à 250 caractères, ou « Item GitHub <n> ») ; ses valeurs arrivent par la fusion qui suit.
5. **Fusion des paires** : chaque paire tâche / item est fusionnée champ par champ (voir plus bas), puis le temps passé est écrit, le numéro de la tâche suit celui de l’issue, et les commentaires sont synchronisés (issues seulement). Une paire en échec (une écriture refusée par GitHub…) est journalisée (« Synchronisation GitHub : tâche non synchronisée. ») et comptée (`failed`), les autres continuent ; son instantané n’étant écrit qu’à la fin, elle est reprise à la synchronisation suivante. De même pour une issue revenue (étape 2) et une tâche nouvelle (étape 6). Une erreur qui arrête toute la synchronisation (GitHub injoignable, jeton refusé, limite de requêtes, jeton sans les droits nécessaires, voir « Erreurs d’appel GitHub ») n’est pas comptée : la synchronisation échoue avec son message.
   Une tâche **archivée** liée est synchronisée comme les autres : la paire est fusionnée à chaque passage (titre, description, état, archivage, étiquettes, champs, parent, liens, temps passé, numéro, commentaires). Une tâche archivée est en lecture seule pour les utilisateurs, pas pour la synchronisation : ce que GitHub change sur l’issue est écrit dans la tâche archivée, et ce qui change dans Ordo (valeurs héritées, règles d’automatisation, annulation) part vers GitHub. Sur une tâche archivée, les valeurs reçues ne déclenchent que les règles « La tâche est archivée » ([Automatisations des tâches](../activities/task-automations.md)), comme toute écriture sur une tâche archivée. Le parent d’une tâche est fusionné comme toute valeur, archivé ou non (dans Ordo ou sur GitHub) : le parent et les sous-issues sont toujours les mêmes des deux côtés ; un changement fait d’un seul côté depuis la dernière synchronisation (tâche placée sous un autre parent, archivé ou non, détachée de son parent) passe à l’autre côté ; changé des deux côtés ou sans instantané, la règle de la fusion s’applique (voir plus bas). Un parent archivé reçu de GitHub est accepté, pour une tâche active comme pour une tâche archivée (un utilisateur, lui, ne choisit jamais un parent archivé). Une tâche archivée qui change de parent par la synchronisation devient archivée pour son propre compte (`archivedByCascade` remis à faux) : restaurer son ancien parent ne la restaure pas. Les liens « bloquée par » et « relative à » avec une tâche archivée sont les mêmes des deux côtés : ajoutés ou retirés d’un côté, ils le sont de l’autre (la synchronisation écrit les liens d’une tâche archivée, que l’utilisateur ne peut pas changer).
6. **Tâches nouvelles** : les tâches de l’arbre non liées, non archivées, jamais retirées du tableau (et, sans `pushExisting`, créées après la liaison) deviennent des items, par numéro croissant : issues du dépôt choisi, sinon brouillons. Une tâche archivée jamais liée n’est pas envoyée ; une tâche archivée après sa liaison reste synchronisée (étape 5). Une tâche dont le brouillon a été supprimé quand elle a quitté le tableau (transfert hors de l’arbre), revenue dans l’arbre, ou dont l’issue n’existe plus (étape 2), est envoyée de même, archivée ou non (son item est alors archivé aussitôt), quelle que soit sa date de création (elle a déjà été sur un tableau). La tâche est liée à son item dès sa création, avec l’instantané de ce qu’il porte alors (titre, description, assignés, ouverte, non archivée) : si l’envoi des autres valeurs échoue, la paire est fusionnée à la synchronisation suivante (comme une première synchronisation pour les valeurs non envoyées), jamais envoyée deux fois. Seules les valeurs renseignées dans Ordo sont envoyées.

### Champs synchronisés

Toujours : titre, description (corps), archivage (tâche archivée ↔ item archivé sur le tableau). Pour les **issues** seulement : ouverture / fermeture (et sa raison : terminée ou annulée), étiquettes (si `syncLabels`), parent (sous-issues), jalon, « bloquée par », « relative à ». Selon les champs choisis : statut, priorité, type, itération (sprint), début, fin, échéance, effort. Assignés si `syncAssignees`. Temps passé : Ordo → GitHub uniquement.

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
- **Étiquettes / tags** : comparées par clé de nom (`nameKey`, « Été » = « ete »). Une étiquette reçue sans tag crée un tag (nom coupé à 250 caractères, couleur grise par défaut `DEFAULT_LABEL_COLOR`). Un tag envoyé sans étiquette dans le dépôt crée l’étiquette avec le nom et la couleur du tag.
- **Jalon** : par titre (coupé à 250 caractères) ; un jalon absent est créé du côté qui ne l’a pas (dans le projet de la tâche, ou dans le dépôt : « Jalon « X » non créé sur GitHub : <détail>. ») ; un jalon créé dans Ordo pendant la synchronisation est aussitôt connu des tâches fusionnées après (une sous-tâche qui en hérite l’envoie dans le même passage).
- **Valeurs héritées** : pour la priorité, le jalon et les assignés, Ordo envoie la valeur que la tâche suit (la sienne ou celle héritée de son parent, voir [Tâches](../activities/tasks.md#héritage)). Pour l’échéance, Ordo n’envoie qu’une échéance saisie sur une tâche : la sienne, ou celle d’un de ses parents dont elle hérite, en remontant la chaîne ; jamais celle prise d’un jalon, d’un projet ou d’un sprint, même par un parent (GitHub connaît déjà l’échéance du jalon). Sans échéance saisie dans la chaîne, aucune échéance n’est envoyée. Une valeur reçue de GitHub devient propre. Les tâches sont fusionnées les parents d’abord, l’héritage relu après chaque valeur héritable reçue (ou parent changé) : une valeur reçue par un parent part dans le même passage vers les sous-tâches qui en héritent.
- **Valeurs refusées** : une valeur reçue que les règles d’Ordo refusent n’est pas prise, la tâche garde la sienne (renvoyée à GitHub à la synchronisation suivante) : un effort hors de sa règle (négatif, trop grand), un début et une fin dans le mauvais ordre (les deux jours reçus sont laissés), une échéance avant l’« Ouverture » propre de la tâche, un parent qu’Ordo refuserait (d’une autre arborescence de projets, la tâche elle-même ou l’une de ses sous-tâches ; un parent archivé, lui, est accepté).
- **Parent** : une issue parente du tableau ↔ la tâche parente, archivée ou non (`taskParentValue`, `itemParentValue`) ; une tâche n’est jamais placée sous elle-même ou l’une de ses sous-tâches. Placée par GitHub sous un parent d’un autre projet de l’arborescence, une tâche qui hérite de son projet le suit, avec ses sous-tâches, comme dans Ordo. Une sous-tâche détachée de son parent par GitHub (parent retiré, ou parent hors du tableau) perd son parent comme dans Ordo : chaque champ hérité devient propre avec la valeur qu’elle suivait ; une tâche du premier niveau placée sous un parent par GitHub hérite de ses champs vides, comme dans Ordo.
- **Dépendances et relations** : seules les issues liées à des tâches (archivées ou non) sont comparées ; une dépendance refusée par Ordo (circulaire, autre arbre de projets) est ignorée. Une relation symétrique n’est envoyée qu’une fois par paire.
- **Fermeture** : l’état et la raison de fermeture de l’issue (`state`, `stateReason`) ↔ l’état et la façon d’être fermée de la tâche, dans les deux sens : une issue fermée « completed » ferme la tâche comme terminée, une issue fermée « not planned » (ou « duplicate ») la ferme comme annulée, une issue rouverte la rouvre ; une tâche terminée ferme l’issue « completed », une tâche annulée la ferme « not planned » (`closeIssue` avec `stateReason`, aussi pour une issue déjà fermée d’une autre façon), une tâche rouverte rouvre l’issue. La date de fermeture d’une tâche déjà fermée est conservée. Une fermeture enregistrée sans raison à une synchronisation précédente compte comme « completed ». Le statut n’y touche pas : les valeurs reçues (statut, fermeture) déclenchent les [règles de l’espace](../activities/task-automations.md#règles-du-statut--annulé-), comme toute écriture ; sur une tâche archivée, seules les règles « La tâche est archivée » s’appliquent.
- **Archivage** : la tâche archivée ↔ l’item archivé sur le tableau (`isArchived`), fusionné comme une valeur (instantané `archived`) : archiver une tâche dans Ordo archive son item (`archiveProjectV2Item`), la restaurer le sort de l’archive (`unarchiveProjectV2Item`), à la synchronisation suivante ; un item archivé sur le tableau archive sa tâche dans Ordo, un item sorti de l’archive la restaure (`setTaskArchived`, avec les cascades habituelles : sous-tâches actives archivées avec elle, sous-tâches archivées avec elle et ancêtres archivés restaurés). Les tâches sont fusionnées les parents d’abord et chacune est relue avant sa fusion : les sous-tâches archivées ou restaurées par la cascade d’un parent voient leur item suivre dans le même passage. Seuls les ancêtres qu’une sous-tâche sortie de l’archive sur le tableau restaure dans Ordo attendent la synchronisation suivante : leurs items sortent alors de l’archive, même archivés sur le tableau (la règle d’Ordo l’emporte). Le parent reçu est écrit avant l’archivage ou la restauration reçus : la cascade suit la nouvelle lignée. Changé des deux côtés depuis la dernière synchronisation (archivée d’un côté, restaurée de l’autre), le côté changé le plus récemment gagne. Un instantané écrit avant que l’archivage soit synchronisé compte comme non archivé (`upgradedSnapshot`) : le côté archivé depuis gagne. Un item sorti de l’archive est remis avant les autres valeurs envoyées, un item archivé l’est après.
- **Temps passé** : somme des entrées de temps terminées de la tâche, chaque entrée partagée à parts égales entre ses tâches, en heures à deux décimales ; écrit seulement s’il diffère.
- **Numéro** : une tâche liée à une issue prend le numéro de l’issue ; la tâche du même projet qui l’avait reçoit le numéro libre suivant, sauf si elle est elle-même liée à une issue de ce numéro (autre dépôt).

### Commentaires (issues)

- Un commentaire Ordo jamais envoyé est publié sur l’issue (`commentToPublish`), sauf un commentaire d’un autre auteur venu de GitHub dont l’issue a été oubliée (issue disparue, étape 2) : il garde son auteur et reste dans Ordo seulement, jamais publié sous le compte connecté.
- Un commentaire modifié d’un côté est recopié de l’autre ; modifié des deux côtés, la modification la plus récente gagne.
- Un commentaire supprimé sur GitHub est supprimé dans Ordo. Un commentaire supprimé dans Ordo est supprimé sur GitHub tout de suite, en arrière-plan (`forgetGithubComment`).
- Un commentaire GitHub nouveau est créé dans Ordo avec sa date ; son auteur est gardé sauf si c’est le compte connecté.

### Suppressions côté Ordo

`forgetGithubItems` (appelé par la suppression de tâches et leur transformation en routine, `services/tasks/tasks.ts`, `services/routines/conversion.ts`) trouve aussitôt le tableau de chaque item, puis retire en arrière-plan les items correspondants du tableau du projet (ou du plus proche ancêtre lié ; dans une transaction, comme l’annulation d’un transfert, seulement une fois celle-ci validée, `afterCommit`) : un brouillon est supprimé, une issue reste dans son dépôt. Un échec GitHub ne bloque pas la suppression (avertissement journalisé « Items GitHub non retirés. »).

Un transfert (`moveTaskTrees`, y compris la sortie des tâches d’un projet supprimé, `releaseProjectTasks`) retire du tableau les items des tâches qui quittent leur tableau : hors de tout projet, ou vers une arborescence liée à un autre tableau ou à aucun ; un transfert dans la même arborescence garde les items. La tâche perd son item (`githubItemId`, dans l’écriture du transfert) mais garde son issue ou son brouillon (contenu, URL, numéro GitHub, instantané) et ses commentaires leur lien. Les items ne sont retirés qu’une fois le transfert écrit (`githubItemsLeaving`, puis `afterCommit` : dans l’annulation d’un transfert, une fois sa transaction validée), jamais s’il échoue ; au moment de retirer chaque item, s’il est de nouveau celui d’une tâche (son issue remise au tableau entre-temps, le tableau rendant le même item), il est gardé ; seule une synchronisation qui le lie de nouveau dans les quelques millisecondes entre cette lecture et le retrait le perd (sa tâche est alors archivée comme retirée du tableau à la synchronisation suivante). Un retrait en échec est journalisé (« Item GitHub non retiré. ») et n’empêche pas les autres. Un item resté sur l’ancien tableau (retrait en échec, ou pas encore fait) est pris par la synchronisation de ce tableau comme un item nouveau : il devient une deuxième tâche ; la tâche transférée, revenue ensuite dans cet arbre, trouve son issue liée à cette tâche et est déliée (étape 2). Revenue dans l’arborescence d’un tableau (annulation du transfert, nouveau transfert, liaison de sa nouvelle arborescence), la synchronisation suivante remet la même issue au tableau (étape 2) ou recrée son brouillon (étape 6), sans doublon dans le dépôt.

### Résumé rendu

`GithubSyncSummary` : `pulledNew` (tâches créées depuis GitHub), `pushedNew` (items créés, ou issues remises au tableau), `pulled` (tâches mises à jour), `pushed` (items mis à jour), `unlinked` (tâches déliées et archivées, leur item ayant quitté le tableau), `sprints` (créés ou appariés), `sprintsSkipped` (sprints sans itération), `renumbered`, `comments` (créés, modifiés ou supprimés), `failed` (tâches dont la synchronisation a échoué, reprises à la suivante). `linkedTaskCount` d’une liaison compte les tâches liées de l’arbre.
