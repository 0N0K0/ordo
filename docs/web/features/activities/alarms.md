# Code web des alarmes

Référence de chaque fichier de `apps/web/src/features/alarms/` (api, pages, components, hooks, lib) : composants, hooks, fonctions, constantes et types, leur rôle et où ils servent. Fonctionnalités : [Alarmes](../../../features/activities/alarms.md) ; règles : [Règles des alarmes](../../../business-rules/activities/alarms.md).

## api

### `api/index.ts`

Fragments `AlarmFields`, `ReminderFields` (un rappel : `before`, `at`, `days`, `anchor`, `ringtone` ; repris par toutes les requêtes de rappels : tâches, routines, évènements, éphémérides, anniversaires, `ElsewhereNotifier`) et `AlarmRingFields`, requêtes `Alarms`, `AlarmRings`, mutations `CreateAlarm`, `UpdateAlarm`, `DeleteAlarm`, `MarkAlarmFired`, `RingAlarm`, `SnoozeAlarmRing`, `StopAlarmRing` ; notifications push : requête `PushConfig` (`pushPublicKey`, `pushSubscriptions`), mutations `RegisterPushSubscription`, `RemovePushSubscription`, `TestPushSubscription`, clé `pushQueryKey` = `['push-devices']`. Clé de requête interne `alarmsQueryKey` = `['alarms']` ; toutes les mutations des alarmes passent par `useAlarmMutation` (interne, `useInvalidatingMutation` qui l’invalide) ; celles des sonneries sont de simples fonctions (appelées hors de React par `lib/ringing.tsx`).

| Export                        | Rôle                                                                            | Utilisé par                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `Alarm` (type)                | Alarme (`AlarmFieldsFragment`)                                                  | tout le dossier, `ElsewhereNotifier` (via le fragment)                           |
| `AlarmInput` (type réexporté) | Entrée GraphQL d’une alarme                                                     | `AlarmForm`                                                                      |
| `useAlarms()`                 | Toutes les alarmes de l’espace                                                  | `AlarmsPage`, `TaskAlarms`, `AlarmCenter`, `ChronoCard` et `WorkCards` (accueil) |
| `useTaskAlarmCounts()`        | Nombre d’alarmes **actives** par tâche (`countBy`)                              | `TaskBoard`, `use-task-columns` (tâches)                                         |
| `useAlarmMutations()`         | `create`, `update` (`{ id, input }`), `remove` (id), `markFired` (`{ id, at }`) | `AlarmForm`, `AlarmList`, `AlarmCenter`                                          |
| `AlarmRing` (type)            | Une sonnerie gardée par l’API (`AlarmRingFieldsFragment`)          | `lib/ringing.tsx`                                                                |
| `fetchAlarmRings()`           | Sonneries de l’utilisateur des 6 dernières heures, arrêtées comprises           | `loadRings`                                                                      |
| `sendAlarmRing(input)`        | Une sonnerie commence (première ou répétition) ; renvoie l’état gardé           | `lib/ringing.tsx`                                                                |
| `sendAlarmSnooze(key)`, `sendAlarmStop(key)` | « Répéter dans N min », « Arrêter »                              | `lib/ringing.tsx`                                                                |
| `PushConfig`, `PushDevice` (types), `pushQueryKey` | Push de ce serveur (clé publique VAPID, null : désactivé) et appareils de l’utilisateur (`endpoint`, `label`, `createdAt`, `lastSuccessAt`) | `OutsideRings` (compte), `lib/push.ts` |
| `fetchPushConfig()`, `usePushConfig()` | Clé publique et appareils (tous espaces)                                       | `OutsideRings`                                                                   |
| `sendPushSubscription(input)`, `sendPushRemoval(id)` | Abonne un appareil (renvoie son id) ; retire un appareil          | `lib/push.ts`                                                                    |
| `usePushMutations()`          | `remove` (id), `test` (id : vrai si le service push l’a acceptée) ; rechargent les appareils | `OutsideRings`                                                     |

## pages

### `pages/AlarmsPage.tsx`

`AlarmsPage()` : page `/alarms` (route dans `app/router.tsx`, `PAGES.alarms`). `PageHeader` avec « Nouvelle alarme » (`useAlarmForm`), encart d’autorisation des notifications (état `permission` : `Notification.permission`, `Notification.requestPermission()`), section « Minuteurs » (`CountdownList`), puis section « Alarmes » : `ListSkeleton`, `EmptyState` « Aucune alarme. », sinon `AlarmList`.

