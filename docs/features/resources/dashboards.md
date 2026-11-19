# Tableaux de bord

Ce que l’utilisateur peut faire avec les tableaux de bord et leurs diagrammes : onglets de tableaux, diagrammes sur les tâches, la facturation et la trésorerie, jeux de données et comparaisons, exports. Sources : `apps/web/src/features/dashboards/**`, `apps/api/src/services/dashboards/**`. Règles : [Règles des tableaux de bord](../../business-rules/resources/dashboards.md) ; code : [Code web des tableaux de bord](../../web/features/resources/dashboards.md).

## Où se trouvent les tableaux de bord

| Endroit                                                    | Route                               | Portée des données                                                                                                                                                                                        |
| ---------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page « Tableaux de bord » (menu « Ressources »)            | `/dashboards`                       | Tableaux généraux : toutes les tâches, tous les documents, tous les mouvements. Titre des exports : « Tous les projets ».                                                                                 |
| Onglet « Vue d’ensemble » d’un projet, sous la description | `/projects/:id` (onglet `overview`) | Tableaux du projet : seules les tâches du projet **et de ses sous-projets** comptent ; pour la facturation et la trésorerie, seuls les documents et mouvements rattachés au projet ou à ses sous-projets. |

Les deux endroits affichent le même composant (`DashboardBoard`) ; seule la portée change. Les tableaux d’un projet et les tableaux généraux sont des listes distinctes.

## Onglets de tableaux

Chaque tableau de bord est un onglet. L’onglet ouvert est gardé dans l’adresse (`?dashboard=<id>`) ; sans paramètre, c’est le premier.

- **Créer** : bouton « + » des onglets ou « Nouveau tableau de bord » (état vide). Formulaire de libellé (« Nouveau tableau de bord », placeholder « KPI, Sprint, Mensuel… ») ; le premier tableau d’une portée propose « KPI » par défaut. Le tableau créé est ouvert.
- **Renommer** : menu de l’onglet, « Renommer » (« Renommer le tableau de bord »). Absent sur un tableau archivé.
- **Réordonner** : glisser-déposer des onglets (ou depuis leur menu). Un tableau archivé ne bouge pas (notification « Élément archivé : restaurez-le pour le modifier. »).
- **Archiver / restaurer** : menu de l’onglet. Un tableau archivé est masqué tant que « Afficher les archivés » n’est pas activé ; il porte le badge archivé, une bannière « Tableau de bord archivé : restaurez-le pour le modifier. » et ses diagrammes sont en lecture seule (seuls les exports restent).
- **Supprimer** : menu de l’onglet, après confirmation « Supprimer le tableau de bord » : « « X » et ses N diagrammes seront supprimés définitivement. Les données affichées ne sont pas modifiées. » Notification « Tableau de bord supprimé. »

État vide (aucun tableau visible) : « Aucun tableau de bord. Créez-en un pour suivre vos indicateurs : tâches fermées par semaine, vélocité par sprint, burndown, charge par assigné… », avec l’interrupteur « Afficher les archivés » et « Nouveau tableau de bord ».

## Barre d’actions du tableau ouvert

- « Afficher les archivés » (interrupteur, visible quand il y a des archivés).
- « Exporter en PDF » : tous les diagrammes du tableau dans un PDF A4 paysage, un diagramme par page (désactivé sans diagramme).
- « Nouveau diagramme » (désactivé sur un tableau archivé), menu de source : « Tâches », « Facturation (devis, factures…) », « Trésorerie ».

## Grille de diagrammes

- Deux colonnes sur grand écran, une sur petit. Un diagramme est en demi-largeur ou en « Pleine largeur ».
- Chaque carte : poignée de déplacement, titre, sous-titre décrivant le diagramme (ex. « Tâches · Nombre · par date de création · par semaine, 3 derniers mois ») suivi du nombre d’éléments comptés (« 12 tâches », « 4 documents », « 30 mouvements », ou « points » pour un solde), puis le dessin (hauteur 288 px).
- Réordonner : glisser-déposer par la poignée (ou clavier), ou les entrées de déplacement du menu.
- État vide du tableau : « Ce tableau de bord n’a pas encore de diagramme. »
- Diagramme sans donnée : « Aucune donnée ne correspond à ce diagramme. » (burndown sans sprint : « Choisissez le sprint suivi. »).
- Squelette pendant le chargement ; erreur de chargement en alerte.

