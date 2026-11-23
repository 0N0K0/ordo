# Facturation

Ce que l’utilisateur peut faire dans la facturation : devis, factures, factures d’acompte, avoirs, documents importés, suivi (envoi, acceptation, paiements, relances), factures récurrentes, catalogue, fiche de facturation des clients, profil de la société, numérotation, PDF et export ZIP. Sources : `apps/web/src/features/accounting/**`, routes de `apps/web/src/app/router.tsx` et `apps/web/src/app/pages.ts`. Les règles appliquées par l’API sont dans [Règles métier de la facturation](../../business-rules/finances/accounting.md) ; le code web est décrit dans [Code web de la facturation](../../web/features/finances/accounting.md).

## Espace PRO uniquement

- Les trois pages de la facturation sont enveloppées dans `ProOnly` : dans un espace personnel, elles affichent « Indisponible dans un espace personnel » et « L’espace « … » est personnel : il n’a ni facturation, ni clients, ni société. », avec un retour à l’accueil.
- L’API refuse aussi les créations dans un espace PERSO (« Indisponible dans un espace personnel (facturation). », voir [Espaces et accès](../../business-rules/cross-cutting/workspaces-and-access.md)).
- L’action rapide « Devis » de la barre d’actions rapides (`QuickActions`) n’est proposée que dans un espace PRO ; sur une page de projet, elle préremplit le client et le projet.

## Pages et adresses

| Page             | Adresse                                         | Contenu                                                                                                                            |
| ---------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Facturation      | `/accounting` (onglet `?tab=…`)                 | Onglets des documents par type, « À envoyer », « À relancer », « Récurrentes », « Catalogue » ; paramètres dans la barre latérale. |
| Document d’Ordo  | `/accounting/:id`                               | Éditeur d’un brouillon ou d’un modèle de facture récurrente, lecture d’un document définitif.                                      |
| Document importé | `/accounting/imported/:id`                      | Fichier du document importé, ses informations et son suivi.                                                                        |
| Fiche client     | `/clients/:id`                                  | Section « Facturation » (coordonnées, services, contacts) dans les paramètres du client, et tableau « Documents comptables ».      |
| Projet           | `/projects/:id?tab=billing` et `?tab=resources` | Onglet des documents comptables du projet ; onglet des ressources (fichiers et liens) du projet.                                   |

Adresses utiles : `/accounting?tab=overdue` (`OVERDUE_INVOICES_PATH`, utilisée par l’accueil), `/accounting?settings=1&section=company` (paramètres ouverts sur « Ma société »). L’ancien onglet `?tab=tracking` ouvre les paramètres ; l’ancien paramètre `settingsTab` est converti vers celui de toutes les pages.

## Page « Facturation »

### En-tête

Bouton « Nouveau document » avec un menu : « Devis », « Facture », « Facture d’acompte », « Avoir », puis (séparateur) « Importer un document existant ».

