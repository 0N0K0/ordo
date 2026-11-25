# Erreurs

Types d'erreurs renvoyées par l'API, forme des messages, rattachement aux champs de formulaire et équivalents HTTP des routes de fichiers. Sources : `apps/api/src/graphql/errors.ts`, `apps/api/src/routes/http.ts`, `apps/api/src/graphql/builder.ts`, `packages/shared/src/core/rules.ts`.

Voir aussi : [Archivage](archiving.md), [Nommage](naming.md), [Espaces et accès](workspaces-and-access.md).

## Codes d'erreur

Toute erreur destinée à l'utilisateur est une `GraphQLError` créée par `clientError(code, message, extensions?)` : Yoga ne la masque pas, le message est affiché tel quel par le web. Toute autre erreur (bug, panne) est masquée par Yoga côté GraphQL, ou journalisée et renvoyée en 500 sans détail côté routes.

| Code                  | Usage                                                                                                              | HTTP (routes de fichiers) |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| `BAD_USER_INPUT`      | Saisie refusée : schéma zod, règle métier, élément archivé, action indisponible en espace personnel.               | 400                       |
| `INVALID_CREDENTIALS` | Identifiant ou mot de passe incorrect ; mot de passe actuel incorrect.                                             | 400                       |
| `INVALID_TOKEN`       | Lien de réinitialisation ou de confirmation invalide ou expiré.                                                    | 400                       |
| `UNAUTHENTICATED`     | Pas de session (« Connexion requise. »).                                                                           | 401                       |
| `NOT_FOUND`           | Élément introuvable (« X introuvable. »).                                                                          | 404                       |
| `CONFLICT`            | Valeur unique déjà prise (libellé, identifiant, email, numéro…).                                                   | 409                       |
| `TOO_MANY_REQUESTS`   | Limite de tentatives atteinte (« Trop de tentatives. Réessayez dans N min. », extension `retryAfter` en secondes). | 429                       |
| `SERVICE_UNAVAILABLE` | Service externe injoignable (cartographie, serveur mail…).                                                         | 503                       |
| `CONFIRMATION_REQUIRED` | Changement qui supprimerait des données sans confirmation : règle d'une série d'évènements ou d'une routine qui fait disparaître des occurrences ayant des commentaires ou des temps (extension `lost` : `{ times, comments }`) ; transformation d'une tâche en routine ou l'inverse (extension `lost` : `ConversionLoss`, toujours demandée). Le web demande la confirmation et renvoie avec `confirmLoss: true` (`confirm: true` pour une transformation). | —                         |
| `RULE_CHOICE_REQUIRED` | Déplacement d'une répétition le dernier jour du mois à un autre jour (« Celle-ci et les suivantes », « Toutes ») sans sa nouvelle règle (« Cette répétition tombe le dernier jour du mois : choisissez sa nouvelle règle pour la déplacer. », extension `movedRule` : `{ rule, start }`, la règle proposée et le jour d'où elle se montre). Le web demande la règle dans un formulaire et renvoie avec `movedRule`. | —                         |

## Erreurs rattachées à un champ