### Menu « … » d’un diagramme

| Action                                      | Effet                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| « Modifier »                                | Ouvre l’éditeur dans le panneau latéral (« Modifier le diagramme »).                                                                        |
| « Renommer »                                | Formulaire de libellé « Renommer le diagramme ».                                                                                            |
| « Dupliquer »                               | Copie « Nom (copie) » placée juste après.                                                                                                   |
| « Demi-largeur » / « Pleine largeur »       | Bascule la largeur.                                                                                                                         |
| Entrées de déplacement (monter, descendre…) | Réordonne dans le tableau.                                                                                                                  |
| « Déplacer vers… »                          | Panneau « Déplacer « X » » (voir plus bas).                                                                                                 |
| « Exporter en image… »                      | Panneau de réglages de l’image PNG.                                                                                                         |
| « Exporter en PDF »                         | PDF A4 paysage du diagramme seul, couleurs claires.                                                                                         |
| « Exporter les données (CSV) »              | Tableau des valeurs en CSV.                                                                                                                 |
| « Exporter les données (PDF) »              | Tableau des valeurs en PDF.                                                                                                                 |
| « Supprimer »                               | Confirmation « Supprimer le diagramme » : « Le diagramme « X » sera supprimé définitivement. Les données affichées ne sont pas modifiées. » |

Sur un tableau archivé, seuls les quatre exports restent. Les exports sont désactivés quand le diagramme est vide ou pas encore calculé.

## Éditeur de diagramme

Ouvert dans le panneau latéral (taille large), en deux colonnes : réglages à gauche, « Aperçu » en direct à droite (avec le nombre d’éléments comptés et des remarques : « l’effort d’une tâche parente est celui de ses sous-tâches », « une tâche à plusieurs assignés compte pour chacun »). Boutons « Ajouter le diagramme » / « Enregistrer » et « Annuler ». Notifications « Diagramme ajouté. » / « Diagramme modifié. ». La première erreur de validation s’affiche en alerte et bloque l’enregistrement.

Le titre n’est pas dans l’éditeur : il se change par « Renommer ». Un nouveau diagramme prend un titre par défaut selon sa source, qui suit la source tant qu’il n’a pas été renommé :

| Source      | Titre par défaut                   | Réglages par défaut                                                                                     |
| ----------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Tâches      | « Tâches créées par semaine »      | Barres, axe date de création, par semaine, 3 derniers mois, nombre.                                     |
| Facturation | « Chiffre d’affaires HT par mois » | Barres, date du document, par mois, cette année, montant HT, types facture + facture d’acompte + avoir. |
| Trésorerie  | « Entrées et sorties par mois »    | Barres, date, par mois, cette année, montant net, séries entrée / sortie.                               |

### Champs

