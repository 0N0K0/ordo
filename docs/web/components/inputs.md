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

`Select` d'un réglage (catégorie, magasin, unité…) qui crée aussi ce qui est saisi : « Créer « … » » quand le texte n'est aucun des choix ; le nouveau choix est alors sélectionné. Sans `onCreate`, un `Select` simple. Utilisé par la trésorerie, le stock, les achats, les tâches, les projets, l'agenda : la création à la volée est offerte partout où l'on choisit un réglage (étiquettes, statuts, catégories, unités, magasins, lieux…).

### `creatable.ts`

- `CREATE_VALUE` : valeur `'__create__'` de l'option de création.
- `withCreate(data, search)` : options + « Créer « … » » quand le texte saisi n'est le nom d'aucune (comparaison `sameName` : casse, accents et espaces ignorés). Fonction interne `labelsOf(data)` (libellés à plat, groupes ouverts).
- `keepCreate(filter)` : recherche des options qui garde toujours l'option de création (par défaut : libellés contenant le texte normalisé, groupes compris).

### `RemindersSelect`

« Rappels » d'une tâche, d'une routine, d'un évènement, d'une éphéméride ou d'un anniversaire, le seul éditeur de tous, dans un `LabeledField` : **une ligne par rappel** (10 au plus, `REMINDERS_MAX`), « Ajouter un rappel » (`AddItemButton` ; la ligne ajoutée : « 15 min avant » là où il y a des « avant », sinon « Le jour J à 09:00 »), « Retirer » sur chaque ligne (`RemoveButton`) ; sans rappel : `emptyLabel` (« Aucun rappel. »). Pas de préréglages ni de saisie rapide : chaque rappel se règle par ses champs. Chaque ligne n'a que les champs de son type, parmi ceux de l'élément (`kinds`) :

