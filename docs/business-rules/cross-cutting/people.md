# Personnes : contributeurs, « Moi », membres, relations, assignés, bénéficiaires

Qui peut être choisi où : profil « Moi », contributeurs et leurs projets, membres de l'équipe ou du foyer, relations, assignés et bénéficiaires. Sources : `apps/api/src/services/projects/contributors.ts`, `apps/api/src/services/core/beneficiaries.ts`, `apps/api/src/services/shopping/people.ts`, `apps/api/src/services/treasury/treasury-team.ts`, `apps/api/src/services/workspaces/workspaces.ts`, `packages/shared/src/tasks/tasks.ts`, `packages/shared/src/accounting/treasury.ts`, `packages/shared/src/calendar/event-busy.ts`.

Voir aussi : [Espaces et accès](workspaces-and-access.md), [Archivage](archiving.md), [Nommage](naming.md), [Trésorerie](../finances/treasury.md).

## Les sortes de personnes

| Sorte                  | Modèle                                            | Rôle                                                                                                                                                             |
| ---------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contributeur           | `Contributor`                                     | Personne qui peut être assignée, participer, être mentionnée (`@handle`). Nom (100 max), identifiant de mention unique dans l'espace, avatar, projets rattachés. |
| « Moi »                | `Contributor` avec `userId`                       | Profil contributeur de l'utilisateur dans chaque espace.                                                                                                         |
| Membre                 | `Contributor` avec `teamMember` (ou « Moi »)      | Membre de l'équipe (espace PRO) ou du foyer (espace PERSO) : ventilation des dépenses, budgets, « Pour » des courses.                                            |
| Relation               | `TreasuryRelation`                                | Personne hors équipe ou foyer (ami, famille, partenaire…) : lignes de trésorerie, budgets, prêts, bénéficiaires. Peut être aussi un contributeur (non membre).   |
| Client, contact, tiers | `Client`, `ClientContact`, `TreasuryCounterparty` | Personnes de la facturation et de la trésorerie (voir [Comptabilité](../finances/accounting.md), [Trésorerie](../finances/treasury.md)).                         |

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

## Assignés et participants

Règle unique (2026-11-18) pour les assignés des tâches et des routines et les participants des événements :

- Élément **sans projet** : n'importe quel contributeur.
- Élément **avec projet** : seulement « Moi » et les contributeurs rattachés au projet ou à un de ses parents ; ceux déjà choisis restent valides. Sinon : « Seuls les contributeurs du projet peuvent être choisis. » (`assertProjectContributors`).
- Un contributeur archivé n'est pas nouvellement choisi (sauf annulation d'une action, `restoring`).
- Modifications groupées de tâches : la règle s'applique à chaque tâche de la sélection.
- Déplacer une tâche vers un autre projet : ses assignés (et ceux de ses sous-tâches) **suivent** et sont rattachés au projet cible s'ils ne l'étaient pas déjà, directement ou par un parent (`attachAssignees`) ; « Moi » et les archivés ne sont jamais rattachés.
- Une tâche peut être rattachée à un événement si ses assignés et les participants ont quelqu'un en commun, ou si l'un des deux côtés est vide (`sharePeople`).

## Bénéficiaires

« Bénéficiaires » : pour qui est une tâche, un événement, une routine ; et « Pour » des produits, articles de courses, articles de fiche et de stock.

- N'importe quel contributeur et n'importe quelle relation, quel que soit le projet (`assertBeneficiaries`).
- Ils doivent exister (« Bénéficiaire introuvable. », sous le champ) ; un bénéficiaire archivé n'est pas nouvellement choisi, sauf pour les tâches et les courses / fiches / stock qui acceptent les archivés (`keep: 'all'`).
- Courses : le coût d'un article pour plusieurs personnes est partagé également entre elles (`shoppingShares`, voir [shopping](../../shared/supplies/shopping.md)).

## Membres de l'équipe ou du foyer

`apps/api/src/services/treasury/treasury-team.ts` :

- Liste : « Moi » d'abord, puis par nom.
- Ajouter un membre : un contributeur existant, ou un nouveau créé avec ce nom (un membre est toujours un contributeur). Un contributeur qui est déjà une relation ne peut pas être membre : « Ce contributeur est la relation « X » : il ne peut pas aussi être membre. ».
- Retirer un membre : il reste contributeur (tâches, projets, lignes passées gardés).
- Les membres des lignes de ventilation de trésorerie ne suivent pas la règle des projets.

## Relations

- Nom unique dans l'espace (« Une relation porte déjà ce nom. »), note (500).
- Peut être liée à un contributeur qui n'est pas membre (« Ce contributeur est membre : il n’est pas une relation. ») ; un contributeur au plus une fois (« Ce contributeur est déjà une relation. »).
- Une ligne ou un budget est pour un membre **ou** une relation, pas les deux (« Un membre ou une relation, pas les deux. ») ; un prêt se fait avec une relation (« Un prêt se fait avec une relation. »).
- Archivable (`TREASURY_RELATION`) ; commentable.