- **Source** (contrôle segmenté) : « Tâches », « Facturation », « Trésorerie ». Changer de source repart des réglages par défaut de la nouvelle source. Dans un espace PERSO, « Facturation » n’est pas proposée (sauf pour un diagramme déjà sur cette source).
- **Type** : « Barres », « Barres empilées », « Courbes », « Aires », « Anneau », « Burndown de sprint » (tâches seulement). Avec des jeux de données supplémentaires ou des comparaisons, ni anneau ni burndown.
- **Burndown** : « Sprint » (requis ; placeholder « Aucun sprint : créez-en dans l’onglet Sprints d’un projet » s’il n’y en a pas ; dans un projet, ses sprints seulement ; les sprints archivés ne sont plus proposés sauf celui du diagramme) et « Reste à faire » : « Tâches » ou « Effort ».
- **Axe** (« Parts » pour un anneau), groupé en « Dates » et « Champs » selon la source (voir tableau ci-dessous).
- **Mesure** selon la source.
- Sur un axe de dates : **« Regrouper par »** (jour, semaine, mois, trimestre, année) et **« Période »**. Pour les tâches, période glissante : « 4 dernières semaines », « 3 derniers mois », « 6 derniers mois », « 12 derniers mois », « 24 derniers mois », « 3 prochains mois », « 6 prochains mois », « 12 prochains mois », « Toute la période ». Pour la facturation et la trésorerie, période calendaire : mois, trimestre ou année, au choix « courant », « précédent » ou « choisi » (sélecteur de mois ou d’année ; un trimestre se choisit par l’un de ses mois).
- **« Séries »** (« Séries du jeu principal » avec plusieurs jeux) : un champ de la source autre que l’axe, ou « Aucune (une seule série) ». Absent pour un anneau et pour le solde de trésorerie.
- **« Cumulé (total depuis le début de la période) »** : sur un axe de dates, sauf anneau et solde.
- **« Pleine largeur »**.
- **Filtres des éléments comptés** (« Jeu principal — tâches comptées », « documents comptés » ou « mouvements comptés ») :
  - Tâches : « Recherche » (libellé, description), constructeur de filtres des vues de tâches, « Inclure les tâches archivées ».
  - Facturation : « Types de documents », « Clients », « Statuts de suivi » (libellé suivi de « (devis) » ou « (factures) »), « Avoirs en négatif (chiffre d’affaires net) » (activé par défaut), « Inclure les documents importés » (activé), « Inclure les brouillons » (désactivé).
  - Trésorerie : « Comptes », « Catégories » (arborescence sous « Entrées » / « Sorties » ; une catégorie inclut ses sous-catégories), « Mouvements » : « Tous », « Entrées », « Sorties », « Inclure le prévisionnel (prévisions, factures à encaisser, factures récurrentes à venir) ».
  - Les valeurs archivées (clients, statuts, catégories) ne sont plus proposées, mais celles déjà choisies restent.
- Dans un tableau de projet, pour la facturation et la trésorerie, rappel : seuls les éléments rattachés au projet ou à ses sous-projets comptent (« le solde reste celui de tous les comptes »).

### Axes, séries et mesures par source

| Source      | Dates                                                                   | Champs (axe ou séries)                                                                                          | Mesures                                                          |
| ----------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Tâches      | Date de création, Date de fermeture, Date de début, Date de fin         | Sprint, Jalon, Projet, Statut, Catégorie de statut, Priorité, Type, Assigné, Étiquette, État (ouverte / fermée) | Nombre, Effort, Temps passé (h)                                  |
| Facturation | Date du document, Échéance / validité, Date d’envoi, Date d’acceptation | Type de document, Statut de suivi, Client, Projet, Paiement, Brouillon / définitif, Ordo / importé              | Montant HT, Montant TTC, Montant payé, Reste dû, Nombre          |
| Trésorerie  | Date                                                                    | Catégorie, Membre ou relation, Contexte, Compte, Entrée / sortie, Projet, Réel / prévu                          | Montant net (entrées − sorties), Entrées, Sorties, Solde, Nombre |

### Jeux de données et comparaisons

Section « Jeux de données et comparaisons » (absente pour un burndown, un anneau ou le solde de trésorerie) :

- « Dupliquer le jeu principal » : copie du jeu principal nommée « <libellé> (filtré) », pour resserrer son filtre et comparer un sous-ensemble à l’ensemble (aide affichée).
- « Nouveau jeu » : un jeu de la source du diagramme, nommé « <Source> N ».
- Avec au moins un jeu : « Libellé du jeu principal » (par défaut le nom de la mesure) et un accordéon par jeu : « Libellé » (requis), source, « Mesure » (pas de solde de trésorerie), « Date » sur un axe de dates (« Date des éléments sur l’axe. »), « Type de diagramme » (« Comme le graphique », « Barres », « Courbe », « Aire »), « Séries », filtres de sa source ; bouton « Retirer » (retire aussi les comparaisons qui l’utilisent).
- « Comparer deux jeux » : une comparaison « Pourcentage (A / B) » (part du total de A dans celui de B, en %, sur l’axe de droite) ou « Différence (A − B) », dessinée en barres, courbe (pointillés) ou aire ; choix de A et B ; libellé par défaut « % <A> / <principal> ».
- Ajouter un jeu à un anneau ou un burndown le passe en barres. Au plus 8 jeux supplémentaires et 8 comparaisons.

