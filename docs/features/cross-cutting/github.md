# GitHub

Connexion à GitHub, liaison d’un projet à un tableau GitHub Projects et synchronisation dans les deux sens de ses tâches, sprints et commentaires. Code web : `apps/web/src/features/github/` (voir [GitHub, code web](../../web/features/cross-cutting/github.md)) ; règles détaillées : [Règles GitHub](../../business-rules/cross-cutting/github.md).

La connexion est propre à chaque espace.

## Paramètres › GitHub

Route `/settings?tab=github`. Composant `GithubSettings`.

### « Connexion »

- Badge « Connecté : @login » quand un jeton est enregistré.
- Aide : « Ordo se connecte avec un jeton d’accès personnel : jeton « classic » avec les droits `project` et `repo`, ou jeton « fine-grained » avec l’accès aux projets et aux issues des dépôts concernés. Il est chiffré en base. » (lien vers la page des jetons de GitHub).
- Champ « Jeton » (« Remplacer le jeton » une fois connecté), texte d’exemple « ghp_… ou github_pat_… ».
- Bouton « Connecter » / « Remplacer » : le jeton est vérifié auprès de GitHub ; toast « GitHub connecté : @login. » ; une erreur s’affiche sous le champ.
- Bouton « Déconnecter » : confirmation « Déconnecter GitHub » — « Le jeton sera oublié et les synchronisations s’arrêteront. Les liens entre projets et tableaux sont conservés : ils reprendront avec un nouveau jeton. ». Toast « GitHub déconnecté. ».

### « Contributeurs sur GitHub »

« Les assignés d’une issue sont ceux des contributeurs qui ont son login GitHub ; les autres logins sont laissés tels quels des deux côtés. »

Tableau des contributeurs non archivés avec un champ « @ login GitHub » enregistré quand on quitte le champ (« @ » initial retiré). Erreurs sous le champ : « Login GitHub invalide. », « Ce login GitHub est déjà celui de X. ». État vide : « Aucun contributeur. ».

## Projet › Paramètres › GitHub

Section « GitHub » du panneau des paramètres d’un projet. Composant `ProjectGithubPanel`.

### Sans connexion

« GitHub n’est pas connecté : ajoutez un jeton dans Paramètres › GitHub. » (lien).

### Lier un tableau

« Lier un tableau GitHub Projects » — « Les tâches du projet et de ses sous-projets et les items du tableau (issues et brouillons) sont synchronisés dans les deux sens. »

1. « Adresse du tableau » (`https://github.com/users/compte/projects/1` ou `/orgs/…`), bouton « Charger ». Une erreur s’affiche sous le champ.
2. Le formulaire de réglages s’affiche, prérempli par devinette (voir plus bas).
3. « Lier » : toast « Liaison enregistrée. Lancez une synchronisation pour échanger les tâches. ».

### Formulaire de réglages

