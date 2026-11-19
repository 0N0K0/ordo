# Règles métier de la facturation

Règles appliquées par l’API et les schémas partagés pour les documents comptables (devis, factures, factures d’acompte, avoirs), leur numérotation, leurs statuts, leur suivi (envoi, acceptation, paiements, relances), les factures récurrentes, les documents importés, le catalogue, la fiche de facturation des clients, le profil de la société, le PDF, le Factur-X et l’export ZIP. Sources : `apps/api/src/services/accounting/**`, `apps/api/src/graphql/modules/accounting*.ts`, `apps/api/src/graphql/modules/catalog.ts`, la partie facturation de `apps/api/src/graphql/modules/treasury.ts`, `apps/api/src/routes/accounting.ts` et `packages/shared/src/accounting/**`. Les écrans sont décrits dans [Facturation](../../features/finances/accounting.md).

## Portée

- Toutes les données appartiennent à un espace de travail (`workspaceId`) ; voir [Espaces et accès](../cross-cutting/workspaces-and-access.md).
- La facturation n’existe que dans un espace PRO. `requirePro` refuse avec « Indisponible dans un espace personnel (facturation). » (ou « (société) », « (catalogue) ») : création de document (`createDocument`, `createFromDocument`, `createDepositInvoice`), récurrente, import, statut et envoi d’un importé, numérotation, profil et logo de la société, création d’article (`apps/api/src/services/workspaces/workspaces.ts`).
- Les statuts de suivi par défaut ne sont créés que dans un espace PRO (requête `documentStatuses`).
- Les erreurs suivent le format commun (`BAD_USER_INPUT`, erreurs de champ, `NOT_FOUND`) : voir [Erreurs](../cross-cutting/errors.md).

## Types et états

| Type              | Code              | Préfixe | Nom                   |
| ----------------- | ----------------- | ------- | --------------------- |
| Devis             | `QUOTE`           | `D`     | « Devis »             |
| Facture           | `INVOICE`         | `F`     | « Facture »           |
| Facture d’acompte | `DEPOSIT_INVOICE` | `FA`    | « Facture d’acompte » |
| Avoir             | `CREDIT_NOTE`     | `A`     | « Avoir »             |

`INVOICE_TYPES` = facture et facture d’acompte (`isInvoice`) : les types qui se paient, se relancent et s’acquittent (`packages/shared/src/accounting/accounting.ts`).

États (`ACCOUNTING_DOCUMENT_STATUSES`) :

- `DRAFT` : brouillon modifiable, sans numéro ;
- `FINAL` : numéroté et définitif, plus modifiable (corrigé par un avoir) ; seule exception : la migration `20261119150000_text_sizes` (décision DO) a raccourci ses textes trop longs à la taille de leur sorte (libellé, lignes, mode de règlement 250 ; conditions de règlement, intérêts de retard, mention de TVA 500), société figée comme vendeur comprise ;
- `TEMPLATE` : modèle d’une facture récurrente, jamais numéroté, exclu des listes (`accountingDocuments` et `derived` l’excluent).

Nom d’un document (`documentName`) : son numéro, sinon son libellé (modèle), sinon « Brouillon » (`DRAFT_NAME`). Titre (`documentTitle`) : « Facture F2600042 », « Facture Brouillon ».

## Champs d’un document

Schéma `accountingDocumentInputSchema` (`packages/shared/src/accounting/accounting-documents.ts`) :

