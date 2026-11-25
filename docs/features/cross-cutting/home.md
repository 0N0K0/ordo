# Accueil

La page d’accueil donne tout d’un coup d’œil : création rapide, chiffres clés et cartes condensées réordonnables. Code web : `apps/web/src/features/home/` (voir [Accueil, code web](../../web/features/cross-cutting/home.md)).

## Page

Route `/` (« Accueil »). Composant `HomePage`.

### En-tête

- Titre « Bonjour <identifiant> ».
- Boutons « Nouveau client » (PRO seulement) et « Nouveau projet » : ouvrent les formulaires dans le panneau latéral ([Projets](projects.md)).

### Chiffres clés

Tuiles cliquables (2 colonnes sur téléphone, 3 ensuite, 6 en grand écran — 4 en PERSO) :

| Tuile                      | Valeur                                            | Précision                                                   | Lien                                           |
| -------------------------- | ------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| « Tâches du jour »         | nombre de mes tâches du jour                      | « N en retard » (couleur de retard) ou « Aucune en retard » | « Tâches »                                     |
| « Temps cette semaine »    | temps suivi depuis le début de la semaine         | « Aujourd’hui : … »                                         | « Chronos »                                    |
| « Mails non lus »          | non lus des boîtes de réception, « — » sans boîte | « Boîte de réception » ou « Aucune boîte configurée »       | « Mails »                                      |
| « À encaisser » (PRO)      | reste dû des factures                             | « X en retard » ou « Rien en retard »                       | factures en retard (`/accounting?tab=overdue`) |
| « Devis en attente » (PRO) | nombre de devis envoyés sans réponse              | « X HT »                                                    | « Facturation »                                |
| « Trésorerie »             | solde du jour                                     | « Dans 30 jours : … » (rouge si négatif)                    | « Trésorerie »                                 |

### Cartes

Grille de cartes (1, 2 ou 3 colonnes selon la largeur). Chaque carte a un titre, une icône, un lien vers la page complète (« Tout voir » par défaut), parfois une note sous le titre (ce qu’elle montre) et un squelette pendant le chargement. Une liste montre 10 lignes au plus, puis « + N autres ».

