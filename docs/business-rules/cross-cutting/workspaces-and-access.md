# Espaces de travail et accès

Espaces professionnels et personnels, isolation des données par espace, partage entre espaces (abonnements, notifications), compte utilisateur, connexion, sessions et limites de tentatives. Sources : `apps/api/src/services/workspaces/workspaces.ts`, `apps/api/src/workspace-context.ts`, `apps/api/src/db.ts`, `apps/api/src/services/core/auth.ts`, `apps/api/src/auth/{session,crypto,rate-limit}.ts`, `apps/api/src/graphql/{builder,context}.ts`, `apps/api/src/{env,index,security-headers}.ts`, `apps/api/src/routes/http.ts`, `apps/api/src/graphql/modules/{auth,workspaces}.ts`, `apps/api/src/cli/create-user.ts`, `apps/api/src/services/calendar/{calendars,work-schedules,my-day-settings}.ts`, `packages/shared/src/core/{auth,password-rules,password-strength,workspace}.ts`.

Voir aussi : [Personnes](people.md), [Erreurs](errors.md), [Tâches de fond](background-jobs.md), [Fonctionnalités : espaces](../../features/cross-cutting/workspaces.md), [Fonctionnalités : authentification](../../features/cross-cutting/auth.md).

## Espaces : PRO et PERSO

