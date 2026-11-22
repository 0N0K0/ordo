# Code web : mon compte

Les fichiers de `apps/web/src/features/account/` : la page « Mon compte » et le formulaire de la sonnerie. Les requêtes et mutations du compte sont dans `features/auth/api` ([Connexion, code web](auth.md)). Fonctionnalités : [Mon compte](../../../features/cross-cutting/account.md).

## `pages/`

### `pages/AccountPage.tsx`

| Élément                            | Rôle                                                                                                                                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AccountPage()` (export)           | Route `/account` (`PAGES.account`). Lit `useMe()` ; rien tant que l’utilisateur n’est pas chargé. `PageHeader` puis quatre `SettingsSection` : « Identifiant », « Adresse email », « Mot de passe », « Sonnerie des alarmes » (`RingSettingsForm`, réglages lus par `readRingSettings`). |
| `UsernameForm({ user })` (interne) | `useAppForm` + `changeUsernameFormSchema` ; `useChangeUsername` ; après succès, réinitialise le formulaire sur le nouvel identifiant. Monté avec `key={user.username}`.                             |
| `EmailForm({ user })` (interne)    | Adresse actuelle, encadré `NoticeAlert` « Confirmation en attente » avec « Annuler le changement » (`useCancelEmailChange`), formulaire `changeEmailFormSchema` + `useRequestEmailChange`.          |
| `PasswordForm({ user })` (interne) | `changePasswordFormSchema` + `useChangePassword` ; `NewPasswordFields` avec `userInputs = [username, email]` (mémorisés).                                                                           |

## `components/`

### `components/RingSettingsForm.tsx`

`RingSettingsForm({ settings })` (export) : réglages de la sonnerie, `useAppForm` + `ringSettingsSchema`, enregistrés champ par champ (`useFieldSave`, `ringMinutes` et `repeatMinutes` en les quittant, `SaveStatus`) par `useUpdateRingSettings` (`features/auth/api`, met à jour `me`) ; « Sonnerie » : `RingtoneSelect` `withSettings={false}` (avec « Écouter ») ; « Sonner hors de l’app » : `OutsideRings` (valeur du formulaire, changée par `setFieldValue`, donc enregistrée comme les autres).

### `components/OutsideRings.tsx`

`OutsideRings({ checked, onChange })` (export) : l’interrupteur « Sonner hors de l’app » ; allumé, `subscribeThisDevice` (autorisation, abonnement, `sendPushSubscription`), éteint, `unsubscribeThisDevice`, puis `onChange` (une erreur : toast, l’interrupteur ne change pas ; `useAsyncAction`). Encarts (`NoticeAlert`) : push désactivé sur le serveur (`pushPublicKey` null), navigateur sans push. Réglage allumé : les appareils (`usePushConfig`), `EmptyState` sans appareil, « Recevoir sur cet appareil ». Internes : `useThisEndpoint(refresh)` (endpoint de l’abonnement de cet appareil), `DeviceRow({ device, here })` (libellé, « Cet appareil », dates, « Tester » : `usePushMutations().test` ; « Retirer » : `confirmDestructive`, cet appareil désabonné aussi).

Briques réutilisées : `useAppForm`, `useFieldSave`, `SaveStatus`, `useAsyncAction`, `confirmDestructive`, `EmptyState`, `formCallbacks` (`lib/form`), `toastCallbacks` (`lib/notify`), `FormActions`, `ActionButton`, `NoticeAlert`, `SettingsSection`, `PageHeader`.