| Carte                                        | Contenu                                                                                                                                                                                                                                                           | Vide                                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| « Tâches »                                   | les tâches de la **vue par défaut de la page « Tâches »** (celle choisie par défaut, sinon son premier onglet) : ses filtres, sa recherche et ses tris, les archivées écartées ; ses groupes et ses colonnes sans effet ; les tâches fermées laissées de côté (ni maintenant ni plus tard) ; note « Vue « … » de la page « Tâches ». » ; deux sections, chacune dans l’ordre de la vue : « Maintenant » (les tâches faisables maintenant, même calcul que le filtre « Faisable maintenant », voir [Tâches](../../business-rules/activities/tasks.md#tâches-faisables-maintenant)) puis « Plus tard » (les autres), les 10 lignes comptées sur les deux ; une tâche « Plus tard » ouverte dit pourquoi après son projet et son numéro (« pas encore ouverte », « hors de ses horaires », « hors de ses créneaux », « indisponible » (un créneau « Indisponible » de l’espace) ou « assigné occupé », la première raison) ; « Maintenant » vide : « Rien à faire maintenant. » sous son titre, « Plus tard » vide : pas affichée ; projet et numéro ; badge de retard ou statut ; une tâche s’ouvre dans le panneau ; « Tout voir » ouvre la page sur cette vue. Tant que la page n’a aucune vue (jamais ouverte) : « Mes tâches du jour » (en retard, en cours, à échéance, commençant ou en cours aujourd’hui), en retard d’abord puis par échéance ou date de fin, dans les mêmes deux sections, avec la note « Aucune vue enregistrée sur la page « Tâches » : mes tâches du jour. » | « Aucune tâche dans cette vue. » ; sans vue : « Rien à faire aujourd’hui. »
| « Routines »                                 | les routines de la **vue par défaut de la page « Routines »** (même règle : filtres, recherche, tris, groupes, archivées écartées) ; note « Vue « … » de la page « Routines ». » ; cocher « fait » (« Faite le » et « Changer l’heure de réalisation », comme le tableau des routines), icône d’attente, badge de retard, horaires (« départ hh:mm · fenêtre ») ou durée estimée, bouton « Reporter au lendemain » (s’il y a une occurrence à reporter) ; « Tout voir » ouvre la page sur cette vue. Sans vue : « Routines du jour », celles à faire aujourd’hui ou en retard (en retard d’abord, puis par heure de départ ou de fenêtre, puis par nom), note « Aucune vue enregistrée sur la page « Routines » : routines du jour. » | « Aucune routine dans cette vue. » ; sans vue : « Toutes les routines du jour sont faites. »
| « Agenda » (« Ouvrir l’agenda »)             | évènements (hors annulés et hors évènements déjà terminés aujourd’hui) et alarmes des 7 jours à partir d’aujourd’hui (aujourd’hui et les 6 suivants), dans l’ordre, par jour (« Aujourd’hui », « Demain », « lun. 9 nov. »), heure ou « Journée » ; un évènement commencé avant aujourd’hui et pas fini est sous « Aujourd’hui », en « Journée » | « Rien de prévu cette semaine. »
| « Chrono et alarmes » (« Tous les chronos ») | chronos en cours (plusieurs à la fois) puis « Démarrer un autre chrono », ou formulaire pour en lancer un ; minuteurs en cours (pause, « + 1 min », « + 5 min », « Annuler »), « Lancer un minuteur » (le panneau de « Ajouter › Minuteur »), les minuteurs enregistrés de l’espace lancés en un clic et « Minuteurs enregistrés » (leurs réglages) ; « Prochaine alarme » (libellé et date, ou « Aucune ») avec « Gérer » ; bouton « Programmer une alarme »                                                                                                        | —                                                                                      |
| « Achats »                                   | « Produits manquants » (orange s’il y en a), « Listes en cours » ; listes ouvertes récentes d’abord avec « N à acheter » ou « Tout acheté »                                                                                                                       | « Aucune liste en cours. »                                                             |
| « Facturation » (PRO, « Relancer »)          | « CA HT du mois », « CA HT de l’année » (avoirs déduits, documents importés compris), « Brouillons » ; factures « En retard » : client, numéro, nombre de relances, badge de retard, reste dû                                                                     | « Aucune facture en retard. »                                                          |
| « Devis en attente » (PRO)                   | devis envoyés en attente de réponse, plus anciens d’abord : client et libellé, numéro, « envoyé il y a N jours », montant HT                                                                                                                                      | « Aucun devis en attente de réponse. »                                                 |
| « Trésorerie »                               | « Aujourd’hui », « Dans 30 jours », « Point bas (3 mois) » (rouge si négatif) ; courbe du solde prévu sur 3 mois ; mouvements « À venir » dans les 30 jours (« En retard » ou le jour)                                                                            | « Aucun mouvement attendu dans les 30 jours. »                                         |
| « Mails non lus » (« Boîte de réception »)   | non lus des boîtes de réception de toutes les boîtes actives, récents d’abord : expéditeur, objet, boîte (s’il y en a plusieurs), heure ou jour                                                                                                                   | « Aucune boîte mail configurée. », « Boîte mail injoignable. », « Aucun mail non lu. » |
| « Temps passé »                              | « Aujourd’hui », « Cette semaine » (la part de chaque temps dans le jour ou la semaine : un chrono qui passe minuit compte sur les deux jours, un chrono lancé la veille de la semaine y compte pour ce qui tombe dedans) ; les 4 projets qui ont le plus de temps cette semaine, avec une barre et le parent du projet en gris ; lien vers l’onglet « Temps » du projet                                                                                 | « Aucun temps saisi cette semaine. »                                                   |

Les documents comptables archivés sont exclus des chiffres de facturation ; les produits, listes et comptes archivés sont exclus des cartes.

### Réorganiser les cartes

- Chaque carte a une poignée : glisser-déposer à la souris, ou au clavier sur la poignée (espace, flèches, espace).
- L’ordre est gardé dans le navigateur. Une carte ajoutée depuis va à la fin ; en PERSO, les cartes masquées gardent leur place après les autres.
- Bouton « Disposition par défaut » quand l’ordre a été changé.

## Différences PRO / PERSO

En PERSO : ni « Nouveau client », ni tuiles « À encaisser » et « Devis en attente », ni cartes « Facturation » et « Devis en attente ».

## Pastilles du menu

Les pastilles de la barre latérale reprennent les mêmes calculs (tâches faisables maintenant de la carte « Tâches », évènements du jour, temps du jour, solde) : voir [Projets › Barre latérale](projects.md#barre-latérale).
