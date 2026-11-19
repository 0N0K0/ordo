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

Grille de cartes (1, 2 ou 3 colonnes selon la largeur). Chaque carte a un titre, une icône, un lien vers la page complète (« Tout voir » par défaut) et un squelette pendant le chargement. Une liste montre 10 lignes au plus, puis « + N autres ».

| Carte                                        | Contenu                                                                                                                                                                                                                                                           | Vide                                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| « Mes tâches du jour »                       | mes tâches du jour (en retard, en cours, à échéance, commençant ou en cours aujourd’hui), en retard d’abord puis par date max ou de fin ; projet et numéro ; badge de retard ou statut ; une tâche s’ouvre dans le panneau                                        | « Rien à faire aujourd’hui. »                                                          |
| « Routines du jour »                         | routines à faire aujourd’hui ou en retard (en retard d’abord, puis par heure de départ ou de fenêtre, puis par nom) ; cocher « fait », icône d’attente, badge de retard, horaires (« départ hh:mm · fenêtre ») ou durée estimée, bouton « Reporter au lendemain » | « Toutes les routines du jour sont faites. »                                           |
| « Agenda » (« Ouvrir l’agenda »)             | évènements (hors annulés et hors évènements déjà terminés aujourd’hui) et alarmes des 7 prochains jours, par jour (« Aujourd’hui », « Demain », « lun. 9 nov. »), heure ou « Journée »                                                                            | « Rien de prévu cette semaine. »                                                       |
| « Chrono et alarmes » (« Tous les chronos ») | chrono en cours, ou formulaire pour en lancer un ; « Prochaine alarme » (libellé et date, ou « Aucune ») avec « Gérer » ; bouton « Programmer une alarme »                                                                                                        | —                                                                                      |
| « Achats »                                   | « Produits manquants » (orange s’il y en a), « Listes en cours » ; listes ouvertes récentes d’abord avec « N à acheter » ou « Tout acheté »                                                                                                                       | « Aucune liste en cours. »                                                             |
| « Facturation » (PRO, « Relancer »)          | « CA HT du mois », « CA HT de l’année » (avoirs déduits, documents importés compris), « Brouillons » ; factures « En retard » : client, numéro, nombre de relances, badge de retard, reste dû                                                                     | « Aucune facture en retard. »                                                          |
| « Devis en attente » (PRO)                   | devis envoyés en attente de réponse, plus anciens d’abord : client et libellé, numéro, « envoyé il y a N jours », montant HT                                                                                                                                      | « Aucun devis en attente de réponse. »                                                 |
| « Trésorerie »                               | « Aujourd’hui », « Dans 30 jours », « Point bas (3 mois) » (rouge si négatif) ; courbe du solde prévu sur 3 mois ; mouvements « À venir » dans les 30 jours (« En retard » ou le jour)                                                                            | « Aucun mouvement attendu dans les 30 jours. »                                         |
| « Mails non lus » (« Boîte de réception »)   | non lus des boîtes de réception de toutes les boîtes actives, récents d’abord : expéditeur, objet, boîte (s’il y en a plusieurs), heure ou jour                                                                                                                   | « Aucune boîte mail configurée. », « Boîte mail injoignable. », « Aucun mail non lu. » |
| « Temps passé »                              | « Aujourd’hui », « Cette semaine » ; les 4 projets qui ont le plus de temps cette semaine, avec une barre et le parent du projet en gris ; lien vers l’onglet « Temps » du projet                                                                                 | « Aucun temps saisi cette semaine. »                                                   |

Les documents comptables archivés sont exclus des chiffres de facturation ; les produits, listes et comptes archivés sont exclus des cartes.

### Réorganiser les cartes

- Chaque carte a une poignée : glisser-déposer à la souris, ou au clavier sur la poignée (espace, flèches, espace).
- L’ordre est gardé dans le navigateur. Une carte ajoutée depuis va à la fin ; en PERSO, les cartes masquées gardent leur place après les autres.
- Bouton « Disposition par défaut » quand l’ordre a été changé.

## Différences PRO / PERSO

En PERSO : ni « Nouveau client », ni tuiles « À encaisser » et « Devis en attente », ni cartes « Facturation » et « Devis en attente ».

## Pastilles du menu

Les pastilles de la barre latérale (tâches du jour, évènements du jour, temps du jour, solde) reprennent les mêmes calculs : voir [Projets › Barre latérale](projects.md#barre-latérale).