### `pages/AlarmsPage.module.css`

`.root` : largeur maximale de 7 colonnes de la grille (7 × 96 px + 6 × 16 px), centrée.

## components

### `components/AlarmCenter.tsx`

`AlarmCenter()` : composant sans rendu monté dans `AppLayout` (app) : fait sonner, dans l’espace ouvert, les alarmes et les rappels des évènements, des routines, des tâches, des éphémérides et des anniversaires.

- Données : `useAlarms`, `useRunningTimers` (chronos en cours, plusieurs), `useTasksData` (tâches), `useProjectTree` (projets), `useRoutinesData` + `useRoutineMutations().setDone` (routines), `useSlotRules`, `useWorkSchedules`, `useBirthdays`, `usePersonOpener` (agenda).
- Occurrences d’évènements d’hier à J+31 (`reminderDayRange`, de quoi sonner un « N jours avant ») rechargées toutes les 5 minutes (`fetchCalendarEvents`), gardées dans une ref.
- `unlockAudioOnGesture()` au montage ; `useCountdownRinger()` (`features/countdowns`) : les minuteurs de l’utilisateur sonnent à leur fin, quel que soit l’espace.
- Sonnerie : `configureRinging` avec les réglages de l’utilisateur (`useMe().ringSettings`, `readRingSettings`), l’espace ouvert (`useWorkspaces`) et l’ouverture d’une page (`navigate`, ou `switchWorkspace` pour une sonnerie d’un autre espace) ; `loadRings()` au montage puis chaque minute (`RINGS_MS`) : les sonneries gardées par l’API (rechargement, autre onglet, autre appareil) ; `restore` refait les actions d’une sonnerie remontrée de l’espace ouvert depuis sa clé : « Marquer comme faite » (`routineRingOf`, occurrence en cours, `markDoneAction`), « Ouvrir la fiche » (`birthdayRingOf`) ; `refreshRestoredRings()` une fois les routines et les anniversaires chargés.
- Vérification toutes les `TICK_MS` = 15 s : `ringReminders` (lien « Voir l’agenda »), `ringRoutineReminders` (lien « Voir les routines », « Marquer comme faite », report via `slotRules.nextAllowedAt(routineDoable(routine), at)`, `nextAllowedMoment` partagé avec le serveur, heure de Paris), `ringTaskReminders` (lien vers la tâche, `alarmTarget`), `ringEphemerisReminders` (lien « Voir l’agenda »), `ringBirthdayReminders` (« Ouvrir la fiche » : `usePersonOpener`), puis `dueAlarms` + `ringAlarm` (liens `alarmTarget`, `markFired`).
- Les liens des toasts naviguent avec `useNavigate` (les toasts sont hors du routeur) et portent leur page (`to`, liens communs `calendarRingPage()` et `routinesRingPage()` de `@ordo/shared`), gardée avec la sonnerie. Valeurs les plus récentes lues par une ref `latest`. Paliers des alarmes de chrono : ref `trackingSteps`.
- `listenToPushes()` au montage : ce que dit le service worker (une sonnerie poussée pendant qu’un onglet est visible, un arrêt ou une répétition depuis une notification, une notification ouverte).

### `components/ring.tsx`

