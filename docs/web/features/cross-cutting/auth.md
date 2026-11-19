# Code web : connexion

Tous les fichiers de `apps/web/src/features/auth/` : API du compte et de la session, champs de nouveau mot de passe et jauge de robustesse, mise en page et pages hors application, gardes de routes. Fonctionnalités : [Connexion](../../../features/cross-cutting/auth.md), [Mon compte](../../../features/cross-cutting/account.md).

## `api/`

### `api/index.ts`

Fragment `AccountUser` (`id`, `username`, `email`, `pendingEmail`, `contributorId`).

| Export                      | Rôle                                                                                            | Utilisé par                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `AccountUser`               | Type de l’utilisateur.                                                                          | `AccountPage`                                                                        |
| `meQueryKey`                | Clé `['me']`.                                                                                   | `useLogout`, `lib/query-client.ts` (remet `me` à `null` quand la session est perdue) |
| `useMe()`                   | Utilisateur courant ou `null` (déconnecté) ; `staleTime` 5 min, sans nouvel essai.              | gardes, `AccountPage`, `HomePage`, `AppLayout`, `use-task-context`                   |
| `useLogin()`                | `login(identifier, password)` ; place l’utilisateur dans le cache `me`.                         | `LoginPage`                                                                          |
| `useLogout()`               | `logout` ; met `me` à `null` (la garde redirige) et retire toutes les autres requêtes du cache. | `AppLayout`                                                                          |
| `useRequestPasswordReset()` | Demande d’un lien de réinitialisation.                                                          | `ForgotPasswordPage`                                                                 |
| `useResetPassword()`        | Nouveau mot de passe depuis un jeton ; met `me` à `null` (toutes les sessions sont fermées).    | `ResetPasswordPage`                                                                  |
| `useConfirmEmailChange()`   | Confirme un changement d’adresse ; invalide `me`.                                               | `ConfirmEmailPage`                                                                   |
| `useChangePassword()`       | Change le mot de passe.                                                                         | `AccountPage`                                                                        |
| `useChangeUsername()`       | Change l’identifiant ; met à jour `me`.                                                         | `AccountPage`                                                                        |
| `useRequestEmailChange()`   | Lance un changement d’adresse ; met à jour `me` (`pendingEmail`).                               | `AccountPage`                                                                        |
| `useCancelEmailChange()`    | Annule le changement en attente ; met à jour `me`.                                              | `AccountPage`                                                                        |

Interne : `useSetMe()` (écrit l’utilisateur dans le cache `me`).

## `components/`

### `components/NewPasswordFields.tsx`

`NewPasswordFields({ form, userInputs?, autoFocus? })` : champ « Nouveau mot de passe » avec `PasswordStrength`, puis « Confirmation » ; générique sur un formulaire qui a `password` et `confirmation`. Utilisé par `AccountPage` (`PasswordForm`) et `ResetPasswordPage`.

### `components/PasswordStrength.tsx`

`PasswordStrength({ value, userInputs = [] })` : jauge `Progress` et libellé (« Très faible » à « Très fort », couleurs rouge à vert) avec un conseil ; rien quand le champ est vide. Sous `MIN_PASSWORD_LENGTH`, score plafonné à 1 et « Encore N caractères au minimum. » ; sous `MIN_PASSWORD_SCORE`, la première suggestion de zxcvbn.

Internes : `LABELS`, `COLORS`, `loadChecker()` (import dynamique unique de `@ordo/shared/password-strength`, hors du paquet principal, réessayé après un échec), `useStrengthChecker()` (charge l’analyseur au montage), valeur différée par `useDeferredValue`.

## `pages/`

### `pages/AuthLayout.tsx` (+ `AuthLayout.module.css`)

- `AuthLayout()` : carte centrée « Ordo » avec `<Outlet />` sous un `Suspense` (`FormSkeleton` pendant le chargement du code d'une page) ; route parente des pages hors application dans `app/router.tsx`.
- `AuthHeader({ title, description? })` : titre et description d’une carte ; utilisé par chaque page ci-dessous.

### `pages/guards.tsx`

- `RequireAuth()` : route parente de l’application ; chargement → `FullPageLoader` « Chargement » ; sans utilisateur → `Navigate` vers `AUTH_PATHS.login` avec `state.from` (la page demandée).
- `RequireGuest()` : autour de `/login` et `/forgot-password` ; connecté → retour à `state.from` ou à l’accueil.
- Interne : type `FromState`.

### `pages/LoginPage.tsx`

`LoginPage()` : `loginFormSchema` + `useLogin` ; lien vers « Mot de passe oublié ». Les erreurs du serveur vont sous les champs (`formCallbacks`).

### `pages/ForgotPasswordPage.tsx`

`ForgotPasswordPage()` : `forgotPasswordFormSchema` + `useRequestPasswordReset` ; après succès, `NoticeAlert` « Demande envoyée » à la place du formulaire.

### `pages/ResetPasswordPage.tsx`

`ResetPasswordPage()` : lit `?token` (`useSearchParam`) ; `resetPasswordFormSchema` + `NewPasswordFields` ; succès → toast puis `navigate(AUTH_PATHS.login)`. Sans jeton : `ErrorAlert` « Lien invalide ».

### `pages/ConfirmEmailPage.tsx`

`ConfirmEmailPage()` : lit `?token` ; envoie `useConfirmEmailChange` une seule fois (garde `useRef`, les jetons étant à usage unique et StrictMode doublant les effets) ; affiche le chargement, le succès (`NoticeAlert`) ou l’erreur (`ErrorAlert`) ; lien vers `/account`.