L'extension `fields` porte un message par chemin de champ (`« label »`, `« lines.0.categoryId »`). Le web l'affiche sous le champ concerné ; sans `fields`, le message part en notification (toast d'erreur, persistant).

- `parseInput(schema, input)` : valide une entrée avec un schéma zod partagé ; en cas d'échec, `BAD_USER_INPUT` « Certains champs sont invalides. » avec le premier message de chaque champ (chemins joints par « . »).
- `parseField(field, schema, value)` : même chose pour un seul champ.
- `fieldError(field, message, fieldMessage?)` : `BAD_USER_INPUT` attaché à un champ (message sous le champ éventuellement plus court).
- `notFound(what, field?)` : « X introuvable. » ; avec `field`, en `BAD_USER_INPUT` sous ce champ (valeur choisie dans un formulaire qui n'existe plus), sinon `NOT_FOUND`.
- `orNotFound(query, what, field?)` : résultat d'une requête ou `notFound`.
- `rethrowUnique(error, message, field = 'label')` : une violation d'unicité Prisma (`P2002`, détectée par `isUniqueConflict`) devient `CONFLICT` avec le message sur le champ ; toute autre erreur est relancée.

## Messages

- Écrits en français, phrase complète terminée par un point, guillemets « » autour des noms cités.
- Messages communs (voir [core](../../shared/cross-cutting/core.md)) : « Le libellé est requis. », « Le nom est requis. », « N caractères maximum. », « La fin doit suivre le début. », « Couleur invalide (format #rrggbb). », « Date invalide. », « Lien invalide (http ou https). ».
- Archivé : un seul message, « Élément archivé : restaurez-le pour le modifier. » (voir [Archivage](archiving.md)).
- Doublon : « Un statut porte déjà ce libellé. », etc. (voir [Nommage](naming.md)).
- Espace personnel : « Indisponible dans un espace personnel (X). » (voir [Espaces et accès](workspaces-and-access.md)).
- Cartographie : « Le service de cartographie ne répond pas. », « Le service de cartographie a répondu N. », « Aucun itinéraire trouvé entre ces deux points. » (`apps/api/src/services/core/geo.ts`).

## Utilitaires

- `done(work)` : résultat `true` d'une mutation booléenne une fois le travail fini.
- `sharedRefusal(error)` : une `UserError` d'un calcul partagé devient `BAD_USER_INPUT` avec son message (un `RuleChoiceRequired`, `RULE_CHOICE_REQUIRED` avec l'extension `movedRule`) ; toute autre erreur est rendue telle quelle (voir [Erreurs des calculs partagés](#erreurs-des-calculs-partagés)).
- `rethrowTimeout(error, message)` : une transaction (`inTransaction`) qui a dépassé son délai de 60 s ou n'a pas pu commencer dans les 10 s (Prisma `P2028` d'une transaction expirée ou non commencée à temps, détectée par `isTransactionTimeout` ; tout est annulé) devient `BAD_USER_INPUT` avec le message donné ; toute autre erreur est relancée. Ainsi l'annulation d'un transfert : « L’annulation a pris trop de temps : rien n’a été changé. Réessayez avec moins de tâches. » (voir [Tâches](../activities/tasks.md#transfert-vers-un-autre-projet)) ; la suppression de tâches : « La suppression a pris trop de temps : rien n’a été supprimé. Réessayez avec moins de tâches. » (voir [Tâches](../activities/tasks.md#suppression)).
- `errorMessage(error)` : texte d'une erreur quelconque (journaux, erreurs stockées comme `lastSyncError` GitHub).
- `userErrorMessage(error, fallback, context)` : message d'une `GraphQLError` (écrit pour l'utilisateur), sinon le message de secours, l'erreur étant journalisée.
- `unauthenticated()`, `tooManyRequests(retryAfter)` : erreurs prêtes à l'emploi.

## Scalaires et validation GraphQL

`apps/api/src/graphql/builder.ts` :

- `Date` : jour `YYYY-MM-DD` existant, sinon « Date must be YYYY-MM-DD. » (erreur de validation GraphQL, en anglais, non destinée à l'utilisateur).
- `DateTime` : instant ISO 8601, sinon « Invalid DateTime. ».
- `JSON` : valeur libre, validée par le résolveur qui la reçoit (schémas partagés).
- `File` : fichier envoyé en requête multipart, entrée seulement.

## Routes de fichiers

`apps/api/src/routes/http.ts` :

- `requireSession` : 401 sans session.
- `sessionRequired` : le même contrôle en middleware, placé avant la lecture du corps d'une requête (exports, envoi de fichiers) : un corps anonyme n'est jamais lu.
- `sendServiceError(res, error, context)` : une `GraphQLError` est renvoyée avec le statut de son code (tableau ci-dessus), en JSON `{ error }` ou en texte si une page est demandée (lien, cadre d'aperçu) ; toute autre erreur est journalisée et renvoyée en 500 sans détail.
- `downloadRoute(produce, context)` : route de téléchargement avec ces deux règles ; messages de journal : « PDF impossible. », « Archive impossible. », « Export PDF impossible. », « Export ICS impossible. », « Relevé impossible. », « Pièce jointe impossible. », « Icône impossible. », « Pièce jointe de mail impossible. ».
- Pièce jointe de mail mal désignée : « Pièce jointe mal désignée. » (`apps/api/src/routes/mail.ts`).

## Erreurs des calculs partagés

Une fonction partagée qui refuse avec un message destiné à l'utilisateur lève une `UserError` (`packages/shared/src/core/rules.ts`), jamais une `Error` simple (règle du lint de `packages/shared`). Ex. `changedScheduleSlot` : « Ce jour est en dehors de la période du créneau. », « La fin doit suivre le début. » (voir [calendar](../../shared/activities/calendar.md)).

- Le web affiche son message (toast ou sous le champ, comme toute erreur).
- L'API la transforme en une seule fois pour tous ses appelants (`sharedRefusal`, `apps/api/src/graphql/errors.ts`) : en `BAD_USER_INPUT` avec son message (le refus d'une répétition le dernier jour du mois déplacée sans sa nouvelle règle, `RuleChoiceRequired`, en `RULE_CHOICE_REQUIRED` avec la règle proposée), dans les réponses GraphQL (`maskError` de Yoga, `apps/api/src/index.ts`) comme dans les routes de fichiers (`sendServiceError`, 400). Un service n'a donc pas à l'attraper.
