# Champs de saisie communs

Champs de formulaire partagés : montants, quantités, couleurs, icônes, sélections multiples, sélections avec création à la volée, périodes, rappels (tâches, routines, évènements), interrupteurs. Source : `apps/web/src/components/inputs/`. Les règles de validation des formulaires (au blur puis à chaque changement) sont dans `lib/form` (voir [lib](../lib.md#formts)).

## Nombres et montants

### `number-format.ts`

- `FRENCH_NUMBER_FORMAT` : séparateurs d'un nombre saisi, les mêmes partout : `{ decimalSeparator: ',', thousandSeparator: ' ' }` (« 1 000,5 »), à étaler dans un `NumberInput`. Imposé par eslint.
- `optionalNumber(value)` : nombre saisi dans un champ facultatif : `null` quand le champ est vidé ou pas encore un nombre (le `NumberInput` donne alors du texte).
- `optionalNumberProps(form, field)` : props d'un `NumberInput` facultatif d'un formulaire Mantine : valeur (vide pour aucune), erreur, et `null` enregistré quand on vide le champ. Utilisé par le stock, les achats, les routines, les alarmes.

### `AmountInput`

Champ de montant : saisi avec jusqu'à 4 décimales (prix unitaire de 1,879 €), affiché arrondi à 2 hors du champ (« 1,88 € », `round2`), séparateurs français, suivi du symbole de sa devise (`currencySymbol`). Props : celles de `NumberInput`, plus `currency` (code ISO, défaut `EUR` ; `null` : pas de symbole ; un `suffix` donné l'emporte). Utilisé par la facturation, la trésorerie, les achats, les cellules de `data-table`.

### `QuantityInput`

Champ de quantité (stock, achats, facturation) : 3 décimales au plus, séparateurs français, unité après (`unit`). Props de `NumberInput` en plus.

## Sélections

### `BatchMultiSelect`

Sélection multiple qui coche plusieurs options d'un coup (remplace `MultiSelect`, interdit par eslint) :

- tant que la liste est ouverte, les choix sont un brouillon, transmis une seule fois à la fermeture (enregistrer à chaque clic redessinerait la ligne du tableau et fermerait la liste) ; une puce retirée liste fermée est transmise tout de suite ;
- les options déjà choisies viennent d'abord, dans un groupe « Sélectionnés » (puis « Autres » ou leurs groupes), dans l'ordre de l'ouverture (fonction interne `selectedFirst`) ; une liste en arbre (options avec `depth`) garde son ordre ;
- les valeurs s'empilent dans le champ : 5 au plus (`MAX_STACKED`) ; au-delà, 4 puis « X de plus » (`StackedToggle`), dépliable et repliable ;
- chaque puce montre l'avatar de l'option si elle a une couleur ou une image (`hasAvatar`, `ItemAvatar`) ;
- `onCreate(label)` : création à la volée (« Créer « … » », voir `creatable.ts`), la nouvelle valeur ajoutée au brouillon ou enregistrée ; échec en toast.

Props : celles de `MultiSelect` (`value` / `onChange` = la valeur enregistrée), plus `onCreate`. Styles : `BatchMultiSelect.module.css`. ~26 fichiers.

### `CreatableSelect`

`Select` d'un réglage (catégorie, magasin, unité…) qui crée aussi ce qui est saisi : « Créer « … » » quand le texte n'est aucun des choix ; le nouveau choix est alors sélectionné. Sans `onCreate`, un `Select` simple. Utilisé par la trésorerie, le stock, les achats, les tâches, les projets, l'agenda (décision M : création à la volée partout).

### `creatable.ts`

- `CREATE_VALUE` : valeur `'__create__'` de l'option de création.
- `withCreate(data, search)` : options + « Créer « … » » quand le texte saisi n'est le nom d'aucune (comparaison `sameName` : casse, accents et espaces ignorés). Fonction interne `labelsOf(data)` (libellés à plat, groupes ouverts).
- `keepCreate(filter)` : recherche des options qui garde toujours l'option de création (par défaut : libellés contenant le texte normalisé, groupes compris).

### `RemindersSelect`

« Rappels » d'une tâche, d'une routine ou d'un évènement, le seul éditeur des trois (décision D16), sur `BatchMultiSelect`, 10 au plus (`REMINDERS_MAX`), de types mêlés, en deux groupes :

- « Avant » (`kinds` contient `before`) : « Au début » et « N min avant », parmi `REMINDER_PRESETS` ;
- « À une heure, le jour J » (`kinds` contient `at`) : toutes les demi-heures (`REMINDER_TIME_PRESETS`), ou une heure tapée (« 8:15 », « 8h15 », « 8 », création à la volée) ; une saisie qui n'est pas une heure affiche « Heure attendue (HH:MM). » **sous le champ** (erreur du champ, jusqu'au changement suivant ; décision EP).

