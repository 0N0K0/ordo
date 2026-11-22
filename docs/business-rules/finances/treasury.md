# Règles de la trésorerie

Règles appliquées par l’API pour la trésorerie : comptes, mouvements, lignes de répartition, catégories, sens, moyens de paiement, tiers, prévisions, prévisionnel, budgets, équipe, relations, contextes, prêts, import de relevé, liens et relevé PDF. Sources : `apps/api/src/services/treasury/**`, `apps/api/src/graphql/modules/treasury.ts`, `apps/api/src/routes/treasury.ts` et les schémas de `packages/shared/src/accounting/treasury.ts`. Ce que voit l’utilisateur : [Trésorerie](../../features/finances/treasury.md).

Les messages d’erreur sont cités tels quels ; leur forme (champ, `BAD_USER_INPUT`, « introuvable ») est décrite dans [Erreurs](../cross-cutting/errors.md). L’archivage générique (« Élément archivé : restaurez-le pour le modifier. ») est décrit dans [Archivage](../cross-cutting/archiving.md). Toutes les données sont propres à l’espace de travail ([Espaces et accès](../cross-cutting/workspaces-and-access.md)).

## Montants et sens

Source : `packages/shared/src/accounting/treasury.ts`.

- Un montant est signé : positif = entrée (argent reçu), négatif = sortie. Le sens est déduit du signe par `directionOf` : `IN` si strictement positif, `OUT` sinon (0 compris).
- Montant d’un compte ou d’un mouvement : nombre requis (« Montant attendu. »), entre −99 999 999 et 99 999 999 (« Montant trop grand. »).
- Un mouvement, une opération importée ou une valeur de ligne ne peut pas être nul : « Le montant ne peut pas être nul. », « Montant nul. » (import), « La valeur ne peut pas être nulle. » (ligne).
- Les calculs se font en centimes (`toCents`, `lineCents`, `splitAmounts`) ; l’API stocke des décimaux et renvoie des euros.
- Les sens existants : `TREASURY_DIRECTIONS = ['IN', 'OUT']` (catégories, budgets).

## Comptes

Sources : `apps/api/src/services/treasury/treasury.ts`, schéma `treasuryAccountSchema`.

| Champ            | Règle                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------- |
| `label`          | Requis, 250 caractères au plus (« Le libellé est requis. », « 250 caractères maximum. »).    |
| `openingBalance` | Montant (voir plus haut).                                                                    |
| `openingDate`    | Jour valide, requis.                                                                         |
| couleur, image   | Comme toute liste de paramètres (`TREASURY_ACCOUNT`, [Nommage](../cross-cutting/naming.md)). |