- Devis, facture, avoir : panneau latéral « Nouveau devis » / « Nouvelle facture » / « Nouvel avoir » avec le client (obligatoire) et le projet (facultatif, parmi les projets du client ; désactivé tant qu’aucun client n’est choisi). Texte d’aide : « Le devis est créé en brouillon, sans numéro, avec vos conditions par défaut. » Bouton « Créer » : le brouillon est créé avec les valeurs par défaut de la société puis ouvert.
- Facture d’acompte : panneau « Nouvelle facture d’acompte » (voir [Factures d’acompte](#factures-dacompte)).
- Import : panneau « Importer un devis ou une facture » (voir [Documents importés](#documents-importés)).

### Onglets

| Onglet          | Valeur `tab`         | Contenu                                                                                                                                                |
| --------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| « Devis »       | `QUOTE` (par défaut) | Devis d’Ordo et devis importés.                                                                                                                        |
| « Factures »    | `INVOICE`            | Factures d’Ordo et importées.                                                                                                                          |
| « Acomptes »    | `DEPOSIT_INVOICE`    | Factures d’acompte.                                                                                                                                    |
| « Avoirs »      | `CREDIT_NOTE`        | Avoirs.                                                                                                                                                |
| « À envoyer »   | `toSend`             | Documents définitifs (et importés) non archivés dont le statut est de catégorie « À envoyer », tous types et années ; pastille bleue avec leur nombre. |
| « À relancer »  | `overdue`            | Factures à relancer (voir [Relances](#relances)) ; pastille orange (couleur de retard) avec leur nombre.                                                       |
| « Récurrentes » | `recurring`          | Factures récurrentes.                                                                                                                                  |
| « Catalogue »   | `catalog`            | Articles du catalogue.                                                                                                                                 |

Pendant le chargement, un squelette de tableau s’affiche.

### Tableau des documents

Le même tableau (`DocumentsTable`) sert aux onglets par type, à « À envoyer », à l’onglet d’un projet et à la fiche d’un client. Documents d’Ordo et documents importés y sont mêlés, du plus récent au plus ancien.

Vues créées la première fois : « Cette année » (ouverte d’abord), « L’année dernière », « Tous ». L’onglet « À envoyer » n’a qu’une vue « À envoyer ». Les vues se filtrent, se trient, se regroupent et s’exportent comme tous les tableaux (voir [Tableau de données](../../web/components/data-table.md)). Recherche : « Rechercher (numéro, client, objet) ».

Colonnes :

| Colonne                     | Détail                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Numéro »                  | Numéro en chasse fixe, ou badge « Brouillon » ; icône pour une facture issue d’une facture récurrente ; badge « Archivé » ; badge « Importé » pour un document importé. Clic : ouvre le document. |
| « Type »                    | Seulement là où les types sont mêlés (« À envoyer », projet, client). Filtre par type, regroupable.                                                                                               |
| « Date »                    | Date du document, filtre de date.                                                                                                                                                                 |
| « Mois »                    | Mois de la date.                                                                                                                                                                                  |
| « Échéance »                | Masquée par défaut, filtre de date.                                                                                                                                                               |
| « Mois d’échéance »         | Mois de l’échéance.                                                                                                                                                                               |
| « Client »                  | Masquée sur la fiche d’un client et l’onglet d’un projet. Filtre parmi les clients présents, regroupable.                                                                                         |
| « Projet »                  | Modifiable en place (brouillon comme définitif ; pas pour un document archivé), en lot. Filtre, regroupable.                                                                                      |
| « Objet »                   | Objet ; pour un devis : « Facturé à N % » ; « Depuis D2600004 » pour un document établi depuis un autre.                                                                                          |
| « Statut »                  | Brouillon, ou statut de suivi modifiable en place (menu), en lot ; badge orange « En retard » (facture) ou « Expiré » (devis) ; pour un importé autre qu’un devis, badge « Reste … » / « Réglé ».        |
| « Origine »                 | Pastille « Ordo » (bleue) ou « Importé » (cyan), centrée, triée dans cet ordre ; masquée par défaut.                                                                                                     |
| « Total HT », « Total TTC » | Avec total de colonne ; sous le TTC : « Reste … » ou « À rembourser … » quand une partie est réglée.                                                                                              |
| « Reste dû »                | Masquée par défaut.                                                                                                                                                                               |
| « Pièces jointes »          | Masquée par défaut : fichiers du document (ouvrir, retirer après confirmation, « Joindre des fichiers »), fichier d’un importé. Ajout en lot.                                                     |
| Commentaires                | Nombre de commentaires (note d’un importé en aperçu).                                                                                                                                             |

Choisir un statut de catégorie « Envoyé » ouvre le panneau « Envoi de … » (moyen et date d’envoi) ; sur plusieurs lignes, « Envoi de N documents ». Les statuts ne s’appliquent qu’aux documents de la même portée (devis ou factures), définitifs ou importés, non archivés.

Actions d’une ligne d’Ordo :

- action principale « Enregistrer un paiement » (facture) ou « Enregistrer un remboursement » (avoir) quand il reste un solde ;
- « Dupliquer » (copie en brouillon enregistrée tout de suite, « Document dupliqué en brouillon. », puis ouverture de la copie ) ;
- « Télécharger le PDF » (définitifs seulement) ;
- « Archiver » / « Restaurer ».

Actions d’une ligne importée : « Voir le fichier », « Télécharger le fichier », « Facture d’acompte » (devis non archivé ; grisé avec « Rattachez le devis à un client pour facturer un acompte » sans client), « Modifier », « Archiver » / « Restaurer », « Supprimer » (confirmation : le document et son fichier sont supprimés définitivement).

Actions sur une sélection : archiver / restaurer, « Dupliquer » (en brouillon ; documents d’Ordo non archivés ; un seul : la copie s’ouvre), « Supprimer » (documents importés seulement ; les documents d’Ordo sélectionnés ne sont pas supprimés).

États vides : « Aucun devis. », « Aucune facture. », « Aucune facture d’acompte. », « Aucun avoir. », « Aucun document à envoyer ni à déposer. », « Aucun document comptable. ». Les documents archivés sont masqués tant que « Afficher les archivés » n’est pas activé.

### Factures récurrentes (onglet « Récurrentes »)

Tableau « Factures récurrentes » :

| Colonne        | Détail                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| « Libellé »    | Modifiable en place ; badges « Archivée », « En pause », « Validée automatiquement » ; « N factures émises ». |
| « Client »     | Client du modèle, regroupable.                                                                                |
| « Répétition » | Phrase de la règle de récurrence (voir [Récurrence](../../web/components/recurrence.md)).                     |
| « Prochaine »  | Prochaine date d’émission, ou « Terminée ».                                                                   |
| « État »       | Pastille centrée « Active » (vert) / « En pause » (gris), choisie en place dans la liste des pastilles (en lot), masquée par défaut. |
| « Émises »     | Nombre de factures émises, masquée par défaut.                                                                |
| « Montant »    | Total TTC du modèle.                                                                                          |

Actions : « Modifier la planification » (panneau « Facture récurrente », enregistré champ par champ, voir [Factures récurrentes](#factures-récurrentes)), « Ouvrir le modèle », « Archiver » / « Restaurer », « Supprimer » (confirmation : « … et son modèle seront supprimés définitivement ; les factures déjà émises sont conservées. »). Une récurrente archivée est en lecture seule et n’émet plus rien.

État vide : « Aucune facture récurrente. Ouvrez une facture et choisissez « Rendre récurrente ». »

### Catalogue (onglet « Catalogue »)

Tableau des articles : « Article » (libellé modifiable, badge « Débours », description en aperçu), « Nature » (pastille centrée « Prestation » bleue / « Débours » violette, choisie en place dans la liste des pastilles, triée dans cet ordre, masquée par défaut), « Unité », « Prix HT », « TVA » (vide pour un débours), commentaires. Libellé, nature, unité, prix et TVA se modifient en place et en lot.

- « Nouvel article » ouvre le formulaire (bouton « Ajouter », toast « Article ajouté au catalogue. ») ; « Modifier » ouvre le panneau de l’article, enregistré champ par champ : chaque champ dès qu’il change (« Libellé », « Description » et « Prix unitaire HT » en les quittant), « Enregistrement… » puis « Enregistré » en haut, sans bouton ; un champ invalide garde son erreur dessous et n’est pas enregistré, un échec le remet comme il était, dans un toast d’erreur ; un article archivé s’ouvre en lecture seule. Champs : nature (« Produit ou service » / « Débours » ; un débours passe à TVA 0 et unité forfait), « Libellé » (obligatoire), « Description » (markdown, reprise dans la ligne), « Unité » (heure par défaut), « Prix unitaire HT », « TVA » (20 %, ou 0 % si la société n’applique pas la TVA). Les commentaires de l’article sont sous le formulaire.
- « Archiver » : l’article n’est plus proposé et passe en lecture seule. « Afficher les archivés » les montre.
- « Supprimer » : confirmation (« … sera supprimé du catalogue. Les documents qui l’utilisent gardent leurs lignes. Pour seulement ne plus le proposer, archivez-le. »).
- État vide : « Catalogue vide. Ajoutez vos prestations (journée, heure, forfait…) avec leur prix et leur TVA : vous les ajouterez aux documents en un clic. »

### Paramètres (barre latérale « Paramètres de la facturation »)

« Suivi » et « Ma société » sont aussi dans les paramètres d’un projet, depuis son onglet « Facturation » (les mêmes réglages, ceux de l’espace), suivis des colonnes des nouvelles vues des documents d’un projet ou d’un client. Quatre onglets :

- « Export ZIP » : « Télécharger les documents d’une période » (voir [Export ZIP](#export-zip)).
- « Suivi » : statuts de suivi des devis et des factures (voir [Statuts de suivi](#statuts-de-suivi)).
- « Ma société » : profil de la société et numérotation (voir [Ma société](#ma-société) et [Numérotation](#numérotation)).
- « Colonnes » (en dernier) : « Colonnes des nouvelles vues » de chaque tableau de la facturation : « Devis », « Factures », « Acomptes », « Avoirs », « À envoyer », « À relancer », « Récurrentes », « Catalogue », « Temps à facturer », « Documents d’un projet ou d’un client » ([Colonnes des nouvelles vues](../cross-cutting/settings.md#colonnes-des-nouvelles-vues)).

## Page d’un document d’Ordo

### En-tête

- Titre : « Facture F2600042 », « Devis Brouillon »… ; pour un modèle : « Modèle de facture récurrente ».
- Badge : « Définitif » (vert), « Modèle » (violet) ou « Brouillon » (gris) ; badge « Archivé ».
- Sous-titre : « Établi à partir de D2600004 » (lien), ou « Établi à partir du devis importé … ».
- Menu « … » : « Archiver » / « Restaurer » (pas pour un modèle : il s’archive avec sa récurrente).

Boutons selon l’état :

| Bouton                              | Quand                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| « Aperçu »                          | Brouillon ou modèle : attend la fin des enregistrements en cours, puis ouvre le PDF dans une fenêtre.                    |
| « Télécharger le PDF » (icône)      | Toujours (la version enregistrée).                                                                                       |
| « Facture acquittée »               | Facture ou acompte définitif entièrement payé : PDF portant « acquittée » et ses règlements.                             |
| « Envoyer »                         | Définitif non archivé : ouvre un mail préparé (voir [Envoi par mail](#envoi-par-mail)).                                  |
| « Valider »                         | Brouillon non archivé (voir [Validation](#validation)).                                                                  |
| « Supprimer le brouillon »          | Brouillon : confirmation « Ce brouillon sera supprimé définitivement avec ses pièces jointes. », puis retour à la liste. |
| « Facture d’acompte », « Facturer » | Devis définitif non archivé.                                                                                             |
| « Créer un avoir »                  | Facture ou acompte définitif non archivé.                                                                                |
| « Rendre récurrente »               | Facture (pas un modèle), non archivée.                                                                                   |
| « Dupliquer » (icône)               | Tout document non archivé sauf un modèle : copie en brouillon datée d’aujourd’hui, puis ouverture.                       |

Un brouillon ou un modèle non archivé s’enregistre champ par champ, sans bouton « Enregistrer » : « Enregistrement… » puis « Enregistré » en haut de la colonne principale. Les choix (client, projet, service, contact, dates, interrupteurs, temps facturé ou détaché) sont enregistrés dès qu’ils changent ; les textes, les lignes, la remise générale et l’acompte en les quittant (une ligne en la quittant, ou dès qu’elle est déplacée, retirée, ajoutée depuis le catalogue, le temps passé ou un acompte déduit ; une ligne vierge, laissée telle qu’ajoutée, est ignorée : elle n’est pas enregistrée et ne retient rien) ; les conditions de règlement avec l’échéance qu’elles donnent, en les quittant. Le document entier est enregistré chaque fois : ses lignes sont remplacées et ses totaux recalculés par l’API. Un champ invalide garde son erreur dessous et n’est pas enregistré (une ligne commencée mais invalide, son erreur dessous, retient les lignes) ; un échec le remet comme il était, dans un toast d’erreur ; un champ changé ailleurs est repris, sauf pendant sa saisie. Il n’y a plus rien à confirmer en quittant la page.

### Bandeaux

- Archivé : « Document archivé : masqué des listes et en lecture seule. Il reste valable (numéro et PDF conservés). Restaurez-le pour le modifier. » (la phrase sur le numéro seulement pour un définitif). Modèle d’une récurrente archivée : « Facture récurrente archivée : son modèle est en lecture seule et aucune facture n’est plus émise. Restaurez-la depuis la liste des factures récurrentes pour la modifier. »
- Définitif : « Document définitif : il ne peut plus être modifié. Ses pièces jointes restent modifiables. »
- Devis définitif : « Déjà facturé : X HT sur Y HT (F…, FA…) ».

### Colonne principale

Un document définitif affiche d’abord son PDF dans la page ; un sélecteur « Aperçu » / « Détails » montre ses champs en lecture seule.

Section « Client et dates » :

- « Client » (obligatoire ; en changer vide le service, le contact et le projet) ;
- « Projet » (projets du client), « Service », « Contact » (contacts du service choisi, ou sans service) ;
- « Date du document » (obligatoire ; pour un brouillon : pas avant la date du dernier document du même type, avec « Pas avant le …, date du dernier document de ce type. ») ;
- « Valable jusqu’au » (devis) ou « Échéance » ;
- « Période de la prestation » (un seul champ, chaque bout facultatif).

Section « Contenu » : « Objet », « Libellé de la référence », « Référence du client », « Introduction », lignes, « Conclusion ».

Lignes (voir aussi [Règles de calcul](../../business-rules/finances/accounting.md#lignes-et-totaux)) :

- types : « Article », « Débours » (hors TVA), « Texte » (titre de section, note), « Déjà facturé » (déduction ; badge « Acompte » quand elle est liée à une facture d’acompte) ;
- champs d’une ligne chiffrée : « Libellé », « Quantité », « Unité » (« Unité », « Heure », « Jour », « Mois », « Forfait », « Acompte »), « Prix unitaire HT » (« Montant HT déduit » pour une déduction), « TVA » (si la TVA s’applique, pas pour un débours), « Remise » (% ou montant, articles seulement), « Total HT » calculé ; description markdown repliable ;
- menu d’une ligne : « Description », monter / descendre, « Retirer la ligne » ;
- ajout : « Ajouter un article », « Ajouter un débours », « Ajouter un texte », « Depuis le catalogue… » (articles non archivés), « Temps passé » (facture brouillon), « Déduire un acompte » (factures, quand le client a des acomptes à déduire) ;
- état vide : « Aucune ligne. ».

Temps facturé : « N temps facturés (durée) : ils sont marqués facturés par ce document », et « Détacher le temps » sur un brouillon.

Section « Conditions et mentions » :

- « Mode de facturation » (devis, avec propositions) ;
- « Conditions de règlement » (pas pour un avoir ; choisir des conditions comme « À 30 jours » recalcule l’échéance d’une facture) ;
- « Mode de règlement » ;
- « Acompte à la commande » (devis : % ou montant, avec « Soit … TTC ») ;
- « Intérêts de retard » (pas pour un avoir) ;
- pour un client professionnel : « Client professionnel : l’indemnité forfaitaire de 40 € pour frais de recouvrement est ajoutée au document. » ;
- « Autres mentions » ;
- interrupteurs « Afficher le RIB » et « TVA non applicable ».

### Colonne latérale

- « Suivi » (définitifs seulement, voir [Suivi](#suivi-dun-document-définitif)).
- « Totaux » : « Remise générale » (% ou montant, brouillon), puis « Total articles HT », « Remise générale », « Déjà facturé », « Total HT », une ligne « TVA x % sur … » par taux (ou la mention d’exonération), « Débours », « Total TTC » (ou « Total »).
- « Pièces jointes » : « Joindre » (plusieurs fichiers), ouvrir, retirer (confirmation « La pièce jointe « … » sera supprimée définitivement de « … ». »). Elles restent modifiables sur un définitif, pas sur un archivé. Note : « Joints aux mails d’envoi du document. »
- « Documents liés » : documents établis à partir de celui-ci, avec leur total.
- Commentaires du document (lecture seule si archivé).

États : squelette pendant le chargement, message d’erreur, « Ce document » introuvable avec retour à la facturation.

### Validation

« Valider » ouvre une confirmation : « Le document reçoit son numéro définitif et ne pourra plus être modifié ni supprimé : une erreur se corrigera par un avoir. Vérifiez la date (…) : les numéros se suivent dans l’ordre de validation. » Le brouillon est enregistré puis validé ; toast « Document validé : F2600042. ».

### Facturer un devis, créer un avoir, dupliquer

- « Facturer » (devis) : crée une facture brouillon datée d’aujourd’hui reprenant les lignes du devis et déduisant ce qui a déjà été facturé dessus, puis l’ouvre.
- « Créer un avoir » (facture) : crée un avoir brouillon « Avoir sur la facture … » reprenant les lignes.
- « Dupliquer » : copie en brouillon du même type, datée d’aujourd’hui, sans échéance.

### Facturer le temps passé

Bouton « Temps passé » (facture brouillon non archivée) : panneau « Facturer le temps passé ».

- « Projet » (projets du client, archivés compris), « Période » (un seul champ, préremplie par la période de prestation, chaque bout facultatif).
- Tableau des temps terminés non encore facturés : « Jour », « Temps » (tâches et description ; vide pour un temps qui n'a ni l'un ni l'autre), « Durée » ; cases à cocher.
- « Tarif du catalogue » (articles à l’heure ou à la journée), « Libellé des lignes » (« Prestation »), « Une ligne » : « En tout », « Par jour », « Par tâche », « Par temps » ; « Facturé à » : « L’heure » / « La journée » ; prix HT ; « Heures par jour » (7) ou « Arrondir au quart d’heure supérieur » ; « TVA ».
- Résumé « N temps, durée → N lignes, montant HT » ; « Ajouter les lignes ». La période de prestation est complétée si elle était vide ; les lignes, le temps et la période sont enregistrés ensemble ; toast « N lignes ajoutées. ».
- États vides : « Choisissez le projet dont le temps est facturé. », « Aucun temps à facturer sur ce projet … : tout le temps terminé est déjà facturé. ».

### Déduire un acompte

Bouton « Déduire un acompte » (factures) : menu « Factures d’acompte du client » listant les acomptes définitifs restant à déduire (« FA2600012 du 05/10/2026 », « Reste à déduire … HT sur … TTC »). Un clic ajoute une ligne de déduction par taux de TVA, liée à l’acompte (« Acompte FA2600012 du 05/10/2026 »). Ce que les lignes en cours déduisent déjà est retiré de l’offre.

## Factures d’acompte

Panneau « Nouvelle facture d’acompte » :

- « Client » (filtre, facultatif ; absent quand le devis est imposé) ;
- « Devis » (obligatoire) : devis définitifs non archivés d’Ordo et devis importés rattachés à un client ;
- « Montant de l’acompte » en % du total HT du devis (acompte prévu au devis s’il est en %, sinon 30 %) ;
- aperçu de l’article : « Acompte de 30 % pour le devis D2600004 de 5 100,00 € HT du 12/10/2026 » et son montant HT ;
- « La facture d’acompte est créée en brouillon, sans numéro, avec les conditions du devis. »

Accès : menu « Nouveau document », bouton « Facture d’acompte » d’un devis définitif, action « Facture d’acompte » d’un devis importé.

## Suivi d’un document définitif

Section « Suivi » de la page d’un document définitif (seulement affichée, sans modification, s’il est archivé) :

- « Statut » : statuts de la portée du document ; un statut « Envoyé » ouvre le panneau « Envoi ».
- Alerte : « Date de validité dépassée sans réponse. » (devis) ou « Échéance dépassée : … restent dus. ».
- Envoi : « Envoyé par mail le … », « Déposé sur Chorus Pro le … »… ou « Pas encore envoyé. » ; bouton « Marquer envoyé » / « Modifier ».
- Devis : « Accepté le … », devis signé (ouvrir, retirer), bouton « Enregistrer l’acceptation » / « Joindre le devis signé » / « Remplacer le devis signé ».
- Factures et avoirs : « Avoirs », « Payé » (« Remboursé »), « Reste dû » / « Trop-perçu » / « À rembourser », liste des paiements (date, compte, moyen, montant), bouton « Enregistrer un paiement » / « Enregistrer un remboursement » tant qu’il reste un solde.
- Relances (factures et acomptes, s’il reste un solde ou des relances) : « Relancer par mail », « Noter », liste des relances avec suppression ; « Aucune relance. ».

Panneaux :

- « Envoi » : « Moyen d’envoi » (« Mail », « Chorus Pro », « Courrier », « En main propre », « Autre » ; Chorus Pro par défaut), « Date d’envoi » (pas dans le futur ; « Les relances comptent à partir de cette date. ») ; toast « Envoi noté. ».
- « Acceptation du devis » : « Date d’acceptation » (obligatoire), « Devis signé » (PDF ou image, remplace le précédent) ; toast « Devis accepté. ».
- « Paiement » / « Remboursement » : « Compte » (comptes de trésorerie non archivés), « Date », « Montant » (le reste dû), « Moyen de paiement » (le premier cité dans les modes de règlement du document) ; sans compte : « Créez d’abord un compte dans la trésorerie. » ; toast « Paiement enregistré. » / « Remboursement enregistré. ». Le paiement crée un mouvement réel en [Trésorerie](treasury.md).
- « Noter une relance » : « Note » (zone de texte multiligne, « Appel, courrier… », 4 000 caractères) ; toast « Relance notée. ».

## Envoi par mail

« Envoyer » prépare un mail dans le rédacteur de mails (voir [Mails](../resources/mail.md)) :

- destinataire : le contact du document, sinon son service, sinon le client ;
- objet : « Facture F2600042 — Ma société » ;
- texte : « Veuillez trouver ci-joint notre facture n° … d’un montant de …, à régler avant le … » (ou « à régler à réception », « valable jusqu’au … » pour un devis ; un devis ajoute « Pour l’accepter, il vous suffit de nous le retourner signé avec la mention « Bon pour accord ». ») ;
- pièces jointes : le PDF et les pièces jointes du document ;
- une fois le mail envoyé, le document est marqué envoyé par mail.

« Relancer par mail » prépare de même le mail de relance (objet « Relance — Facture … — Ma société », reste dû, PDF joint) ; une fois envoyé, une relance « Relance par mail » est notée.

## Relances

Onglet « À relancer » : factures et acomptes définitifs envoyés depuis 15 jours ou plus et encore dus (archivés exclus).

- Colonnes : « Facture » (lien, client), « Client » (masquée), « Envoi » (date, moyen, badge « Envoyée il y a N jours » orange, rouge au-delà de 45 jours, échéance), « Reste dû », « Dernière relance » (date, ancienneté, nombre ; « Jamais »), « Destinataire » (« Aucune adresse » en rouge).
- Cases à cocher (désactivées sans adresse), « Non relancées depuis 7 jours (N) » sélectionne celles-là, choix de la boîte d’envoi (s’il y en a plusieurs), « Relancer (N) ».
- Résumé : « N factures en retard, … à encaisser. »
- Confirmation : « N mails partiront depuis …, un par facture, avec la facture en PDF et le reste dû. Chaque relance sera notée sur sa facture. » ; toasts « N relances envoyées. » et une erreur par facture non relancée ; les factures en échec restent sélectionnées.
- Sans boîte mail : « Aucune boîte mail : ajoutez-en une dans les boîtes mail pour envoyer les relances. »
- État vide : « Aucune facture à relancer : celles envoyées depuis 15 jours ou plus sont réglées. »
- Note : « Pour personnaliser le texte, relancez depuis la facture (« Relancer par mail »). »

## Factures récurrentes

« Rendre récurrente » (facture) ouvre « Rendre la facture récurrente » : « Libellé » (obligatoire), « Première facture le », répétition (sans hebdomadaire ; mensuelle par défaut), « Valider automatiquement » (« Les factures sont numérotées dès leur création ; sinon, elles sont créées en brouillon à vérifier. »), « Active ». La facture est copiée comme modèle (bouton « Créer », toast « Facture récurrente créée : la facture a été copiée comme modèle. »). « Modifier la planification » ouvre le panneau « Facture récurrente », mêmes champs, enregistré champ par champ : chaque champ dès qu’il change (« Libellé » en le quittant), « Enregistrement… » puis « Enregistré » en haut, sans bouton ; un champ invalide garde son erreur dessous et n’est pas enregistré, un échec le remet comme il était, dans un toast d’erreur ; archivée, elle s’ouvre en lecture seule. Le modèle s’ouvre depuis la liste et se modifie comme un brouillon. Les factures dues sont émises aussitôt, puis chaque heure (voir [Tâches de fond](../../business-rules/cross-cutting/background-jobs.md)).

## Documents importés

Pour garder la trace de devis et factures émis hors d’Ordo. Panneau « Importer un devis ou une facture » (bouton « Importer », toast « Document importé. »), ou « Document importé … » pour un document importé existant, enregistré champ par champ : chaque champ dès qu’il change (« Numéro », « Objet », « Ou nom du client », les totaux et « Description » en les quittant ; « Total HT » et « TVA » avec le TTC recalculé ; un fichier choisi est envoyé aussitôt), « Enregistrement… » puis « Enregistré » en haut, sans bouton ; un champ invalide garde son erreur dessous et n’est pas enregistré, un échec le remet comme il était, dans un toast d’erreur ; archivé, en lecture seule. Champs :

- « Type » (facture par défaut), « Numéro » (obligatoire), « Objet », « Date » (obligatoire), « Valable jusqu’au » / « Échéance », « Devise » (EUR, CHF, USD, GBP, CAD) ;
- « Client » (client d’Ordo) puis « Projet », ou « Ou nom du client » s’il n’est pas dans Ordo ;
- « Total HT », « TVA » (le TTC se recalcule), « Total TTC » (« Débours compris ») ;
- « Document » (PDF ou image ; en modification, remplace le fichier) ;
- « Description » (markdown) ;
- « Déjà réglée hors trésorerie » (sauf devis, coché par défaut ; décoché, le document est attendu dans le prévisionnel et peut être rattaché à des mouvements de trésorerie).

Page d’un document importé : badge « Importé », fichier affiché (ou « Ce fichier ne peut pas être affiché ici. » / « Aucun fichier joint. » avec « Joindre le fichier »), « Télécharger le fichier », « Modifier », archiver / restaurer, section « Suivi » (statut modifiable, badge « Reste … » / « Réglé »), « Informations » (client, date, échéance, totaux, description), commentaires.

## Statuts de suivi

Paramètres « Suivi » : deux listes, « Statuts des devis » et « Statuts des factures » (factures, acomptes et avoirs), gérées comme les autres listes de paramètres (libellé, couleur, icône, ordre, archivage ; nombre de documents par statut). Chaque statut a une « Catégorie » :

| Portée   | Catégories                                               |
| -------- | -------------------------------------------------------- |
| Devis    | « À envoyer », « Envoyé », « Accepté », « Refusé »       |
| Factures | « À envoyer », « Envoyée », « Payée », « Avoir à créer » |

Textes d’aide : la catégorie règle le suivi automatique (« À envoyer » à la validation, « Envoyé » à l’envoi par mail, « Accepté » quand le devis signé est enregistré, « Payée » dès que le reste dû est nul) ; un devis à envoyer ou envoyé après sa validité est « expiré », une facture non payée après son échéance « en retard ».

## Ma société

Paramètres « Ma société » (« Imprimée sur les devis, factures et avoirs. ») ; tant que le nom est vide : « Renseignez au moins le nom de la société avant d’éditer des documents. »

- « Identité » : logo (« Ajouter un logo » / « Changer le logo » / « Retirer », PNG ou JPEG), « Nom de la société » (obligatoire), « Forme juridique », « Capital », « SIREN », « SIRET », « Code NAF / APE », « Immatriculation ».
- « Adresse » : jusqu’à 4 lignes, code postal, ville, « Région / État », pays.
- « Coordonnées » : « Nom du contact », « Email », « Téléphone », « Site internet ».
- « TVA » : « TVA non applicable » (franchise en base) avec « Mention », sinon « Numéro de TVA intracommunautaire ».
- « Banque (RIB) » : « Titulaire du compte », « Banque », « IBAN », « BIC ».
- « Conditions et mentions par défaut » (reprises dans chaque nouveau document) : « Échéance des factures » (jours), « Validité des devis » (jours), « Libellé de la référence client », « Conditions de règlement », « Mode de règlement », « Intérêts de retard », « Autres mentions ».

Le profil s’enregistre champ par champ : chaque champ dès qu’il change (textes, nombres et adresse en les quittant), « Enregistrement… » puis « Enregistré » en haut, sans bouton ; un champ invalide garde son erreur dessous et n’est pas enregistré, un échec le remet comme il était, dans un toast d’erreur ; un champ changé ailleurs est repris. Le logo s’enregistre à part (« Logo enregistré. »).

## Numérotation

Section « Numérotation » sous « Ma société » : pour une année (précédente, courante, suivante), le « Prochain numéro » de chaque type (Devis D, Facture F, Facture d’acompte FA, Avoir A) avec l’« Aperçu » du numéro (« F2600042 ») et « Enregistrer ». C’est le seul bouton « Enregistrer » voulu d’un réglage existant dans toute l’app (exception voulue à l’enregistrement champ par champ) : les numéros des documents doivent se suivre sans trou ni doublon, alors changer un compteur demande une validation délibérée, pas un enregistrement à chaque chiffre tapé. Le minimum est le numéro qui suit le dernier attribué. Toast « Numérotation enregistrée. ».

## Export ZIP

« Télécharger les documents d’une période » : « Période » (préréglages, « Année civile… » avec « Année », dates personnalisées ; le mois dernier par défaut), « Documents » (types cochés, au moins un), « Inclure les documents importés (leur fichier) ». « Documents validés dont la date d’émission tombe dans la période, rangés dans un dossier par type. Les brouillons ne sont pas inclus. » Bouton « Télécharger le ZIP » ; toast « Archive téléchargée. ».

## PDF

- Aperçu (brouillon, régénéré à chaque ouverture), téléchargement, affichage dans la page d’un définitif.
- Brouillons et modèles : filigrane « PROVISOIRE », coordonnées actuelles de la société et du client. Définitifs : coordonnées figées à la validation, XML Factur-X intégré (factures, acomptes, avoirs).
- Devis : bloc « Bon pour accord » à signer.
- Facture acquittée : mention « acquittée » et ses règlements.

Détails dans [PDF et Factur-X](../../business-rules/finances/accounting.md#pdf).

## Clients : section « Facturation »

Sur la fiche d’un client (onglet de paramètres « billing ») :

- carte du client : nom (ou prénom et nom d’un particulier), badge « Professionnel » / « Particulier », adresse, email, téléphones, site, identifiants ; « Adresse de facturation à renseigner avant d’éditer des factures. » sans adresse ;
- « Contacts » sans service, puis une carte par service avec ses contacts ;
- boutons « Coordonnées », « Nouveau service », « Nouveau contact » ; par service : « Ajouter un contact », « Modifier », « Supprimer » (« ses contacts restent rattachés au client ») ; par contact : « Modifier », « Supprimer » ;
- contact : « Archiver » / « Restaurer » dans son menu (archivé avec son contributeur, et inversement ; jamais le client) ; archivé, badge « Archivé », masqué tant que « Afficher les archivés » n’est pas coché, en lecture seule (« Voir »), plus proposé comme contact d’un document ni comme lien d’un contributeur (celui déjà choisi reste) ;
- archiver le client archive aussi ses contacts et leurs contributeurs (toast « … archivé avec ses projets et ses contacts. ») ; le restaurer restaure ceux archivés avec lui ;
- client archivé : lecture seule ; « Coordonnées » ouvre ses coordonnées en lecture seule, « Voir » un service (panneau « Service ») ou un contact (panneau « Contact »), sans ajout ni suppression.

Un nouveau service ou contact est un formulaire avec « Ajouter » (« Service ajouté. », « Contact ajouté. »). Les coordonnées, un service ou un contact existants s’enregistrent champ par champ : chaque champ dès qu’il change (textes, adresse et téléphones en les quittant ; un téléphone ou une ligne d’adresse retiré, un pays choisi, aussitôt ; l’erreur d’un téléphone sous son numéro), « Enregistrement… » puis « Enregistré » en haut, sans bouton ; un champ invalide garde son erreur dessous et n’est pas enregistré, un échec le remet comme il était, dans un toast d’erreur.

Panneaux :

- « Coordonnées de facturation » : type (« Professionnel » / « Particulier »), « Prénom » et « Nom » (particulier), « Adresse de facturation », « Email », « Site internet » (professionnel), « Téléphones » (libellé et numéro), « Numéro de TVA », « Code d’activité », « SIREN », « SIRET » (professionnel).
- Service : « Libellé du service » (obligatoire), adresse, email, téléphones.
- Contact : « Prénom », « Nom » (obligatoires), « Fonction », « Service », « Email », téléphones.

La fiche client montre aussi le tableau « Documents comptables » du client et de ses projets, avec « Nouveau document » préremplissant le client.

## Projets

- Onglet facturation : tableau « Documents comptables » du projet et « Nouveau document » (désactivé sans client : « Rattachez le projet à un client pour lui établir des documents. »).
- Onglet ressources : fichiers et liens du projet (« Ajouter des fichiers », « Ajouter un lien » avec « Libellé », « Adresse », « Note » multiligne de 4 000 caractères, bouton « Ajouter »), monter / descendre, « Modifier » (panneau enregistré champ par champ, chaque champ en le quittant), « Supprimer » ; « Aucun document ni lien. ».

## Ailleurs dans l’application

- [Accueil](../cross-cutting/home.md) et [Tableaux de bord](../resources/dashboards.md) lisent les documents et les factures à relancer.
- [Trésorerie](treasury.md) : un mouvement peut être rattaché à un document ; catégories des paiements de factures et remboursements d’avoirs.
- [Chronos](../activities/time.md) : un temps facturé affiche son document (« Brouillon » sans numéro).
