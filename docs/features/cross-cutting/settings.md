# Paramètres

Où se règle quoi : le panneau de paramètres de chaque page (barre latérale de droite ouverte par le bouton ⚙) et la page « Paramètres » de l’espace, section par section. Vue fonctionnelle seulement. Sources : `apps/web/src/app/layout/{PageSettings,SettingsAside,SettingsButton,SettingsOverlay}.tsx`, `apps/web/src/app/layout/page-settings.ts`, `apps/web/src/features/projects/pages/SettingsPage.tsx` et les composants de paramètres de chaque feature. Code des briques communes : [components/settings](../../web/components/settings.md) ; cadre de l’app : [app](../../web/app.md).

## Le panneau de paramètres d’une page

- Les pages qui ont des paramètres affichent dans l’en-tête un bouton ⚙ (variante légère, toujours à la même place, avant « Ajouter »). Son libellé est le titre du panneau (« Paramètres des tâches »…) ; il passe à « Fermer » quand le panneau est ouvert (`aria-expanded`). Une page sans paramètres n’a pas de bouton.
- Le panneau s’ouvre dans une barre latérale à droite, titrée comme le bouton, avec un bouton « Fermer les paramètres ». Elle se redimensionne par son bord gauche (pas sur téléphone, où elle prend toute la largeur).
- Pendant qu’il est ouvert, un voile couvre le contenu de la page (l’en-tête et la navigation restent utilisables) ; un clic sur le voile ou Échap ferme le panneau (Échap ferme d’abord une boîte de dialogue, une liste ou un menu ouvert par-dessus).
- L’état ouvert est dans l’adresse (`?settings=1`), fermé par défaut ; un lien peut donc ouvrir les paramètres. Un panneau à onglets garde son onglet dans `?section=` (ex. `/accounting?settings=1&section=company`).
- Les sections sont des cartes empilées sur toute la largeur du panneau (ou des onglets, une section à la fois).
- Un paramètre commun à plusieurs endroits apparaît à chaque endroit pertinent, le même partout (mêmes valeurs, même enregistrement) : voir [Où chaque section apparaît](#où-chaque-section-apparaît) et la règle dans [l’app](../../web/app.md#paramètres).

### Les listes de paramètres (comportement commun)

La plupart des sections sont des listes de paramètres (statuts, catégories, étiquettes…), qui se comportent toutes de la même façon :

- Chaque élément montre son avatar (image, ou initiales sur sa couleur), son nom et son nombre d’utilisations.
- « Ajouter » ouvre le formulaire dans le panneau latéral (nom, couleur, image, parent pour une arborescence, champs propres à la liste ; bouton « Créer », toast « Ajout enregistré. ») ; « Modifier » ouvre le même panneau, enregistré champ par champ : chaque champ dès qu’il change (nom, textes et nombres en les quittant ; couleur dès qu’elle est choisie dans le nuancier ou le sélecteur, en la quittant quand elle est tapée ; adresse d’un lieu dès qu’elle est choisie, effacée ou quittée), « Enregistrement… » / « Enregistré » en haut, sans bouton ; un élément changé ailleurs pendant que le panneau est ouvert (glissé sous un autre parent, une autre fenêtre) y prend ses nouvelles valeurs, sauf un champ en cours de saisie. Une confirmation demandée par la liste (catégorie d’un statut de tâche qui ferme ou rouvre ses tâches) passe avant l’enregistrement ; refusée, le champ revient à sa valeur.
- Réordonner par glisser-déposer ; dans une arborescence, glisser un élément sur un autre l’y range ; menu « Ajouter un sous-élément ».
- Actions de chaque élément : icônes « Ajouter un sous-élément » (arborescence), « Modifier », puis le menu « … » avec « Archiver » / « Restaurer » (avec annulation) et les actions propres à la liste ; les archivés sont masqués derrière « Afficher les archivés », en lecture seule.
- « Supprimer » (icône corbeille rouge, à côté du menu) après confirmation : « « X » sera supprimé définitivement et retiré des N … qui l’utilisent. » ; dans une arborescence : « Ses sous-éléments remonteront d’un niveau. »
- Depuis un champ de sélection (étiquettes, statuts, catégories, unités, magasins, lieux…), « Créer « … » » ouvre ce même formulaire dans le panneau latéral, le libellé tapé déjà rempli, couleur et image comprises ; la nouvelle valeur est alors choisie.
- États vides : « Aucun élément pour le moment. », « Tous les éléments sont archivés. »

Règles détaillées : [Nommage](../../business-rules/cross-cutting/naming.md), [Archivage](../../business-rules/cross-cutting/archiving.md), [Ordre](../../business-rules/cross-cutting/ordering.md).

## Panneaux par page

### Tâches — « Paramètres des tâches »

Page `/tasks` ; aussi dans les paramètres d’un projet depuis son onglet « Tâches ». Réglages de tout l’espace, valables dans toutes les vues de tâches. Voir [Tâches](../activities/tasks.md).

| Section                         | Ce qu’elle gère                                                                                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Statuts de tâche »            | Statuts, chacun avec sa catégorie (badge). La catégorie donne son sens au statut (filtres, tâches « en cours » de l’accueil) ; c’est l’état ouvert / fermé qui dit si la tâche est terminée. |
| « Priorités »                   | Priorités, communes aux tâches et aux routines (leurs usages comptent les deux ; aussi dans les paramètres des routines) ; leur ordre est celui des listes et du tri par priorité. |
| « Types »                       | Communs aux tâches et aux routines (leurs usages comptent les deux ; aussi dans les paramètres des routines) : bug, fonctionnalité, ménage, courses… |
| « Étiquettes »                  | Plusieurs par tâche ; synchronisées avec les labels GitHub.                                                                                                                                  |
| « Colonnes des nouvelles vues » | Du tableau des tâches, en dernier (voir [Colonnes des nouvelles vues](#colonnes-des-nouvelles-vues)).         |

### Projet — « Paramètres du projet »

Page `/projects/:id`. Onglets : d’abord les paramètres de l’espace propres à l’onglet affiché de la page du projet (seulement ceux-là), puis ceux du projet lui-même : « Jalons » et « Sprints » seulement depuis l’onglet « Tâches » (ils ne servent qu’aux tâches), puis « Contributeurs », « GitHub » et « Projet » depuis tous les onglets. Le panneau s’ouvre sur le premier onglet de paramètres (ceux de l’onglet affiché s’il en a, sinon « Contributeurs ») ; changer d’onglet de la page garde une section du projet quand le nouvel onglet la montre, et passe sinon au premier onglet de paramètres du nouvel onglet. Les anciennes adresses d’onglets de paramètres (`?tab=contributors`…) ouvrent la section correspondante (`?tab=taskSettings`, `?tab=milestones`, `?tab=sprints` : sur l’onglet « Tâches »). Voir [Projets](projects.md).

Les paramètres de l’espace repris dans un projet sont ceux de l’espace (les mêmes listes, le même enregistrement que sur la page de chaque fonctionnalité) ; une ligne le dit au-dessus : « Ces paramètres valent pour tout l’espace, pas seulement pour ce projet. »

| Onglet            | Ce qu’il gère                                                                                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Tâches »        | Depuis l’onglet « Tâches » : les paramètres des tâches de l’espace (ci-dessus), automatisations et colonnes des nouvelles vues comprises.                                                        |
| « Routines »      | Depuis l’onglet « Routines » : les paramètres des routines de l’espace (ci-dessous).                                                                                                           |
| « Achats »        | Depuis l’onglet « Achats » : les paramètres des achats de l’espace.                                                                                                                            |
| « Fiches »        | Depuis l’onglet « Fiches » : les paramètres des fiches de l’espace.                                                                                                                            |
| « Temps »         | Depuis l’onglet « Temps » : la semaine de l’espace (« Cette semaine » des temps) et les colonnes des nouvelles vues des temps.                                                                  |
| « Facturation »   | Depuis l’onglet « Facturation » (PRO) : « Suivi » (statuts des devis et des factures) et « Ma société » (avec la numérotation) de la facturation, puis les colonnes des nouvelles vues des documents d’un projet ou d’un client ; l’export ZIP reste sur la page Facturation. |
| « Mails »         | Depuis l’onglet « Mails » : les boîtes mail et les drapeaux de l’espace.                                                                                                                       |
| « Jalons »        | Depuis l’onglet « Tâches » : jalons du projet, utilisables par les tâches du projet et de ses sous-projets.                                                                                     |
| « Sprints »       | Depuis l’onglet « Tâches » : sprints du projet, mêmes règles d’usage.                                                                                                                          |
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

Page `/accounting` (espaces PRO) ; « Suivi » et « Ma société » aussi dans les paramètres d’un projet depuis son onglet « Facturation ». Voir [Facturation](../finances/accounting.md).

| Onglet         | Ce qu’il gère                                                                                                                                                                                                                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| « Export ZIP » | « Télécharger les documents d’une période » en archive ZIP.                                                                                                                                                                                                                                                                                                                    |
| « Suivi »      | « Statuts des devis » et « Statuts des factures » : statuts de suivi, chacun avec sa catégorie, qui règle le suivi automatique (« À envoyer » à la validation, « Envoyé(e) » à l’envoi par mail, « Accepté » / « Payée »…).                                                                                                                                                    |
| « Ma société » | « Ma société » (imprimée sur les devis, factures et avoirs : identité, forme juridique, capital, SIREN, SIRET, NAF, immatriculation, contact, TVA ou « TVA non applicable » avec sa mention, coordonnées bancaires, échéance par défaut, mentions) et « Numérotation » (numéro du prochain document définitif de chaque type, par année ; les brouillons n’ont pas de numéro). |
| « Colonnes »   | Dernier onglet : « Colonnes des nouvelles vues » de chaque tableau de la facturation (devis, factures, acomptes, avoirs, à envoyer, à relancer, récurrentes, catalogue, temps à facturer, documents d’un projet ou d’un client). |

### Trésorerie — « Paramètres de la trésorerie »

Page `/treasury`. Sections empilées. Voir [Trésorerie](../finances/treasury.md).

| Section                                             | Ce qu’elle gère                                                                                                                                                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Comptes »                                         | Comptes bancaires, avec le solde du relevé à une date : point de départ des mouvements et du prévisionnel.                                                                                         |
| « Équipe » (PRO) / « Foyer » (PERSO)                | Membres entre lesquels les mouvements se répartissent ; chaque membre est aussi un contributeur.                                                                                                   |
| « Relations » (PRO) / « Proches » (PERSO)           | Personnes hors de l’équipe ou du foyer pour qui une ligne ou un budget peut être (prêt, cadeau…) ; les organismes restent des tiers.                                                               |
| « Contextes »                                       | Contextes de dépense (vacances…), types d’éphémérides de l’agenda « Sert de contexte au budget » : leurs éphémérides en sont les périodes (bouton « Périodes ») ; une ligne sans contexte est du quotidien. |
| « Catégories d’entrées », « Catégories de sorties » | Catégories en arborescence ; une sous-catégorie sans couleur prend celle de sa parente.                                                                                                            |
| « Factures et avoirs » (PRO seulement)              | Catégorie des règlements des factures et des remboursements des avoirs, pour les budgets ; « Aucune (hors budget) ».                                                                               |
| « Moyens de paiement »                              | Virement, carte, chèque…, pour les entrées, les sorties ou les deux.                                                                                                                               |
| « Tiers »                                           | Émetteurs et destinataires qui ne sont pas des clients (fournisseurs, administrations, banques…) ; supprimer un tiers laisse ses mouvements sans émetteur ou destinataire (mieux vaut l’archiver). |
| « Colonnes des nouvelles vues : … »                 | En dernier, une par tableau : prévisionnel, mouvements, répartition d’un mouvement, budgets du mois, hors budget, budgets définis, prêts. |

### Agenda — « Paramètres de l’agenda »

Page `/calendar`. Voir [Agenda](../activities/calendar.md).

| Onglet                  | Ce qu’il gère                                                                                                                                                                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Affichage et export » | « Affichage de la vue « X » » (réglages de la vue affichée, enregistrés avec elle) : calendriers et créneaux affichés ou masqués, « Aussi dans l’agenda » (Tâches, Routines, créneaux, Chronos, archivés), « Heures (semaine, jour) » « Par 5 minutes » (sinon par 30). « Exporter » : « Vue en PDF » (la vue affichée, ses filtres appliqués) et l’export ICS des calendriers.                                                                           |
| « Paramètres »          | « Semaine » (« Semaine du … au … » de tout l’espace ; aussi dans les paramètres des chronos et de l’onglet « Temps » d’un projet), « Calendriers » et « Calendriers des autres espaces » (abonnements en lecture seule), « Catégories d’agenda » (arborescence ; filtrer sur une catégorie inclut ses sous-catégories), « Créneaux sans type », « Types de créneaux » (couleur et affichage), « Créneaux des autres espaces » (abonnement à un type de créneau d’un autre espace), puis en dernier « Colonnes des nouvelles vues » des tableaux des créneaux et des éphémérides. |

Les créneaux eux-mêmes se gèrent par un bouton de la page, pas dans le panneau.

Réglages de l’agenda, selon ce qu’ils règlent :

| Réglage                                                                                                   | Portée      | Où                                   |
| --------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------ |
| Affichage « Mois » / « Semaine » / « Jour »                                                               | vue         | page (barre d’outils)                |
| Filtres (une section par sorte d’éléments affichée)                                                       | vue         | page (« Filtrer »)                   |
| Calendriers et créneaux / éphémérides affichés, « Aussi dans l’agenda », « Afficher les archivés », « Par 5 minutes » | vue | paramètres, « Affichage et export » |
| Ligne journée entière dépliée                                                                             | non gardé (repliée à chaque ouverture) | page (en-tête de la ligne, « +N »)   |
| Mode « Modifier les créneaux et éphémérides »                                                             | page ouverte (non gardé) | page (barre d’outils) |
| Semaine, calendriers, abonnements, catégories, créneaux sans type, types de créneaux et d’éphémérides (couleur, affichage dans l’agenda, « Indisponible »), anniversaires (couleur, « Afficher dans l’agenda »), créneaux des autres espaces, colonnes des nouvelles vues | espace | paramètres, « Paramètres » |

### Mails — « Paramètres des mails »

Page `/mail` ; aussi dans les paramètres d’un projet depuis son onglet « Mails ». Voir [Mails](../resources/mail.md).

| Section         | Ce qu’elle gère                                                                                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Boîtes mail » | Comptes IMAP / SMTP : ajouter, modifier, signature, archiver (plus lus ni synchronisés), restaurer, supprimer. Seuls les mails rattachés à un projet sont copiés dans Ordo. Sans boîte active, cette section s’affiche dans la page elle-même. |
| « Drapeaux »    | Drapeaux posés sur les mails (mots-clés IMAP, ou gardés dans Ordo quand le serveur ne les accepte pas).                                                                                                                                        |

### Routines — « Paramètres des routines »

Page `/routines` ; aussi dans les paramètres d’un projet depuis son onglet « Routines ». Sections « Catégories » (arborescence des catégories de routines), puis « Priorités » et « Types » (les mêmes que dans les paramètres des tâches : communs aux deux), puis « Colonnes des nouvelles vues » du tableau des routines. Voir [Routines](../activities/routines.md).

### Achats — « Paramètres des achats »

Pages `/shopping` et page d’une liste ; aussi dans les paramètres d’un projet depuis son onglet « Achats ». Voir [Achats](../supplies/shopping.md).

| Section                   | Ce qu’elle gère                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| « Catégories »            | Catégories des produits, en arborescence (aussi dans les paramètres des fiches et de l’inventaire) ; une catégorie peut être réservée à certaines références ; son usage compte les produits, les éléments des listes et des fiches et les articles du stock. |
| « Magasins »              | « Où vous achetez les produits. » (PERSO) / « Magasins et fournisseurs des produits. » (PRO).                                   |
| « Unités »                | Unités de quantité (aussi dans les paramètres des fiches et de l’inventaire) ; renommer une unité la renomme dans les produits et les listes. |
| « Modes de conservation » | Frais, congélation, à l’abri de la lumière…                                                                                     |
| « Colonnes des nouvelles vues : … » | En dernier : « Références », « Listes », « Une liste ». |

### Fiches — « Paramètres des fiches »

Pages `/sheets` et page d’une fiche ; aussi dans les paramètres d’un projet depuis son onglet « Fiches ». Sections « Catégories de fiches » (plusieurs par fiche), puis « Catégories » et « Unités » des éléments (les mêmes que celles des achats), puis « Colonnes des nouvelles vues » des tableaux « Fiches », « Une fiche » et « Listes à cocher » (celles des tâches, routines et évènements). Voir [Fiches](../supplies/sheets.md).

### Inventaire — « Paramètres de l’inventaire »

Page `/stock`. Sections « Emplacements » (où sont rangés les articles, en arborescence : Cuisine › Frigo), puis « Catégories » et « Unités » des articles (les mêmes que celles des achats), puis « Colonnes des nouvelles vues » des tableaux « Stock », « Lots d’un article », « Mouvements », « Historique d’un article », « Inventaires », « Faire l’inventaire ». Voir [Inventaire](../supplies/stock.md).

### Chronos — « Paramètres des chronos »

Page `/time`. Section « Semaine » (la même que dans les paramètres de l’agenda) : elle fixe « Cette semaine » des temps et du temps prévu ; puis « Colonnes des nouvelles vues : Temps passé ». Voir [Temps](../activities/time.md).

### Alarmes — « Paramètres des alarmes »

Page `/alarms`. Liste « Minuteurs enregistrés ». Voir [Alarmes](../activities/alarms.md).

### Pages sans panneau

Accueil, Documents, Tableaux de bord, Mon compte et la page Paramètres n’ont pas de panneau de paramètres.

## Où chaque section apparaît

Portée : « espace » = un réglage de tout l’espace, le même partout où il est montré ; « projet » = propre au projet ; « utilisateur » = valable dans tous les espaces ; « vue » = propre à une vue enregistrée (l’agenda), enregistré avec elle.

| Section                                                                   | Portée      | Où elle apparaît                                                                                   |
| ------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| Paramètres des tâches (statuts, priorités, types, étiquettes, automatisations, colonnes des nouvelles vues) | espace | Tâches ; projet, onglet « Tâches » |
| Colonnes des nouvelles vues (une section par tableau, toujours en dernier) | espace | Le panneau de la page de chaque tableau, et l’onglet du projet qui montre ce tableau : voir [ci-dessous](#colonnes-des-nouvelles-vues) |
| Priorités et types                                                        | espace      | Tâches ; Routines ; projet, onglets « Tâches » et « Routines »                                      |
| Paramètres des routines (catégories, priorités, types)                    | espace      | Routines ; projet, onglet « Routines »                                                              |
| Paramètres des achats (catégories, magasins, unités, conservation)        | espace      | Achats, page d’une liste ; projet, onglet « Achats »                                                |
| Catégories des articles                                                   | espace      | Achats ; Fiches ; Inventaire ; projet, onglets « Achats » et « Fiches »                             |
| Unités                                                                    | espace      | Achats ; Fiches ; Inventaire ; projet, onglets « Achats » et « Fiches »                             |
| Paramètres des fiches (catégories de fiches, catégories des articles, unités) | espace      | Fiches, page d’une fiche ; projet, onglet « Fiches »                                                |
| Semaine                                                                   | espace      | Agenda ; Chronos ; projet, onglet « Temps »                                                         |
| Suivi, Ma société et numérotation                                         | espace (PRO) | Facturation ; projet, onglet « Facturation »                                                       |
| Export ZIP de la facturation                                              | espace (PRO) | Facturation                                                                                        |
| Boîtes mail, drapeaux                                                     | espace      | Mails (et la page elle-même sans boîte active) ; projet, onglet « Mails »                           |
| Affichage de la vue de l’agenda (calendriers et créneaux affichés, « Aussi dans l’agenda », archivés, « Par 5 minutes ») | vue | Agenda |
| Calendriers, catégories d’agenda, créneaux, types, anniversaires          | espace      | Agenda                                                                                              |
| Paramètres de la trésorerie                                               | espace      | Trésorerie (« Équipe » / « Foyer » et « Relations » / « Proches » aussi dans la page Paramètres)    |
| Paramètres de l’inventaire (emplacements, catégories des articles, unités) | espace     | Inventaire                                                                                          |
| Minuteurs enregistrés                                                     | espace      | Alarmes                                                                                             |
| Jalons, sprints                                                           | projet      | Paramètres du projet, depuis son onglet « Tâches »                                                  |
| Contributeurs, GitHub du projet, formulaire du projet                     | projet      | Paramètres du projet, depuis tous ses onglets                                                       |
| Facturation et formulaire du client                                       | client      | Paramètres du client                                                                                |
| Projets, équipe et contributeurs, lieux, GitHub, espaces                  | espace      | Page Paramètres                                                                                     |
| Compte, sonnerie, notifications push                                      | utilisateur | Mon compte                                                                                          |

Onglets d’un projet sans paramètres de l’espace : « Aperçu » et « Ressources ».

## Colonnes des nouvelles vues

Chaque tableau de données a, pour tout l’espace, les colonnes (ordre et colonnes masquées) avec lesquelles démarrent ses nouvelles vues, premières vues comprises ; les vues existantes gardent les leurs. Le réglage est le même pour la page et pour les projets. Il se règle dans la section « Colonnes des nouvelles vues » (« Colonnes des nouvelles vues : <tableau> » quand un panneau en a plusieurs), toujours en dernier dans le panneau : la liste des colonnes, limitée en hauteur, défile ; on coche les colonnes affichées et on les glisse dans l’ordre voulu ; « Colonnes par défaut », sous la liste, revient aux colonnes de l’application. Règles : [Espaces](../../business-rules/cross-cutting/workspaces.md#colonnes-par-défaut-des-nouvelles-vues).

| Tableau (`tableKey`) | Où il se règle |
| --- | --- |
| `tasks` | Paramètres des tâches ; projet, onglet « Tâches » |
| `routines` | Paramètres des routines ; projet, onglet « Routines » |
| `shopping-base-list` (« Références »), `shopping-lists` (« Listes »), `shopping-list` (« Une liste ») | Paramètres des achats ; projet, onglet « Achats » |
| `sheets` (« Fiches »), `sheet-items` (« Une fiche »), `checklist` (« Listes à cocher ») | Paramètres des fiches ; projet, onglet « Fiches » |
| `stock`, `stock-lots`, `stock-movements`, `stock-item-movements`, `stock-counts`, `stock-count` | Paramètres de l’inventaire |
| `time-log` (« Temps passé ») | Paramètres des chronos ; projet, onglet « Temps » |
| `work-schedules` (créneaux), `ephemerides` | Paramètres de l’agenda, onglet « Paramètres » |
| `treasury-forecast`, `treasury-entries`, `treasury-entry-lines`, `treasury-budget-report`, `treasury-budget-outside`, `treasury-budgets`, `treasury-loans` | Paramètres de la trésorerie |
| `documents-quote`, `documents-invoice`, `documents-deposit-invoice`, `documents-credit-note`, `documents-to-send`, `overdue-invoices`, `recurring-invoices`, `catalog`, `time-billing` | Paramètres de la facturation, onglet « Colonnes » (PRO) |
| `project-documents` (« Documents d’un projet ou d’un client ») | Paramètres de la facturation, onglet « Colonnes » ; projet, onglet « Facturation » |

Sans section : les tableaux de l’import d’un relevé bancaire (`statement-import-file`, colonnes du fichier lu ; `statement-import-preview`), étapes d’un import, et la bibliothèque de documents (`library`, page sans panneau de paramètres) ; leurs nouvelles vues partent quand même du réglage s’il existe.

## Page « Paramètres » de l’espace

Route `/settings` (lien « Paramètres » en bas du menu latéral). Réglages de tout l’espace, en onglets ; l’onglet est dans l’adresse (`?tab=`). Les sections sont des cartes en grille (trois au plus côte à côte).

| Onglet                                                                 | Ce qu’il gère                                                                                                                                                                                                           |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Projets »                                                            | « Statuts de projet » (au plus un par projet, l’ordre est celui des listes) et « Catégories de projet » (plusieurs par projet).                                                                                         |
| « Équipe et contributeurs » (PRO) / « Foyer et contributeurs » (PERSO) | Membres de l’équipe ou du foyer, relations ou proches, et « Contributeurs » (personnes assignables aux tâches, à rattacher aux projets). Voir [Personnes](../../business-rules/cross-cutting/people.md).                |
| « Lieux »                                                              | Lieux (carte et arborescence) : une adresse par lieu et des zones sans adresse ; ils situent évènements et routines et servent aux temps de trajet. Voir [Lieux](geo.md).                                               |
| « GitHub »                                                             | « Connexion » (jeton d’accès personnel, chiffré en base) et « Contributeurs sur GitHub » (login GitHub de chaque contributeur). Voir [GitHub](github.md).                                                               |
| « Espaces »                                                            | Espaces : ajouter (professionnel ou personnel), renommer, changer le type, réordonner, ouvrir, supprimer ; notifications d’un espace non ouvert. Voir [Espaces](workspaces.md). |

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