- Création : en dernière position (`nextPositionIn`).
- Modification : refusée sur un compte archivé (« Élément archivé… »).
- Suppression : refusée s’il a des mouvements : « Ce compte a des mouvements : archivez-le plutôt. » (la base refuse aussi : `onDelete: Restrict`).
- Solde d’un compte à un jour (`accountBalance` ; `accountBalances` pour plusieurs comptes en une requête) : 0 avant sa date d’ouverture ; sinon solde d’ouverture + somme des mouvements **réels** datés de la date d’ouverture à ce jour inclus. Les mouvements archivés comptent (argent réel), les prévisions non. Le champ GraphQL `balance` donne le solde d’aujourd’hui (heure de Paris).
- Archivage : liste de paramètres `TREASURY_ACCOUNT` (date `archivedAt`), seulement par « Archiver » / « Restaurer » ; le formulaire du compte n’a pas de case « Archivé ».
- Liste `treasuryAccounts` : non archivés d’abord, puis par position.
- Un compte archivé n’est plus compté dans le solde global ni dans le prévisionnel ; il ne peut pas être donné à un nouveau mouvement (voir [Éléments archivés](#éléments-archivés-donnés-à-un-mouvement)) ni recevoir un import.

## Mouvements

Sources : `apps/api/src/services/treasury/treasury.ts`, schéma `treasuryEntrySchema`.

### Champs

| Champ                                      | Règle                                                                                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accountId`                                | Requis (« Le compte est requis. »), doit exister (« Compte » introuvable).                                                                                     |
| `status`                                   | `ACTUAL` (réel) ou `FORECAST` (prévu).                                                                                                                         |
| `date`                                     | Date d’exécution, jour valide. C’est elle qui compte pour le solde.                                                                                            |
| `valueDate`                                | Jour ou null ; null = la date d’exécution (enregistrée telle quelle). Information seulement.                                                                   |
| `label`                                    | Requis, 250 caractères (`TEXT_MAX`).                                                                                                              |
| `amount`                                   | Signé, non nul.                                                                                                                                                |
| `categoryId`                               | Facultatif ; doit être du sens du mouvement : « Choisissez une catégorie d’entrée. » / « Choisissez une catégorie de sortie. »                                 |
| `methodId`                                 | Facultatif ; doit servir ce sens : « Ce moyen de paiement ne sert pas aux entrées. » / « Ce moyen de paiement ne sert pas aux sorties. »                       |
| `clientId` / `counterpartyId`              | Émetteur ou destinataire : un client ou un tiers, pas les deux (« Choisissez un client ou un tiers, pas les deux. »). Chacun doit exister.                     |
| `projectId`                                | Facultatif, doit exister.                                                                                                                                      |
| `note`                                     | Facultative, markdown, 65 536 caractères (« Texte trop long. ») ; blanche → null.                                                                              |
| `url`                                      | Facultative, http ou https (« Lien invalide (http ou https). ») ; vide = null.                                                                                 |
| `recurrence`                               | Règle de répétition ([Dates](../cross-cutting/dates.md)) ; seulement pour une prévision : « Seul un mouvement prévu peut se répéter. »                         |
| `allocations`                              | Documents réglés (voir plus bas) ; 50 au plus (« 50 documents maximum. ») ; seulement pour un mouvement réel : « Seul un mouvement réel règle des documents. » |
| `linkedEntryIds`                           | Mouvements liés, 50 au plus (« 50 mouvements liés maximum. »).                                                                                                 |
| `libraryDocumentIds`, `projectResourceIds` | Pièces justificatives (documents de la bibliothèque, documents de projet), 50 au plus chacun ; doivent exister (« Document », « Document du projet »).         |
| `lines`                                    | Répartition, 50 lignes au plus (« 50 lignes maximum. »).                                                                                                       |

### Mouvement décomposé

Un mouvement qui a des lignes porte sa catégorie, son projet, ses liens et ses pièces sur ses lignes : renseigner `categoryId`, `projectId`, `linkedEntryIds` ou des pièces sur le mouvement est refusé avec « Décomposé : à préciser sur les lignes. »

### Création, modification, suppression

- Création (`createEntry`) : le mouvement, ses règlements, ses lignes, ses pièces et ses liens sont créés ensemble ; puis le statut de paiement des documents réglés est recalculé (`syncPaymentStatus`, voir [Facturation](accounting.md)).
- Modification (`updateEntry`) :
  - refusée si le mouvement est archivé ;
  - un mouvement ne peut pas être lié à lui-même : « Un mouvement ne peut pas être lié à lui-même. » ;
  - tout est remplacé dans une transaction : règlements supprimés puis recréés, pièces remplacées, liens remplacés ;
  - un lien n’est gardé qu’une fois, du côté enregistré : la liste envoyée (qui contient les liens dans les deux sens) devient les liens du mouvement, et les liens que d’autres mouvements avaient vers lui sont effacés ;
  - s’il est décomposé, les lignes d’autres mouvements liées au mouvement entier sont déliées (il ne se lie plus que par ses lignes) ;
  - lignes : celles dont l’`id` est renvoyé sont mises à jour en place, les autres supprimées, les nouvelles créées (voir [Lignes](#lignes-de-répartition)) ;
  - les documents réglés avant et après sont recalculés.
- Suppression (`deleteEntry`) : ses lignes et règlements sont supprimés en cascade, ses liens retirés ; les documents qu’il réglait redeviennent dus (`syncPaymentStatus`). Un mouvement archivé reste supprimable (règle commune, voir [Archivage](../cross-cutting/archiving.md#archiver-ou-supprimer)).
- Archivage / restauration : mutation générique, type `TREASURY_ENTRY`. Archivé, il reste compté partout (soldes, prévisionnel, budgets, relevés) mais n’est plus modifiable.

### Documents réglés (allocations)

- Chaque règlement vise exactement un document : un document Ordo (`documentId`) ou un document importé (`importedDocumentId`) : « Choisissez un document. »
- Montant positif (« Montant positif attendu. »), 99 999 999 au plus.
- Le document doit exister, ne pas être un devis et, pour un document Ordo, être validé (`FINAL`) ; sinon « Document » introuvable.
- Une entrée règle des factures, une sortie rembourse des avoirs : « Une entrée règle des factures, une sortie rembourse des avoirs. »
- La somme réglée ne dépasse pas la valeur absolue du mouvement : « Les documents réglés dépassent le montant du mouvement. »
- Un document Ordo réglé ne peut plus être supprimé (`onDelete: Restrict` sur le règlement) ; un document importé supprimé emporte ses règlements (`Cascade`).

### Éléments archivés donnés à un mouvement

`assertNoNewArchived` : un compte, une catégorie, un moyen de paiement, un tiers, un projet, un client, un contexte, une relation ou un document réglé **archivé** est refusé s’il est nouvellement donné au mouvement (ou à une ligne, ou à un règlement). Ceux que le mouvement avait déjà restent valides. Une catégorie ou un projet déjà présent sur le mouvement ou sur l’une de ses lignes reste accepté partout dans le mouvement.

## Lignes de répartition

Sources : `treasury.ts` (`assertLines`, `saveLines`), schéma `treasuryEntryLineSchema`, `splitAmounts`.

| Champ                              | Règle                                                                                                                                                                                                                                   |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                               | Ligne gardée (ses liens restent) ; doit appartenir au mouvement modifié, sinon « Ligne » introuvable. Absent : nouvelle ligne.                                                                                                          |
| `label`                            | Facultatif, 250 caractères (`TEXT_MAX`).                                                                                                                                                                                                |
| `mode`                             | `AMOUNT` (montant signé) ou `PERCENT` (pourcentage signé du montant du mouvement).                                                                                                                                                      |
| `value`                            | Non nulle ; au plus 99 999 999 en montant (« Montant trop grand. »), 1 000 en pourcentage (« 1 000 % au plus. »).                                                                                                                       |
| `memberId` / `relationId`          | Pour un membre ou une relation, pas les deux : « Un membre ou une relation, pas les deux. » Aucun des deux : l’utilisateur de l’app (« Moi »). Doivent exister (« Membre », « Relation »).                                              |
| `loan`                             | Prêt ; seulement avec une relation : « Un prêt se fait avec une relation. »                                                                                                                                                             |
| `date`                             | Jour propre de la ligne (achat payé par carte à débit différé) ; absent : le jour du mouvement.                                                                                                                                         |
| `categoryId`                       | Facultatif ; du sens **de la ligne** (une ligne positive est une entrée, quel que soit le mouvement) : « Choisissez une catégorie d’entrée pour une ligne positive. » / « Choisissez une catégorie de sortie pour une ligne négative. » |
| `contextId`                        | Facultatif (aucun : « Quotidien »), doit exister (« Contexte »).                                                                                                                                                                        |
| `projectId`                        | Facultatif, doit exister.                                                                                                                                                                                                               |
| pièces                             | 50 au plus de chaque sorte (« 50 documents maximum. »).                                                                                                                                                                                 |
| `linkedLineIds` / `linkedEntryIds` | 50 au plus chacun (« 50 liens maximum. »).                                                                                                                                                                                              |

- Montant d’une ligne en centimes : `lineCents` = sa valeur, ou le pourcentage du montant du mouvement (`percentOf`). Ce que les lignes laissent est le « non réparti » (`remainder` de `splitAmounts`) ; il n’a ni catégorie ni bénéficiaire propre et compte comme celui de l’utilisateur.
- Ordre : la position de la ligne est son rang dans la liste envoyée.
- Liens d’une ligne : vers des lignes d’**autres** mouvements, ou vers des mouvements entiers **sans lignes**. Refus : « Une ligne se lie à une ligne ou à un mouvement d’un autre mouvement. », « Ce mouvement est décomposé : liez l’une de ses lignes. », « Ligne liée » / « Mouvement lié » introuvables.
- Au niveau du mouvement, un mouvement décomposé ne peut pas être lié en entier : « Un mouvement décomposé se lie par ses lignes. »
- Mise à jour d’une ligne gardée : ses pièces et liens sont remplacés par ceux envoyés et les liens que d’autres lignes avaient vers elle sont effacés (le lien est gardé une fois, depuis la ligne enregistrée).
- Suppression en cascade avec le mouvement. Un membre, une relation, une catégorie, un contexte ou un projet supprimé laisse la ligne sans cette valeur (`SetNull`).

## Liens entre mouvements

- Les liens sont réciproques à l’affichage : `linkedEntries` d’un mouvement = ses liens + ceux qui le visent, triés par date ; `linkedLines` d’une ligne idem ; `linkedByLines` = lignes d’autres mouvements liées au mouvement entier.
- Compensation (`offsetLinkedMovements`, `packages/shared/src/accounting/treasury.ts`) : dans chaque groupe de mouvements liés (directement ou par d’autres) d’une même période, le plus petit des totaux d’entrées et de sorties est retiré des deux, au prorata de chaque mouvement. Une entrée liée à une sortie de même montant et de même période comptent toutes deux zéro ; les mouvements non liés gardent leur montant. Utilisé par les totaux de la page Mouvements, les graphiques et le relevé PDF.
- Recherche de mouvements à lier (`treasuryEntrySearch`) : libellé contenant le texte (insensible à la casse), plus récents d’abord, 20 par défaut, 50 au plus.

## Prévisions

### Réaliser une prévision

Source : `realizeForecast` (`treasury.ts`), mutation `realizeTreasuryForecast(id, occurrence, date, amount)`.

- La prévision doit exister et être `FORECAST` (sinon « Prévision » introuvable) et ne pas être archivée.
- Un mouvement réel est créé avec la date et le montant donnés (signé par le client), et les champs de la prévision : compte, libellé, catégorie, moyen, client, tiers, projet, note, lien. Les lignes suivent (les pourcentages s’appliquent au montant réel), avec leurs projets et pièces ; les liens de la prévision restent avec elle ; les pièces et liens du mouvement entier ne sont pas repris ; aucun document réglé.
- Les éléments archivés que la prévision avait déjà restent acceptés.
- Prévision répétée : la date réalisée (`occurrence`) est ajoutée aux exceptions de sa règle ; prévision simple : elle est supprimée. Le tout dans une transaction.

### Liste des prévisions

`forecastEntries` : toutes les prévisions (une répétée apparaît une fois) et les mouvements réels datés après aujourd’hui, par date croissante.

## Prévisionnel

Source : `treasuryProjection(today, from, until)` (`treasury.ts`). La page web demande `until` = au moins aujourd’hui + 365 jours.

### Mouvements attendus (`items`)

Seuls les comptes **non archivés** sont pris en compte.

| Origine (`kind`)          | Ce qui est repris                                                                                                                                                                                                                                         | Date attendue                                                       | Montant                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------- |
| `FORECAST`                | Prévisions des comptes ouverts. Répétée : ses occurrences entre aujourd’hui et `until` (les occurrences passées ne sont pas reprises). Simple : sa date si elle est au plus `until`.                                                                      | Sa date ; passée : aujourd’hui (`overdue`).                         | Celui de la prévision.            |
| `ACTUAL`                  | Mouvements réels datés après aujourd’hui et au plus `until`.                                                                                                                                                                                              | Sa date.                                                            | Le sien.                          |
| `INVOICE` / `CREDIT_NOTE` | Documents Ordo validés encore dus (`documentBalances`, solde > 0). Libellé « Facture N — client » / « Avoir N — client », le nom du client coupé pour tenir en 250 caractères (`fitName`).                                                                | Échéance, sinon date d’émission ; passée : aujourd’hui (`overdue`). | Reste dû ; négatif pour un avoir. |
| `IMPORTED`                | Documents importés non soldés (`importedBalances`). Libellé avec « (importé) ».                                                                                                                                                                           | Idem.                                                               | Idem.                             |
| `RECURRING_INVOICE`       | Factures récurrentes actives, non archivées, avec une prochaine date : occurrences de leur règle de `nextDate` à `until`, payées après le même délai que leur modèle (échéance − émission du modèle). Libellé « [nom] — client », coupé à 250 caractères. | Date de paiement (jamais en retard).                                | Total TTC du modèle.              |

- `payerName` : client ou tiers du mouvement, client du document (ou nom de client saisi sur un importé).
- `archived` : le mouvement ou le document est archivé ; il compte quand même (argent réel), seule sa ligne est masquée côté web.
- Tri : par date attendue, puis montant décroissant.

### Solde et courbe

- `balance` : somme des soldes d’aujourd’hui des comptes ouverts.
- `series` (un point par jour) :
  - passé, de `from` (ou aujourd’hui si `from` est après) jusqu’à aujourd’hui (ou `until` s’il est avant) : solde réel jour par jour (`forecast: false`). Un mouvement daté avant l’ouverture de son compte n’est pas compté ; un compte ouvert pendant la période ajoute son solde d’ouverture ce jour-là ;
  - si `until` est avant aujourd’hui, pas de partie prévue ;
  - sinon, à partir d’aujourd’hui : solde du jour + mouvements attendus aujourd’hui (dont les retards), puis jour par jour jusqu’à `until` (`forecast: true`). Aujourd’hui a donc un point réel et un point prévu.

## Catégories

Sources : `apps/api/src/services/treasury/treasury-settings.ts`, schéma `treasuryCategorySchema`, arbre générique `treeListService` ([Ordre](../cross-cutting/ordering.md)).

- Champs : `label` (requis, 250 caractères), `color` (facultative ; vide l’efface, omise la laisse), `direction` (`IN` / `OUT`), `parentId`.
- Une catégorie est dans l’arbre de son sens : le parent doit être du même sens : « La catégorie parente doit être du même sens. » ; il doit exister (« Catégorie parente ») ; une catégorie ne peut pas être rangée sous elle-même : « Une catégorie ne peut pas être rangée sous elle-même. »
- Rien n’est rangé sous une catégorie archivée (une catégorie déjà dessous y reste).
- Création : dernière parmi ses sœurs (même sens, même parent). Changement de parent : elle passe en dernier. Déplacement (`moveTreasuryCategory`) : sous une autre catégorie du même sens, ou à la racine, à un rang (dernier sans rang).
- Changer le sens : toute la branche (sous-catégories comprises) change de sens ; refusé si des mouvements utilisent une catégorie de la branche : « Des mouvements utilisent cette catégorie : son sens ne peut plus changer. » (seule la catégorie du mouvement est vérifiée, pas celle des lignes).
- Suppression : ses sous-catégories remontent à son parent, ses mouvements et lignes perdent leur catégorie (`SetNull`), ses budgets sont supprimés (`onDelete: Cascade`).
- Liste : par sens puis position ; `entryCount` = nombre de mouvements (pas de lignes).
- Archivage : liste de paramètres `TREASURY_CATEGORY`.

### Catégories des factures et avoirs

`setInvoiceCategories` (`treasury-settings.ts`), stockées sur le profil de l’entreprise (`CompanyProfile.invoiceCategoryId`, `creditNoteCategoryId`) :

- catégorie des règlements de factures : d’entrée (« Choisissez une catégorie d’entrée. ») ; catégorie des remboursements d’avoirs : de sortie (« Choisissez une catégorie de sortie. ») ; null = aucune (hors budget) ;
- une catégorie archivée ne peut pas être nouvellement choisie, mais celle déjà choisie reste ;
- elles servent au rapport de budgets (ce qui est attendu des factures et avoirs) et à `recordDocumentPayment`.

## Moyens de paiement

Source : `treasury-settings.ts`, schéma `treasuryPaymentMethodSchema`.

- Champs : `label` (requis, 250), `incoming`, `outgoing` ; au moins un sens : « Choisissez au moins un sens. »
- Création en dernière position. Modification refusée s’il est archivé.
- Retirer un sens utilisé est refusé : « Des entrées utilisent ce moyen de paiement. » (entrées = montant > 0), « Des sorties utilisent ce moyen de paiement. »
- Suppression : ses mouvements le perdent (`SetNull`).
- `assertMethodFor(methodId, incoming)` : vérifie qu’un moyen sert le sens d’un mouvement (utilisé aussi par les règlements de documents).

## Tiers

Source : `treasury-settings.ts`, schéma `treasuryCounterpartySchema`.

- Émetteur ou destinataire qui n’est pas un client. Champs : `name` (nom de personne, requis, 250 caractères : « Le nom est requis. »), `note` (texte multiligne, 4 000).
- Création en dernière position ; modification refusée s’il est archivé ; suppression : ses mouvements perdent leur émetteur ou destinataire.
- Liste : non archivés d’abord, puis position et nom.
- Archivage : liste de paramètres `TREASURY_COUNTERPARTY` (date `archivedAt`), seulement par « Archiver » / « Restaurer » ; pas de case « Archivé » dans le formulaire.

## Équipe ou foyer (membres)

Source : `apps/api/src/services/treasury/treasury-team.ts`.

- Un membre est un contributeur marqué `teamMember`, ou l’utilisateur de l’app (« Moi », toujours membre). Liste : « Moi » d’abord, puis par nom.
- Ajouter (`addTreasuryMember`) : un contributeur existant (doit exister, « Contributeur »), ou un nouveau contributeur créé avec ce nom (nom de personne valide, identifiant libre généré).
- Un contributeur est lié à un membre, une relation ou un contact, un seul : « Ce contributeur est la relation « X » : il ne peut pas aussi être membre. », « Ce contributeur est le contact « Prénom Nom · Client » : il ne peut pas aussi être membre. »
- Retirer (`removeTreasuryMember`) : il reste contributeur (tâches, projets, lignes passées gardés), sans coordonnées ; « Moi » ne peut pas être retiré : « Vous êtes toujours membre de votre équipe ou de votre foyer. »
- Coordonnées et date de naissance du membre (`updateTreasuryMember`) : modifiées dans sa fiche, seulement pour un membre (voir [Personnes](../cross-cutting/people.md#membres-de-léquipe-ou-du-foyer)).
- Ajouter, retirer un membre ou changer sa date de naissance passe par la confirmation d'un anniversaire cité (`confirmLoss`).
- Voir aussi [Personnes](../cross-cutting/people.md).

## Relations

Source : `treasury-team.ts`, schéma `treasuryRelationSchema`.

- Personne hors de l’équipe ou du foyer (amis, famille, partenaires…) pour qui une ligne ou un budget peut être. Champs : `name` (nom de personne), `note` (texte multiligne, 4 000), `contributorId` facultatif, et ses coordonnées et sa date de naissance (omis : inchangés ; voir [Personnes](../cross-cutting/people.md#coordonnées-date-de-naissance-anniversaire)).
- Le contributeur lié ne peut être ni membre (« Ce contributeur est membre : il n’est pas une relation. ») ni lié à un contact (« Ce contributeur est le contact « Prénom Nom · Client » : il ne peut pas aussi être une relation. ») ; ses coordonnées et son anniversaire sont ceux de la relation.
- Unicité dans l’espace : le nom (« Une relation porte déjà ce nom. ») et le contributeur (« Ce contributeur est déjà une relation. »).
- Modification refusée si elle est archivée.
- Suppression : ses budgets sont supprimés (`Cascade`), ses lignes deviennent celles de l’utilisateur (`SetNull`) et sortent donc des prêts.
- Liste : par nom ; `lineCount`, `budgetCount`.
- Archivage : type `TREASURY_RELATION` ; la relation et son contributeur sont archivés et restaurés ensemble (voir [Archivage](../cross-cutting/archiving.md#personnes-liées)).

## Contextes et leurs périodes (éphémérides)

Source : `treasury-team.ts` (`saveContext`, `contextEphemerides`), `treasury-contexts.ts`, schéma `treasuryContextSchema`, `contextPlanner`.

- Un contexte **est** un type d’éphémérides de l’agenda dont « Sert de contexte au budget » est coché (`ScheduleType.budgetContext`, voir [Agenda](../activities/calendar.md#éphémérides)) : son libellé, sa couleur, son image, sa position et son archivage sont ceux du type. Ses éphémérides en sont les périodes. Pas d’arbre. Une ligne sans contexte est du « Quotidien » (`EVERYDAY_CONTEXT`).
- Lignes et budgets nomment une ligne `TreasuryContext` de leur espace, liée au type (`scheduleTypeId`, une seule par espace et par type) : il y en a une dans l’espace du type, et une dans chaque espace de l’utilisateur quand « Partagé entre espaces » est coché (`sharedContext` ; même accès que les conditions de créneaux qui citent un autre espace, voir l’entrée multi-utilisateur de [Écarts](../../discrepancies.md)). Un nouvel espace reçoit les contextes partagés (`addSharedContexts`). Ces lignes suivent le type à chaque enregistrement (`syncKindContexts`).
- Retirer « Sert de contexte au budget » ou « Partagé entre espaces » est refusé tant qu’une ligne ou un budget d’un espace qui perdrait le contexte l’a : « Ce contexte a N lignes et N budgets dans l’espace « X » : il le reste (archivez plutôt le type). » (`assertKindContextsKept`).
- Création depuis la trésorerie (`saveTreasuryContext` sans id, depuis la liste « Contextes » ou un champ de ligne) : un type d’éphémérides avec « Sert de contexte au budget », `label` requis (250 caractères), `color` requise, affichage par défaut ; libellé unique parmi les types de l’espace : « Un type porte déjà ce libellé. ». Modification (`saveTreasuryContext` avec id) : celle du type, refusée pour un contexte partagé par un autre espace (« Ce contexte est partagé par un autre espace : modifiez-le dans son agenda. ») et pour un type archivé.
- Un contexte archivé (son type) n’est plus choisi, celui déjà sur la ligne ou le budget reste (« Élément archivé », `assertContextsActive`) ; un contexte inconnu de l’espace : « Contexte » introuvable.
- Suppression depuis la liste « Contextes » de la trésorerie : elle retire seulement « Sert de contexte au budget » (et « Partagé entre espaces ») du type, par la même modification que son formulaire (`updateScheduleType`) : le type et ses éphémérides restent, et elle est refusée de la même façon tant qu’une ligne ou un budget a le contexte (`assertKindContextsKept`). Supprimer le type lui-même (réglages de l’agenda) supprime son contexte : ses éphémérides restent, sans type ; les lignes qui avaient le contexte n’en ont plus (`SetNull`), ses budgets sont supprimés (`TreasuryBudget.context` en `onDelete: Cascade`), dans tous les espaces s’il était partagé.
- Contexte proposé un jour (`contextPlanner`) : celui des éphémérides de contexte qui ont des horaires ce jour-là (journée entière ou heures, répétition et exceptions comprises, éphémérides archivées comprises) quand elles sont toutes d’un seul contexte (deux éphémérides du même contexte n’en font qu’un) ; aucun quand plusieurs contextes couvrent le jour (ce sont deux contextes à la fois, une ligne n’en a qu’un, l’utilisateur choisit) ; aucun hors de toute éphéméride (« Quotidien »). Côté web, les contextes archivés ne sont pas proposés.
- Comportement admis : un jour couvert par plusieurs contextes, ce qui est attribué automatiquement (le non réparti, le mouvement entier sans lignes, les attendus des factures et avoirs, ci-dessous) n’a pas de contexte et compte en « Quotidien », dans le rapport des budgets comme dans les diagrammes.
- Changer ou supprimer une éphéméride ne modifie pas les lignes déjà enregistrées.
- Migration `20261120180000_ephemerides` (données modifiées) : chaque contexte est devenu un type d’éphémérides « Sert de contexte au budget » de son espace (son libellé, suivi de « (contexte) » si un type de l’espace l’avait déjà ; sa couleur, son image, son archivage, placé après les types existants), la ligne du contexte (même id) liée à ce type ; chaque période planifiée est devenue une éphéméride journée entière de ce type, tous les jours de son premier à son dernier, au libellé du contexte, sa note devenant le premier commentaire de l’éphéméride ; les contextes sans période sont des types sans éphéméride ; la table des périodes est supprimée.

## Budgets

Source : `apps/api/src/services/treasury/treasury-budgets.ts`, schéma `treasuryBudgetSchema`, `budgetMonths`.

### Champs

| Champ                     | Règle                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `month`                   | Premier mois, `YYYY-MM` (« Mois invalide. ») ; stocké au 1er du mois.                                                                                        |
| `memberId` / `relationId` | Un membre ou une relation, pas les deux (« Un membre ou une relation, pas les deux. ») ; aucun : l’utilisateur. Avec une relation, le membre est mis à null. |
| `contextId`               | Aucun : « Quotidien ».                                                                                                                                       |
| `categoryId`              | Requis : « La catégorie est requise. » Le sens du budget est celui de sa catégorie.                                                                          |
| `amount`                  | Positif (« Montant positif attendu. »), 99 999 999 au plus.                                                                                                  |
| `repeatEvery`             | Tous les n mois, entier de 1 à 24 ; null : ce mois seulement.                                                                                                |
| `repeatUntil`             | Dernier mois inclus (`YYYY-MM`) ou null (sans fin) ; ignoré sans répétition ; doit suivre le premier mois : « La fin doit suivre le début. »                 |

- Une catégorie, relation ou un contexte archivé est refusé, sauf si c’est déjà celui du budget. Le membre doit exister.
- `saveTreasuryBudget` : crée (sans id) ou modifie un budget **et toutes ses répétitions** (une seule ligne en base) ; modification refusée s’il est archivé.
- Suppression : le budget et ses répétitions.
- Mois couverts dans une période (`budgetMonths`) : sans répétition, son mois s’il est dans la période ; sinon chaque n mois à partir du premier, jusqu’à `repeatUntil` ou la fin de la période.

### Rapport (`treasuryBudgetReport(from, to)`)

- Budgets pris : non archivés, de premier mois au plus `to`. Plusieurs budgets de même clé (mois, bénéficiaire, contexte, catégorie) s’additionnent.
- Mouvements pris : réels datés dans la période ; réels hors période ayant des lignes datées dans la période (carte à débit différé) ; prévisions datées au plus la fin de la période (répétées : leurs occurrences dans la période ; simples : seulement si elles sont dans la période). Les mouvements archivés comptent.
- Chaque ligne d’un mouvement compte pour sa relation, sinon son membre, sinon l’utilisateur, dans son contexte et sa catégorie, au mois de sa date propre (mouvement réel seulement) ou du mouvement. **Les lignes de prêt ne comptent pas** (ce n’est pas une dépense).
- Le non réparti, ou le mouvement entier sans lignes, compte pour l’utilisateur, dans le contexte proposé ce jour-là (ses éphémérides, `contextPlanner`), et dans la catégorie du mouvement (aucune pour le non réparti d’un mouvement décomposé).
- Une part va au budget de son mois, bénéficiaire et contexte pour sa catégorie, ou pour la catégorie parente la plus proche qui en a un. Sans budget, elle est « hors budget » (`budgeted: false`), sous sa propre clé.
- Ce qui est attendu des factures et avoirs (lignes du prévisionnel hors `FORECAST` / `ACTUAL`, à partir d’aujourd’hui) compte en prévu pour l’utilisateur, dans le contexte proposé ce jour-là (ses éphémérides, `contextPlanner`), dans la catégorie des factures (montant positif) ou des avoirs (négatif) réglée dans les paramètres. Seulement si aujourd’hui est au plus la fin de la période.
- Lignes renvoyées : `budget` (positif), `actual` et `forecast` (sommes signées), triées par mois puis budgets avant hors budget. Les budgets archivés ne comptent pas : leurs mouvements sont hors budget.
- Côté web, ce qui est « utilisé » se lit dans le sens de la catégorie (sorties en positif pour une catégorie de sortie).

## Prêts

Source : `apps/api/src/services/treasury/treasury-loans.ts`.

- Une ligne est un prêt quand elle est marquée `loan` avec une relation, dans un mouvement **réel**.
- Une sortie vers la relation lui prête (ou lui rembourse ce qu’on lui doit) ; une entrée venant d’elle est un emprunt (ou un remboursement de ce qu’elle devait).
- Par relation : `out` = somme des sorties, `in` = somme des entrées, `balance` = −(somme des lignes) : positif = la relation doit, négatif = on lui doit. Chaque ligne : date propre ou du mouvement, libellé « mouvement › ligne », montant signé.
- Tri : par valeur absolue du solde décroissante ; lignes par date.

## Import de relevé bancaire

Sources : `apps/api/src/services/treasury/treasury-import.ts`, `statementMappingSchema`, `statementImportSchema`, `readStatement`, `parseCsv`.

### Mapping des colonnes

| Champ          | Règle                                                                    |
| -------------- | ------------------------------------------------------------------------ |
| `separator`    | `;`, `,` ou tabulation.                                                  |
| `encoding`     | `utf-8` ou `windows-1252`.                                               |
| `skipRows`     | 0 à 50 lignes ignorées au début.                                         |
| `dateColumn`   | Index (à partir de 0).                                                   |
| `dateFormat`   | `DD/MM/YYYY`, `DD/MM/YY`, `YYYY-MM-DD`, `DD-MM-YYYY`.                    |
| `labelColumns` | 1 à 4 colonnes jointes par « — » : « Choisissez la colonne du libellé. » |
| `amountColumn` | Une colonne signée, ou null avec `debitColumn` / `creditColumn`.         |

Lecture (`readStatement`, partagée, faite côté web) :

- CSV avec cellules entre guillemets (séparateurs, sauts de ligne et guillemets doublés acceptés) ; lignes vides ignorées.
- Date : séparateurs `/`, `.` ou `-` ; année sur 2 chiffres = 20xx ; date réelle exigée.
- Montant : espaces, espaces insécables et « € » retirés, « + » initial retiré ; le dernier « , » ou « . » suivi d’au plus 2 chiffres est la marque décimale ; arrondi à 2 décimales. Débit / crédit : crédit − |débit|.
- Libellé : espaces multiples réduits, coupé à 250 caractères.
- Les lignes sans date, libellé ou montant valides (ou montant nul) sont ignorées (en-têtes, totaux…).

### Import (`importTreasuryStatement`)

- 1 à 2 000 opérations (« Aucune opération à importer. », « 2 000 opérations au plus. ») ; chaque opération : date, libellé (1 à 250 caractères), montant non nul, prévision réalisée facultative (`forecastId`, `occurrence`).
- Le compte doit être actif (non archivé). Le mapping, s’il est donné, est gardé sur le compte (`csvMapping`) pour ses prochains relevés.
- Opération avec prévision : la prévision est réalisée (date et montant de l’opération, à l’occurrence donnée, sinon à la date), le mouvement créé passe sur le compte importé et sa note reçoit « Relevé : [libellé bancaire] » à la suite de la note de la prévision.
- Sinon : nouveau mouvement réel (date d’exécution et de valeur = date de l’opération, libellé, montant), sans catégorie, à catégoriser ou répartir ensuite.
- Résultat : `{ created, realized }`.
- La détection des doublons (même montant à 3 jours près) et des prévisions (même montant à 7 jours près, du même compte) est faite côté web, pas par l’API.

## Relevé PDF

Source : `apps/api/src/services/treasury/treasury-pdf.ts`, route `GET /api/treasury/statement.pdf?from=&to=&accountId=` (`apps/api/src/routes/treasury.ts`, erreur générique « Relevé impossible. »).

- Paramètres : `from` (« Date de début invalide. »), `to` (« Date de fin invalide. »), la fin suit le début, dix ans au plus (« Dix ans au plus. ») ; `accountId` facultatif (tous les comptes, archivés compris).
- Compte inconnu : « Compte » introuvable ; aucun compte : « Aucun compte. »
- A4 paysage ; nom du fichier « Relevé trésorerie du [from] au [to] » (plusieurs comptes) ou « Relevé [compte] du … » ; titre « Relevé des mouvements », sous-titre : émetteur (entreprise, ou nom de l’espace en PERSO), « Tous les comptes » ou le compte, période. Titre en 16 pt gras, sous-titre en 10 pt gris, comme tous les PDF d’export (`writeHeading`, `services/core/pdf-report.ts`).
- Quatre chiffres : solde la veille du début, entrées, sorties, solde à la fin. Note : nombre de mouvements réels, « les prévisions ne sont pas incluses », et, s’il y en a, la part d’entrées et sorties liées qui se compensent (entrées et sorties nettes).
- Colonnes : « Exécution », « Valeur », « Libellé », « Émetteur / destinataire », « Catégorie » (chemin), « Moyen », « Compte » (plusieurs comptes), « Débit », « Crédit », « Solde » (rouge si négatif).
- Sous le libellé : « Règle [documents] », « Lié à : … », « Pièces : … », et « Avant l’ouverture du compte : hors solde » pour un mouvement daté avant l’ouverture de son compte (non compté dans le solde courant).
- Mouvements décomposés : une ligne grisée par ligne (« ↳ libellé · pour X · contexte · projet P · prêt · le JJ/MM »), puis « Non réparti » s’il en reste.
- Sur plusieurs mois : bandeau par mois avec ses entrées et sorties. Un compte ouvert pendant la période ajoute une ligne « JJ/MM — Ouverture du compte X » et son solde d’ouverture. Vide : « Aucun mouvement sur la période. »
- Total : « Total de la période · Débit X · Crédit Y » et « Solde au JJ/MM : Z ».

## Pièces justificatives

- Un mouvement (non décomposé) ou une ligne peut citer des documents de la bibliothèque et des documents de projet ([Fichiers et pièces jointes](../cross-cutting/files-and-attachments.md)).
- Options proposées (`documentOptions`, la même requête que les documents des tâches, routines et évènements : [Documents liés](../cross-cutting/files-and-attachments.md#documents-liés-aux-tâches-routines-et-évènements)) : bibliothèque par titre, puis documents de projet par projet et position ; chaque document : source (`LIBRARY` / `PROJECT`), sorte (`FILE` / `LINK`), URL, lieu (dossier, « Documents » par défaut, ou projet).

## Règlements depuis un document

Source : `recordPayment` (`apps/api/src/services/accounting/document-tracking.ts`), mutation `recordDocumentPayment` déclarée dans `graphql/modules/treasury.ts`. Détail dans [Facturation](accounting.md).

- Seul un document validé (facture ou avoir), non archivé, peut être réglé : « Seul un document validé (facture ou avoir) peut être réglé. »
- Compte actif, moyen non archivé et du bon sens.
- Crée un mouvement réel : libellé « Règlement N — client » ou « Remboursement N — client » (nom du client coupé pour tenir en 250 caractères, `fitName`), montant négatif pour un avoir, catégorie des factures / avoirs des paramètres, sinon une catégorie nommée « Ventes » (entrée) ou « Remboursements clients » (sortie) si elle existe ; client et projet du document ; un règlement du montant.
- Puis le statut de suivi du document est recalculé.

## Autres éléments du module GraphQL

`apps/api/src/graphql/modules/treasury.ts` déclare aussi des champs et mutations de la facturation : statuts de suivi (`documentStatuses`, `createDocumentStatus`…), envoi, acceptation de devis, relances (`overdueInvoices`, `sendDocumentReminders`…), soldes `paid` / `credited` / `balance` / `overdue` des documents. Ils sont décrits dans [Facturation](accounting.md). Les soldes des documents sont calculés une fois par requête (cache par contexte).
