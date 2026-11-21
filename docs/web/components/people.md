# Personnes : sélections, clés, libellés

Choix et affichage des personnes : contributeurs (membres de l'équipe ou du foyer), relations (« Relations » en pro, « Proches » en perso), l'utilisateur (« Moi »). Source : `apps/web/src/components/people/`. Règles : [Personnes](../../business-rules/cross-cutting/people.md) (bénéficiaires libres, assignés = contributeurs du projet).

## `people-keys.ts`

Valeurs des sélections qui mélangent les sortes de personnes : `« c:<id> »` (contributeur), `« m:<id> »` (membre), `« r:<id> »` (relation), construites avec `taggedKey` (`lib/tagged-key`).

- `ME_KEY` : valeur `'me'` de « Moi » (l'utilisateur, ni membre ni relation) dans une sélection ou un filtre de personnes. Imposée par eslint.
- `personKey(kind, id)` : clé d'une personne (`kind` = `'contributor' | 'member' | 'relation'`).
- `personKeyOptions(kind, names)` : options `{ value: clé, label }` à partir d'une table nom par id.
- `parsePersonKey(key)` : `{ kind, id }`, ou `null` pour aucune clé ou une clé inconnue.
- `peopleKeys(people)` : valeurs d'une sélection multiple, sorte par sorte (`{ contributor?, member?, relation? }`).
- `idsOfKind(keys, kind)` : ids d'une sorte parmi des clés.
- `memberOrRelation(key)` : `{ memberId, relationId }` d'une sélection simple membre / relation (pour qui est une ligne, un budget).
- `memberOrRelationKey({ memberId, relationId })` : clé inverse (la relation d'abord), `null` sans aucun.
- `memberRelationOptions(members, relations, { perso, withMe })` : options groupées d'une sélection de membres et relations (« Prénom (moi) » pour l'utilisateur, retiré si `withMe` est faux). Utilisé par la trésorerie.

## `people-options.ts`

- `PeopleGroup` (interface) : groupe d'options `{ group, items }`.
- `personName(person)` : « Prénom (moi) » pour l'utilisateur, le nom sinon, partout.
- `meName(me)` : nom de l'utilisateur parmi des personnes, « Moi » s'il n'en fait pas partie.
- `relationNoun(perso, many?)` : « Relation(s) » en pro, « Proche(s) » en perso. Imposé par eslint.
- `RelationWords` (interface) et `relationWords(perso)` : les mots accordés : `noun`, `many`, `the` (« la relation » / « le proche »), `new` (« Nouvelle relation » / « Nouveau proche »), `none` (« Aucune relation. » / « Aucun proche. »), `feminine`. Imposé par eslint pour ces libellés.
- `peopleOptions(contributors, relations, perso)` : options groupées « Contributeurs » puis « Relations » / « Proches », groupe vide retiré.
- `usePeopleOptions()` : `peopleOptions` avec le type de l'espace actif (`useActiveWorkspace`). Exception eslint connue : import de `features/workspaces`.

## `PeopleSelect.tsx`

`PeopleSelect` : champ de formulaire qui choisit des personnes (assignés, bénéficiaires, pour qui est un produit) : `BatchMultiSelect` cherchable et vidable, placeholder « Personne » sans choix. Props : `label`, `description`, `placeholder`, `data`, `value`, `onChange`, `renderOption`, `nothingFoundMessage`, `error`, `disabled`. Utilisé par les tâches, les achats, les bénéficiaires.

## `people-rows.tsx`

- `PersonOption` : option d'une personne dans une sélection : avatar (20 px), libellé, indice atténué (handle…). Utilisé par l'autocomplétion « @ » de l'éditeur markdown.
- `PersonAvatar` : avatar d'une personne (initiales colorées par le nom), 16 px par défaut (dans une ligne de texte). Utilisé par les tâches et les mails.
- `PersonRow` : ligne d'une personne dans une liste (contributeurs d'un projet, de l'espace) : avatar `md`, nom (`label`, défaut le nom), `badges`, `details` en dessous. Utilisé par les tâches et la trésorerie.

## `person-option.tsx`

`personOptionRenderer(byId, { handle })` : rendu (`renderOption`) des options d'une sélection de personnes : avatar, libellé, « @handle » (sauf `handle: false`). Imposé par eslint (un `PersonOption` dans un `renderOption` écrit à la main est interdit). Utilisé par les tâches et la trésorerie.

## Détails d'une personne

- `BirthDateField({ value, onChange, onBlur?, error? })` (`BirthDateField.tsx`) : « Date de naissance » : jour, mois (`monthOptions`), année facultative (« L’année est facultative : connue, l’âge s’affiche. ») ; la valeur (`YYYY-MM-DD` ou `--MM-DD`) n'existe qu'avec le jour et le mois ; les parties tapées sont gardées, une valeur changée ailleurs les remplace.
- `PersonDetailsFields(props)` (`PersonDetailsFields.tsx`) : les détails d'un membre de l'équipe ou du foyer ou d'une relation, les mêmes dans les deux panneaux (un autre contributeur n'en a pas à lui) : date de naissance, « Rappels d’anniversaire » (`RemindersSelect`, `at` et `days` : une ligne par rappel, « Le jour J » ou N « jours avant », « à » HH:MM ; désactivé sans date de naissance), adresses mail et téléphones (`ContactListField`, `kind="emails"` puis `"phones"`, erreurs `emailErrors` / `phoneErrors` par `nestedErrors`). `MemberForm`, `RelationForm`.
- `ContactLines({ emails, phones })` (`ContactLines.tsx`) : adresses mail (liens `mailto:`) et téléphones en lignes de texte, avec leur libellé (« Mobile : 06… ») ; rien sans l'un ni l'autre. Utilisé par `ContactInfo` (fiche de facturation d'un client) et `ContributorLinkField` (coordonnées liées d'un contributeur).
- `person-details.ts` : `PersonDetailsValues` (type des valeurs), `NO_PERSON_DETAILS_VALUES` (une nouvelle personne), `PERSON_DETAILS_ON_BLUR` (champs enregistrés en les quittant : date, adresse, téléphones ; les rappels dès qu'ils changent), `personDetailsValues(person)` (valeurs depuis le cache), `personDetailsProps(form, fieldProps)` (props de `PersonDetailsFields` depuis `useFieldSave`).

