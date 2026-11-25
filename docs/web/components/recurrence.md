# Répétitions : règles, cas, durées

L'éditeur commun des répétitions (évènements, créneaux, routines, alarmes, trésorerie, facturation) : une règle, ou plusieurs cas avec leur période ; durée de chaque occurrence ; pauses et dates supprimées ; résumé en mots. Source : `apps/web/src/components/recurrence/`. Le modèle (`Recurrence`, `RepetitionCase`, `Duration`, `ruleValues`, libellés des jours et mois) vient de `@ordo/shared` : voir [Partagé : dates](../../shared/cross-cutting/dates.md) et [Règles : dates](../../business-rules/cross-cutting/dates.md).

## Champ et modale

### `RepetitionField`

Répétition de ce qu'affiche un panneau : son résumé (une ligne par élément décrit ; rien : `emptyText`, « Ne se répète pas » par défaut) et un bouton « Modifier » (`secondary`, `xs`) qui ouvre tous les réglages dans une modale, sur un brouillon appliqué par « Appliquer » et abandonné par « Annuler ». Le même champ pour les créneaux, horaires des tâches (`TaskHoursField`, « N’importe quand » sans horaires), alarmes, trésorerie et facturation (évènements et routines règlent la leur directement dans leur panneau). Props : `value`, `onChange`, `describe(value)` (lignes), `editor(draft, setDraft)`, `valid(draft)`, `label` (défaut « Répétition »), `description`, `error`, `required`, `editable` (défaut vrai), `emptyText`.

### `RepetitionModal`

Modale (`Modal` taille `xl`) des réglages de répétition sur un brouillon : `header` facultatif, l'éditeur, `FormActions` « Appliquer » (désactivé si `valid` refuse) / « Annuler ». Props : `opened`, `onClose`, `title`, `draft`, `setDraft`, `editor`, `valid`, `onApply`, `header`. Utilisée par `RepetitionField` et par une cellule de tableau des routines.

### `RuleField`

Répétition d'une seule règle, sans horaires (trésorerie, facturation) : `RepetitionField` + `RuleEditor`, résumé `describeRecurrence` capitalisé. `required` : une règle est obligatoire (« Ne se répète pas » non proposé, « Appliquer » refusé sans règle). Props : `value`, `onChange`, `start`, `label`, `description`, `error`, `required`, `weekly`.

## Éditeurs

### `RepetitionEditor`

Tous les réglages d'une répétition, selon ce que l'élément permet. Générique sur le type `T` des horaires d'un cas. Props :