- En tête : lien vers le tableau, et « Toujours synchronisés : titre, description et commentaires ; pour les issues, l’ouverture / fermeture, le jalon, le parent (sous-issues), les dépendances (« bloquée par »), les relations (« relative à ») et le numéro (celui de l’issue). Choisissez où vont les autres champs. ».
- Champs du tableau pour chaque champ Ordo (« Non synchronisé » par défaut) : « Statut », « Priorité », « Type » (un champ du tableau, ou « Types d’issue de l’organisation »), « Sprint (itérations) », « Début », « Fin », « Échéance », « Effort », « Temps passé » (« En heures, d’Ordo vers GitHub »). Un champ d’issue de l’organisation est marqué « (champ d’issue) ».
- Interrupteurs « Assignés (assignees GitHub) » et « Étiquettes (labels des issues) ».
- Avec un champ d’itération : interrupteur « Écrire les itérations sur GitHub » (désactivé par défaut), description « Les sprints créés, renommés ou redatés dans Ordo sont écrits dans le champ d’itération : toute la liste est réécrite puis relue, et l’écriture s’arrête au moindre écart. GitHub peut recalculer les dates des itérations : essayez d’abord sur un tableau de test. », puis un rappel. Activé : « Sprints et itérations sont le reflet l’un de l’autre : une itération sans sprint prend le sprint de même nom, ou devient un sprint du projet ; un sprint sans itération devient une itération ; un nom ou des dates changés d’un côté passent de l’autre (changés des deux côtés, Ordo l’emporte). Un sprint qui chevauche un autre sprint n’est pas envoyé. Un sprint supprimé dans Ordo laisse son itération sur GitHub, ses items perdent seulement cette valeur. Une tâche placée dans une itération sur GitHub est ajoutée à son sprint, sans perdre ses autres sprints. ». Désactivé : « Itérations et sprints se correspondent par leur nom : une itération sans sprint prend le sprint de même nom, ou devient un sprint du projet ; les sprints ne sont pas écrits sur GitHub (un sprint sans itération est à créer dans les réglages du tableau) et Ordo fait référence pour leurs noms et dates. Une tâche placée dans une itération sur GitHub est ajoutée à son sprint, sans perdre ses autres sprints. ».
- Tables de correspondance « Statuts », « Priorités », « Types » : pour chaque valeur Ordo, l’option GitHub (« Non synchronisé » possible). Pour les types d’issue : « Les brouillons d’issue n’ont pas de type. ». Changer de champ vide sa correspondance.
- « Dépôt des nouvelles tâches » (« compte/dépôt ») : « Les tâches créées dans Ordo deviennent des issues de ce dépôt (compte/dépôt) ; vide : des brouillons du tableau. ».
- « Envoyer aussi les tâches qui existaient avant la liaison » (non par défaut).
- « Synchronisation automatique (toutes les 10 minutes) » (oui par défaut).
- Nouvelle liaison : boutons « Annuler » et « Lier ». Liaison existante (« Réglages ») : enregistrée champ par champ : chaque choix dès qu’il change, le dépôt en le quittant (« Forme attendue : compte/dépôt. » dessous s’il n’est pas écrit ainsi), « Enregistrement… » / « Enregistré » en haut, sans bouton ; « Réglages » referme le formulaire.