| Export                                                      | Rôle                                                                                                                                         | Utilisé par                                       |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `RingLink` (type, réexporté de `lib/ringing.tsx`)           | Lien d’un toast (`NotifyAction` et sa page `to`)                                                                                             | `AlarmCenter`, `ElsewhereNotifier`                |
| `RingWorkspace` (type)                                      | Espace d’un rappel ou d’une alarme quand ce n’est pas celui ouvert : `id`, `label`                                                          | ici, `lib/ring-*.tsx`                             |
| `ringAlarm(alarm, key, links, workspace?, dueAt?)`          | Une alarme réservée une fois (`claim`) sonne par `startRinging` (texte `alarmRingText`, `workspaceRingLine` si autre espace)                 | `AlarmCenter`, `ElsewhereNotifier`                |
| `ringPlannedReminders(planned, now, actions, workspace?)` | La seule sonnerie des rappels : des rappels planifiés par les briques partagées (`PlannedRing` : clé, instant, sonnerie, titre, lignes ; `@ordo/shared`, `dates/reminder-rings.ts`, les mêmes que le serveur), chaque rappel dû (`isRingDue` : ≤ 6 h de retard) réservé une fois (`claim` 7 h, clé `ordo.alarm.<clé>`) sonne par `startRinging` (sa sonnerie ou celle des réglages, `workspaceRingLine` si autre espace) ; `actions` donne ses liens. Règle eslint : `startRingtone()`, `playRingtone()` ou `notifyAlarm()` appelés ailleurs renvoient vers elle (exceptions commentées : `startRinging`, `MailWatcher`) ; `occurrenceReminders`, `taskReminders`, `remindersAt`, `remindersBefore` appelés dans le web renvoient vers les briques partagées | `ringReminders`, `ringTaskReminders`, `ringRoutineReminders`, `ring-calendar.tsx` |
| `ringReminders(occurrences, now, links, workspace?)`   | Rappels d’évènements (`eventRings` : « avant » le début, « À HH:MM » et « N jours avant » le premier jour ; depuis la fin : « avant » la fin, le dernier jour ; clé `event:<clé>:before:<minutes>` / `…:at:<HH:MM>` / `…:days:<N>:<HH:MM>`, `…:end:…` depuis la fin ; ligne « ven. 13 nov., 14:05 · lieu » à l’heure de Paris, ou « Journée entière »), sauf occurrences annulées | `AlarmCenter`, `ElsewhereNotifier`                |
| `ringTaskReminders(tasks, now, links, workspace?)` | Rappels « À HH:MM » et « N jours avant » l’échéance des tâches ouvertes non archivées (`taskRings`, type `RemindedTask` partagé, clé `task:<id>:<jour>:at:<HH:MM>` / `task:<id>:<échéance>:days:<N>:<HH:MM>`) | `AlarmCenter`, `ElsewhereNotifier` |
| `dueAlarms(alarms, running, projects, now, trackingSteps, markFired)` | Alarmes à sonner maintenant, avec leur clé d’occurrence (`dueAlarmOccurrence`, `alarmRingKey` ; `running` : les chronos en cours, chacun ses paliers `trackingStep`, clé `trackingRingKey` ; `projects` : les projets de l’espace avec leur parent, pour compter les chronos des sous-projets d’une alarme de projet ; « pas de chrono » : aucun ne tourne) ; enregistre les occurrences planifiées comme sonnées | `AlarmCenter`, `ElsewhereNotifier`                |

### `lib/ring-calendar.tsx`

Rappels des éphémérides et des anniversaires.

