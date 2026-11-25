# Code web de « Ma journée »

Tous les fichiers de `apps/web/src/features/my-day/` : la page « Ma journée » de l’espace courant. Règles : [Règles de « Ma journée »](../../../business-rules/activities/my-day.md). Calculs partagés : [`my-day.ts`](../../../shared/activities/calendar.md#my-dayts--placement-de--ma-journée-), [`my-day-settings.ts`](../../../shared/activities/calendar.md#my-day-settingsts--réglages-de--ma-journée-).

## api

### `api/index.ts`

Fragment `MyDaySettingsFields` (tous les champs de `MyDaySettings`) ; requête `MyDaySettings` ; mutation `UpdateMyDaySettings`.

| Export | Rôle | Utilisé par |
| ------ | ---- | ----------- |
| `myDaySettingsKey` | Clé `['my-day', 'settings']` des réglages (de l’utilisateur, dans l’espace de la fenêtre). | `useMyDaySettings`, `useSaveMyDaySettings` |
| `useMyDaySettings()` | Réglages de « Ma journée » de l’utilisateur dans l’espace courant, tels qu’enregistrés sur le serveur (les valeurs par défaut s’il n’en a jamais enregistré). | pas encore placé dans un écran |
| `useSaveMyDaySettings()` | Enregistre tout le jeu de réglages (`useInvalidatingMutation`) : montré tout de suite (optimiste), remis comme avant si l’enregistrement échoue (l’appelant dit l’erreur), relu en arrière-plan. | pas encore placé dans un écran |