**Devinette initiale** : statut = champ à choix unique nommé « Status » ou « Statut » ; priorité = nom contenant « priorit » ; type = types d’issue de l’organisation s’il y en a, sinon un champ « Type » ; itération = premier champ d’itération ; début, fin, échéance, effort, temps passé par leur nom (anglais ou français). Options devinées par nom identique ou nom anglais usuel (« À faire » ↔ « Todo », « To do », « Backlog » ; « En cours » ↔ « In progress », « Doing » ; « En revue » ↔ « In review » ; « Terminé » ↔ « Done », « Closed » ; « Annulé » ↔ « Cancelled », « Won't do » ; priorités « Urgente », « Haute », « Moyenne », « Basse » ↔ « P0 »…« P3 », « Urgent », « High », « Medium », « Low »…). Assignés et étiquettes activés, synchronisation automatique activée.

### Projet lié

- Carte : lien vers le tableau, badge « Synchronisation automatique » ou « Synchronisation manuelle », puis « N tâches liées · nouvelles tâches en issues de compte/dépôt » (ou « en brouillons ») « · dernière synchronisation le … ».
- « Synchroniser » : toast « Synchronisé : <résumé>. ».
- « Réglages » : rouvre le formulaire (le tableau est rechargé).
- « Délier » : confirmation « Délier le tableau GitHub » — « La synchronisation s’arrête et Ordo oublie quel item, quelle itération et quel commentaire du tableau correspond à chaque tâche, sprint et commentaire. Rien n’est supprimé : les tâches, sprints et commentaires restent dans Ordo, les items restent sur le tableau (les issues dans leur dépôt), sans plus changer ensemble. Lier ce tableau à nouveau ne les rapparie pas : chaque item non archivé du tableau deviendrait une nouvelle tâche à côté de l’ancienne et, avec « Envoyer aussi les tâches qui existaient avant la liaison », chaque tâche active un nouvel item à côté de l’ancien (une nouvelle issue dans le dépôt, ou un brouillon), sauf une tâche retirée du tableau, qui n’est plus envoyée ; les commentaires d’autres auteurs venus de GitHub gardent leur auteur et restent dans Ordo seulement (les autres sont publiés sur la nouvelle issue) ; seuls les sprints retrouvent leur itération par leur nom (les autres deviendraient de nouvelles itérations). Cette action est irréversible. », boutons « Délier » puis « Annuler ». Toast « Tableau GitHub délié. ».
- Dernier échec : « Dernière synchronisation en échec » avec le message. Sinon : « Dernier échange : <résumé>. ».
- Synchronisation des itérations arrêtée (GitHub n’a pas gardé une écriture telle qu’envoyée) : « Itérations non synchronisées » avec le message et le bouton « Reprendre » (`resumeGithubIterations` ; enregistrer les réglages ne reprend pas ; toast « Itérations reprises : elles sont synchronisées de nouveau à la prochaine synchronisation. »).
- Dernière écriture des itérations refusée par GitHub (le champ inchangé) : avertissement « Itérations refusées par GitHub » avec le message (pas quand la synchronisation des itérations est arrêtée).
- Rappel : « Un champ modifié d’un seul côté passe de l’autre ; modifié des deux côtés, la modification la plus récente gagne. Une tâche supprimée ou transformée en routine dans Ordo est retirée du tableau (un brouillon est supprimé, une issue reste dans son dépôt, fermée comme « non prévue » (comme la tâche si elle est fermée) ; une tâche transférée hors du tableau garde son issue ouverte) ; archiver ou restaurer une tâche archive ou sort de l’archive son item, et inversement ; un item retiré du tableau laisse sa tâche dans Ordo, déliée et archivée, avec un commentaire. ».

### Résumé d’une synchronisation

« N tâches créées depuis GitHub, N items créés sur GitHub, N tâches et N items mis à jour, N tâches retirées du tableau (archivées), N sprints créés ou mis à jour, [N itérations créées ou mises à jour sur GitHub, ]N tâches renumérotées, [N sprints non envoyés (ils chevauchent un autre sprint), ][N sprints non envoyés (itérations non écrites, voir la section GitHub du projet), ][N sprints sans itération (à créer dans GitHub), ]N commentaires échangés[, N tâches en échec (réessayées à la prochaine synchronisation)] ».

## Tâches d’une arborescence liée

Dans une arborescence de projets liée à un tableau, chaque tâche montre où elle en est avec GitHub (rien hors d’une arborescence liée) :

- tableau des tâches : icône GitHub devant le libellé d’une tâche sur GitHub (« Synchronisée avec l’issue GitHub #n » ou « Synchronisée avec un brouillon GitHub ») ; colonne « GitHub » (masquée par défaut, filtrable) : pastille « Sur GitHub » (vert), « Pas sur GitHub » (gris) ou « Retirée du tableau GitHub » (orange) ;
- en-tête du panneau d’une tâche : badge « GitHub #12 » (lien vers l’issue) ou « Brouillon GitHub » ; sinon « Pas sur GitHub » (infobulle « Pas sur GitHub : créée avant la liaison (sans « Envoyer aussi les tâches qui existaient avant la liaison »), ou en attente de la prochaine synchronisation. ») ou « Retirée du tableau GitHub » (infobulle « Retirée du tableau GitHub : la synchronisation ne la renvoie plus. »), suivie, quand la tâche peut être envoyée, de « « Envoyer sur GitHub », dans le menu de la tâche, l’y envoie maintenant. », pour une tâche archivée retirée du tableau de « Restaurée, « Envoyer sur GitHub » (menu de la tâche) l’y renvoie. ».

Une synchronisation en échec pour une seule tâche n’est pas gardée sur la tâche : elle est comptée dans le résumé de la liaison (« N tâches en échec ») et la tâche est réessayée à la synchronisation suivante.

### Envoyer sur GitHub

Menu d’une tâche (ligne du tableau, panneau) et barre de sélection : « Envoyer sur GitHub » (icône GitHub), proposé pour une tâche active pas sur GitHub (jamais envoyée, créée avant la liaison, ou retirée du tableau) d’une arborescence liée dont la synchronisation automatique est activée, GitHub connecté ; la barre de sélection ne l’affiche que si l’une des tâches cochées peut l’être, et n’envoie que celles-là. L’envoi lance une synchronisation de la liaison (après celle en cours) : toast « Tâche envoyée sur GitHub. » (« 3 tâches envoyées sur GitHub. »), la sélection vidée ; une tâche non envoyée est dite dans un toast d’erreur (son message ; plusieurs : « 2 tâches non envoyées : <premier message> »). Règles : [Envoyer sur GitHub](../../business-rules/cross-cutting/github.md#envoyer-sur-github).

## Tâche de fond

Toutes les liaisons en synchronisation automatique sont synchronisées 30 secondes après le démarrage du serveur puis toutes les 10 minutes, dans chaque espace connecté. Une erreur est gardée sur la liaison et affichée dans le panneau.

## Un seul tableau par arbre

Un projet et ses sous-projets partagent un seul tableau ; un tableau n’est lié qu’à un projet. Les tâches des sous-projets sont incluses dans la synchronisation ; les items nouveaux du tableau deviennent des tâches du projet lié.
