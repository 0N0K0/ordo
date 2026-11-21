# Personnes : contributeurs, « Moi », membres, relations, assignés, bénéficiaires

Qui peut être choisi où : profil « Moi », contributeurs et leurs projets, membres de l'équipe ou du foyer, relations, assignés et bénéficiaires. Sources : `apps/api/src/services/projects/contributors.ts`, `apps/api/src/services/people/**`, `apps/api/src/services/core/person-details.ts`, `apps/api/src/services/calendar/birthdays.ts`, `packages/shared/src/people/**`, `apps/api/src/services/core/beneficiaries.ts`, `apps/api/src/services/shopping/people.ts`, `apps/api/src/services/treasury/treasury-team.ts`, `apps/api/src/services/workspaces/workspaces.ts`, `packages/shared/src/tasks/tasks.ts`, `packages/shared/src/accounting/treasury.ts`, `packages/shared/src/calendar/event-busy.ts`.

Voir aussi : [Espaces et accès](workspaces-and-access.md), [Archivage](archiving.md), [Nommage](naming.md), [Trésorerie](../finances/treasury.md).

## Les sortes de personnes

| Sorte                  | Modèle                                            | Rôle                                                                                                                                                             |
| ---------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contributeur           | `Contributor`                                     | Personne qui peut être assignée, participer, être mentionnée (`@handle`). Nom (250 max), identifiant de mention unique dans l'espace, avatar, projets rattachés ; ses coordonnées et son anniversaire sont ceux de ce à quoi il est lié (voir [Lien d'un contributeur](#lien-dun-contributeur)). |
| « Moi »                | `Contributor` avec `userId`                       | Profil contributeur de l'utilisateur dans chaque espace.                                                                                                         |
| Membre                 | `Contributor` avec `teamMember` (ou « Moi »)      | Membre de l'équipe (espace PRO) ou du foyer (espace PERSO) : ventilation des dépenses, budgets, « Pour » des courses.                                            |
| Relation               | `TreasuryRelation`                                | Personne hors équipe ou foyer (ami, famille, partenaire…) : lignes de trésorerie, budgets, prêts, bénéficiaires. Peut être aussi un contributeur (ni membre, ni lié à un contact). |
| Client, contact, tiers | `Client`, `ClientContact`, `TreasuryCounterparty` | Personnes de la facturation et de la trésorerie (voir [Comptabilité](../finances/accounting.md), [Trésorerie](../finances/treasury.md)). Un contact peut être aussi un contributeur (espace PRO). |

## « Moi »

- Chaque utilisateur a un profil « Moi » dans chaque espace : créé à la création du compte (`npm run user:create`, pour tous les espaces) et à la création ou modification d'un espace (`ensureMeContributor`). Son nom est l'identifiant de connexion, son identifiant de mention est libre (« moi » en secours, suffixe « -moi » si pris).
- « Moi » appartient à **tous les projets** sans y être rattaché.
- « Moi » est toujours membre de l'équipe ou du foyer : « Vous êtes toujours membre de votre équipe ou de votre foyer. ».
- « Moi » ne peut pas être supprimé : « Votre propre profil ne peut pas être supprimé. ».
- Dans le calcul d'occupation (`blockingEvent`), un événement sans participant et une tâche ou routine sans assigné comptent comme « Moi ».
- Filtre « assigné à moi » : valeur `@me` (`ME`).

## Contributeurs

- Création : nom et identifiant valides (`contributorFormSchema`), projets existants et non archivés (`projectIds`) ; identifiant pris : « Cet identifiant est déjà utilisé. ».
- Modification refusée si archivé ; les projets déjà rattachés restent valides même archivés.
- Suppression : les tâches perdent simplement cet assigné ; son avatar orphelin est supprimé.
- Rattachement aux projets : `setProjectContributors(projectId, ids)` (projet non archivé ; un contributeur archivé n'est pas rattaché à nouveau) ; les tâches gardent leurs assignés.
- Un contributeur rattaché à un projet l'est aussi, de fait, à ses sous-projets (portée héritée des parents).

## Lien d'un contributeur

`apps/api/src/services/people/contributor-links.ts`, `packages/shared/src/people/contributor-link.ts` :

- Un contributeur n'a **ni adresses mail, ni téléphones, ni date de naissance, ni anniversaire à lui** : ce sont ceux de ce à quoi il est lié, montrés en lecture seule dans sa fiche avec leur provenance, jamais remplacés.
- Il est lié à **un seul** de (`link`, `CONTRIBUTOR_LINKS`) :
  - **« Membre »** (`MEMBER`) : lui-même, membre de l'équipe ou du foyer (`teamMember`, « Moi » toujours). Ses coordonnées et sa date de naissance sont enregistrées sur sa ligne, modifiées seulement dans la fiche du membre (« Équipe » / « Foyer » des paramètres), pas dans celle du contributeur ;
  - **une relation** (`RELATION`, `TreasuryRelation.contributorId`) : celles de la relation ;
  - **un contact** d'un client (`CONTACT`, `Contributor.contactId`, espace PRO) : son adresse (unique) et ses téléphones, sans anniversaire ;
  - **rien** (`NONE`) : aucune coordonnée, aucun anniversaire.
- Choisir un lien remplace le précédent (une relation liée avant perd son contributeur) ; un nouveau contributeur peut être créé avec son lien. Refusés : « Moi » autrement que membre (« Vous êtes toujours membre de votre équipe ou de votre foyer. ») ; une relation déjà liée à un autre contributeur (« Cette relation est déjà liée à un autre contributeur. ») ; un contact déjà lié à un autre contributeur (« Ce contact est déjà lié à un autre contributeur. », un contact va à un contributeur au plus) ; une relation archivée ou un contact d'un client archivé nouvellement choisis (« Élément archivé… ») ; une relation ou un contact introuvables. Sans relation ou contact choisi : « Choisissez la relation. », « Choisissez le contact. ».
- Par les autres chemins, le lien unique est vérifié aussi : ajouter comme membre un contributeur lié à une relation ou à un contact, ou lier à une relation un contributeur membre ou lié à un contact, est refusé (messages sous [Membres](#membres-de-léquipe-ou-du-foyer) et [Relations](#relations)).
- Un contributeur qui n'est plus membre garde sur sa ligne ses coordonnées, sa date de naissance et ses rappels, inutilisés ; ils reviennent s'il redevient membre.
- Supprimer la relation ou le contact lié laisse le contributeur sans lien.

## Assignés et participants

Règle unique pour les assignés des tâches et des routines et les participants des événements :

- Élément **sans projet** : n'importe quel contributeur.
- Élément **avec projet** : seulement « Moi » et les contributeurs rattachés au projet ou à un de ses parents ; ceux déjà choisis restent valides. Sinon : « Seuls les contributeurs du projet peuvent être choisis. » (`assertProjectContributors`).
- Un contributeur archivé n'est pas nouvellement choisi (sauf annulation d'une action, `restoring`).
- Modifications groupées de tâches : la règle s'applique à chaque tâche de la sélection.
- Déplacer une tâche vers un autre projet : ses assignés (et ceux de ses sous-tâches) **suivent** et sont rattachés au projet cible s'ils ne l'étaient pas déjà, directement ou par un parent (`attachAssignees`) ; « Moi » et les archivés ne sont jamais rattachés.
- Même règle pour une routine ou un évènement qui change de projet : ses assignés ou contributeurs restent, même s'ils ne sont pas du nouveau projet, et y sont rattachés (`followProject`). Les sous-routines ne suivent pas : elles gardent leur projet, sauf celles qui l'héritent.
- Seules les personnes déjà enregistrées suivent : une personne ajoutée dans le même enregistrement que le changement de projet doit être du nouveau projet, sinon « Seuls les contributeurs du projet peuvent être choisis. ».
- Une tâche (ou une routine) peut être rattachée à un événement si ses assignés (ceux qu'elle suit, hérités compris) et les participants ont quelqu'un en commun, ou si l'un des deux côtés est vide (`sharePeople`).
- **Héritage** ([Tâches](../activities/tasks.md#héritage), [Routines](../activities/routines.md#héritage)) : une sous-tâche ou une sous-routine peut hériter ses assignés et ses bénéficiaires de son parent, en direct ; hérités, ils sont ceux du parent et ne sont pas revérifiés contre son projet ; seuls ses assignés propres le sont, contre le projet qu'elle suit.

## Bénéficiaires

« Bénéficiaires » : pour qui est une tâche, un événement, une routine ; et « Pour » des produits, articles de courses, articles de fiche et de stock.

- N'importe quel contributeur et n'importe quelle relation, quel que soit le projet (`assertBeneficiaries`).
- Ils doivent exister (« Bénéficiaire introuvable. », sous le champ) ; un bénéficiaire archivé n'est pas nouvellement choisi, sauf pour les tâches et les courses / fiches / stock qui acceptent les archivés (`keep: 'all'`).
- Courses : le coût d'un article pour plusieurs personnes est partagé également entre elles (`shoppingShares`, voir [shopping](../../shared/supplies/shopping.md)).

## Membres de l'équipe ou du foyer

`apps/api/src/services/treasury/treasury-team.ts` :

- Liste : « Moi » d'abord, puis par nom.
- Ajouter un membre : un contributeur existant, ou un nouveau créé avec ce nom (un membre est toujours un contributeur). Un contributeur lié à une relation ou à un contact ne peut pas être membre : « Ce contributeur est la relation « X » : il ne peut pas aussi être membre. », « Ce contributeur est le contact « Prénom Nom · Client » : il ne peut pas aussi être membre. ».
- Retirer un membre : il reste contributeur (tâches, projets, lignes passées gardés), sans coordonnées ni anniversaire (les siens restent enregistrés, inutilisés).
- Fiche du membre (`updateTreasuryMember`) : sa date de naissance, ses rappels d'anniversaire, ses adresses mail et ses téléphones, le seul endroit où ils se modifient ; refusé pour un contributeur qui n'est pas membre (« Seul un membre de l’équipe ou du foyer a ses propres coordonnées : modifiez celles de sa relation ou de son contact. ») ; archivé : lecture seule.
- Ajouter ou retirer un membre, comme changer sa date de naissance, passe par la confirmation d'un anniversaire cité (voir plus bas).
- Les membres des lignes de ventilation de trésorerie ne suivent pas la règle des projets.

## Relations

- Nom unique dans l'espace (« Une relation porte déjà ce nom. »), note (500).
- Peut être liée à un contributeur qui n'est ni membre (« Ce contributeur est membre : il n’est pas une relation. ») ni lié à un contact (« Ce contributeur est le contact « Prénom Nom · Client » : il ne peut pas aussi être une relation. ») ; un contributeur au plus une fois (« Ce contributeur est déjà une relation. »). Ses coordonnées et son anniversaire sont alors ceux du contributeur.
- Une ligne ou un budget est pour un membre **ou** une relation, pas les deux (« Un membre ou une relation, pas les deux. ») ; un prêt se fait avec une relation (« Un prêt se fait avec une relation. »).
- Archivable (`TREASURY_RELATION`) ; commentable.

## Coordonnées, date de naissance, anniversaire

Sources : `packages/shared/src/people/**`, `apps/api/src/services/core/person-details.ts`, `apps/api/src/services/calendar/birthdays.ts`.

- Les membres de l'équipe ou du foyer (« Moi » compris) et les relations ont une **date de naissance** (facultative ; l'année aussi), des **rappels d'anniversaire**, des **adresses mail** et des **téléphones** : deux listes à libellés de la même forme (`emails` `[{ label, address }]`, `phones` `[{ label, number }]` comme ceux des clients et de leurs contacts, 10 au plus chacune). Un autre contributeur n'en a pas à lui : ceux de sa relation ou de son contact (voir [Lien d'un contributeur](#lien-dun-contributeur)). Les clients et leurs contacts ont **une** adresse (`email`, celle où partent les factures), des téléphones, pas de date de naissance.
- Date de naissance : stockée en texte `YYYY-MM-DD`, ou `--MM-DD` quand l'année n'est pas connue (forme ISO 8601 / vCard). Refusée : un jour que le mois n'a pas (le 29 février sans année est admis), une année avant 1900 (« Date de naissance invalide. »), une date à venir (« La date de naissance ne peut pas être à venir. »). Vide : aucune.
- Adresse mail : « Adresse email invalide. » ; téléphone : « Numéro invalide. » (3 à 30 caractères) ; libellé facultatif (250 caractères).
- Rappels d'anniversaire : « À HH:MM » le jour même ou « N jours avant, à HH:MM » (1 à 30 jours), 10 au plus (« Un anniversaire n’a que des rappels à une heure précise. ») ; gardés quand la date de naissance est retirée, sans sonner. Saisis une ligne par rappel : « Le jour J » coché, ou N « jours avant » (1 à 30), puis « à » l’heure ; ajoutés et retirés un à un, enregistrés champ par champ comme le reste de la fiche, les erreurs sous les champs (voir [Composants de saisie](../../web/components/inputs.md#remindersselect)).
- Modifications : un champ omis reste tel quel (membre et relation) ; un membre ou une relation archivé n'est pas modifiable (règle commune).
- **Anniversaire** : il découle de la date de naissance, calculé à la lecture (`birthdays`, aucune ligne enregistrée) : une éphéméride d'une journée entière chaque année, le jour et le mois de la naissance (un 29 février : le 28 les autres années), jamais avant la naissance ni le jour même. Nommé « Anniversaire de Paul — 40 ans », l'âge seulement quand l'année est connue. Sa couleur et son affichage dans l'agenda, et s'il y est affiché, se règlent pour tous les anniversaires de l'espace (« Anniversaires » des paramètres de l'agenda) ; masqué, ses rappels sonnent toujours et les conditions de créneaux le comptent toujours. Une personne archivée n'a pas d'anniversaire. Seuls les membres et les relations ont un anniversaire : une personne, un anniversaire, celui d'un contributeur lié à une relation est celui de la relation (`aliases` de la requête `birthdays`, tant qu'aucun des deux n'est archivé) ; un contributeur lié à un contact, ou à rien, n'en a pas.
- L'anniversaire est **citable par une condition de créneaux** des tâches et routines (attentions, surprises) : celui d'une personne (`birthday:contributor:<id>`, `birthday:relation:<id>`, « Anniversaire de Paul (éphéméride) ») ou tous (type `birthday`, « Anniversaires (éphéméride) », ceux des personnes ajoutées ensuite compris), sa journée entière ; jamais dans le temps libre (une éphéméride). La personne citée doit être un contributeur ou une relation de l'espace (« Contributeur » / « Relation » introuvable) et ne pas être archivée, sauf si elle était déjà dans la condition (« Élément archivé », comme un créneau archivé) ; une personne archivée n'ayant pas d'anniversaire, la condition qui la cite ne permet plus aucun moment (elle la nomme encore, suivie de « (archivé) ») ; sans date de naissance, aucun moment non plus. Une condition qui cite un contributeur suit son lien : celui de sa relation, le sien s'il est membre, aucun moment s'il est lié à un contact ou à rien, dans le calcul comme dans la condition écrite. Seuls les anniversaires de l'espace de la tâche ou de la routine (pas de `ws:` comme les types d'autres espaces) ; pas des contextes du budget. Il n'apparaît que dans l'agenda de son espace (comme une éphéméride sans type, qu'aucun abonnement ne montre ailleurs) ; ses rappels sonnent quel que soit l'espace ouvert. Voir [Agenda](../activities/calendar.md#anniversaires) et [Alarmes](../activities/alarms.md#rappels-des-tâches-routines-et-évènements).
- **Changement d'un anniversaire cité** : changer ou retirer la date de naissance, créer une personne avec une date, archiver, restaurer ou supprimer la personne, changer le lien d'un contributeur (membre ajouté ou retiré, relation liée ou déliée) passe par la même confirmation qu'un changement de créneau pour les routines dont une condition cite un anniversaire (la personne ou « Anniversaires ») : les occurrences qui ne peuvent plus être faites perdent leurs commentaires une fois confirmé (« Occurrences supprimées »), les cochées restent (`confirmLoss`, `settleScheduleChange`, voir [Routines](../activities/routines.md#créneaux-de-lagenda-conditionwindows-windowsallowed)). **Créer une personne avec une date de naissance et supprimer une personne demandent donc cette confirmation**, comme archiver ou restaurer. Le web le demande dans les panneaux des personnes (enregistrés champ par champ : refusé, le champ revient), à l'ajout et au retrait d'un membre, à l'archivage et à la suppression, puis recharge les routines, les tâches faisables et les anniversaires.