| Champ                                                                                | Règle                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clientId`                                                                           | Obligatoire (« Le client est requis. »).                                                                                                                                                                   |
| `serviceId`, `contactId`, `projectId`                                                | Facultatifs.                                                                                                                                                                                               |
| `issueDate`                                                                          | Jour obligatoire (« La date est requise. »).                                                                                                                                                               |
| `dueDate`                                                                            | Facultatif ; pas avant la date (« L’échéance doit suivre la date du document. »).                                                                                                                          |
| `serviceStart`, `serviceEnd`                                                         | Facultatifs ; la fin suit le début (message commun `END_AFTER_START`).                                                                                                                                     |
| `label`                                                                              | 250 caractères (décision DO).                                                                                                                                                                              |
| `introduction`, `conclusion`                                                         | Markdown, 65 536 caractères (« Texte trop long. ») ; blanc → null.                                                                                                                                         |
| `referenceLabel` / `referenceValue`                                                  | 250 caractères chacun.                                                                                                                                                                                     |
| `paymentTerms`, `paymentMethods`, `lateInterest`, `billingSchedule`, `otherMentions` | Conditions de règlement et intérêts de retard : mentions légales, 500 caractères (`LEGAL_TEXT_MAX`) ; mode de règlement et mode de facturation 250 ; `otherMentions` : texte multiligne, 4 000 caractères. |
| `depositType` / `depositValue`                                                       | `PERCENT` ou `AMOUNT` ; valeur ≥ 0 (« L’acompte ne peut pas être négatif. »), au plus 100 en % (« 100 % maximum. »).                                                                                       |
| `globalDiscountType` / `globalDiscountValue`                                         | Idem, au plus 100 en %.                                                                                                                                                                                    |
| `showBankDetails`, `vatApplicable`                                                   | Booléens.                                                                                                                                                                                                  |
| `lines`                                                                              | 500 lignes au plus (« 500 lignes maximum. »).                                                                                                                                                              |
| `timeEntryIds`                                                                       | 5 000 au plus ; omis : le temps facturé ne change pas.                                                                                                                                                     |

Une ligne (`accountingLineSchema`) :

- `kind` : `ITEM` (article), `DISBURSEMENT` (débours, hors TVA et sans marge), `TEXT` (texte libre), `DEDUCTION` (déjà facturé) ;
- `label` : 250 caractères, obligatoire sauf pour un texte (« Le libellé est requis. ») ;
- `description` : markdown, 65 536 caractères (« Texte trop long. »), blanc → null ;
- `quantity` : de −999 999 à 999 999 (« Quantité attendue. ») ;
- `unit` : `UNIT`, `HOUR`, `DAY`, `MONTH`, `FLAT`, `DEPOSIT` (« Unité », « Heure », « Jour », « Mois », « Forfait », « Acompte ») ;
- `unitPrice` : de −99 999 999 à 99 999 999 (« Montant attendu. », « Montant trop grand. ») ;
- `vatRate` : 0 à 100 (« Taux invalide. ») ;
- remise : valeur ≥ 0 (« La remise ne peut pas être négative. »), au plus 100 en % ;
- `deductedDocumentId` : seulement gardé sur une déduction (`linesData`).

Stockage : quantité 3 décimales, prix et remises 4 décimales, taux 2 décimales, totaux 2 décimales ; la devise est `EUR` par défaut (schéma Prisma).

## Lignes et totaux

`computeTotals` (partagé, utilisé par l’éditeur, l’API et le PDF), en centimes :

1. Une ligne texte vaut 0.
2. Brut d’une ligne = arrondi au centime de quantité × prix unitaire (le prix garde ses décimales).
3. Taux retenu = taux de la ligne si la TVA s’applique au document, sinon 0.
4. Déduction : son brut est retiré de la base de son taux ; son net vaut −brut.
5. Débours : ajouté aux débours, hors TVA.
6. Article : remise de ligne (pourcentage arrondi, ou montant), jamais plus que le brut ; le net s’ajoute à la base de son taux.
7. Remise générale sur la somme des articles nets (`itemsNet`), jamais plus que cette somme, répartie sur les taux au prorata de leurs bases, le dernier taux (du plus fort au plus faible) prenant le reste.
8. TVA par taux = pourcentage arrondi de la base (après remise et déductions) ; les taux de base et de TVA nulles ne sont pas listés.
9. `totalNet` = articles nets − remise générale − déductions ; `totalGross` = `totalNet` + TVA + débours.

Les totaux HT, TVA et TTC sont recalculés et stockés à chaque enregistrement (`documentData`). Un acompte de devis n’est gardé que si sa valeur et son type sont donnés.

Taux usuels proposés (`VAT_RATES`) : 20, 10, 5,5, 2,1, 0.

## Valeurs par défaut d’un nouveau document

`defaultFields` (`apps/api/src/services/accounting/accounting-documents.ts`), à partir du profil de la société :

- échéance : devis = date + validité des devis (`quoteValidityDays`) ; avoir = aucune ; facture = date donnée par les conditions (`dueDateForTerms`), sinon date + `paymentDays` ;
- conditions de règlement et intérêts de retard : ceux de la société, sauf pour un avoir (aucun) ;
- mode de règlement, autres mentions, libellé de la référence, TVA applicable : ceux de la société ;
- RIB affiché sauf sur un devis ;
- aucune ligne, aucune remise, aucun acompte.

À la création, la mention d’exonération de TVA de la société est copiée sur le document (`vatExemptionText`).

### Échéance déduite des conditions

`dueDateForTerms` (partagé) compare les conditions sans casse ni accents :

- « À réception » ou « Comptant » (`paidOnReceipt`) : échéance = date du document, imprimée « À réception » ;
- « À N jours » : date + N jours ;
- « À N jours fin de mois » : dernier jour du mois de date + N jours ;
- autre texte : pas d’échéance déduite.

Propositions : `PAYMENT_TERMS_PRESETS`, `PAYMENT_METHOD_PRESETS`, `LATE_INTEREST_PRESETS`, `BILLING_SCHEDULE_PRESETS` ; tout autre texte est accepté.

## Création, modification, suppression

`apps/api/src/services/accounting/accounting-documents.ts` :

- Une facture d’acompte ne se crée pas directement : « Une facture d’acompte s’établit à partir d’un devis. » (mutation `createAccountingDocument`).
- Client, service, contact, projet (`assertParties`) : un client ou un projet archivé est refusé, sauf s’il est déjà celui du document (ou copié d’un document source) ; « Ce service n’appartient pas au client. », « Ce contact n’appartient pas au client. ».
- Déductions (`assertDeductions`) : chaque acompte déduit doit exister (« Facture d’acompte » introuvable), être une facture d’acompte définitive (« Seule une facture d’acompte validée peut être déduite. ») du même client (« Cette facture d’acompte est celle d’un autre client. »).
- Chronologie (`assertChronology`) : un brouillon ne peut pas être daté avant le dernier document définitif du même type, documents importés compris : « La date ne peut pas précéder celle de la dernière facture (12/10/2026). » (« le dernier devis », « la dernière facture d’acompte », « le dernier avoir »). Un modèle de récurrente n’est pas contrôlé. La requête `latestDocumentDate` donne cette date au formulaire.
- Modification (`updateDocument`) : brouillons et modèles seulement (« Un document définitif ne peut plus être modifié : corrigez-le par un avoir. ») ; refusée sur un document archivé, et sur le modèle d’une récurrente archivée. Les lignes sont toutes remplacées.
- Suppression (`deleteDocument`) : brouillons seulement (« Seuls les brouillons peuvent être supprimés. ») et pas si d’autres documents ont été créés à partir de lui (« D’autres documents ont été créés à partir de ce brouillon. »). Lignes et pièces jointes sont supprimées avec lui (cascade). Un document définitif ne se supprime jamais ; il s’archive.
- Duplication (`duplicateDocument`) : copie en brouillon du même type, datée du jour donné, sans échéance ; une facture d’acompte garde son devis d’origine ; refusée sur un archivé.
- Projet (`setDocumentProject`) : changeable sur un brouillon comme sur un définitif (le projet n’est pas imprimé) ; refusé si archivé ; projet archivé refusé sauf s’il est déjà le sien.
- Pièces jointes (`addDocumentAttachments`, `removeDocumentAttachment`) : sur brouillons et définitifs (elles ne font pas partie du document), pas sur un archivé. Voir [Fichiers et pièces jointes](../cross-cutting/files-and-attachments.md).

## Temps facturé

`assertBillableTime` :

- seule une facture facture du temps (« Seule une facture peut facturer du temps. ») ; un modèle non plus (« Un modèle de facture récurrente ne facture pas de temps. ») ;
- chaque temps doit exister (« Temps » introuvable) et être terminé (« Arrêtez le chrono avant de facturer son temps. ») ;
- pas déjà facturé ailleurs (« Une partie de ce temps est déjà facturée (« F2600042 »). ») ;
- à l’enregistrement, les temps donnés sont liés au document et ceux retirés détachés (dans une transaction). Supprimer le document détache ses temps (`onDelete: SetNull`).

Côté web, `timeLines` regroupe les temps (en tout, par jour, par tâche — un temps à plusieurs tâches est partagé à parts égales —, par temps), en heures (2 décimales, arrondi au quart d’heure supérieur en option) ou en jours (3 décimales, heures par jour) ; les descriptions deviennent une liste markdown sans doublon.

## Validation et numérotation

`finalizeDocument` :

- seul un brouillon se valide (« Seul un brouillon peut être validé. »), pas un archivé ;
- le nom de la société est requis (« Renseignez le nom de votre société (Paramètres › Société) avant de valider. ») ;
- au moins une ligne chiffrée (« Le document n’a aucune ligne chiffrée. ») ;
- total TTC positif ou nul (« Le total ne peut pas être négatif : établissez plutôt un avoir. ») ;
- dans une transaction, la ligne `DocumentSequence` (espace, type, année de la date du document) est créée si besoin puis verrouillée (`FOR UPDATE`) : deux validations n’obtiennent jamais le même numéro ; la chronologie est revérifiée sous le verrou ;
- compteur = max(prochain numéro enregistré, plus grand compteur déjà attribué + 1) ; au-delà de 99 999 : « Numérotation épuisée pour cette année. » ;
- numéro (`documentNumber`) : préfixe + année sur deux chiffres + compteur sur cinq chiffres (« F2600042 ») ; unique par espace ;
- le vendeur (profil de la société sans les catégories de trésorerie) et l’acheteur (client, adresse du service s’il en a une, service, contact) sont figés (`sellerSnapshot`, `buyerSnapshot`) ;
- le statut de suivi devient le premier statut « À envoyer » de sa portée ; `finalizedAt` est daté ;
- un avoir validé recalcule le statut de paiement de sa facture et le sien (`syncPaymentStatus`).

Compteur déjà attribué (`usedCounter`) : plus grand compteur des documents d’Ordo du type et de l’année, et des documents importés du même type dont le numéro suit le même format (« F26 » + 5 chiffres) : Ordo continue après eux.

Réglage (`setSequenceStart`, mutation `setDocumentSequence`) : prochain numéro entier de 1 à 99 999 (« Numéro invalide (1 à 99 999). »), jamais en dessous des numéros attribués (« Les numéros jusqu’à N sont déjà attribués. »). `documentSequences(year)` renvoie pour chaque type le prochain numéro (au moins le minimum) et ce minimum (`apps/api/src/services/accounting/company.ts`).

## Documents créés à partir d’un autre

`createFromDocument` (mutation `createDocumentFrom`) :

- la source doit être définitive (« Validez d’abord le document d’origine. ») et non archivée ;
- seuls : devis → facture ou facture d’acompte, facture ou acompte → avoir (« Ce document ne peut pas être créé à partir de celui-ci. ») ;
- client, service, contact, projet, période de prestation, référence, TVA, remise générale sont copiés (client et projet gardés même archivés) ; date = celle donnée ;
- facture depuis un devis : lignes du devis sans ses déductions, plus une déduction « Déjà facturé : F… » par document et par taux pour ce qui a déjà été facturé sur le devis (factures et acomptes définitifs moins leurs avoirs définitifs) ; une déduction d’acompte est liée à son acompte ; conditions, mode de règlement et intérêts de retard du devis repris, échéance recalculée ;
- avoir : lignes de la facture, objet « Avoir sur la facture F… », conditions par défaut d’un avoir.

Montant déjà facturé sur un devis (`invoicedAmounts`, champ `invoicedNet`, calculé en une requête pour tous les devis d'une liste) : somme HT des factures et acomptes définitifs issus du devis moins leurs avoirs définitifs.

## Factures d’acompte

`createDepositInvoice` (mutation `createDepositInvoice`) :

- pourcentage strictement positif et au plus 100 (« Pourcentage d’acompte invalide (plus de 0 et jusqu’à 100 %). ») ; 30 % par défaut via `createDocumentFrom` ;
- depuis un devis d’Ordo : définitif (« Une facture d’acompte s’établit à partir d’un devis validé. »), non archivé ; une ligne « Acompte de 30 % pour le devis D2600004 de 5 100,00 € HT du 12/10/2026 » (unité « Acompte ») au pourcentage du total HT ; un devis à plusieurs taux donne une ligne par taux (« Part soumise à la TVA à 20 % ») ; conditions du devis reprises ; objet du devis ou « Acompte — devis D… » ;
- depuis un devis importé : il doit être un devis (« Une facture d’acompte s’établit à partir d’un devis. ») rattaché à un client (« Rattachez d’abord le devis importé à un client. »), non archivé ; une seule ligne au taux usuel le plus proche de TVA/HT (20, 10, 8,5, 5,5, 2,1, 0) ; TVA applicable si le devis a de la TVA ; lien `importedSourceId`.

Acomptes à déduire (`deductibleDeposits`, requête `deductibleDeposits`) : acomptes définitifs du client, par taux, moins leurs avoirs définitifs et les déductions des autres documents (brouillons compris, le document en cours exclu) ; une déduction portée par un avoir définitif rend son montant ; seuls les restes positifs sont proposés, du plus ancien au plus récent.

## Statuts de suivi

`apps/api/src/services/accounting/document-statuses.ts`, constantes dans `packages/shared/src/accounting/treasury.ts` :

- portées : `QUOTE` (devis) et `INVOICE` (factures, acomptes et avoirs) (`scopeOf`) ;
- catégories : devis `TO_SEND`, `SENT`, `ACCEPTED`, `REFUSED` ; factures `TO_SEND`, `SENT`, `PAID`, `CREDIT_DUE` (`STATUS_CATEGORIES_BY_SCOPE`) ; une catégorie d’une autre portée est refusée (« Catégorie invalide pour ce type de document. ») ;
- chaque catégorie de chaque portée a toujours un statut : `ensureDocumentStatuses` crée ceux qui manquent (libellé de la catégorie, numéroté « (2) »… si pris ; couleurs par défaut), à chaque lecture des statuts dans un espace PRO ;
- les changements automatiques donnent le premier statut actif de la catégorie (`statusOf`), sinon un archivé, sinon le statut par défaut recréé ;
- libellé et couleur suivent `labelFormSchema` ; libellé unique (« Un statut porte déjà ce libellé. ») ; voir [Nommage](../cross-cutting/naming.md) ;
- le dernier statut d’une catégorie ne peut ni changer de catégorie ni être supprimé (« C’est le dernier statut de sa catégorie : il est nécessaire au suivi automatique. ») ;
- supprimer un statut donne à ses documents (d’Ordo et importés) le premier autre statut de la même catégorie ;
- un statut archivé reste celui de ses documents mais n’est plus donné (voir [Archivage](../cross-cutting/archiving.md)).

## Suivi automatique

| Évènement               | Effet                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| Validation              | Statut « À envoyer ».                                                                                        |
| Envoi noté (`markSent`) | Statut « Envoyé » choisi, sinon le premier « Envoyé » si le document était « À envoyer » (ou sans statut).   |
| Acceptation d’un devis  | Statut « Accepté », date d’acceptation.                                                                      |
| Paiement, avoir validé  | `syncPaymentStatus` (ci-dessous).                                                                            |
| Statut changé à la main | Quitter « Accepté » efface la date d’acceptation ; passer à « Accepté » la met à aujourd’hui si elle manque. |

`syncPaymentStatus` (factures, acomptes et avoirs définitifs, et documents liés par un avoir) :

- statut « Avoir à créer » : inchangé tant qu’aucun avoir définitif n’existe ; ensuite « Payée » si le reste dû est nul ou négatif, sinon « Envoyée » (ou « À envoyer » sans envoi) ;
- reste dû ≤ 0 et pas « Payée » : « Payée » ;
- reste dû > 0 et « Payée » ou sans statut : « Envoyée » (ou « À envoyer ») ;
- autres statuts choisis à la main : gardés.

## Envoi, acceptation, relances

`apps/api/src/services/accounting/document-tracking.ts` :

- Le suivi ne concerne que les documents définitifs (« Le suivi ne concerne que les documents validés. », « Seul un document validé peut être envoyé. ») non archivés.
- Statut donné à la main : de la portée du document (sinon « Statut » introuvable) ; un statut archivé est refusé sauf s’il est déjà le sien.
- Envoi (`sendingData`) : moyen parmi `MAIL`, `CHORUS`, `POST`, `HAND`, `OTHER` (« Moyen d’envoi inconnu. ») ; date pas dans le futur (« La date d’envoi ne peut pas être dans le futur. ») ; sans date ou aujourd’hui : maintenant ; un jour passé est enregistré à midi UTC. Le statut donné doit être de catégorie « Envoyé » (« Ce statut n’est pas un statut d’envoi. »). L’envoi d’un mail depuis l’éditeur note `MAIL`.
- Acceptation (`acceptQuote`) : devis seulement (« Seul un devis peut être accepté. ») ; le devis signé remplace le précédent (l’ancien fichier est supprimé). `removeSignedQuote` retire le fichier.
- Relance notée (`addReminder`) : factures et acomptes seulement (« Seule une facture peut être relancée. ») ; note multiligne de 4 000 caractères au plus (« 4 000 caractères maximum. »), refusée plutôt que coupée ; vide → null. Supprimer une relance est refusé sur un document archivé.

Destinataire (`billingRecipient` ; `billingRecipients` pour une liste, champ `billingEmail`) : email du contact, sinon du service, sinon du client.

Factures à relancer (requête `overdueInvoices`) : factures et acomptes définitifs envoyés au moins `REMINDER_DELAY_DAYS` (15) jours avant (envoyée le 1er : relançable dès le 16) et encore dus, la date d’envoi comptant et non l’échéance ; triées par date d’envoi puis numéro. Le web retire les archivées.

Relance groupée (`sendReminders`, `apps/api/src/services/accounting/reminders.ts`) :

- boîte d’envoi requise (« Choisissez la boîte d’envoi. »), de 1 à 100 factures (« Aucune facture choisie. », « 100 factures maximum à la fois. ») ;
- un mail par facture avec son PDF et la signature de la boîte ; texte de `reminderMail` (objet « Relance — Facture F… — Société », montant, échéance, reste dû) ;
- une facture est sautée et signalée : « Ce n’est pas une facture validée. », message d’archivage, « Déjà réglée. », « Aucune adresse mail pour ce client. », ou l’erreur d’envoi (« Envoi impossible. ») ;
- chaque relance envoyée est notée « Relance par mail (groupée) ».

## Retard

Champ `overdue` : document définitif avec une échéance passée (jour de Paris) ;

- devis : statut « À envoyer » ou « Envoyé » (« Expiré ») ;
- avoir : jamais ;
- facture et acompte : reste dû positif (« En retard »).

## Paiements et soldes

`documentBalances` (montants en centimes) :

- facture ou acompte : payé = somme de ses affectations de trésorerie ; crédité = TTC de ses avoirs définitifs ; reste dû = TTC − crédité − payé + remboursé sur ses avoirs (négatif : trop-perçu) ;
- avoir : remboursé = ses affectations ; dû au client = son TTC moins ce qui est remboursé, limité, s’il annule une facture, à ce qui rend cette facture trop payée.

Documents importés (`importedBalances`) : TTC − affectations, 0 s’ils sont réglés hors trésorerie. Les soldes sont calculés une fois par requête GraphQL (cache par contexte).

Paiement (`recordPayment`, schéma `documentPaymentSchema`) :

- compte requis (« Le compte est requis. »), date, montant positif (« Montant positif attendu. ») d’au plus 99 999 999, moyen facultatif ;
- seul un document définitif qui n’est pas un devis (« Seul un document validé (facture ou avoir) peut être réglé. »), non archivé ;
- compte actif, moyen non archivé et du bon sens (entrée pour une facture, sortie pour un avoir : « Ce moyen de paiement ne sert pas aux entrées. » / « … aux sorties. ») ;
- crée un mouvement réel daté du jour du paiement (valeur et opération), libellé « Règlement F… — Client » (ou « Remboursement A… — Client »), montant positif (négatif pour un remboursement), client et projet du document, affecté au document ;
- catégorie : celle réglée pour les paiements de factures ou les remboursements d’avoirs (profil de la société, mutation `setInvoiceTreasuryCategories`), sinon la catégorie « Ventes » (entrée) ou « Remboursements clients » (sortie) la plus ancienne si elle existe ;
- puis `syncPaymentStatus`. Voir [Trésorerie](treasury.md).

## Factures récurrentes

`apps/api/src/services/accounting/recurring-invoices.ts`, schéma `recurringInvoiceSchema` :

- planification : `label` obligatoire (250), `recurrence` (règle partagée, voir [Dates](../cross-cutting/dates.md)), `startDate` (premier jour), `autoFinalize`, `active` ;
- seule une facture peut devenir récurrente (« Seule une facture peut être rendue récurrente. »), non archivée ; elle est copiée comme modèle (`TEMPLATE`), la facture elle-même ne change pas ;
- prochaine date : première occurrence à partir du début (ou d’aujourd’hui en modification), cherchée sur environ 800 jours ; aucune : récurrente terminée (`nextDate` null) ;
- modifier une récurrente archivée est refusé ; le modèle se modifie comme un brouillon (refusé si la récurrente est archivée) ;
- suppression : le modèle est supprimé avec la récurrente (cascade) ; les factures émises sont gardées (`recurringId` mis à null) ;
- émission (`issueDueInvoices`) : pour chaque récurrente active non archivée dont la prochaine date est passée, une facture par date due non émise (rattrapage), au plus 24 par récurrente et par passage ; la date de la facture est la date d’émission, l’échéance du modèle est décalée d’autant ; client et projet gardés même archivés ; avec `autoFinalize`, la facture est validée (un échec est journalisé, la facture reste en brouillon) ;
- une récurrente archivée n’émet rien et sa prochaine date est avancée après aujourd’hui sans rien émettre : restaurée, elle reprend sans rattraper ;
- tâche de fond « Factures récurrentes » : 20 s après le démarrage puis chaque heure, dans chaque espace PRO, avec la date de Paris (voir [Tâches de fond](../cross-cutting/background-jobs.md)) ; aussi lancée après la création ou la modification d’une récurrente, et par la mutation `issueDueRecurringInvoices`.

## Documents importés

`apps/api/src/services/accounting/imported-documents.ts`, schéma `importedDocumentSchema` :

- `type` (les quatre types), `number` obligatoire (250, « Le numéro est requis. »), `issueDate` obligatoire, `dueDate` après la date ;
- client d’Ordo ou nom libre (250) requis (« Choisissez un client ou saisissez son nom. ») ; client et projet archivés refusés sauf s’ils sont déjà les siens ;
- `label` (250), `note` (markdown, 65 536), totaux HT, TVA, TTC (de −99 999 999 à 99 999 999), devise ISO à trois lettres (« Devise invalide. ») ;
- `settled` : réglé ou remboursé hors trésorerie, plus attendu ;
- numéro unique par type dans l’espace (« Un document importé de ce type porte déjà ce numéro. ») ;
- fichier facultatif ; en modification, un nouveau fichier remplace l’ancien (supprimé après coup ; en cas d’échec, le nouveau est supprimé) ; supprimer le document supprime son fichier ;
- modification, projet, statut et envoi refusés sur un importé archivé ;
- statut donné à la main ou effacé (de la portée du document, pas un statut archivé sauf le sien) ; envoi noté comme pour un document d’Ordo, avec un statut « Envoyé » obligatoire ; aucun suivi automatique (les paiements ne sont pas suivis par Ordo, hors affectations de trésorerie) ;
- un numéro importé au format d’Ordo fait avancer la numérotation, et sa date compte pour la chronologie.

## Catalogue

`apps/api/src/services/accounting/catalog.ts`, schéma `catalogItemSchema` :

- `kind` : `ITEM` ou `DISBURSEMENT` ; `label` obligatoire (250) ; `description` markdown (65 536) ; unité ; prix ; TVA 0 à 100 ;
- un débours est toujours enregistré à TVA 0 ;
- modifier un article archivé est refusé (restaurer d’abord) ;
- supprimer un article ne change pas les documents (les lignes sont des copies) ;
- liste triée par libellé ; un article archivé n’est plus proposé.

## Clients : coordonnées, services, contacts

`apps/api/src/services/accounting/client-parties.ts`, schémas de `packages/shared/src/accounting/accounting.ts` :

- type `COMPANY` ou `INDIVIDUAL` ; un particulier perd TVA, SIREN, SIRET et code d’activité ; un professionnel perd prénom et nom ;
- adresse : jusqu’à 4 lignes de 250 caractères, code postal 20, ville 250, région 250, pays ISO à deux lettres (« Pays invalide. ») ; vide = pas d’adresse (`hasAddress`) ;
- téléphones : 10 au plus, libellé 250, numéro de 3 à 30 caractères (« Numéro invalide. ») ;
- email (« Adresse email invalide. ») et site http(s) (« Adresse invalide (http ou https). ») ; vides → null ;
- SIREN 9 chiffres avec clé de Luhn (« SIREN invalide (9 chiffres). »), SIRET 14 chiffres avec clé de Luhn sauf établissements de La Poste (`356000000…`) (« SIRET invalide (14 chiffres). ») ; espaces retirés ;
- service : libellé obligatoire (250), adresse, email, téléphones ; position en fin de liste ;
- contact : prénom obligatoire (« Le prénom est requis. »), nom (règle des noms de personne), email, fonction (250), téléphones, service facultatif du même client ;
- toute modification est refusée sur un client archivé ; supprimer un service garde ses contacts (rattachés au client) ; un contact ou un service supprimé est retiré des documents (`SetNull`) ;
- un client ayant des documents ne peut pas être supprimé (relation `Restrict` du schéma).

## Profil de la société

`apps/api/src/services/accounting/company.ts`, schéma `companyProfileSchema` :

- une ligne par espace, créée vide au premier accès ;
- `name` obligatoire (« Le nom de la société est requis. ») ; `contact` 250, forme juridique 250, capital 250, immatriculation 500 (mention légale, `LEGAL_TEXT_MAX`), SIREN, SIRET, code d’activité 20, TVA 20 ;
- `vatApplicable` ; `vatExemptionText` obligatoire (« La mention est requise. », 500 : mention légale), par défaut « TVA non applicable, art. 293 B du CGI » ;
- IBAN contrôlé (ISO 13616, modulo 97 : « IBAN invalide. »), BIC 8 ou 11 caractères (« BIC invalide (8 ou 11 caractères). ») ; espaces retirés, majuscules ;
- conditions de règlement et intérêts de retard : 500 caractères chacun (mentions légales), mode de règlement 250 ;
- défauts : conditions « À 30 jours », `paymentDays` 30 (0 à 365), mode « Virement bancaire », intérêts « Trois fois le taux d’intérêt légal », autres mentions « Pas d’escompte pour paiement anticipé. », libellé de référence « Référence dossier » (obligatoire, 250), validité des devis 30 jours (1 à 365) ;
- logo : PNG ou JPEG seulement (« Logo en PNG ou JPEG uniquement. ») ; l’ancien logo est supprimé ;
- catégories de trésorerie des paiements de factures et des remboursements d’avoirs : réglées depuis la trésorerie, absentes des documents imprimés.

## PDF

`apps/api/src/services/accounting/accounting-pdf.ts`, route `GET /api/accounting/documents/:id/pdf` (`?download=1` pour télécharger, `?paid=1` pour l’acquittée ; « PDF impossible. » en cas d’échec) :

- PDF/A-3b, A4 ; titre = titre du document (+ « acquittée ») ;
- brouillon et modèle : vendeur et acheteur actuels, filigrane « PROVISOIRE », « Provisoire » à la place du numéro ; définitif : vendeur et acheteur figés à la validation ;
- en-tête : logo (ignoré s’il est illisible), nom, SIRET (sinon SIREN), code APE, TVA, adresse, « Contact : » ; à droite : type, « N° … », « Date », « Valable jusqu’au » (devis) ou « Échéance » (« À réception » si payable à réception), « Prestation », « Devis » ou « Facture d’origine », référence ; acheteur placé dans la fenêtre d’enveloppe (service, « À l’attention de … », adresse ; pays omis pour la France), identifiants dessous ;
- objet, introduction (markdown), tableau des lignes avec en-tête répété : « Désignation », « Qté », « Unité », « PU HT », « Remise » (si une ligne en a), « TVA » (si applicable), « Total HT » (« Total ») ; débours notés « Débours, hors TVA » ;
- totaux : « Sous-total HT », « Remise (x %) », « Déjà facturé », « Total HT », « TVA x % sur … », « Débours », « Total TTC » (« Net à payer » sans TVA, « Total de l’avoir ») ; sans TVA, la mention d’exonération (sinon « TVA non applicable ») ;
- acquittée : section « Facture acquittée » avec « Réglée le … (moyen) » par paiement et « Pour acquit, le … » ; seulement pour une facture ou un acompte définitif (« Seule une facture validée peut être acquittée. ») entièrement réglé (« La facture n’est pas entièrement réglée : enregistrez d’abord son règlement. ») ;
- conclusion, puis « Conditions » : « Mode de facturation » (devis), « Conditions de règlement », « Mode de règlement », « Acompte à la commande » (devis), « Intérêts de retard », « Indemnité forfaitaire pour frais de recouvrement en cas de retard : 40 € » (client professionnel, sauf avoir), autres mentions ; « Coordonnées bancaires » (titulaire, banque, IBAN, BIC) si le RIB est affiché et l’IBAN connu ;
- devis : bloc « Bon pour accord » (« À ____, le __ / __ / ____ », « Signature et cachet ») ;
- pied de page : « Facture N° … du … » (ou « provisoire ») et « page / total » ;
- forme juridique, capital et immatriculation du profil ne sont pas imprimés.

## Factur-X

`apps/api/src/services/accounting/factur-x.ts` :

- factures (380), acomptes (386) et avoirs (381) définitifs embarquent `factur-x.xml` (UN/CEFACT CII D16B, profil EN 16931, relation « Alternative ») et les métadonnées XMP ; pas les devis ni les brouillons ;
- unités UN/ECE : `C62`, `HUR`, `DAY`, `MON`, `LS` ;
- catégories de TVA : standard `S`, taux zéro `Z`, exonéré `E` (franchise `VATEX-FR-FRANCHISE` avec la mention, débours `VATEX-EU-79-C`) ;
- les montants déjà facturés sont des lignes négatives ; la remise générale est une remise de document par taux, comme répartie par les totaux ; un avoir référence sa facture d’origine.

## Export ZIP

`apps/api/src/services/accounting/accounting-zip.ts`, route `GET /api/accounting/documents/zip?from=&to=&types=&imported=1` (« Archive impossible. ») :

- dates réelles (« Période invalide. »), début avant fin (`END_AFTER_START`), au moins un type (« Choisissez au moins un type de document. ») ;
- documents définitifs dont la date tombe dans la période (bornes comprises), en PDF avec Factur-X, un dossier par type (« Devis », « Factures », « Factures d’acompte », « Avoirs ») ;
- avec `imported`, fichiers des documents importés de la période (« F… (importé).pdf ») ;
- aucun fichier : « Aucun document sur cette période. » ; nom « Documents comptables du … au ….zip ».

## Archivage

Documents d’Ordo (`ACCOUNTING_DOCUMENT`), récurrentes (`RECURRING_INVOICE`), documents importés (`IMPORTED_DOCUMENT`), articles (`CATALOG_ITEM`) et statuts (`DOCUMENT_STATUS`) s’archivent par la mutation générique (voir [Archivage](../cross-cutting/archiving.md)). Archivé : lecture seule (« Élément archivé : restaurez-le pour le modifier. »), rien ne peut en être créé (facture, avoir, acompte, duplication, récurrente), mais un définitif archivé garde son numéro et son PDF. Les commentaires des documents, importés et articles suivent les règles de [Commentaires](../cross-cutting/comments.md).