Une valeur gardée d'avant hors des préréglages reste affichée (`reminderLabel`). Props : `kinds` (défaut : les deux), `value` (rappels du formulaire ou de GraphQL, lus par `readReminders`), `onChange` (`Reminder[]` dans l'ordre enregistré, `normalizedReminders`), `day` (jour des heures dans les libellés, « le jour J » par défaut, vide pour une tâche), `emptyLabel`, et les props du `MultiSelect` (`error` passée sous le champ). Choix encodés par `reminderKey` / `reminderOfKey`. Utilisé par l'agenda (`EventForm`), les routines (`RoutineSchedule` : seulement `at` sans horaire ni créneau ; `RemindersCell`) et les tâches (`TaskReminders`, `at` seulement). Interne : `typedTime`, `TYPED_TIME_ERROR`.

### `reminder-presets.ts`

- `ReminderPreset` (type) : `{ value, label }`.
- `REMINDER_PRESETS` : rappels « avant » d'un évènement ou d'une routine, en minutes : « Au début », 5, 10, 15, 30 min, 1 h, 2 h, 6 h (24 heures au plus : plus de « 1 jour avant », « 2 jours avant », « 1 semaine avant » ; remplace `EVENT_REMINDERS` et `ROUTINE_REMINDERS`).
- `REMINDER_TIME_PRESETS` : heures `00:00` à `23:30`, toutes les demi-heures (« À HH:MM »).
- `REMINDER_DAY` : « le jour J ».
- `reminderLabel(reminder, day?)` : « Au début », le préréglage, sinon la durée (« 24 h 00 avant ») ; « À 08:00 le jour J » (`day` vide : « À 08:00 »).

## Couleur, icône, liens, groupe de contrôles