- Un espace est **professionnel** (`PRO` : facturation, clients, entreprise) ou **personnel** (`PERSO`). Libellé requis, 250 caractères max.
- Un espace personnel refuse la facturation (documents, documents importés, factures récurrentes), les clients, le catalogue et la fiche société : « Indisponible dans un espace personnel (facturation). » / « (clients) » / « (catalogue) » / « (société) » (`requirePro`).
- Un espace PRO ne devient personnel que s'il n'a ni clients, ni documents de facturation, ni documents importés : « Cet espace a des clients ou des documents de facturation : il ne peut pas devenir personnel. ».
- Condition de créneaux des tâches et routines : la même en PRO et en PERSO, sans condition n'importe quand ; les heures de travail de l'espace PRO ne jouent pas sur ce qui est faisable (voir [Agenda](../activities/calendar.md#condition-de-créneaux-des-tâches-et-routines)).
- Les factures récurrentes ne sont émises que dans les espaces PRO.
- Mots du web : « équipe » en PRO, « foyer » en PERSO (membres, voir [Personnes](people.md)).

### Création, modification, suppression

- Création : en dernier du sélecteur ; mise en place (`setUpWorkspace`) : un profil « Moi » pour chaque utilisateur, un premier agenda, les statuts de suivi des documents (PRO), les unités de courses par défaut (« pièce », « kg »…) si l'espace n'en a pas.
- La mise en place est rejouée à chaque modification de l'espace (elle complète sans dupliquer).
- Réglages de l'espace : notifications données quand un autre espace est ouvert (`MAILS` ; alarmes et rappels sonnent toujours, quel que soit l'espace ouvert), semaine (premier et dernier jours), colonnes de départ des vues de tâches, créneaux sans type (libellé, couleur, affichage).
- Ordre : glisser-déposer dans le sélecteur (`moveWorkspace`).
- Suppression : supprime l'espace et **tout son contenu** ; le dernier espace ne peut pas être supprimé (« Le dernier espace ne peut pas être supprimé. »). Les mouvements de trésorerie, leurs règlements et les documents comptables sont supprimés d'abord (ils bloquent la cascade), puis la cascade de la base emporte le reste.
- S'il n'existe aucun espace, un espace « Pro » (PRO) est créé à la première requête.

### Isolation des données

- Chaque requête HTTP travaille dans **un** espace : celui de l'en-tête `x-ordo-workspace`, sinon du cookie `ordo_workspace`, sinon le premier espace (`workspaceMiddleware`). Le middleware passe avant l'authentification.
- Toutes les lignes, sauf `Workspace`, `User`, `Session`, `AuthToken`, `RateLimit`, `AlarmRing` (les sonneries de l’utilisateur, de tous ses espaces), `Countdown` (ses minuteurs, de même) et `PushSubscription` (ses appareils, de même), appartiennent à un espace. Le client Prisma étendu (`apps/api/src/db.ts`) ajoute `workspaceId` à toutes les lectures, mises à jour et suppressions, et donne l'espace à toutes les créations (y compris imbriquées) ; l'espace d'une ligne ne change jamais. Une requête hors espace échoue (« No workspace… », erreur interne).
- `unscopedPrisma` (sans limite) ne sert qu'aux espaces eux-mêmes, aux abonnements entre espaces, aux créneaux et types des autres espaces qu'une condition de créneaux cite (`otherWorkspaceSchedules`, `assertConditionSchedules`) et à la suppression d'un espace. Le SQL brut filtre lui-même par `currentWorkspaceId()`.
- Les tâches de fond tournent espace par espace (`forEachWorkspace`), une erreur dans un espace n'arrêtant pas les autres.

### Partage entre espaces

- **Agendas** : un espace peut afficher en lecture seule un agenda d'un autre espace (abonnement, `CalendarSubscription`, unique par agenda) ; on ne s'abonne pas à son propre agenda (« Ce calendrier appartient déjà à cet espace. »).
- **Créneaux** : un espace peut afficher en lecture seule un type de créneaux d'un autre espace, ou ses créneaux sans type (`WorkScheduleSubscription`) ; pas ses propres créneaux (« Ces créneaux appartiennent déjà à cet espace. ») ; couleur et affichage réglables côté abonné. Une condition de créneaux de tâche ou de routine peut citer les créneaux et types d'un autre espace, abonné ou non ; elle note un tel type `ws:<espace>:<type | default>` (comme les abonnements).
- **Notifications d'ailleurs** : le web interroge les espaces non ouverts (toujours leurs alarmes et les rappels de leurs tâches, routines et évènements ; leurs nouveaux mails s'ils l'ont choisi) et affiche leurs notifications avec un lien vers l'espace (`ElsewhereNotifier`).
- Supprimer l'espace source supprime ses abonnements (cascade).

## Compte et utilisateurs

- Le compte est créé en ligne de commande (`npm run user:create`, `apps/api/src/cli/create-user.ts`) ; refusé s'il existe déjà un compte : « Un compte existe déjà. Ordo ne gère qu’une seule utilisatrice. ». Aucun écran d'inscription.
- Tous les espaces sont accessibles à tout utilisateur connecté ; il n'y a ni rôles ni permissions par espace dans le code actuel (le partage multi-utilisateur est prévu sur la branche `multi-user-sharing`).
- Réglages d'un utilisateur dans un espace (`UserWorkspaceSettings`, une ligne par utilisateur et par espace, celle de « Ma journée ») : lus et écrits seulement par cet utilisateur, dans l'espace de la requête dont il est membre (il y a son profil « Moi ») ; sinon « Espace introuvable. » (voir [Ma journée](../activities/my-day.md#réglages)).
- Identifiant : 3 à 32 caractères `[a-z0-9._-]`, en minuscules, unique ; email unique, en minuscules.

## Accès à l'API

- Toute requête GraphQL exige une session (`authScopes: { loggedIn: true }` sur `Query` et `Mutation`) : sinon `UNAUTHENTICATED` « Connexion requise. ».
- Champs publics (`skipTypeScopes`) : `health`, `me` (renvoie `null` sans session), `login`, `logout`, `requestPasswordReset`, `resetPassword`, `confirmEmailChange`.
- Routes de fichiers (`/api/attachments`, `/api/icons`, `/api/accounting`, `/api/mail`, `/api/exports`, `/api/library`, `/api/treasury`) : 401 sans session.
- **Mode** : l'API tourne en production sauf si `NODE_ENV` vaut `development` ou `test` ; la valeur du `.env` l'emporte sur celle de l'hébergeur (`apps/api/src/env.ts`). Hors production : GraphiQL, introspection, pas de CSP, cookie sans `secure`, détail des erreurs inattendues.
- En production, l'introspection GraphQL est désactivée, GraphiQL et la page d'accueil de Yoga absents ; CSP stricte (`helmet`, `apps/api/src/security-headers.ts`) : valeurs par défaut de `helmet`, images permises depuis `data:`, `blob:` et toute adresse `https:` (tuiles des cartes, images liées dans un texte, images distantes d'un mail une fois autorisées).
- Les fichiers du front servis par Apache (dont `index.html`) reçoivent les mêmes en-têtes par le `.htaccess` de la racine de l'app (`htaccessBlock`, bloc `ordo-security` écrit par `scripts/deploy.sh` à côté des règles de Passenger) : HSTS, `nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, et la CSP sur les pages HTML. Le même bloc redirige tout le HTTP vers HTTPS (301), API comprise, et fixe le cache de ces fichiers : `/assets/*` (noms hachés) gardés un an (`immutable`), la page, `sw.js` et le manifeste toujours revérifiés (`no-cache`). Un fichier de `/assets` absent répond 404, jamais la page.
- Les réponses de l'API sont compressées (`compression` : brotli ou gzip selon le navigateur) ; les PDF, ZIP et images restent tels quels.
- **CORS** désactivé : le front et l'API partagent la même origine, aucun autre site ne peut lire les réponses.
- Un corps de requête n'est lu que pour un utilisateur connecté quand il peut être lourd : envoi de fichiers en GraphQL (multipart) et exports (`sessionRequired`), 401 sinon. Un envoi de fichiers est refusé pendant sa lecture au-delà de 25 Mo par fichier ou de 50 fichiers ; chaque service applique ensuite sa propre limite.

## Connexion et sessions

- Connexion par identifiant **ou** email (contient « @ ») et mot de passe : « Identifiant ou mot de passe incorrect. » (`INVALID_CREDENTIALS`), même temps de réponse que l'utilisateur existe ou non (vérification d'un hash factice).
- Mots de passe hachés en argon2id (64 Mio, 3 passes, 4 voies).
- Session : jeton aléatoire de 32 octets dans le cookie `ordo_session` (`httpOnly`, `sameSite=strict`, `secure` en production), seul son SHA-256 est stocké. Expiration après **14 jours sans activité** ; l'échéance glissante est réécrite au plus une fois par jour. Une session ne dure jamais plus de **90 jours**, même active : passé ce délai, il faut se reconnecter. Une session expirée est supprimée à sa lecture ; toutes les sessions expirées sont purgées à chaque connexion.
- Déconnexion : supprime la session et le cookie, et demande au navigateur de vider son cache du site (`Clear-Site-Data: "cache"`) : les pièces jointes y sont gardées un an.

## Limites de tentatives

Comptées en base (`rate-limiter-flexible`, table `RateLimit`) : un redémarrage ne les remet pas à zéro et tous les processus de l'app les partagent. Si la base échoue, le compte se fait en mémoire. Les compteurs expirés sont supprimés une heure après leur fin.

| Limite                               | Clé         | Seuil                                       |
| ------------------------------------ | ----------- | ------------------------------------------- |
| Connexions échouées                  | IP          | 5 par 15 min (remise à zéro après succès)   |
| Connexions échouées                  | identifiant | 100 par 15 min (remise à zéro après succès) |
| Demandes de réinitialisation         | IP          | 3 par heure                                 |
| Vérifications du mot de passe actuel | utilisateur | 5 par 15 min (remise à zéro après succès)   |

- La limite par identifiant est volontairement très au-dessus de celle par IP : quelques échecs d'un tiers ne verrouillent pas le compte, une attaque répartie sur beaucoup d'adresses reste arrêtée.
- Chaque connexion échouée est journalisée avec son adresse (« Failed login from … »). Une adresse « unknown » signifie que l'hébergeur la masque : toutes les visites partagent alors le même compteur par IP.

Dépassement : « Trop de tentatives. Réessayez dans N min. ».

## Mot de passe

- 12 à 128 caractères et score zxcvbn ≥ 3 (dictionnaires commun et français), l'identifiant et l'email étant pénalisés : message de zxcvbn ou « Mot de passe trop facile à deviner. ».
- **Oubli** : demande par identifiant ou email, toujours « réussie » (pas de sondage des comptes) ; un lien `/reset-password?token=…` valable **30 minutes** est envoyé (mail « Réinitialisation de votre mot de passe »), les anciens liens supprimés.
- **Réinitialisation** : lien invalide ou expiré : « Ce lien est invalide ou a expiré. » (`INVALID_TOKEN`) ; le nouveau mot de passe ferme **toutes** les sessions ; mail « Votre mot de passe a été modifié ».
- **Changement** (connecté) : mot de passe actuel requis (« Mot de passe actuel incorrect. ») ; ferme les **autres** sessions ; même mail d'avis.

## Changements de compte

- Identifiant : mot de passe actuel requis ; pris : « Cet identifiant est déjà utilisé. » (`CONFLICT`).
- Email : mot de passe actuel requis ; identique : « C'est déjà votre adresse actuelle. » ; pris : « Cette adresse est déjà utilisée. ». L'adresse attend confirmation (`pendingEmail`) : lien `/confirm-email?token=…` valable **24 heures** envoyé à la nouvelle adresse (« Confirmez votre nouvelle adresse email »). La confirmation remplace l'adresse, invalide tous les liens en cours et avertit l'ancienne adresse (« Votre adresse email a été modifiée »). Annulation possible (`cancelEmailChange`).
- Les mails d'avis partent en arrière-plan : leur échec est journalisé sans faire échouer l'action (sauf le mail de confirmation d'email, attendu).
