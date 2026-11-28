# Répétitions : règles, cas, durées

L'éditeur commun des répétitions (évènements, créneaux, routines, alarmes, trésorerie, facturation) : une règle, ou plusieurs cas avec leur période ; durée de chaque occurrence ; résumé en mots ; synthèse et liste des exceptions. Les exceptions naissent des actions des occurrences (« Annuler », « Supprimer » « Cette occurrence », déplacer, modifier ; `occurrenceEntry`, `OccurrenceButton`) ; sous la répétition, leur synthèse (`ExceptionsSummary`) ouvre leur modale (`ExceptionsList`), où chacune se rétablit et où une exception « rien » s'ajoute un jour de la règle. Source : `apps/web/src/components/recurrence/`. Le modèle (`Recurrence`, `RepetitionCase`, `Duration`, `ruleValues`, libellés des jours et mois) vient de `@ordo/shared` : voir [Partagé : dates](../../shared/cross-cutting/dates.md) et [Règles : dates](../../business-rules/cross-cutting/dates.md).

## Champ et modale

### `RepetitionField`

Répétition de ce qu'affiche un panneau : son résumé (une ligne par élément décrit ; rien : `emptyText`, « Ne se répète pas » par défaut) et un bouton « Modifier » (`secondary`, `xs`) qui ouvre tous les réglages dans une modale, sur un brouillon appliqué par « Appliquer » et abandonné par « Annuler ». Le même champ pour les créneaux, horaires des tâches (`TaskHoursField`, « N’importe quand » sans horaires), alarmes, trésorerie et facturation (évènements et routines règlent la leur directement dans leur panneau). Props : `value`, `onChange`, `describe(value)` (lignes), `editor(draft, setDraft)`, `valid(draft)`, `label` (défaut « Répétition »), `description`, `error`, `required`, `editable` (défaut vrai), `emptyText`, `exceptions(value)` (ses exceptions en mots, `ExceptionLine[]` : leur synthèse `ExceptionsSummary` sous le résumé, dont « Modifier les exceptions » ouvre la même modale, défilée jusqu’à ses exceptions ; rien sans exception). Deux boutons seulement : « Modifier » (la modale en haut) et « Modifier les exceptions ».

### `RepetitionModal`

Modale (`Modal` taille `xl`) des réglages de répétition sur un brouillon : `header` facultatif, l'éditeur, `FormActions` « Appliquer » (désactivé si `valid` refuse) / « Annuler ». Props : `opened`, `onClose`, `title`, `draft`, `setDraft`, `editor`, `valid`, `onApply`, `header`, `exceptionsFirst` (ouverte par « Modifier les exceptions » : `ExceptionsFocusContext`, sa liste d’exceptions défile jusqu’à elle). Utilisée par `RepetitionField` et par une cellule de tableau des routines. Son contenu (interne `DraftSettings`) est aussi celui d'`openRepetitionModal`.

### `OpenedDraft` et `openRepetitionModal` (`open-repetition-modal.tsx`)

