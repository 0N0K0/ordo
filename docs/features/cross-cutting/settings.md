# Paramètres

Où se règle quoi : le panneau de paramètres de chaque page (barre latérale de droite ouverte par le bouton ⚙) et la page « Paramètres » de l’espace, section par section. Vue fonctionnelle seulement. Sources : `apps/web/src/app/layout/{PageSettings,SettingsAside,SettingsButton,SettingsOverlay}.tsx`, `apps/web/src/app/layout/page-settings.ts`, `apps/web/src/features/projects/pages/SettingsPage.tsx` et les composants de paramètres de chaque feature. Code des briques communes : [components/settings](../../web/components/settings.md) ; cadre de l’app : [app](../../web/app.md).

## Le panneau de paramètres d’une page

- Les pages qui ont des paramètres affichent dans l’en-tête un bouton ⚙ (variante légère, toujours à la même place, avant « Ajouter »). Son libellé est le titre du panneau (« Paramètres des tâches »…) ; il passe à « Fermer » quand le panneau est ouvert (`aria-expanded`). Une page sans paramètres n’a pas de bouton.
- Le panneau s’ouvre dans une barre latérale à droite, titrée comme le bouton, avec un bouton « Fermer les paramètres ». Elle se redimensionne par son bord gauche (pas sur téléphone, où elle prend toute la largeur).
- Pendant qu’il est ouvert, un voile couvre le contenu de la page (l’en-tête et la navigation restent utilisables) ; un clic sur le voile ou Échap ferme le panneau (Échap ferme d’abord une boîte de dialogue, une liste ou un menu ouvert par-dessus).
- L’état ouvert est dans l’adresse (`?settings=1`), fermé par défaut ; un lien peut donc ouvrir les paramètres. Un panneau à onglets garde son onglet dans `?section=` (ex. `/accounting?settings=1&section=company`).
- Les sections sont des cartes empilées sur toute la largeur du panneau (ou des onglets, une section à la fois).

### Les listes de paramètres (comportement commun)

La plupart des sections sont des listes de paramètres (statuts, catégories, étiquettes…), qui se comportent toutes de la même façon :

- Chaque élément montre son avatar (image, ou initiales sur sa couleur), son nom et son nombre d’utilisations.
- « Ajouter » ouvre le formulaire dans le panneau latéral (nom, couleur, image, parent pour une arborescence, champs propres à la liste ; bouton « Créer », toast « Ajout enregistré. ») ; « Modifier » ouvre le même panneau, enregistré champ par champ (décision D22) : chaque champ dès qu’il change (nom, couleur, textes et nombres en les quittant ; adresse d’un lieu dès qu’elle est choisie, effacée ou quittée), « Enregistrement… » / « Enregistré » en haut, sans bouton. Une confirmation demandée par la liste (catégorie d’un statut de tâche qui ferme ou rouvre ses tâches) passe avant l’enregistrement ; refusée, le champ revient à sa valeur.
- Réordonner par glisser-déposer ; dans une arborescence, glisser un élément sur un autre l’y range ; menu « Ajouter un sous-élément ».
- « Archiver » / « Restaurer » (avec annulation) ; les archivés sont masqués derrière « Afficher les archivés », en lecture seule.
- « Supprimer » (dans le menu « … ») après confirmation : « « X » sera supprimé définitivement et retiré des N … qui l’utilisent. » ; dans une arborescence : « Ses sous-éléments remonteront d’un niveau. »
- Depuis un champ de sélection (étiquettes, statuts, catégories, unités, magasins, lieux…), « Créer « … » » ouvre ce même formulaire dans le panneau latéral, le libellé tapé déjà rempli, couleur et image comprises ; la nouvelle valeur est alors choisie.
- États vides : « Aucun élément pour le moment. », « Tous les éléments sont archivés. »

