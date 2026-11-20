# Trésorerie

Ce que l’utilisateur peut faire dans la trésorerie : comptes bancaires, mouvements réels et prévus, répartition des mouvements, prévisionnel, budgets, prêts, import de relevés et relevé PDF. Sources : `apps/web/src/features/treasury/**` (page, composants), avec les règles côté API dans [Règles de la trésorerie](../../business-rules/finances/treasury.md) et le code web détaillé dans [Code web de la trésorerie](../../web/features/finances/treasury.md).

## Accès et espaces

- Page « Trésorerie », route `/treasury` (`PAGES.treasury`, icône banque), présente dans les espaces PRO et PERSO.
- Le menu de navigation affiche un badge avec le solde du jour des comptes non archivés (rouge s’il est négatif), via `TreasuryNavBadge` (`features/projects/components/NavBadges.tsx`).
- Différences PRO / PERSO :
  - en PERSO, pas de facturation : le formulaire de mouvement ne propose pas « Factures réglées » / « Avoirs remboursés », et les paramètres n’ont pas la section « Factures et avoirs » ;
  - l’ensemble des membres s’appelle « Équipe » en PRO et « Foyer » en PERSO ;
  - les personnes hors équipe s’appellent « Relations » en PRO (féminin : « la relation », « Nouvelle relation ») et « Proches » en PERSO (« le proche », « Nouveau proche »).

## Page Trésorerie

### Sans compte

- Chargement : squelette de détail (`DetailSkeleton`).
- Tant qu’aucun compte n’existe, l’en-tête propose seulement « Nouveau compte » et la page affiche l’état vide : « Aucun compte. Créez votre compte bancaire avec le solde de votre relevé à une date : les mouvements et le prévisionnel partent de là. »
- « Nouveau compte » ouvre le formulaire de compte dans le panneau latéral (mêmes champs que dans les paramètres, voir plus bas).

### En-tête

- Bouton principal « Nouveau mouvement » (ouvre « Nouveau mouvement », statut réel) avec un menu : « Nouvelle prévision » (ouvre « Nouvelle prévision », statut prévu).
- Bouton de paramètres de page : ouvre la barre latérale « Paramètres de la trésorerie » (paramètre d’URL `settings=1`).

### Chiffres clés (4 tuiles)

| Tuile                                 | Contenu                                                                                                                                                           |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Solde aujourd’hui »                 | Solde de tous les comptes ouverts aujourd’hui (rouge si négatif) ; indice : nombre de comptes non archivés (« 2 comptes »).                                       |
| « À encaisser »                       | Somme des factures validées et des factures importées encore dues (montants positifs du prévisionnel) ; indice « Factures validées non réglées ».                 |
| « En retard »                         | Somme des échéances positives dépassées (hors prévisions saisies) ; indice « N échéances dépassées » ; couleur de retard s’il y en a.                             |
| « Solde au … » / « Solde prévu au … » | Solde au dernier jour de la période affichée (réel si la période est passée, prévu sinon) ; indice « Point bas X le JJ/MM » : plus bas solde prévu de la période. |

### Évolution du solde

- Section « Évolution du solde » : graphique en aires, courbe en escalier, « Réel » (bleu) jusqu’à aujourd’hui puis « Prévu » (violet, pointillé), ligne rouge à 0.
- Période : un mois, un trimestre ou une année civile (contrôle segmenté « Durée de la période », options `CALENDAR_SCALE_OPTIONS`), défaut : le mois courant.
- Navigation par flèches précédent / suivant et bouton « aujourd’hui » (`PeriodNav`) ; un bouton au milieu affiche le nom de la période et ouvre un sélecteur de mois (mois ou trimestre, choisi par l’un de ses mois) ou d’année.
- Changer d’échelle garde la période qui contient le premier jour de la période précédente.
- Le prévisionnel (liste des mouvements attendus) va toujours au moins un an après aujourd’hui, quelle que soit la période affichée.
- Pendant le chargement : squelette de bloc.

### Onglets