| Export                                                      | Rôle                                                                                                                                         | Utilisé par                         |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `RemindedSchedule` (type : le type partagé et de quoi lire sa règle, `scheduleRules`), `ringEphemerisReminders(schedules, now, links, workspace?)` | Rappels des éphémérides non archivées (`ephemerisRings` : un créneau n'en sonne aucun ; pour chaque suite de jours d’hier à J+31 depuis son premier horaire ; clé `ephemeris:<id>:<jour>:…` ; toast libellé, jour) | `AlarmCenter`, `ElsewhereNotifier` |
| `RemindedBirthday` (type partagé, réexporté), `ringBirthdayReminders(birthdays, now, links, workspace?)` | Rappels des anniversaires (`birthdayRings` : d’hier à J+31 ; clé `birthday:<contributor\|relation>:<id>:<jour>:…` ; toast `birthdayLabel` (« Anniversaire de Paul — 40 ans »), jour) | `AlarmCenter`, `ElsewhereNotifier` |

### `components/AlarmForm.tsx`

- `AlarmForm({ context, alarm?, defaults?, onDone })` : formulaire de création (« Créer l’alarme ») ou panneau d’une alarme existante enregistré champ par champ (`useFieldSave` : libellé, description et minutes en les quittant, le reste dès qu’il change, projet et tâche ensemble ; `SaveStatus` en tête ; l’alarme du cache suivie, `useAlarms`) — `useAppForm` + `alarmInputSchema` : libellé, type (`SegmentedControl` + aide), minutes de chrono (`optionalNumberProps`) ou `RepetitionField` + `RuleEditor` (date, heure, répétition ; résumé `describeAlarmTiming`), `ProjectSelect` / `TaskSelect` (tâches `timeTasks`), description, « Active ». À l’envoi (`alarmInputOf`) : `legacyFields(recurrence)` ajouté, `minutes` vidé hors chrono ; création par `formCallbacks` (« Alarme créée. »). Pas de mode copie : « Dupliquer » de `AlarmList` (`duplicateRowsAction`) enregistre la copie (`toAlarmInput` + `copyName`), puis ouvre le formulaire sur elle (`cachedItem`, `alarmsQueryKey`, exporté).
- `AlarmDefaults` (interface) : `label`, `projectId`, `taskId` d’une nouvelle alarme.
- Internes : `TYPES` (libellés des types), `TYPE_HELP` (aides), `AlarmFormValues`, `AlarmFormProps`, `alarmFormValues(alarm)`, `alarmInputOf(values)`, `ON_BLUR`.
- Utilisé par `useAlarmForm`.

### `components/AlarmList.tsx`

`AlarmList({ alarms, context, openForm, showTarget = true })` : cartes d’alarmes (libellé, badge « Terminée », `describeAlarm`, « Prochaine : … » via `nextRing`, lien `alarmTarget` si `showTarget`, note), `StateSwitch` actif/inactif, `InlineActions` « Modifier », « Dupliquer », « Supprimer » (`confirmDestructive`). Interne `toAlarmInput(alarm, changes)` : renvoie l’alarme entière avec un changement (interrupteur). Utilisé par `AlarmsPage`, `TaskAlarms`.

### `components/TaskAlarms.tsx`

`TaskAlarms({ task, context })` : section « Alarmes » du panneau d’une tâche (`SubSection`) : alarmes de la tâche (`AlarmList` sans lien), état vide « Aucune alarme pour cette tâche. », « Ajouter une alarme » (défauts : titre de la tâche, de même taille qu’un libellé d’alarme, projet, tâche). Utilisé par `TaskPanel` (tâches).

## hooks

### `hooks/use-alarm-form.tsx`

- `AlarmFormOpener` (type) : `(alarm?, { defaults? }) => void`.
- `useAlarmForm(context)` : ouvre `AlarmForm` dans `openFormPanel` (« Nouvelle alarme », « Alarme ») ; sans contexte : rien. Utilisé par `AlarmsPage`, `TaskAlarms`, `AlarmsCell` (`extra-cells`, tâches), `ChronoCard` (accueil), `QuickActions` (app).

## lib

### `lib/alarm-labels.ts`

| Export                                  | Rôle                                                                                                                          | Utilisé par                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `legacyFields(rule)`                    | Anciens champs (fréquence, intervalle, jours, fin) déduits de la répétition ; `YEARLY` → `MONTHLY` ; aucune règle → `ONCE`    | `AlarmForm`                                     |
| `AlarmTiming` (interface)               | Date, heure et répétition                                                                                                     | `AlarmForm`                                     |
| `describeAlarmTiming(timing)`           | « Le 3 nov. 2026 à 09:00 », « Tous les jours à 07:30 » (`describeRecurrence`)                                                 | `AlarmForm`, `describeAlarm`                    |
| `nextRing(alarm, now)`                  | Prochaine sonnerie (aucune si inactive ou de chrono) via `nextOccurrence`                                                     | `AlarmList`, `nextRings`                        |
| `describeAlarm(alarm)`                  | Programmation lisible, y compris « Toutes les N min de chrono » et « , si aucun chrono ne tourne »                            | `AlarmList`                                     |
| `alarmTaskLabel(task, projectLabel?)`, `alarmTarget(alarm, taskOf, projectOf)` | Réexportés de `@ordo/shared` (`dates/reminder-rings.ts` : aussi les sonneries poussées par le serveur) : « Projet #12 Libellé » ; lien de l’alarme, sa tâche, sinon son projet, ou null | `AlarmList`, `AlarmCenter`, `ElsewhereNotifier` |
| `nextRings(alarms, now)`                | Alarmes qui sonneront encore, avec leur prochaine sonnerie, la plus proche d’abord                                            | `ChronoCard`, `WorkCards` (accueil)             |


### `lib/alarm-sound.ts`

La banque de sonneries, générées en Web Audio, sans fichier.

- `unlockAudioOnGesture()` : crée/reprend l’`AudioContext` au premier `pointerdown` ou `keydown` ; renvoie le nettoyage. Utilisé par `AlarmCenter`.
- `startRingtone(id, { loop, durationMs })` : joue une sonnerie en boucle (toutes les `period` secondes) ou une fois, pendant la durée ; renvoie l’arrêt. Silencieuse tant que l’audio n’est pas débloqué. Seul `startRinging` l’appelle (garde eslint).
- `playRingtone(id)` : une fois (nouveau mail, `MailWatcher`, le carillon).
- `previewRingtone(id)` : « Écouter », depuis le clic (crée l’audio au besoin). Utilisé par `RingSettingsForm`.
- Internes : `resumedAudio()`, `Note`, `arpeggio(...)`, `RINGTONE_NOTES` (notes et période de chaque sonnerie : carillon 880 / 1 175 / 1 568 Hz, bip carré, marimba triangle, cloche avec harmoniques, réveil alterné, harpe en arpège), `playNotes(context, destination, id)` ; variable de module `audio`.

### `lib/ringing.tsx`

La sonnerie de l’app, une brique pour tout ce qui sonne (rappels et alarmes, espace ouvert et autres) : une sonnerie sonne la durée des réglages (en boucle ou une fois), son toast (`notifyAlarm`) reste avec « Arrêter » et « Répéter dans N min » et les liens, et elle resonne N minutes après la fin de chaque sonnerie tant que les réglages la répètent, jusqu’à « Arrêter ». L’API garde l’état de chaque sonnerie (voir [Règles des alarmes](../../../business-rules/activities/alarms.md#état-dune-sonnerie-alarmring)).

| Export                                     | Rôle                                                                                                                                                              | Utilisé par                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `RingTarget`, `RingLink`, `RingEntry` (types) | Page d’un lien (`path`, `workspaceId`) ; lien d’un toast avec sa page ; ce qui commence à sonner (clé, instant dû, titre, lignes, actions, sonnerie, espace) | `ring.tsx`, `MailWatcher`                         |
| `claim(key, ttlMs = 10 min)`               | Réserve une occurrence pour cet onglet dans `localStorage` (premier arrivé), nettoie les clés `ordo.alarm.*` expirées ; sans stockage : vrai                     | `ring.tsx`, `MailWatcher`, ici (`…:again`)        |
| `systemNotification(title, body, tag)`     | Notification système si autorisée                                                                                                                                 | ici, `MailWatcher`                                |
| `configureRinging({ settings, open, workspaceId, restore? })` | Réglages de l’utilisateur, ouverture d’une page, espace ouvert, actions d’une sonnerie remontrée (`KeptRing` : clé, espace )                                                                                           | `AlarmCenter`                                     |
| `openRingTarget(target)`                   | Ouvre la page d’un lien de sonnerie dans son espace (la façon donnée par `configureRinging`)                                                                     | `useCountdownRinger`                              |
| `startRinging(entry)`                      | Sonne maintenant (sauf déjà en cours ou arrêtée) : sonnerie, notification système, toast, fin et prochaine sonnerie planifiées, `sendAlarmRing` (arrêtée ailleurs : s’arrête) | `ringPlannedReminders`, `ringAlarm`, `useCountdownRinger` |
| `stopRing(key)`, `snoozeRing(key)`         | « Arrêter » (pour de bon) et « Répéter dans N min » (`snoozeMinutes`) : ici, dans les autres onglets (`BroadcastChannel` `ordo.alarm`) et l’API                  | boutons du toast                                  |
| `followRings(rings)`, `loadRings()`        | Suit les sonneries gardées par l’API : une arrêtée s’arrête ici ; une mise en attente ailleurs (silencieuse, prochaine sonnerie plus tard d’au moins 5 s, `SNOOZE_DRIFT_MS`) attend ici aussi ; une inconnue ici s’affiche telle quelle (en train de sonner sans son, en attente, ou silencieuse), avec le lien gardé et ses actions refaites (`restore`) | `AlarmCenter`, `lib/push.ts`     |
| `refreshRestoredRings()`                  | Remontre les sonneries remontrées de l’API avec leurs actions refaites (routines et anniversaires chargés) | `AlarmCenter` |
| `ringPushed(key)`                          | Une sonnerie poussée par le serveur pendant que cet onglet est visible (le service worker ne montre alors pas de notification) : `loadRings`, puis elle sonne ici comme les autres (un seul onglet : `claim` `…:again`) | `lib/push.ts`                    |

Internes : `ActiveRing` (sonnerie montrée : début, prochaine, arrêt du son, minuteries), `RingContext`, `RingMessage`, `RING_ICONS` / `ringIcon(key)` (icône selon le genre de la clé : évènement, tâche, routine, éphéméride, anniversaire, minuteur `countdown`, sinon alarme), `quiet`, `show` (toast : en train de sonner, couleur d’avertissement ; en attente, « Sonne à nouveau à HH:MM » ; silencieuse ; un lien cliqué garde le toast), `schedule`, `ringNow`, `record`, `ringAgain` (une répétition ne sonne que dans l’onglet qui la réserve, `ordo.alarm.<clé>:again` pour la durée d’une sonnerie ; les autres la montrent), `finish`, `wait`.

### `lib/ring-routines.tsx`

`RemindedRoutine` (type minimal, routines d'un autre espace aussi, compatible avec le type partagé) ; `markDoneAction(onClick)` : « Marquer comme faite » d’une sonnerie de routine, à sa sonnerie et remontrée (`AlarmCenter`) ; `ringRoutineReminders(routines, now, links, markDone?, defer?, workspace?)` : rappels des routines non archivées planifiés par `routineRings` (partagé), pour chaque occurrence donnée par l'API (`reminderOccurrences` : en cours non faite, et suivante) : les « avant » pour chaque moment non coché (clé `routine:<id>:<échéance>:<moment>:before:<minutes>` ; depuis la fin : avant `endAt`, `…:end:before:<minutes>`), les « À HH:MM » une fois, le premier jour (clé `routine:<id>:<échéance>:at:<HH:MM>` ; depuis la fin : le jour de l’échéance, `…:end:at:<HH:MM>`), reportés par `defer` hors des créneaux permis ; sonne par `ringPlannedReminders` (horaires `windowText` et lieu ; « Marquer comme faite », pour l'occurrence en cours et avec `markDone`, + liens). Utilisé par `AlarmCenter`, `ElsewhereNotifier` (sans `markDone` ni `defer`).

### `lib/push.ts`

Notifications push de cet appareil (Web Push). Le service worker de l’app (`public/push-sw.js`, importé par celui généré : `workbox.importScripts` de `vite.config.ts`) montre les sonneries poussées app fermée.

| Export                                  | Rôle                                                                                                                                       | Utilisé par      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| `pushSupported()`                       | Ce navigateur reçoit-il des notifications push (service worker, Push API, notifications)                                                  | `OutsideRings`   |
| `currentPushSubscription()`             | Abonnement push de cet appareil, s’il y en a un (aucun service worker en développement)                                                   | `OutsideRings`   |
| `deviceLabel(userAgent?)`               | « Chrome · Android » d’après l’agent utilisateur                                                                                           | ici              |
| `subscribeThisDevice(publicKey)`        | Demande l’autorisation, abonne le service worker avec la clé du serveur, donne l’abonnement à l’API ; une erreur dit quoi faire (pas de service worker, autorisation refusée) | `OutsideRings` |
| `unsubscribeThisDevice(devices)`        | Désabonne cet appareil (navigateur et API)                                                                                                 | `OutsideRings`   |
| `listenToPushes()`                      | Écoute le service worker : `ordo.push.ring` → `ringPushed`, `ordo.push.changed` → `loadRings`, `ordo.push.open` → `openRingTarget` ; renvoie l’arrêt | `AlarmCenter` |

Internes : `registration()`, `keyBytes(key)` (base64url → octets), `BROWSERS`, `SYSTEMS`, `PushMessage`.

### `public/push-sw.js` (hors de `src`)

Script classique importé par le service worker généré (`importScripts`), comme `boot-rescue.js` hors du paquet. `push` : un onglet de l’app visible → pas de notification, l’onglet est prévenu (`ordo.push.ring`) et sonne lui-même ; sinon `showNotification(title, { body, tag: 'ordo.alarm.<clé>', renotify, requireInteraction, vibrate, actions, data: { key, path, workspaceId } })` (un test : `ordo.push.test`, sans boutons). `notificationclick` : « Arrêter » / « Répéter dans N min » appellent l’API (`/api/graphql`, `stopAlarmRing` / `snoozeAlarmRing`, cookie de session) puis préviennent les onglets (`ordo.push.changed`) ; un clic sur la notification ouvre sa page dans son espace (une fenêtre de l’app : `ordo.push.open` ; sinon une nouvelle fenêtre sur `<page>?ordo-workspace=<id>`, lu par `features/workspaces/lib/switch.ts`).