Règles détaillées : [Nommage](../../business-rules/cross-cutting/naming.md), [Archivage](../../business-rules/cross-cutting/archiving.md), [Ordre](../../business-rules/cross-cutting/ordering.md).

## Panneaux par page

### Tâches — « Paramètres des tâches »

Page `/tasks` ; aussi dans l’onglet « Tâches » des paramètres d’un projet. Réglages de tout l’espace, valables dans toutes les vues de tâches. Voir [Tâches](../activities/tasks.md).

| Section                         | Ce qu’elle gère                                                                                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Colonnes des nouvelles vues » | Colonnes affichées et leur ordre (glisser-déposer) quand une vue de tâches est créée ; les vues existantes gardent les leurs. « Colonnes de l’app » revient aux colonnes par défaut.         |
| « Statuts de tâche »            | Statuts, chacun avec sa catégorie (badge). La catégorie donne son sens au statut (filtres, tâches « en cours » de l’accueil) ; c’est l’état ouvert / fermé qui dit si la tâche est terminée. |
| « Priorités »                   | Priorités ; leur ordre est celui des listes et du tri par priorité.                                                                                                                          |
| « Types de tâche »              | Bug, fonctionnalité, amélioration…                                                                                                                                                           |
| « Étiquettes »                  | Plusieurs par tâche ; synchronisées avec les labels GitHub.                                                                                                                                  |

### Projet — « Paramètres du projet »

Page `/projects/:id`. Onglets (depuis l’onglet « Tâches » du projet, le panneau s’ouvre sur « Tâches », sinon sur « Jalons »). Les anciennes adresses d’onglets de paramètres (`?tab=milestones`…) ouvrent la section correspondante. Voir [Projets](projects.md).

| Onglet            | Ce qu’il gère                                                                                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Tâches »        | Les paramètres des tâches de l’espace (ci-dessus).                                                                                                                                             |
| « Jalons »        | Jalons du projet, utilisables par les tâches du projet et de ses sous-projets.                                                                                                                 |
| « Sprints »       | Sprints du projet, mêmes règles d’usage.                                                                                                                                                       |
| « Contributeurs » | Contributeurs rattachés au projet, hérités des projets parents, et « Moi » : seuls eux sont proposés comme assignés de ses tâches ([Personnes](../../business-rules/cross-cutting/people.md)). |
| « GitHub »        | Lien du projet avec un tableau GitHub Projects : dépôt des nouvelles issues, synchronisation dans les deux sens, dernière erreur ([GitHub](github.md)).                                        |
| « Projet »        | Le formulaire du projet lui-même (nom, couleur, icône…).                                                                                                                                       |

### Client — « Paramètres du client »

Page `/clients/:id` (espaces PRO). Voir [Projets](projects.md) et [Facturation](../finances/accounting.md).

| Onglet                    | Ce qu’il gère                                                                                                                                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Facturation »           | Coordonnées de facturation du client (actions « Coordonnées », « Nouveau service », « Nouveau contact »), identifiants SIREN / SIRET / TVA / activité, avertissement « Adresse de facturation à renseigner avant d’éditer des factures. », contacts et services. |
| « Nom, couleur et icône » | Le formulaire du client.                                                                                                                                                                                                                                         |

### Facturation — « Paramètres de la facturation »

Page `/accounting` (espaces PRO). Voir [Facturation](../finances/accounting.md).

| Onglet         | Ce qu’il gère                                                                                                                                                                                                                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| « Export ZIP » | « Télécharger les documents d’une période » en archive ZIP.                                                                                                                                                                                                                                                                                                                    |
| « Suivi »      | « Statuts des devis » et « Statuts des factures » : statuts de suivi, chacun avec sa catégorie, qui règle le suivi automatique (« À envoyer » à la validation, « Envoyé(e) » à l’envoi par mail, « Accepté » / « Payée »…).                                                                                                                                                    |
| « Ma société » | « Ma société » (imprimée sur les devis, factures et avoirs : identité, forme juridique, capital, SIREN, SIRET, NAF, immatriculation, contact, TVA ou « TVA non applicable » avec sa mention, coordonnées bancaires, échéance par défaut, mentions) et « Numérotation » (numéro du prochain document définitif de chaque type, par année ; les brouillons n’ont pas de numéro). |

