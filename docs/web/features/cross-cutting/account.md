# Code web : mon compte

Le seul fichier de `apps/web/src/features/account/` : la page « Mon compte ». Les requêtes et mutations du compte sont dans `features/auth/api` ([Connexion, code web](auth.md)). Fonctionnalités : [Mon compte](../../../features/cross-cutting/account.md).

## `pages/`

### `pages/AccountPage.tsx`

| Élément                            | Rôle                                                                                                                                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AccountPage()` (export)           | Route `/account` (`PAGES.account`). Lit `useMe()` ; rien tant que l’utilisateur n’est pas chargé. `PageHeader` puis trois `SettingsSection` : « Identifiant », « Adresse email », « Mot de passe ». |
| `UsernameForm({ user })` (interne) | `useAppForm` + `changeUsernameFormSchema` ; `useChangeUsername` ; après succès, réinitialise le formulaire sur le nouvel identifiant. Monté avec `key={user.username}`.                             |
| `EmailForm({ user })` (interne)    | Adresse actuelle, encadré `NoticeAlert` « Confirmation en attente » avec « Annuler le changement » (`useCancelEmailChange`), formulaire `changeEmailFormSchema` + `useRequestEmailChange`.          |
| `PasswordForm({ user })` (interne) | `changePasswordFormSchema` + `useChangePassword` ; `NewPasswordFields` avec `userInputs = [username, email]` (mémorisés).                                                                           |

Briques réutilisées : `useAppForm`, `formCallbacks` (`lib/form`), `toastCallbacks` (`lib/notify`), `FormActions`, `ActionButton`, `NoticeAlert`, `SettingsSection`, `PageHeader`.