Onglets de page (paramètre d’URL `tab`) : « Prévisionnel » (`forecast`, défaut), « Mouvements » (`entries`), « Budgets » (`budgets`), « Prêts » (`loans`). Les anciennes valeurs `tab=settings` et `tab=accounts` ouvrent la barre latérale des paramètres. Changer d’onglet garde la barre latérale telle qu’elle est.

## Onglet « Prévisionnel »

Table unique (`DataTable`, clé de vue `treasury-forecast`, titre « Prévisionnel ») des mouvements attendus d’ici au moins un an : prévisions saisies (et chaque répétition), mouvements réels datés après aujourd’hui, factures et avoirs dus, factures importées non réglées, factures récurrentes à venir. Les éléments en retard sont attendus aujourd’hui.

### Colonnes du prévisionnel

| Colonne              | Détail                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Mois »             | Mois de la date attendue (pour grouper).                                                                                                                                                                                                                                                                                               |
| « Date d’exécution » | Date attendue ; modifiable en place pour une prévision non répétée ou un mouvement réel à venir ; badge « Prévu le JJ/MM » si en retard. Filtre date.                                                                                                                                                                                  |
| « Libellé »          | Verrouillé. Lien vers le document pour une facture / un avoir (badge archivé si besoin) ; texte modifiable en place pour un mouvement ; lien externe (`url`) ; bouton « détails » qui déplie la répartition (mouvement décomposé, ou répartition ouverte par « Répartir »).                                                            |
| « Origine »          | Badge : « Prévision » (violet), « À venir » (gris, mouvement réel futur), « Facture » (bleu), « Avoir » (orange), « Importé » (cyan), « Récurrente » (sarcelle). Filtre à choix, groupable.                                                                                                                                            |
| « En retard »        | Masquée par défaut ; filtre booléen, groupable.                                                                                                                                                                                                                                                                                        |
| Colonnes partagées   | « Compte », « Date de valeur », « Mois de valeur », « Émetteur / destinataire », « Catégories », « Moyen de paiement », « Projet », « Pièces justificatives », « Mouvements liés », « Répétition » (voir [Colonnes partagées des mouvements](#colonnes-partagées-des-mouvements)). Vides pour une ligne sans mouvement (facture due…). |
| « Montant »          | Signé ; modifiable en place pour un mouvement ; total en pied. Filtre nombre.                                                                                                                                                                                                                                                          |

Une catégorie, un moyen de paiement, un tiers, une relation ou un contexte créé à la volée s'ouvre dans le panneau latéral avec le même formulaire que dans les paramètres, couleur et image comprises, le libellé tapé déjà rempli.

### Actions du prévisionnel

- Recherche « Rechercher (libellé, tiers) », vues, filtres, tris, groupements, colonnes, export : comme toutes les tables (voir [Tables de données](../../web/components/data-table.md)).
- Ligne d’une prévision : action principale « Réaliser » ; menu « Modifier la prévision », « Dupliquer », « Archiver » / « Restaurer », « Supprimer ».
- Ligne d’un mouvement réel à venir : action principale « Modifier le mouvement » ; menu « Dupliquer », « Archiver » / « Restaurer », « Supprimer ».
- Factures, avoirs, importés, récurrentes : pas d’action de ligne (le libellé mène au document).
- Sélection (« N prévisions ») : « Archiver » et « Supprimer » sur les prévisions saisies seulement ; si des factures à venir sont sélectionnées, la confirmation précise « (les factures à venir sélectionnées ne le sont pas) ».
- Édition en place et en masse : une modification appliquée à la sélection d’une colonne enregistre chaque prévision une seule fois (une prévision répétée apparaît sur plusieurs lignes) ; une prévision répétée ne se déplace que par sa règle (son formulaire), pas par la cellule de date.
- « Réaliser » ouvre « Réaliser la prévision » : texte « « Libellé », prévu le JJ/MM, devient un mouvement réel. », champs « Date réelle » (requis, défaut : la date attendue) et « Montant entré » / « Montant sorti » (défaut : le montant prévu). Toast « Mouvement enregistré. ».
- Les prévisions et documents archivés sont masqués sauf si la vue les inclut ; ils comptent toujours dans les soldes et la courbe. Une prévision archivée est en lecture seule (texte + badge « Archivée »).
- État vide : « Rien d’attendu d’ici le JJ/MM/AAAA. Ajoutez des prévisions (loyer, charges…) : les factures validées non réglées et les factures récurrentes y figurent d’elles-mêmes. »

## Onglet « Mouvements »

Table des mouvements réels (clé `treasury-entries`, titre « Mouvements »), tous chargés ; ce sont les vues qui choisissent la période.

### Vues créées la première fois

| Vue                              | Configuration                                                   |
| -------------------------------- | --------------------------------------------------------------- |
| « Ce mois-ci » (ouverte d’abord) | Filtre date « ce mois-ci ».                                     |
| « Cette année »                  | Filtre date « cette année », groupé par mois, mois décroissant. |
| « Tous »                         | Groupé par mois, mois décroissant.                              |

### Colonnes des mouvements

« Mois », « Date d’exécution » (modifiable), « Libellé » (verrouillé, modifiable, lien externe, bouton « détails »), colonnes partagées (sans « Répétition », « Compte » et « Date de valeur » toujours remplies), « Documents réglés » (masquée par défaut : badges des factures / avoirs réglés avec montant, lien vers le document ; filtre booléen), « Montant » (signé, modifiable, total), et une colonne de commentaires (nombre de commentaires, note).

### Barre et totaux

- Recherche « Rechercher (libellé, tiers, documents) ».
- Option d’affichage « Répartitions dépliées » (si des mouvements sont décomposés) : déplie ou replie toutes les répartitions.
- Export : « Relevé de compte (PDF) » (voir [Relevé PDF](#relevé-de-compte-pdf)).
- Outils : « Importer un relevé » (désactivé sans compte ouvert), puis à droite « Entrées X · Sorties Y » des lignes affichées et, s’il y en a, « Z compensés par des mouvements liés ».
- Résumé de groupe : « +entrées · −sorties » (mouvements liés compensés).

### Actions sur les mouvements

- Ligne : « Modifier » (principale), « Dupliquer », « Répartir » (mouvement non décomposé : déplie sa répartition, vide, sous lui), « Archiver » / « Restaurer », « Supprimer ». Mêmes actions sur un mouvement ou une prévision du prévisionnel.
- Sélection (« N mouvements ») : « Archiver », « Supprimer ».
- Confirmation de suppression : « … sera supprimé définitivement. », plus « Les documents qu’il règle redeviendront dus. » et « Ses liens avec d’autres mouvements seront retirés. » selon le cas.
- Un mouvement archivé : masqué sauf si la vue l’inclut, lecture seule, badge « Archivé » ; il compte dans les soldes, le prévisionnel et les relevés.
- État vide : « Aucun mouvement pour le moment. »

### Répartition dépliée

La répartition d’un mouvement ne se fait qu’ici, pas dans son formulaire. Sous un mouvement (bouton « détails » s’il est décomposé, action « Répartir » sinon), la table « Répartition de [libellé] » (clé `treasury-entry-lines`) liste ses lignes, un tableau comme les autres (vues, recherche, filtres, tri, regroupement, colonnes, sélection en masse). Chaque modification enregistre le mouvement entier.

- Colonnes, modifiables en place : « Libellé », « Bénéficiaire » (Moi, un membre ou une relation ; création d’une relation à la volée), « Catégorie » (du sens de la ligne ; création à la volée), « Contexte » (vide : « Quotidien » ; création à la volée), « Unité » (€ ou %, la part reste la même au changement d’unité), « Valeur », « Montant » (calculé), « Prêt » (case, seulement avec une relation), « Date » (date d’achat propre), « Projet », « Pièces justificatives », « Relative à un autre mouvement » (liens).
- Une valeur positive va dans le sens du mouvement, une négative en sens inverse (remboursement inclus dans un achat…) ; changer le signe d’une valeur retire une catégorie qui n’est plus du bon sens ; choisir un bénéficiaire qui n’est pas une relation décoche « Prêt ».
- « Ajouter une ligne » (ligne d’ajout en bas du tableau) : nouvelle ligne avec ce qui reste à répartir, pour « Moi », dans le contexte planifié ce jour-là. Désactivée quand tout est réparti : « Tout le montant est réparti : réduisez une ligne pour en ajouter une. » (une ligne sans valeur est refusée).
- Première ligne d’un mouvement (il devient décomposé) : sa catégorie et son projet passent sur les lignes, ses pièces et ses liens sur la première.
- « Retirer » (menu de la ligne) : confirmation « Retirer la ligne » (« La ligne … est retirée de la répartition de « … » : son montant redevient non réparti, ses pièces justificatives et ses liens sont détachés. »).
- « Parts égales entre les membres » (barre d’outils, s’il y a plus d’un membre) : une ligne en % par membre (la dernière prend l’arrondi) ; s’il y a déjà des lignes, confirmation « Répartir à parts égales » (« Les lignes … sont remplacées par une ligne par membre : leurs catégories, pièces justificatives et liens sont perdus. », bouton « Remplacer »).
- Recherche « Rechercher (libellé, bénéficiaire, catégorie) » ; s’il en reste, « Non réparti : X » dans la barre.
- Sans ligne : « Ce mouvement n’est pas réparti. Répartissez-le par membre, catégorie et contexte, en euros ou en pourcentage : une valeur positive va dans son sens, une négative en sens inverse (remboursement inclus dans un achat…). Ce qui reste est « non réparti ». », avec « Ajouter une ligne » et « Parts égales entre les membres ».

## Colonnes partagées des mouvements

Utilisées par le prévisionnel et les mouvements (`entryFieldColumns`) :

| Colonne                     | Défaut         | Détail                                                                                                                               |
| --------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| « Compte »                  | visible        | Liste des comptes ; filtre à choix, groupable.                                                                                       |
| « Date de valeur »          | masquée        | Date de valeur (sinon la date d’exécution).                                                                                          |
| « Mois de valeur »          | —              | Mois de la date de valeur.                                                                                                           |
| « Émetteur / destinataire » | visible        | Client ou tiers ; filtre avec « Aucun », groupable.                                                                                  |
| « Catégories »              | visible        | Chemin « Parent › Enfant » ; pour un mouvement décomposé, celles des lignes (lecture seule, « Sur les lignes »). Filtre multi-choix. |
| « Moyen de paiement »       | masquée        | Seuls les moyens du sens du mouvement sont proposés.                                                                                 |
| « Projet »                  | masquée        | Celui du mouvement ou de ses lignes.                                                                                                 |
| « Pièces justificatives »   | masquée        | Badges des documents (ouverts au clic) ; bouton de choix.                                                                            |
| « Mouvements liés »         | masquée        | Badges des liens (rouge : sortie, vert : entrée), croix pour délier, recherche pour lier.                                            |
| « Répétition »              | (prévisionnel) | Règle de répétition d’une prévision, modifiable.                                                                                     |

En masse, une modification qui ne convient pas à un mouvement (décomposé, ou de l’autre sens pour une catégorie ou un moyen de paiement) le laisse tel quel.

## Formulaire de mouvement

Ouvert dans le panneau latéral (large) : « Nouveau mouvement », « Nouvelle prévision » (formulaire, bouton « Ajouter »), « Modifier le mouvement » (panneau enregistré champ par champ, décision D22 : chaque champ dès qu’il change, « Libellé », « Montant », « Description », « Lien » et le montant réglé d’un document en les quittant ; les champs qui vont ensemble le sont ensemble : changer « Réel » / « Prévu » ou le sens avec ce qu’il vide, choisir un document avec le montant et le libellé qu’il donne, retirer un document ; « Enregistrement… » puis « Enregistré » en haut, sans bouton ; un champ invalide garde son erreur dessous et n’est pas enregistré, un échec le remet comme il était, dans un toast d’erreur ; le mouvement entier est enregistré chaque fois, avec sa répartition telle que le tableau l’a laissée, et un champ changé ailleurs, une cellule ou la répartition, est repris sauf pendant sa saisie). Un mouvement archivé s’ouvre en lecture seule.

| Champ                                              | Règle d’interface                                                                                                                                                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Réel » / « Prévu »                               | Contrôle segmenté ; changer vide la répétition et les documents réglés.                                                                                                                                                                     |
| « Compte »                                         | Requis ; comptes non archivés (plus celui du mouvement) ; défaut : le premier.                                                                                                                                                              |
| « Date d’exécution » / « Date d’exécution prévue » | Requis ; défaut aujourd’hui. La date de valeur suit tant qu’elle n’a pas été changée à part.                                                                                                                                                |
| « Date de valeur »                                 | Facultative : « Celle du relevé bancaire, pour information : le solde suit la date d’exécution. Vide, c’est la date d’exécution. »                                                                                                          |
| « Libellé »                                        | Requis, focus initial.                                                                                                                                                                                                                      |
| Sens « Entrée » / « Sortie » + « Montant »         | Montant requis, positif. Changer de sens vide les documents réglés, la catégorie (du mouvement et des lignes) et le moyen s’il ne sert pas ce sens.                                                                                         |
| « Catégorie »                                      | Arborescence des catégories du sens ; création à la volée (« Aucune : tapez un libellé pour la créer »). Absente si décomposé.                                                                                                              |
| « Moyen de paiement »                              | Moyens du sens ; création à la volée (le nouveau moyen sert le sens du mouvement).                                                                                                                                                          |
| « Émetteur » (entrée) / « Destinataire » (sortie)  | Clients puis tiers, archivés masqués sauf le choix actuel ; création d’un tiers à la volée.                                                                                                                                                 |
| « Projet »                                         | Projets avec chemin complet ; archivés seulement s’ils sont déjà choisis. Absent si décomposé.                                                                                                                                              |
| « Description »                                    | Markdown.                                                                                                                                                                                                                                   |
| « Lien »                                           | URL http(s) (« https://… (une commande en ligne, par exemple) »).                                                                                                                                                                           |
| « Pièces justificatives »                          | Documents de la bibliothèque ou des projets (groupés par lieu, le projet du mouvement d’abord). Absent si décomposé.                                                                                                                        |
| « Mouvements liés »                                | Badges et recherche d’un mouvement (au moins 2 caractères, avec son compte) ; un mouvement décomposé ne se lie que par ses lignes ; les lignes d’autres mouvements liées au mouvement entier sont montrées en contour. Absent si décomposé. |
| Répétition                                         | Prévision seulement (`RuleField`, sans répétition hebdomadaire).                                                                                                                                                                            |
| « Factures réglées » / « Avoirs remboursés »       | Réel et PRO seulement : lignes document + « Montant réglé » + « Retirer » ; bouton « Régler une facture » / « Rembourser un avoir » ; « X affectés sur Y ».                                                                                 |

Comportements :

- Documents proposés : factures validées (entrée) ou avoirs (sortie), Ordo ou importés, non archivés et encore dus, ou déjà réglés par ce mouvement ; libellé « N° — client (reste X) ».
- Choisir un document propose comme montant réglé le reste dû (dans la limite du montant restant à affecter) ; un mouvement sans montant prend ce montant ; un mouvement sans libellé prend « Règlement [document] » / « Remboursement [document] ».
- La répartition ne se modifie pas dans le formulaire (voir [Répartition dépliée](#répartition-dépliée)) : les lignes d’un mouvement décomposé sont gardées telles quelles à chaque enregistrement. Texte, décomposé : « Décomposé : catégorie, projet, pièces justificatives et liens se précisent sur chaque ligne de sa répartition, dépliée sous le mouvement dans le tableau (« détails »). » ; sinon : « La répartition par membre, catégorie et contexte se fait dans le tableau, une fois le mouvement enregistré : action « Répartir » de sa ligne. ». Une erreur de l’enregistrement sur une ligne s’affiche en alerte « Répartition : … ».
- « Dupliquer » (décision D20, menu d’une ligne) : la copie, « … (copie) », est enregistrée tout de suite, sans les documents réglés et avec ses propres lignes (« Mouvement dupliqué. »), puis son formulaire s’ouvre.
- En modification, les commentaires du mouvement s’affichent sous le formulaire (lecture seule s’il est archivé).
- Toast : « Mouvement ajouté. » (création).

## Onglet « Budgets »

- En haut : sélecteur « Mois » (défaut : le mois courant) et « Nouveau budget » (désactivé sans catégorie).
- Section « Budgets de [mois] » : table (clé `treasury-budget-report`) des budgets du mois : « Bénéficiaire », « Contexte », « Catégorie » (chemin + badge « Entrée » / « Sortie »), « Montant du budget », « Montant réel », « Montant prévu », « Montant restant » (rouge si dépassé pour une sortie, vert « +X » au-delà pour une entrée), « Avancement » (barre réel + prévu, info-bulle « X % (réel Y %) · budget dépassé » ou « · au-delà du budget »). Couleur de barre : sortie bleue, orange au-delà de 80 %, rouge au-delà de 100 % ; entrée bleue puis verte à 100 %. États : squelette, « Aucun budget ce mois-ci. » ou « Créez d’abord des catégories (Paramètres). ».
- Section « Hors budget » (icône d’alerte, si non vide) : « Mouvements sans budget pour leur membre, contexte et catégorie ce mois-ci. » ; colonnes clé + « Montant réel », « Montant prévu » ; action « Créer le budget » (pré-remplie avec le mois, le bénéficiaire, le contexte, la catégorie et le montant réel + prévu).
- Section « Budgets définis » (clé `treasury-budgets`) : « À partir de », « Montant » (+ / − selon le sens), « Bénéficiaire », « Contexte », « Catégorie », « Répétition », « Jusqu’à », commentaires ; tout est modifiable en place et en masse (un premier mois après le dernier déplace le dernier, et inversement). Ligne : « Modifier (et ses répétitions) », « Dupliquer », « Archiver » / « Restaurer », « Supprimer » ; sélection : « Archiver », « Supprimer ». Archivé : lecture seule. Vide : « Aucun budget. ».
- Confirmation de suppression : « … (et toutes ses répétitions) sera supprimé définitivement. Ses mouvements seront hors budget s’il n’y en a pas d’autre. »

### Formulaire de budget

« Nouveau budget » (formulaire, bouton « Créer »), « Modifier le budget » (panneau enregistré champ par champ, décision D22 : chaque champ dès qu’il change, le montant et « Tous les » en les quittant, « Enregistrement… » / « Enregistré », sans bouton ; changer de sens vide la catégorie, à choisir de nouveau avant d’enregistrer ; archivé, en lecture seule ; « Dupliquer » d’un budget l’enregistre tout de suite avec les mêmes valeurs, « Budget dupliqué. », puis ouvre « Modifier le budget » sur la copie, décision D20) :

- « Mois » / « À partir de » (requis), « Sorties prévues » / « Entrées prévues » (requis, positif, préfixe − / +) ;
- sens « Sorties » / « Entrées » (déduit de la catégorie, défaut sorties ; changer de sens vide une catégorie de l’autre sens) ;
- « Catégorie » (requise, création à la volée ; « Le budget couvre aussi ses sous-catégories qui n’ont pas le leur. ») ;
- « Bénéficiaire » (vide : « Moi ») et « Contexte » (vide : « Quotidien ») ;
- « Répétition » : « Ce mois seulement », « Tous les X mois » (champ « Tous les » 1 à 24 mois), « Tous les ans » ; défaut d’un nouveau budget : tous les mois ; « Jusqu’à » (vide : « Sans fin ») ;
- commentaires du budget en modification. Toast « Budget créé. » (création).

## Onglet « Prêts »

- Résumé : « On vous doit X » et « Vous devez Y ».
- Table (clé `treasury-loans`) en arbre : une ligne par relation (nom en gras, « Solde » en badge « Soldé » / « Vous doit X » / « Vous lui devez X », « Sorti vers elle », « Reçu d’elle »), ses lignes de prêt dessous (libellé « mouvement › ligne », « Date », « Montant » signé). Colonne nommée « Relation / ligne » ou « Proche / ligne ».
- Action d’une relation : « Commentaires » (panneau « Commentaires · [nom] », lecture seule si la relation est archivée).
- Relation supprimée : « Relation supprimée » / « Proche supprimé ».
- État vide : « Aucun prêt. Dans la répartition d’un mouvement, une ligne pour une relation peut être marquée « Prêt » (colonne « Prêt ») : … ».

## Import d’un relevé bancaire (CSV)

« Importer un relevé » (onglet Mouvements) ouvre « Importer un relevé bancaire » en trois étapes :

1. Fichier : « Compte » (comptes ouverts) et « Relevé (CSV) ». L’encodage est détecté (UTF-8, sinon Windows-1252). Les colonnes sont reprises du dernier import du compte, sinon devinées (séparateur le plus fréquent, en-têtes date / libellé / montant / débit / crédit). Aide sur la carte à débit différé (une ligne par mois, à répartir ensuite en achats datés). « Suivant ».
2. Colonnes : aperçu des 12 premières lignes (lignes ignorées grisées), « Séparateur » (Point-virgule, Virgule, Tabulation), « Encodage » (UTF-8, Windows (ANSI)), « Lignes à ignorer au début » (0 à 50), « Date », « Format de date » (JJ/MM/AAAA, JJ/MM/AA, JJ-MM-AAAA, AAAA-MM-JJ), « Libellé » (plusieurs colonnes mises bout à bout), montant « Une colonne montant (signé) » ou « Colonnes débit et crédit ». « N opérations lues. » ou « Aucune opération lue : vérifiez les colonnes et le format de date. ». « Retour » / « Aperçu ».
3. Aperçu : chaque opération avec case à cocher. Une opération d’un mouvement réel du compte de même montant à 3 jours près est marquée « Déjà saisie ? « libellé » » et décochée (alerte « N opérations semblent déjà saisies… : décochées. »). Une prévision du compte de même montant à 7 jours près est proposée : case « Réalise la prévision « libellé » du JJ/MM » (cochée). « Importer N opérations ».

Toast : « N opérations importées, M prévisions réalisées. ». Le mapping des colonnes est gardé sur le compte.

## Relevé de compte (PDF)

« Relevé de compte (PDF) » ouvre « Exporter le relevé des mouvements » : « Période » (préréglages, défaut le mois dernier, ou « Dates choisies »), dates, « Compte » (vide : « Tous les comptes »), texte « Mouvements réels de la période par date d’exécution, avec le solde avant, après et au fil des mouvements. Les prévisions ne sont pas incluses. », « Télécharger le PDF ». Toast « Relevé téléchargé. » ou erreur « Relevé impossible. ». Contenu du PDF : voir [Règles de la trésorerie](../../business-rules/finances/treasury.md#relevé-pdf).

## Paramètres de la trésorerie (barre latérale)

Barre « Paramètres de la trésorerie », sections une sous l’autre (listes de paramètres standard : ajout, modification, couleur, image, glisser-déposer, archivage, suppression ; voir [Paramètres](../cross-cutting/settings.md)) :

- « Comptes » : « Vos comptes en banque, avec le solde du relevé à une date : les mouvements et le prévisionnel partent de là. » Champs : libellé (« Compte courant, livret… »), couleur facultative, image, « Solde d’ouverture », « Au » (requis, défaut aujourd’hui ; « Le solde du relevé à cette date : seuls les mouvements suivants sont comptés. »). Badges : solde du jour et « X au JJ/MM ». Suppression impossible avec des mouvements : « A des mouvements : archivez-le ».
- « Contextes » : « Une même dépense ne compte pas pareil en vacances ou au quotidien. Une ligne sans contexte est du « Quotidien ». » Libellé (« Vacances, Rentrée… ») et couleur requise. Suppression : « … sera supprimé définitivement avec ses périodes planifiées. Les lignes qui l’avaient deviendront du « Quotidien ». »
- « Contextes planifiés » : périodes (contexte, « Du », « Au », description) ; « Nouvelle période » (désactivé sans contexte actif), « Modifier », « Supprimer » (confirmation ; « Les lignes déjà enregistrées gardent leur contexte. »). Interrupteur « Afficher les archivées » (périodes des contextes archivés, en lecture seule). Vide : « Aucune période planifiée. » / « Créez d’abord un contexte. ». « Nouvelle période » : formulaire, bouton « Planifier », toast « Période planifiée. » ; « Modifier » : panneau enregistré champ par champ (la description en la quittant, décision D22), en lecture seule si son contexte est archivé. Un contexte créé depuis la répartition d’un mouvement : formulaire « Nouveau contexte », bouton « Créer » (un contexte se modifie dans sa liste).
- « Catégories d’entrées » et « Catégories de sorties » : arborescence (glisser une catégorie sur une autre pour l’y ranger ; une sous-catégorie sans couleur prend celle de sa parente), nombre de mouvements par catégorie.
- « Factures et avoirs » (PRO) : « Règlements des factures » (catégorie d’entrée) et « Remboursements des avoirs » (catégorie de sortie), vide : « Aucune (hors budget) ». Toast « Catégorie enregistrée. ».
- « Moyens de paiement » : libellé (« Virement, carte, chèque… »), « Pour les entrées », « Pour les sorties » (les deux cochés par défaut) ; badges « Entrées » / « Sorties ».
- « Tiers » : « Émetteurs et destinataires qui ne sont pas des clients : fournisseurs, administrations, banques… Les clients sont proposés d’office. » Nom, description ; la suppression prévient que les mouvements perdront leur émetteur ou destinataire.

## Équipe / Foyer et relations (page Paramètres)

Dans l’onglet « contributors » de la page Paramètres (`features/projects/pages/SettingsPage.tsx`) :

- « Équipe » / « Foyer » : membres (« Moi » toujours, badge « Moi ») ; ajout d’un contributeur existant ou d’un nouveau membre par son nom (crée le contributeur) ; « Retirer » (reste contributeur, toast « X n’est plus membre. ») ; « Archiver » ; interrupteur des archivés.
- « Relations » / « Proches » : nom (« Paul, Mamie, Association du quartier… »), contributeur lié facultatif (non membre, pas déjà relation ; donne son nom si vide), « Description » (zone de texte multiligne, 4 000 caractères) ; badge « Contributeur » ; usages (« N lignes, M budgets ») ; « Modifier », « Archiver », « Supprimer » (« Ses budgets aussi. Ses lignes vous seront attribuées. »). Nouvelle relation : formulaire, bouton « Ajouter » ; « Modifier » : panneau enregistré champ par champ (nom et description en les quittant ; le contributeur choisi avec le nom qu’il donne, décision D22).

## Ailleurs dans l’app

- Accueil : cartes financières à partir du prévisionnel ([Accueil](../cross-cutting/home.md)).
- Tableaux de bord : sources de mouvements et de soldes ([Tableaux de bord](../resources/dashboards.md)).
- Facturation : enregistrement d’un règlement depuis un document, qui crée un mouvement ([Facturation](accounting.md)).
- Achats : recherche de mouvements pour lier une liste ([Achats](../supplies/shopping.md)).
- Agenda : un événement peut concerner des relations de la trésorerie ([Agenda](../activities/calendar.md)).
- Contributeurs : la liste des contributeurs signale les membres et les relations ([Personnes](../../business-rules/cross-cutting/people.md)).