### Trésorerie — « Paramètres de la trésorerie »

Page `/treasury`. Sections empilées. Voir [Trésorerie](../finances/treasury.md).

| Section                                             | Ce qu’elle gère                                                                                                                                                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Comptes »                                         | Comptes bancaires, avec le solde du relevé à une date : point de départ des mouvements et du prévisionnel.                                                                                         |
| « Équipe » (PRO) / « Foyer » (PERSO)                | Membres entre lesquels les mouvements se répartissent ; chaque membre est aussi un contributeur.                                                                                                   |
| « Relations » (PRO) / « Proches » (PERSO)           | Personnes hors de l’équipe ou du foyer pour qui une ligne ou un budget peut être (prêt, cadeau…) ; les organismes restent des tiers.                                                               |
| « Contextes »                                       | Contextes de dépense (vacances…) ; une ligne sans contexte est du quotidien. Supprimer un contexte supprime ses périodes planifiées.                                                               |
| « Contextes planifiés »                             | Périodes où les lignes datées prennent un contexte ; changer une période ne modifie pas les lignes déjà enregistrées.                                                                              |
| « Catégories d’entrées », « Catégories de sorties » | Catégories en arborescence ; une sous-catégorie sans couleur prend celle de sa parente.                                                                                                            |
| « Factures et avoirs » (PRO seulement)              | Catégorie des règlements des factures et des remboursements des avoirs, pour les budgets ; « Aucune (hors budget) ».                                                                               |
| « Moyens de paiement »                              | Virement, carte, chèque…, pour les entrées, les sorties ou les deux.                                                                                                                               |
| « Tiers »                                           | Émetteurs et destinataires qui ne sont pas des clients (fournisseurs, administrations, banques…) ; supprimer un tiers laisse ses mouvements sans émetteur ou destinataire (mieux vaut l’archiver). |

### Agenda — « Paramètres de l’agenda »

Page `/calendar`. Voir [Agenda](../activities/calendar.md).

| Onglet                  | Ce qu’il gère                                                                                                                                                                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Affichage et export » | « Affichage » : calendriers et créneaux affichés ou masqués, « Aussi dans l’agenda » (Tâches, Routines, créneaux, Chronos, archivés), « Heures (semaine, jour) » « Par 5 minutes » (sinon par 30). « Exporter » : « Vue en PDF » et l’export ICS des calendriers.                                                                           |
| « Paramètres »          | « Calendriers » et « Calendriers des autres espaces » (abonnements en lecture seule), « Catégories d’agenda » (arborescence ; filtrer sur une catégorie inclut ses sous-catégories), « Créneaux sans type », « Types de créneaux » (couleur et affichage), « Créneaux des autres espaces » (abonnement à un type de créneau d’un autre espace). |

Les créneaux eux-mêmes se gèrent par un bouton de la page, pas dans le panneau.

### Mails — « Paramètres des mails »

Page `/mail`. Voir [Mails](../resources/mail.md).

| Section         | Ce qu’elle gère                                                                                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Boîtes mail » | Comptes IMAP / SMTP : ajouter, modifier, signature, archiver (plus lus ni synchronisés), restaurer, supprimer. Seuls les mails rattachés à un projet sont copiés dans Ordo. Sans boîte active, cette section s’affiche dans la page elle-même. |
| « Drapeaux »    | Drapeaux posés sur les mails (mots-clés IMAP, ou gardés dans Ordo quand le serveur ne les accepte pas).                                                                                                                                        |

### Routines — « Paramètres des routines »

Page `/routines`. Section « Catégories » : arborescence des catégories de routines. Voir [Routines](../activities/routines.md).