## Déplacer un diagramme vers un autre tableau

Panneau « Déplacer « X » » : « Destination » (« Tableau de bord général (tous les projets) » ou un projet non archivé, en arborescence), puis « Tableau de bord » parmi ceux, non archivés, de la destination. Sans tableau à la destination : « Ce projet n’a pas encore de tableau de bord : un tableau « Tableau de bord » sera créé. » (ou « Aucun autre tableau de bord général… »). Rappel : « Le diagramme quitte son tableau de bord actuel. Il ne comptera plus que le projet et ses sous-projets. » (ou « Il comptera tous les projets. »). Notification « Diagramme déplacé. »

## Exports

| Export             | Contenu                                                                                                                                                                                                                                                                                                                                    | Fichier                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Tableau en PDF     | Un diagramme par page, A4 paysage, couleurs claires ; titre « <portée> — <tableau> », sous-titre « N diagrammes · exporté le … »                                                                                                                                                                                                           | `<portée> — <tableau>.pdf`           |
| Diagramme en PDF   | Le diagramme seul ; sous-titre « <portée> — <tableau> · exporté le … »                                                                                                                                                                                                                                                                     | `<titre>.pdf`                        |
| Diagramme en image | PNG avec titre au-dessus et légende en dessous. Réglages : « Thème » (« Clair » / « Foncé »), « Orientation » (« Paysage » / « Portrait », inactive en 1:1), « Format » (16:9, 4:3, 3:2, A4, 1:1), « Taille (grand côté) » (HD 1 280, Full HD 1 920, QHD 2 560, 4K 3 840 px). Taille finale affichée. Réglages retenus dans ce navigateur. | `<portée> — <tableau> — <titre>.png` |
| Données en CSV     | Une ligne par valeur de l’axe, une colonne par série ; ligne « Total » quand une somme a du sens ; format tableur français (points-virgules, virgules décimales, UTF-8 avec BOM), colonnes de pourcentage suffixées « (%) »                                                                                                                | `<portée> — <tableau> — <titre>.csv` |
| Données en PDF     | Même tableau, montants en euros, ratios en %, mis en page par l’API                                                                                                                                                                                                                                                                        | `<titre>.pdf`                        |

Un diagramme pas encore affiché ne peut pas être exporté (« « X » n’est pas encore affiché. ») ; un diagramme vide non plus (« « X » est vide. »).

## Calculs visibles

- Les tâches comptées suivent les mêmes filtres que les vues de tâches ; une tâche à plusieurs assignés ou étiquettes compte pour chacun.
- Par sprint : une tâche compte dans chacun de ses sprints où elle correspondait au filtre, avec son statut **à la fin du sprint** pour les sprints terminés (maintenant pour les autres).
- Effort : celui des tâches sans sous-tâches (l’effort d’une parente est celui de ses sous-tâches).
- Burndown : reste à faire à la fin de chaque jour du sprint contre la droite « Idéal » ; les jours futurs sont vides.
- Facturation : documents archivés exclus ; « Paiement » distingue « Payé », « Partiellement payé », « À payer », « En retard », « À rembourser », « Soldé », « Sans objet » (brouillons et devis).
- Trésorerie : les entrées et sorties liées d’une même tranche se compensent (montants seulement) ; une écriture ventilée compte ligne par ligne ; « Solde » donne le solde des comptes à la fin de chaque tranche, « Réel » jusqu’à aujourd’hui puis « Prévu » en pointillés.
- Une semaine commence au premier jour de semaine de l’espace.

## Différences PRO / PERSO

Dans un espace PERSO, la source « Facturation » n’est pas proposée dans l’éditeur ni pour les jeux de données (un diagramme existant sur cette source la garde). Tout le reste est identique.