- `openRepetitionModal({ title, value, editor, valid?, onApply })` : ouvre une modale de répétition (`openModal`, taille `xl`, sous-formulaire d'un champ) sur un brouillon de `value`, « Appliquer » / « Annuler » dans son pied toujours visible (`DialogFooter`). Utilisé par les exceptions d'un évènement (`EventRepetition`, contenu `RuleExceptions` avec ses occurrences supprimées, annulées ou modifiées seules).
- `OpenedDraft({ value, editor, valid?, onApply, onClose })` (`RepetitionField.tsx`) : son contenu, avec son propre brouillon.

### `RuleField`

Répétition d'une seule règle, sans horaires (trésorerie, facturation) : `RepetitionField` + `RuleEditor`, résumé `describeRecurrence` capitalisé, synthèse des exceptions « rien » dessous et, dans la modale, « Exceptions » (`RuleExceptions`). `required` : une règle est obligatoire (« Ne se répète pas » non proposé, « Appliquer » refusé sans règle). Props : `value`, `onChange`, `start`, `label`, `description`, `error`, `required`, `weekly`.

## Éditeurs

### `RepetitionEditor`

Tous les réglages d'une répétition, selon ce que l'élément permet. Générique sur le type `T` des horaires d'un cas. Props :

- `mode` / `onModeChange` : `'RULE'` (une règle), `'CASES'` (plusieurs cas) ou un mode propre (`RepetitionModeValue`) ;
- `cases` / `onChange` : les cas (`RepetitionCase<T>` : `start`, son début, `rule`, avec sa fin, `times`) ; un seul en mode règle ;
- `start` : premier jour de ce qui se répète (les rythmes comptent de lui) ;
- `multiple` : cas proposés (routines, créneaux) ;
- `weekly` : jours de semaine et semaines paires / impaires proposés (défaut vrai) ;
- `allowNone` : « Ne se répète pas » proposé (règle seule, défaut vrai) ;
- `durations` : façons de durer plus d'un jour (`DurationUnit[]`) ;
- `times` (`RepetitionTimes<T>`) : éditeur et résumé des horaires d'un cas ;
- `modes` : autres modes (ex. une routine qui suit les créneaux de l'agenda), chacun avec `value`, `label`, `render` ;
- `footer` : réglages sous tous les modes ;
- `onCommit` : appelé une fois une valeur choisie (fréquence, jour, fin, début, mode, cas ajouté, retiré ou déplacé…) ou un nombre quitté (intervalle, nombre de fois, jour du mois, durée) : un panneau enregistré champ par champ enregistre alors, pas à chaque touche (`EventRepetition`, `RoutineRepetition`) ; il est aussi passé à `times.render`, pour les horaires d’un cas ; `onChange` reste appelé à chaque changement ;
- `caseStart` (`CaseStart<T>` : `needed(item)`, `message`) : « Début » requis des cas qui en ont besoin (horaires d’une tâche), en mode règle aussi : champ obligatoire (« À choisir »), `message` en erreur sous lui, une fois le champ quitté (sortie ou fermeture du calendrier), tant qu’il est vide. Sans : « Début » seulement en mode cas, facultatif ; les rythmes comptent de `start` sans début.

Comportement : choix du mode en `SegmentedControl` (« Une règle », « Plusieurs cas », modes propres) quand il y en a plusieurs ; passer en cas garde la règle comme premier cas ; revenir à une règle garde le premier cas (sans début, sauf un début requis). En mode cas : cartes `CaseCard` réordonnables par glisser-déposer (`SortableArea`), pliables et retirables quand il y en a plusieurs ; texte « Chaque cas a son début, ses jours, sa fin et ses horaires ; un jour pris par plusieurs cas suit le premier (glissez-les pour les réordonner). » ; « Ajouter un cas » (nouveau cas : toutes les semaines depuis le premier jour, déplié). Composant interne `CaseFields` : « Début » (`DateField`, cas seulement ou requis ; facultatif : placeholder « Dès le début », effaçable ; un début avant `start`, jour technique des plus anciens cas, s'affiche vide, sauf avec `caseStart` : horaires d'une tâche), puis la règle comptée depuis lui (sa « Fin » : « Jamais », « À une date », « Après un nombre de fois »), durée, horaires.

- `RepetitionTimes<T>` (interface) : `render(times, onChange, index, rule, onCommit?)` (`onCommit` : celui de l’éditeur, à appeler après un choix, une heure ou un nombre quitté), `describe(times, rule)`, `empty()`.
- `CaseStart<T>` (interface) : `needed(item)`, `message`.
- `RepetitionModeValue` (type) : `'RULE' | 'CASES' | string`.

### `RuleEditor`

Éditeur d'une seule règle (alarme, évènement, champ) : `RepetitionEditor` en mode règle sur un cas unique. Props : `rule`, `onChange`, `start`, `weekly`, `allowNone`, `durations`, `footer`, `onCommit`.

### `RecurrenceEditor`

Règle de répétition : fréquence (« Ne se répète pas », « Tous les jours », « Toutes les semaines », « Tous les mois », « Tous les ans »), intervalle « Tous les N jours / semaines / mois / ans » (1 à 999 ; remplacé en semaines paires / impaires par « Toutes les x semaines paires / impaires », `parityInterval`, 1 à 999, quitté pour valider) ; en hebdomadaire : « Toutes les semaines / Semaines paires / Semaines impaires » (`SegmentedControl` ; « Toutes les semaines » vide `parityInterval` ; un autre choix, ou une autre fréquence, vide le décalage de ses semaines laissé par un déplacement, `parityShift`) et puces des jours ; en mensuel / annuel : « Un jour du mois » (1 à 31, ou la case « Le dernier jour du mois » : le 31, 30, 29 ou 28 selon le mois, le champ du numéro masqué ; décochée, le jour de la première date), « Un jour de semaine du mois » (rang + jour : « le 2e mardi » ; en mensuel, suivi de « Toutes les semaines / Semaines paires / Semaines impaires », `weekdayParity` : le rang devient « 1re » à « 3e » ou « dernière » : celui de la première date quand elle est ce jour de semaine, dans une semaine de cette parité, pour qu'elle reste une occurrence ; sinon le rang gardé, un 4e passant au 3e ; de même au retour à « Toutes les semaines ») et, en annuel, « Un jour d'une semaine » (jour + semaine 1 à 53) ; mois en annuel ; « Fin » : « Jamais », « À une date » (« Jusqu'au », pas avant le début), « Après un nombre de fois » (1 à 9999, 10 au départ) ; résumé `describeRecurrence`. Les valeurs de jour et de mois sont pré-remplies depuis le premier jour (`withRuleValues`, `ruleValues`). Changer de fréquence vide `parityInterval` hors hebdomadaire et `weekdayParity` hors mensuel ; quitter « Un jour de semaine du mois » vide `weekdayParity`. Internes `parityOptions`, `parityOf`. Props : `value`, `onChange`, `start`, `withinPortal` (listes dans une popover), `weekly`, `allowNone`, `frequencyLocked` (fréquence en lecture seule), `onCommit` (après un choix, ou un nombre quitté).

### `MovedRuleForm`

Formulaire de la nouvelle règle d'une répétition le dernier jour du mois déplacée à un autre jour (« Celle-ci et les suivantes », « Toutes ») : texte « Cette répétition tombe le dernier jour du mois, et tous les mois n’ont pas le même nombre de jours : choisissez la règle de la série déplacée. », `RecurrenceEditor` prérempli avec la règle proposée (sans « Ne se répète pas », fréquence affichée sans pouvoir la changer : `frequencyLocked`), erreur de la règle sous l'éditeur (`recurrenceSchema`), « Annuler » et « Déplacer ». Props : `initial`, `start`, `onSubmit`, `onCancel`.

### Nouvelle règle d'un déplacement (`ask-moved-rule.tsx`)

- `askMovedRule(proposal, start)` : ouvre `MovedRuleForm` dans le panneau de droite, « Nouvelle règle de la répétition » (par-dessus le panneau déjà ouvert), et attend la règle choisie ; `null` si abandonné (« Annuler », panneau fermé).
- `withMovedRuleChoice(run)` : lance un déplacement sans nouvelle règle (`run(null)`) ; refusé faute d'elle — par l'API (`RULE_CHOICE_REQUIRED`, extension `movedRule` : `{ rule, start }`) ou par un calcul partagé lancé dans l'app (`RuleChoiceRequired`) —, demande la règle (`askMovedRule`) puis relance avec elle ; abandonné : `ActionDeclined` (silencieux, l'appelant remet en place). Autres refus transmis. Utilisé par la modification d'un évènement (`useCalendarEventMutations().update`), le changement d'une occurrence de routine (`useRoutineMutations().changeOccurrence`) et les changements de créneaux depuis l'agenda (`changeSlot`, `SlotEditForm`). Fonction interne `proposedRule`.

### `MonthDayField`

Jour du mois choisi, le même champ partout (répétition `RecurrenceEditor`, durée `DurationFields`, « Ouverture » `OpensOnInput`) : un nombre 1 à 31 (le dernier jour d'un mois plus court), ou la case « Le dernier jour du mois » (`LAST_DAY` : le nombre masqué ; décochée, `fallback`). Props : `value`, `onChange`, `fallback`, `onCommit` (après la case, ou le nombre quitté), `label`, `ariaLabel`, `prefix`, `size`, `w`, `lastLabel` (libellé de la case, défaut « Le dernier jour du mois » ; « Le dernier jour du mois précédent » pour une « Ouverture » mensuelle), `month` (le choix du mois, placé entre le nombre et la case : durée, « Ouverture » annuelle). Garde eslint : un `NumberInput` `max={31}` écrit à la main est refusé (sauf la date de naissance, `BirthDateField`).

### `DurationFields`

Durée de chaque occurrence à partir de son premier jour : « Chaque fois » : « Pendant des jours », « Pendant des semaines (jusqu'au dimanche) », « Pendant des mois (jusqu'à la fin du mois) », « Jusqu'à un jour (du mois, d'un mois) », « Jusqu'à une semaine de l'année », « Jusqu'à la fin d'un mois » ; avec le nombre (1 à 366), le jour (`MonthDayField` : 1 à 31, ou « Le dernier jour du mois » ; décochée : le 1er) et le mois (« du même mois » par défaut), la semaine (1 à 53) ou le mois. Props : `value`, `onChange`, `units` (unités proposées), `withinPortal`, `onCommit` (après un choix, ou un nombre quitté).

### `FoldCard`

Carte d'une liste de réglages qui se plient (cas d'une répétition, exceptions) : titre (toute la ligne cliquable quand elle se plie, `FoldHeading`, coupé sur une ligne plié), actions à droite, réglages dessous (`Collapse`). Props : `title`, `collapsible`, `opened`, `onToggle`, `before` (poignée), `actions`, `cardRef`, `style`, `raised` (déplacée), `children`. Utilisée par `CaseCard` et `ExceptionsList`.

### `CaseCard`

Un cas d'une répétition (`FoldCard`) : « Cas 2 · son résumé », pliable quand il y en a plusieurs, déplaçable par sa poignée (`DragHandle`, `useSortableItem`, pointeur ou clavier : le premier cas qui convient à un jour l'emporte), retirable (« Retirer le cas N »). Props : `index`, `summary`, `collapsible`, `opened`, `onToggle`, `onRemove`, `sortId`, `sortable`, `children`.

## Exceptions

### `ExceptionsSummary`

Synthèse des exceptions d'une répétition, sous elle, la même partout (évènements, créneaux et éphémérides, routines, horaires des tâches, alarmes, trésorerie, facturation) : « Exceptions », une ligne chacune triée par jour (« 3 novembre 2026 : rien ») ; plus de 5 : les 4 premières et « + X exceptions » (`FoldHeading` `inline`, `aria-expanded`) qui développe les autres sur place (« Moins d’exceptions » les replie) ; bouton « Modifier les exceptions » (`secondary`, `xs`) qui ouvre leur modale (dans `RepetitionField`, la même que « Modifier », défilée jusqu’aux exceptions). Titre « Exceptions » (`LabeledField`). Rien sans exception, sauf `showEmpty` (« Aucune exception »). Props : `lines`, `onEdit` (aucun : lecture seule), `showEmpty`.

### `useFoldedExceptions` (`use-folded-exceptions.tsx`)

`useFoldedExceptions(lines)` : exceptions pliées de la même façon dans la synthèse et la liste : `sorted` (par jour), `shown` (5, ou les 4 premières), `more` (« + X exceptions » / « Moins d’exceptions », `FoldHeading` `inline`). Constante interne `SHOWN_EXCEPTIONS` (5).

### `ExceptionsList`

Exceptions à modifier dans une modale, la même partout : une carte chacune (`FoldCard`), triées par jour, 5 ou les 4 premières et « + X exceptions » (`useFoldedExceptions`), toutes réduites à l'ouverture, celles ajoutées ensuite développées ; les plis repartent de zéro après un retrait ; celles qui ont des réglages (une période d'exception d'un créneau) se développent ; chacune se retire par « Rétablir « son texte » » (`IconAction`, flèche de retour : son occurrence revient comme sa règle la donne). `add` : champ « Ajouter une exception « rien » » (`DateField`, seuls les jours de la règle se choisissent ; aide `description` de `ExceptionsAdd`, sinon « Un jour de la règle dont l’occurrence n’a pas lieu. »). Dans une modale ouverte par « Modifier les exceptions » (`ExceptionsFocusContext`), elle défile jusqu’à elle (`scrollIntoView`). Props : `entries` (`ExceptionEntry` : une `ExceptionLine` avec `body`, `onRestore`, `restoring`), `add` (`ExceptionsAdd` : `isDay`, `onAdd`, `minDate`, `description`), `footer`, `emptyText` (défaut « Aucune exception. »).

### `RuleExceptions`

Exceptions « rien » d'une seule règle dans une modale de répétition (évènement, alarme, trésorerie, facturation) : `ExceptionsList`, chacune rétablie, « Ajouter une exception « rien » » un jour de la règle (`ruleDayAdding`) ; les autres exceptions de l’élément parmi elles (`others` : les occurrences d’un évènement supprimées, annulées ou modifiées seules). Props : `rule`, `onChange`, `start`, `others`.

### `ExceptionsFocusContext` (`exceptions-focus.ts`)

Vrai dans une modale de répétition ouverte par « Modifier les exceptions » : `ExceptionsList` y défile jusqu’à elle une fois montrée.

Garde eslint : une liste d'exceptions écrite à la main dans du JSX (`….exceptions.map(…)`, `….moves.map(…)`) est refusée.

### `exceptions.ts`

- `SKIPPED_KIND` : « rien ».
- `ExceptionLine` (interface) : `key`, `day` (pour trier), `text`.
- `exceptionText(day, kind)` : « 3 novembre 2026 : rien », « 4 novembre 2026 : reportée au ven. 6 nov. ».
- `byExceptionDay(lines)` : triées par jour.
- `skippedLines(rules, prefix?)` : exceptions « rien » de règles (une règle, ou celles des cas), avec l'indice de leur règle.
- `withSkipped(rule, day)` / `withoutSkipped(rule, day)` : règle avec / sans l'exception « rien » de ce jour.
- `withSkippedOn(rules, day)` : règles (chacune avec son premier jour) avec une exception « rien » ce jour-là, donnée à chaque règle qui a ce jour (plusieurs cas un même jour : rien ce jour-là pour aucun) ; les autres inchangées.
- `rulesDayAdding(rules, onChange, minDate)` : ajout d'une exception « rien » à des règles (`ExceptionsAdd` : un jour de l'une d'elles, `occurrenceDates` ; `withSkippedOn`).
- `ruleDayAdding(rule, start, onChange)` : ajout d'une exception « rien » à une règle seule (ses jours seulement, depuis son premier jour). Utilisé par `RuleExceptions` et les routines à une règle.
- `casesDayAdding(cases, start, onChange, minDate?)` : ajout d'une exception « rien » à des cas : un jour d'un des cas (chacun compté depuis son « Début », sinon `start`), donnée à tous les cas qui ont ce jour ; aide « Un jour d’un des cas : rien ce jour-là, pour tous les cas qui y tombent. ». Utilisé par les créneaux et éphémérides (`ScheduleRepetition`), les horaires des tâches (`TaskHoursField`, depuis `OWN_CASES_START`, proposés depuis aujourd’hui) et les routines à plusieurs cas. Fonction interne `isRuleDay`, constante interne `CASES_ADD_DESCRIPTION`.
- `casesSkippedEntries(cases, onChange, prefix?)` : exceptions « rien » des règles de cas, chacune rétablie dans les cas rendus (créneau, période d'exception, horaires d'une tâche).

## Résumés (`describe-recurrence.ts`)

- `describeRecurrence(rule, start, weekdays = true)` : règle en mots : « Toutes les 2 semaines le lundi, le jeudi », « du lundi au vendredi », « Les semaines paires », « Toutes les 2 semaines impaires le lundi », « Tous les mois le 2e mardi », « Le mardi de la 1re semaine paire de chaque mois », « Tous les 2 mois le jeudi de la dernière semaine impaire du mois », « Tous les mois le dernier jour du mois », « Tous les ans le 1er juin », « Tous les ans le dernier jour de février », « … de la semaine 12 », puis « , jusqu'au 20 décembre 2026 », « , 10 fois ». Fonctions internes `nthWeekday`, `weekdayOfParityWeek`, `parityWeeks`, `dayOfRule` (« le 14 », « le dernier jour du mois », « le dernier jour d’avril »).
- `describeDuration(duration)` : « pendant 3 jours », « toute la semaine », « tout le mois », « jusqu'au 20 août », « jusqu’au dernier jour du mois », « jusqu’au dernier jour de février », « jusqu'à la semaine 12 », « jusqu'à fin août » ; vide pour un seul jour.
- `describeCase(item, start, { weekly, times })` : texte d'un cas : début après le premier jour (« À partir du 1 juin »), règle avec sa fin (ou « Ne se répète pas »), durée et horaires, séparés par « · ».

## Plis et clés des cas (`use-case-folds.ts`)

- `useCaseFolds()` : cas dépliés par indice (ajoutés dépliés, les autres pliés) : `isOpen`, `toggle`, `open`, `removed` (les suivants remontent), `moved` (le pli suit le cas déplacé).
- `useCaseKeys(count)` : clés stables des cas pour le glisser-déposer (`case-N`, jamais réutilisées), suivant les ajouts et retraits faits de l'extérieur : `list`, `moved`, `removed`. Fonction interne `sized`.