- `mode` / `onModeChange` : `'RULE'` (une règle), `'CASES'` (plusieurs cas) ou un mode propre (`RepetitionModeValue`) ;
- `cases` / `onChange` : les cas (`RepetitionCase<T>` : `since`, `until`, `anchor`, `rule`, `times`) ; un seul en mode règle ;
- `start` : premier jour de ce qui se répète (les rythmes comptent de lui) ;
- `multiple` : cas proposés (routines, créneaux) ;
- `weekly` : jours de semaine et semaines paires / impaires proposés (défaut vrai) ;
- `allowNone` : « Ne se répète pas » proposé (règle seule, défaut vrai) ;
- `durations` : façons de durer plus d'un jour (`DurationUnit[]`) ;
- `times` (`RepetitionTimes<T>`) : éditeur et résumé des horaires d'un cas ;
- `modes` : autres modes (ex. une routine qui suit les créneaux de l'agenda), chacun avec `value`, `label`, `render` ;
- `footer` : réglages sous tous les modes ;
- `onCommit` : appelé une fois une valeur choisie (fréquence, jour, fin, période, mode, cas ajouté, retiré ou déplacé…) ou un nombre quitté (intervalle, nombre de fois, jour du mois, durée) : un panneau enregistré champ par champ enregistre alors, pas à chaque touche (`EventRepetition`, `RoutineRepetition`) ; il est aussi passé à `times.render`, pour les horaires d’un cas ; `onChange` reste appelé à chaque changement ;
- `caseStart` (`CaseStart<T>` : `needed(item)`, `message`) : jour d’où compte le rythme demandé aux cas qui en ont besoin (horaires d’une tâche) : champ « À partir du » obligatoire (« À choisir »), son `anchor`, `message` en erreur sous lui, une fois le champ quitté (sortie ou fermeture du calendrier), tant qu’il est vide ; la règle se règle alors depuis ce jour. Sans : les rythmes comptent de `start`.

Comportement : choix du mode en `SegmentedControl` (« Une règle », « Plusieurs cas », modes propres) quand il y en a plusieurs ; passer en cas garde la règle comme premier cas ; revenir à une règle garde le premier cas (sans période). En mode cas : cartes `CaseCard` réordonnables par glisser-déposer (`SortableArea`), pliables et retirables quand il y en a plusieurs ; texte « Chaque cas a sa période, ses jours et ses horaires ; un jour pris par plusieurs cas suit le premier (glissez-les pour les réordonner). » ; « Ajouter un cas » (nouveau cas : toutes les semaines depuis le premier jour, déplié). Composant interne `CaseFields` : « Période » (`PeriodField`, cas seulement, placeholder « Toujours », chaque bout facultatif : « Dès le début » / « Jusqu’à la fin », « Sans début » / « Sans fin » ; changer le début remet l'ancre à zéro), règle, durée, horaires.

- `RepetitionTimes<T>` (interface) : `render(times, onChange, index, rule, onCommit?)` (`onCommit` : celui de l’éditeur, à appeler après un choix, une heure ou un nombre quitté), `describe(times, rule)`, `empty()`.
- `CaseStart<T>` (interface) : `needed(item)`, `message`.
- `RepetitionModeValue` (type) : `'RULE' | 'CASES' | string`.

### `RuleEditor`

Éditeur d'une seule règle (alarme, évènement, champ) : `RepetitionEditor` en mode règle sur un cas unique. Props : `rule`, `onChange`, `start`, `weekly`, `allowNone`, `durations`, `footer`, `onCommit`.

### `RecurrenceEditor`

Règle de répétition : fréquence (« Ne se répète pas », « Tous les jours », « Toutes les semaines », « Tous les mois », « Tous les ans »), intervalle « Tous les N jours / semaines / mois / ans » (1 à 999 ; masqué pour les semaines paires / impaires) ; en hebdomadaire : « Toutes les semaines / Semaines paires / Semaines impaires » et puces des jours ; en mensuel / annuel : « Un jour du mois » (1 à 31, ou la case « Le dernier jour du mois » : le 31, 30, 29 ou 28 selon le mois, le champ du numéro masqué ; décochée, le jour de la première date), « Un jour de semaine du mois » (rang + jour : « le 2e mardi ») et, en annuel, « Un jour d'une semaine » (jour + semaine 1 à 53) ; mois en annuel ; « Fin » : « Jamais », « À une date » (« Jusqu'au », pas avant le début), « Après un nombre de fois » (1 à 9999, 10 au départ) ; « Pauses » (périodes sans occurrence, chacune un `PeriodField` début et fin requis, « Ajouter une pause » ; texte « Aucune occurrence pendant une pause (congés…), la répétition reprend ensuite. ») ; dates supprimées (`DeletedDates`) ; résumé `describeRecurrence`. Les valeurs de jour et de mois sont pré-remplies depuis le premier jour (`withRuleValues`, `ruleValues`). Props : `value`, `onChange`, `start`, `withinPortal` (listes dans une popover), `weekly`, `allowNone`, `frequencyLocked` (fréquence en lecture seule), `onCommit` (après un choix, ou un nombre quitté).

### `MovedRuleForm`

Formulaire de la nouvelle règle d'une répétition le dernier jour du mois déplacée à un autre jour (« Celle-ci et les suivantes », « Toutes ») : texte « Cette répétition tombe le dernier jour du mois, et tous les mois n’ont pas le même nombre de jours : choisissez la règle de la série déplacée. », `RecurrenceEditor` prérempli avec la règle proposée (sans « Ne se répète pas », fréquence affichée sans pouvoir la changer : `frequencyLocked`), erreur de la règle sous l'éditeur (`recurrenceSchema`), « Annuler » et « Déplacer ». Props : `initial`, `start`, `onSubmit`, `onCancel`.

### Nouvelle règle d'un déplacement (`ask-moved-rule.tsx`)

- `askMovedRule(proposal, start)` : ouvre `MovedRuleForm` dans le panneau de droite, « Nouvelle règle de la répétition » (par-dessus le panneau déjà ouvert), et attend la règle choisie ; `null` si abandonné (« Annuler », panneau fermé).
- `withMovedRuleChoice(run)` : lance un déplacement sans nouvelle règle (`run(null)`) ; refusé faute d'elle — par l'API (`RULE_CHOICE_REQUIRED`, extension `movedRule` : `{ rule, start }`) ou par un calcul partagé lancé dans l'app (`RuleChoiceRequired`) —, demande la règle (`askMovedRule`) puis relance avec elle ; abandonné : `ActionDeclined` (silencieux, l'appelant remet en place). Autres refus transmis. Utilisé par la modification d'un évènement (`useCalendarEventMutations().update`), le changement d'une occurrence de routine (`useRoutineMutations().changeOccurrence`) et les changements de créneaux depuis l'agenda (`changeSlot`, `SlotEditForm`). Fonction interne `proposedRule`.

