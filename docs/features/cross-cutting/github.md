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
- Avec un champ d’itération, rappel : « Itérations et sprints se correspondent par leur nom : une itération sans sprint devient un sprint du projet ; un sprint sans itération est à créer dans les réglages du tableau GitHub (l’API ne sait pas donner ses dates à une itération). Ordo fait référence pour les noms et dates. Une tâche placée dans une itération sur GitHub est ajoutée à son sprint, sans perdre ses autres sprints. ».
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
- « Délier » : confirmation « Délier le tableau GitHub » — « La synchronisation s’arrête : les tâches et sprints restent dans Ordo, les items restent sur GitHub, mais ils ne sont plus liés. Une nouvelle liaison les dupliquerait. ». Toast « Tableau GitHub délié. ».
- Dernier échec : « Dernière synchronisation en échec » avec le message. Sinon : « Dernier échange : <résumé>. ».
- Rappel : « Un champ modifié d’un seul côté passe de l’autre ; modifié des deux côtés, la modification la plus récente gagne. Une tâche supprimée dans Ordo est retirée du tableau (une issue reste dans son dépôt) ; archiver ou restaurer une tâche archive ou sort de l’archive son item, et inversement ; un item retiré du tableau laisse sa tâche dans Ordo, déliée et archivée, avec un commentaire. ».

### Résumé d’une synchronisation

« N tâches créées depuis GitHub, N items créés sur GitHub, N tâches et N items mis à jour, N tâches retirées du tableau (archivées), N sprints créés ou mis à jour, N tâches renumérotées, [N sprints sans itération (à créer dans GitHub), ]N commentaires échangés[, N tâches en échec (réessayées à la prochaine synchronisation)] ».

## Tâche de fond

Toutes les liaisons en synchronisation automatique sont synchronisées 30 secondes après le démarrage du serveur puis toutes les 10 minutes, dans chaque espace connecté. Une erreur est gardée sur la liaison et affichée dans le panneau.

## Un seul tableau par arbre

Un projet et ses sous-projets partagent un seul tableau ; un tableau n’est lié qu’à un projet. Les tâches des sous-projets sont incluses dans la synchronisation ; les items nouveaux du tableau deviennent des tâches du projet lié.