### Achats — « Paramètres des achats »

Pages `/shopping` et page d’une liste. Voir [Achats](../supplies/shopping.md).

| Section                   | Ce qu’elle gère                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| « Catégories »            | Catégories des produits, en arborescence (partagées avec les fiches) ; une catégorie peut être réservée à certaines références. |
| « Magasins »              | « Où vous achetez les produits. » (PERSO) / « Magasins et fournisseurs des produits. » (PRO).                                   |
| « Unités »                | Unités de quantité ; renommer une unité la renomme dans les produits et les listes.                                             |
| « Modes de conservation » | Frais, congélation, à l’abri de la lumière…                                                                                     |

### Fiches — « Paramètres des fiches »

Pages `/sheets` et page d’une fiche. Sections « Catégories de fiches » (plusieurs par fiche) et « Catégories » des articles (les mêmes que celles des achats). Voir [Fiches](../supplies/sheets.md).

### Inventaire — « Paramètres de l’inventaire »

Page `/stock`. Section « Emplacements » : où sont rangés les articles, en arborescence (Cuisine › Frigo). Voir [Inventaire](../supplies/stock.md).

### Pages sans panneau

Accueil, Chronos, Alarmes, Documents, Tableaux de bord, Mon compte et la page Paramètres n’ont pas de panneau de paramètres.

## Page « Paramètres » de l’espace

Route `/settings` (lien « Paramètres » en bas du menu latéral). Réglages de tout l’espace, en onglets ; l’onglet est dans l’adresse (`?tab=`). Les sections sont des cartes en grille (trois au plus côte à côte).

| Onglet                                                                 | Ce qu’il gère                                                                                                                                                                                                           |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Projets »                                                            | « Statuts de projet » (au plus un par projet, l’ordre est celui des listes) et « Catégories de projet » (plusieurs par projet).                                                                                         |
| « Équipe et contributeurs » (PRO) / « Foyer et contributeurs » (PERSO) | Membres de l’équipe ou du foyer, relations ou proches, et « Contributeurs » (personnes assignables aux tâches, à rattacher aux projets). Voir [Personnes](../../business-rules/cross-cutting/people.md).                |
| « Lieux »                                                              | Lieux (carte et arborescence) : une adresse par lieu et des zones sans adresse ; ils situent évènements et routines et servent aux temps de trajet. Voir [Lieux](geo.md).                                               |
| « GitHub »                                                             | « Connexion » (jeton d’accès personnel, chiffré en base) et « Contributeurs sur GitHub » (login GitHub de chaque contributeur). Voir [GitHub](github.md).                                                               |
| « Espaces »                                                            | Espaces : ajouter (professionnel ou personnel), renommer, changer le type, réordonner, ouvrir, supprimer ; premier et dernier jour de la semaine ; notifications d’un espace non ouvert. Voir [Espaces](workspaces.md). |

Les anciennes adresses d’onglets déplacés redirigent vers le panneau de leur page :

| Ancien onglet   | Redirige vers                                              |
| --------------- | ---------------------------------------------------------- |
| `?tab=tracking` | `/accounting?settings=1` (PERSO : accueil)                 |
| `?tab=company`  | `/accounting?settings=1&section=company` (PERSO : accueil) |
| `?tab=calendar` | `/calendar?settings=1`                                     |
| `?tab=mail`     | `/mail?settings=1`                                         |
| `?tab=tasks`    | `/tasks?settings=1`                                        |

Les réglages personnels (identifiant, adresse email, mot de passe…) sont dans « Mon compte » : voir [Compte](account.md).

## Différences PRO / PERSO

- Pas de panneau « Paramètres de la facturation » ni de page client en PERSO (pas de facturation ni de clients) ; la section « Factures et avoirs » de la trésorerie est absente.
- Libellés : « Équipe » / « Foyer », « Relations » / « Proches », description des « Magasins ».