- `ColorField` : champ couleur d'un formulaire, le même partout : hexadécimal, palette du thème (`useColorSwatches`) en rangées de 9, libellé « Couleur » par défaut. Remplace `ColorInput` (interdit par eslint).
- `IconField` : choix d'une icône avec aperçu (`ItemAvatar` grand, initiales sinon) : bouton « Choisir une image », bouton « Retirer » (tertiaire rouge), aide « JPG, PNG, WebP ou SVG — 1 Mo maximum. ». Le fichier est vérifié avant d'être gardé (`ICON_MIME_TYPES`, `MAX_ICON_BYTES`, messages `ICON_ERRORS` de `@ordo/shared`). Props : `value` (`IconValue`), `onChange`, `currentUrl`, `name`, `color`, `error`, `contain` (image entière, logos clients). L'URL d'aperçu est libérée au démontage. Dans un formulaire : `formIconProps(form, champ du fichier, champ du retrait)` (`icon-field.ts`) donne `value` et `onChange` depuis deux champs du formulaire (`File | null` et `boolean`, envoyés avec les valeurs ; dans un panneau enregistré champ par champ, enregistrés ensemble dès qu'ils changent). Imposé par eslint (pas de `value` / `onChange` écrits à la main sur `IconField`). Utilisé par `ProjectForm`, `ClientForm`, `ContributorForm`, `SettingsItemForm`.
- `IconValue` (interface) : `{ file: File | null; remove: boolean }` (nouveau fichier, ou retrait de l'icône actuelle).
- `LinksField` : champ « Liens » d'un évènement, d'une tâche ou d'une routine, le même partout (décision D5) : une ligne par lien (adresse `https://…` avec icône de lien, « Libellé (facultatif) », « Retirer »), « Ajouter un lien » (désactivé à 20, `ITEM_LINKS_MAX`). Props : `form` (le formulaire `useAppForm` de l'élément, son champ `links` validé par `itemLinksSchema`, ou celui de `useFieldSave` : un lien est alors enregistré une fois tapé, en quittant ses champs), `onRemoved` (suite d'un retrait : son enregistrement immédiat, `commit(['links'])`). Utilisé par `EventForm`, `RoutineForm`, `TaskCreateForm`, `TaskLinks`. Imposé par eslint (« Ajouter un lien » dans un `AddItemButton`, placeholder « Libellé (facultatif) »).
- `LabeledField` : libellé au-dessus de contrôles qui ne sont pas un seul champ (liste de champs, groupe de boutons), comme le libellé d'un champ ; les contrôles forment un groupe (`role="group"`) nommé par le libellé. Props : `label`, `description`, `error`, `required` (astérisque), `gap` (4), `children`.

## Interrupteur

### `StateSwitch`

Interrupteur d'un état oui / non ou d'un mode (décision CN : une bascule n'est pas un bouton) : fait, favori, acheté, mode d'édition. Nom caché sauf `showLabel`, infobulle (`hint`) affichée même désactivé (`ActionTooltip wrapped`). Props : `label`, `showLabel`, `checked`, `onChange(checked)`, `hint`, `color`, `icon` (dans le curseur quand actif), `dashed` (piste en pointillés : facultatif, ex. heure facultative d'une routine ; `StateSwitch.module.css`), `size` (`sm`), `disabled`. eslint interdit `aria-pressed` et un `Switch` à libellé caché écrit à la main.

## Périodes

### `date-range.ts`

Règles d'une période (décision Q) : la fin suit le début, un seul message (`END_AFTER_START`, « La fin doit suivre le début. »), les jours impossibles grisés.

- `followBounds(bounds, side, value)` : bornes après un changement : un début mis après la fin déplace la fin à lui, une fin mise avant le début déplace le début.
- `rangeError(start, end, strict?)` : `END_AFTER_START` si la fin précède le début (`strict` : strictement après, pour des heures).
- `rangeProps(binding, strict?)` : props des deux champs (valeur, changement avec `followBounds`, erreur, blur) ; la fin reçoit `END_AFTER_START` si besoin.
- `dateRangeProps(binding, { min, max, month })` : props des deux sélecteurs de dates (`DatePickerInput`, `MonthPickerInput`, `DateTimePicker`), à étaler (`{...range.start}`) ; la fin ne peut pas être choisie avant le début (`minDate`) ; `month` : bornes en mois (YYYY-MM). ~16 fichiers.
- `formRange(form, startKey, endKey)` : lien (`RangeBinding`) avec deux champs d'un formulaire Mantine : valeurs, les deux mises à jour d'un coup, erreurs et validation au blur.
- Types internes : `Bound`, `RangeSide`, `RangeBinding`, `BoundProps`, `DateBoundProps`, `DateRangeOptions`.

eslint impose ces aides : `minDate` / `maxDate` tirés d'une autre borne et les anciens messages (« Avant la date de début »…) sont interdits.

### `use-period-range.ts`

- `PeriodRange<P>` (interface) : période d'un formulaire d'export : `today`, `preset` / `setPreset`, `custom` / `setCustom` (dates saisies pour « Dates choisies »), `from`, `to`, `valid` (deux jours connus et dans l'ordre).
- `usePeriodRange(initial, resolve?)` : état de cette période ; les dates saisies partent du mois dernier ; `resolve` donne les jours des préréglages propres au formulaire au-delà de `PERIOD_PRESETS`. Utilisé par les exports de la facturation et de la trésorerie.

### `PeriodRangeFields`

Champs « Du » et « Au » d'une période d'export : affichés (désactivés) pour un préréglage, saisis pour « Dates choisies » (`custom`), la fin suivant le début (`dateRangeProps`). Prop : `range` (`usePeriodRange`).
