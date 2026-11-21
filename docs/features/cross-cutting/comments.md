# Commentaires

Ce que l’utilisateur peut faire avec les commentaires : le fil de commentaires d’une tâche et des autres éléments (routines, évènements, horaires, temps, achats, fiches, stock, documents, catalogue, trésorerie, documents de la bibliothèque, mails), et la colonne « Commentaires » des tableaux. Sources : `apps/web/src/features/comments/**`, `apps/web/src/features/tasks/components/TaskComments.tsx`, le fil partagé `apps/web/src/components/comments/**`.

Règles appliquées par l’API : [Règles métier — Commentaires](../../business-rules/cross-cutting/comments.md). Code : [Code web — Commentaires](../../web/features/cross-cutting/comments.md) et [Composants — Commentaires](../../web/components/comments.md).

## Où se trouvent les commentaires

| Élément                                                         | Où                                                                                                                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tâche                                                           | Panneau de la tâche, section « Commentaires » ([Tâches](../activities/tasks.md)).                                                                                        |
| Routine                                                         | Formulaire de la routine : ceux de l’occurrence ouverte, « Commentaires du 12 nov. 2026 » ([Routines](../activities/routines.md)).                                       |
| Évènement                                                       | Formulaire de l’évènement : ceux de l’occurrence ouverte (« Commentaires du … » pour un récurrent) ([Agenda](../activities/calendar.md)).                                |
| Créneaux de travail (horaire)                                     | Gestion des créneaux ([Agenda](../activities/calendar.md)).                                                                                                                |
| Temps passé                                                     | Panneau « Temps » ([Temps passé](../activities/time.md)).                                                                                                 |
| Liste d’achats, produit, article d’une liste                    | Pages et formulaires des achats ([Achats](../supplies/shopping.md)).                                                                                                     |
| Élément d’une fiche                                             | Page d’une fiche ([Fiches](../supplies/sheets.md)).                                                                                                                      |
| Article du stock                                                | Tableau du stock ([Inventaire](../supplies/stock.md)).                                                                                                                   |
| Document de facturation, document importé, article du catalogue | Éditeur de document, page d’un document importé, catalogue ([Facturation](../finances/accounting.md)).                                                                   |
| Écriture, budget, relation                                      | Trésorerie ([Trésorerie](../finances/treasury.md)) ; les commentaires d’une relation s’ouvrent aussi depuis les emprunts (`LoansPanel`, panneau « Commentaires · Nom »). |
| Document de la bibliothèque                                     | Formulaires de la bibliothèque ([Bibliothèque](../resources/library.md)).                                                                                                |
| Mail                                                            | Lecteur de mails ([Mails](../resources/mail.md)).                                                                                                                        |

Le titre par défaut du fil est « Commentaires » (`Comments`, propriété `title`).

Une routine et un évènement récurrent ont des commentaires **par occurrence** : le panneau montre ceux de l’occurrence qu’il ouvre. Pour un évènement, l’occurrence cliquée ; pour une routine ouverte depuis l’agenda (« Ouvrir la routine »), l’occurrence cliquée ; sinon l’occurrence en cours, à défaut la suivante, à défaut la première. Un évènement unique a une seule occurrence.

## Le fil de commentaires

Le même fil partout (`CommentThread`, voir [Composants — Commentaires](../../web/components/comments.md)) :

- commentaires du plus ancien au plus récent, avec leur date relative (« il y a … », date et heure en info-bulle) ;
- écrire un commentaire en markdown : `#` propose les tâches (« #12 » renvoie à la tâche 12 du projet de l’élément), `@` les contributeurs non archivés ;
- « Modifier » et « Supprimer » un commentaire (confirmation « Supprimer le commentaire ») ;
- sur une tâche liée à GitHub, « @login sur GitHub » s’affiche quand l’auteur n’est pas le compte connecté ; les commentaires sont synchronisés avec l’issue ([GitHub](github.md)) ;
- **lecture seule** sur un élément archivé (tâche archivée, routine archivée…) : les commentaires s’affichent, sans ajout ni modification.

Un commentaire vide est refusé : « Le commentaire est vide. ».

## Colonne « Commentaires »

Dans les tableaux (tâches, temps, routines, achats, stock, documents, trésorerie, bibliothèque, fiches, créneaux de travail, catalogue) :

- nombre de commentaires de la ligne, **la description remplie comptant pour un**, avec une icône de bulle ; rien quand il n’y en a aucun ; pour une routine, ceux de l’occurrence que son panneau ouvre ; pour un évènement du tableau des tâches, ceux de son occurrence ;
- triable et filtrable comme un nombre ; masquée par défaut dans les tableaux qui utilisent `commentColumn` (la colonne des tâches suit les colonnes par défaut des tâches) ;
- un filtre « A des commentaires » existe dans le tableau des tâches.

## Suppression

- Supprimer un élément supprime ses commentaires.
- Supprimer une occurrence d’un évènement ou d’une routine (ou elle et les suivantes) supprime ses commentaires ; la confirmation en donne le nombre (« 3 commentaires seront aussi supprimés. », ou « Commentaires supprimés avec : cette occurrence 1, celle-ci et les suivantes 2… » dans la question de portée). La suppression de routines ou d’un calendrier le dit aussi.
- Reporter une occurrence d’évènement emmène ses commentaires vers le report.
- Les commentaires écrits avant qu’ils portent sur une occurrence sont placés par l’application à la première lecture (voir [Règles des commentaires](../../business-rules/cross-cutting/comments.md)).
- Supprimer une tâche supprime ses commentaires (dit dans la confirmation : « … et ses commentaires seront supprimés définitivement »).
- Dupliquer une tâche ne copie pas ses commentaires.

## Espace PRO / PERSO

Aucune différence.