- case « Le jour J » (`dayLabel` ; « Chaque jour » pour une tâche), quand l'élément a des rappels à une heure et d'autres : cochée, un rappel « À HH:MM » le jour même ;
- décochée : un nombre, son unité (« min » / « h » avant un moment, `kinds` `before` ; « jours » avant un jour, `kinds` `days` : un `Select` s'il y en a plusieurs, sinon le mot) et « avant » ; « 0 min avant » est « Au début » ;
- « Depuis » (un `Select`) quand l'élément a plusieurs repères (`anchors`) : évènements (`EVENT_REMINDER_ANCHORS`) « le début » / « la fin » (« le premier jour » / « le dernier jour » pour un rappel à une heure) ; routines (`ROUTINE_REMINDER_ANCHORS`) « le début de l’ouverture », « la fin de l’ouverture », « le début de l’échéance », « la fin de l’échéance » (« l’ouverture » / « l’échéance », ou « le jour de l’ouverture » / « le jour de l’échéance », pour un rappel à une heure) ; aucun pour une tâche, une éphéméride ou un anniversaire ;
- « à » et l'heure (`TimePicker`) pour un rappel à une heure (le jour J ou N jours avant).

Une ligne est envoyée (`onChange`, `Reminder[]` dans l'ordre enregistré, `normalizedReminders`) dès qu'elle est valide : en quittant son nombre ou son heure, à un choix (case, unité, repère), à l'ajout ou au retrait d'une ligne (un panneau enregistré champ par champ l'enregistre alors). Ses erreurs s'affichent sous ses champs une fois quittée, avec les messages de `reminderSchema` (« Nombre attendu. », « 24 heures maximum. », « Au moins 1 jour. », « 30 jours maximum. », « Heure attendue (HH:MM). ») ; une ligne déjà dans la liste : « Ce rappel est déjà dans la liste. » sous elle. Des rappels changés ailleurs (autre élément d'une sélection, l'API) remplacent les lignes. Props : `label`, `description`, `error` (de la liste, sous les lignes), `kinds` (défaut : les trois), `anchors` (défaut : `start`), `value` (rappels du formulaire ou de GraphQL, lus par `readReminders`), `onChange`, `day` (jour des heures dans les libellés, « le jour J » par défaut, vide pour une tâche), `dayLabel`, `emptyLabel`, `disabled`, `readOnly`. Sous les lignes, « Sonneries » (replié ; « Sonneries (N) » quand N rappels en nomment une) : pour chaque rappel, sa sonnerie (« Celle des réglages » ou l'une de la banque) ; gardée par clé quand on change les autres. Internes : `ReminderDraft`, `draftOf`, `readDraft`, `rowAnchors`, `anchorLabel`, `ReminderRingtones`. Utilisé par l'agenda (`EventForm`, éphémérides de `WorkSchedulesManager`), les routines (`RoutineSchedule` et `RemindersCell`, qui garde les sonneries d'une sélection : tous les types, ou `DAY_REMINDER_KINDS` pour une routine sans aucune heure, `routineHasHours` ; aide de `RoutineSchedule` sans heure : « À une heure du jour de l’ouverture ou de l’échéance, ou de quelques jours avant : donnez une heure « dès » ou « jusqu’à » à ses moments (ou un créneau) pour des rappels avant eux. »), les tâches (`TaskReminders`) et les personnes (`PersonDetailsFields`), ces deux-là avec `DAY_REMINDER_KINDS` (`at` et `days`). Garde eslint : `kinds` reçoit `REMINDER_KINDS` / `DAY_REMINDER_KINDS`, pas un tableau écrit sur place.

### `RingtoneSelect`

La sonnerie de ce qui sonne (un rappel dans « Sonneries » de `RemindersSelect`, un temps mort, un minuteur, un minuteur enregistré, les réglages de « Mon compte »), la même partout : « Celle des réglages » en tête, puis les sonneries de la banque (`RINGTONES`) ; au début du champ, « Écouter » (icône lecture, `IconAction` « Écouter « Carillon » ») joue une fois la sonnerie choisie (`previewRingtone` de `lib/alarm-sound.ts` ; « Celle des réglages » : celle des réglages de l’utilisateur), utilisable même champ désactivé. Props : celles d’un `Select` sans `data` ni `leftSection`, `value` (`RingtoneId | null` : null = celle des réglages), `onChange(ringtone | null)`, `withSettings` (défaut oui ; non : la banque seule, pour les réglages eux-mêmes). Gardes eslint : `RINGTONES` ne s’importe que dans `RingtoneSelect` ; `previewRingtone` ne s’importe pas ailleurs.

### `reminder-presets.ts`

Mots des rappels, les mêmes dans l'éditeur et là où ils sont dits :

- `ReminderTarget` (type) : `item` (tâche, éphéméride, anniversaire), `event`, `routine` ; `reminderTargetOf(anchors)` (les quatre repères : une routine ; `end` : un évènement).
- `anchorWords(target, anchor)` : les mots d'un repère (`at` « Au début de l’ouverture », `moment` « le début de l’ouverture », `daysBefore` « l’ouverture », `on` « le jour de l’ouverture ») ; aucun pour `item`.
- `REMINDER_DAYS_TIME` : 09:00, l'heure d'une ligne « jours avant » ajoutée.
- `REMINDER_DAY` : « le jour J ».
- `reminderLabel(reminder, { day?, target? })` : « Au début », « 15 min avant », « 2 h avant », « À 08:00 le jour J » (`day` vide : « À 08:00 »), « 3 jours avant, à 08:00 » ; évènement : « À la fin », « 15 min avant la fin », « À 18:00, le dernier jour », « 3 jours avant le premier jour, à 09:00 » ; routine : « Au début de l’ouverture », « 15 min avant la fin de l’échéance », « À 18:00, le jour de l’échéance », « 3 jours avant l’ouverture, à 09:00 ». Utilisé par « Sonneries » de `RemindersSelect`.

### `ContactListField`

`ContactListField({ kind, value, onChange, errors?, onBlur? })` : liste à libellés pour joindre une personne ou une organisation, la même pour chaque sorte : `kind="phones"` « Téléphones » (libellé et numéro, « Ajouter un numéro ») ou `kind="emails"` « Adresses mail » (libellé et adresse, « Ajouter une adresse »), ajout et retrait ; l’erreur de chacun sous lui (`errors`, chemins `N.label`, `N.number` ou `N.address`) ; `onBlur` : un champ quitté, une entrée retirée (enregistrés alors dans un panneau enregistré champ par champ). Téléphones : clients, services et contacts (`ClientPartyForms`), contributeurs et relations ; adresses mail : contributeurs et relations (`PersonDetailsFields`).

## Couleur, icône, liens, groupe de contrôles

- `ColorField` : champ couleur d'un formulaire, le même partout : hexadécimal, palette du thème (`useColorSwatches`) en rangées de 9, libellé « Couleur » par défaut. `onCommit(color)` : la couleur choisie, aussitôt quand elle est prise dans le nuancier, le sélecteur ou la pipette, en quittant le champ quand elle est tapée (une couleur tapée à moitié n’en est pas une) ; non contrôlé (`defaultValue`), seulement quand elle a changé. `onChangeEnd` de Mantine n'est pas dans ses props (il annonce chaque couleur valide en cours de frappe). Dans un panneau enregistré champ par champ : `commitProps('color')` de `useFieldSave` (imposé par eslint dans ces panneaux). Tient lieu de `ColorInput`, interdit par eslint.
- `IconField` : choix d'une icône avec aperçu (`ItemAvatar` grand, initiales sinon) : bouton « Choisir une image », bouton « Retirer » (tertiaire rouge), aide « JPG, PNG, WebP ou SVG — 1 Mo maximum. ». Le fichier est vérifié avant d'être gardé (`ICON_MIME_TYPES`, `MAX_ICON_BYTES`, messages `ICON_ERRORS` de `@ordo/shared`). Props : `value` (`IconValue`), `onChange`, `currentUrl`, `name`, `color`, `error`, `contain` (image entière, logos clients). L'URL d'aperçu est libérée au démontage. Dans un formulaire : `formIconProps(form, champ du fichier, champ du retrait)` (`icon-field.ts`) donne `value` et `onChange` depuis deux champs du formulaire (`File | null` et `boolean`, envoyés avec les valeurs ; dans un panneau enregistré champ par champ, enregistrés ensemble dès qu'ils changent). Imposé par eslint (pas de `value` / `onChange` écrits à la main sur `IconField`). Utilisé par `ProjectForm`, `ClientForm`, `ContributorForm`, `SettingsItemForm`.
- `IconValue` (interface) : `{ file: File | null; remove: boolean }` (nouveau fichier, ou retrait de l'icône actuelle).
- `LinksField` : champ « Liens » d'un évènement, d'une tâche ou d'une routine, le même partout : une ligne par lien (adresse `https://…` avec icône de lien, « Libellé (facultatif) », « Retirer »), « Ajouter un lien » (désactivé à 20, `ITEM_LINKS_MAX`). Props : `form` (le formulaire `useAppForm` de l'élément, son champ `links` validé par `itemLinksSchema`, ou celui de `useFieldSave` : un lien est alors enregistré une fois tapé, en quittant ses champs), `onRemoved` (suite d'un retrait : son enregistrement immédiat, `commit(['links'])`). Utilisé par `EventForm`, `RoutineForm`, `TaskCreateForm`, `TaskLinks`. Imposé par eslint (« Ajouter un lien » dans un `AddItemButton`, placeholder « Libellé (facultatif) »).
- `LabeledField` : libellé au-dessus de contrôles qui ne sont pas un seul champ (liste de champs, groupe de boutons), comme le libellé d'un champ ; les contrôles forment un groupe (`role="group"`) nommé par le libellé. Props : `label`, `description`, `error`, `required` (astérisque), `gap` (4), `children`.

## Interrupteur

### `StateSwitch`

Interrupteur d'un état oui / non ou d'un mode (une bascule n'est pas un bouton) : fait, favori, acheté, mode d'édition. Nom caché sauf `showLabel`, infobulle (`hint`) affichée même désactivé (`ActionTooltip wrapped`). Props : `label`, `showLabel`, `checked`, `onChange(checked)`, `hint`, `color`, `icon` (dans le curseur quand actif), `dashed` (piste en pointillés : facultatif, ex. heure facultative d'une routine ; `StateSwitch.module.css`), `size` (`sm`), `disabled`. eslint interdit `aria-pressed` et un `Switch` à libellé caché écrit à la main.

## Périodes

### `date-range.ts`

Règles d'une période : la fin suit le début, un seul message (`END_AFTER_START`, « La fin doit suivre le début. »), les jours impossibles grisés.

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