### `MonthDayField`

Jour du mois choisi, le même champ partout (répétition `RecurrenceEditor`, durée `DurationFields`, « Ouverture » `OpensOnInput`) : un nombre 1 à 31 (le dernier jour d'un mois plus court), ou la case « Le dernier jour du mois » (`LAST_DAY` : le nombre masqué ; décochée, `fallback`). Props : `value`, `onChange`, `fallback`, `onCommit` (après la case, ou le nombre quitté), `label`, `ariaLabel`, `prefix`, `size`, `w`, `month` (le choix du mois, placé entre le nombre et la case : durée, « Ouverture » annuelle). Garde eslint : un `NumberInput` `max={31}` écrit à la main est refusé (sauf la date de naissance, `BirthDateField`).

### `DurationFields`

Durée de chaque occurrence à partir de son premier jour : « Chaque fois » : « Pendant des jours », « Pendant des semaines (jusqu'au dimanche) », « Pendant des mois (jusqu'à la fin du mois) », « Jusqu'à un jour (du mois, d'un mois) », « Jusqu'à une semaine de l'année », « Jusqu'à la fin d'un mois » ; avec le nombre (1 à 366), le jour (`MonthDayField` : 1 à 31, ou « Le dernier jour du mois » ; décochée : le 1er) et le mois (« du même mois » par défaut), la semaine (1 à 53) ou le mois. Props : `value`, `onChange`, `units` (unités proposées), `withinPortal`, `onCommit` (après un choix, ou un nombre quitté).

### `CaseCard`

Un cas d'une répétition : « Cas 2 · son résumé », pliable quand il y en a plusieurs (`FoldHeading`), déplaçable par sa poignée (`DragHandle`, `useSortableItem`, pointeur ou clavier : le premier cas qui convient à un jour l'emporte), retirable (« Retirer le cas N »). Props : `index`, `summary`, `collapsible`, `opened`, `onToggle`, `onRemove`, `sortId`, `sortable`, `children`.

### `DeletedDates`

Occurrences supprimées une à une d'une répétition, sous « Dates supprimées » : une puce par date (« 13 novembre 2026 × », infobulle « Rétablir cette date »), un clic la rétablit ; rien sans date. Props : `dates`, `onChange`. Utilisé par `RecurrenceEditor`.

## Résumés (`describe-recurrence.ts`)

- `describeRecurrence(rule, start, weekdays = true)` : règle en mots : « Toutes les 2 semaines le lundi, le jeudi », « du lundi au vendredi », « Les semaines paires », « Tous les mois le 2e mardi », « Tous les mois le dernier jour du mois », « Tous les ans le 1er juin », « Tous les ans le dernier jour de février », « … de la semaine 12 », puis « , jusqu'au 20 décembre 2026 », « , 10 fois », « (2 pauses) ». Fonctions internes `nthWeekday`, `dayOfRule` (« le 14 », « le dernier jour du mois », « le dernier jour d’avril »).
- `describeDuration(duration)` : « pendant 3 jours », « toute la semaine », « tout le mois », « jusqu'au 20 août », « jusqu’au dernier jour du mois », « jusqu’au dernier jour de février », « jusqu'à la semaine 12 », « jusqu'à fin août » ; vide pour un seul jour.
- `describeCase(item, start, { weekly, times })` : texte d'un cas : période, règle (ou « Ne se répète pas »), durée et horaires, séparés par « · ».

## Plis et clés des cas (`use-case-folds.ts`)

- `useCaseFolds()` : cas dépliés par indice (ajoutés dépliés, les autres pliés) : `isOpen`, `toggle`, `open`, `removed` (les suivants remontent), `moved` (le pli suit le cas déplacé).
- `useCaseKeys(count)` : clés stables des cas pour le glisser-déposer (`case-N`, jamais réutilisées), suivant les ajouts et retraits faits de l'extérieur : `list`, `moved`, `removed`. Fonction interne `sized`.
