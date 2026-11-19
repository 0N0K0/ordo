# Tâches de fond

Tâches lancées par l'API à intervalles réguliers, tâches périodiques du navigateur, et conditions de leur exécution sur l'hébergement. Sources : `apps/api/src/index.ts`, `apps/api/src/services/workspaces/workspaces.ts` (`schedulePerWorkspace`, `forEachWorkspace`), `apps/api/src/services/mail/scheduled.ts`, `apps/api/src/services/mail/linked.ts`, `apps/api/src/services/accounting/recurring-invoices.ts`, `apps/api/src/services/github/sync.ts`, `docs/deployment.md`.

Voir aussi : [Espaces et accès](workspaces-and-access.md), [Mail](../resources/mail.md), [Comptabilité](../finances/accounting.md), [GitHub](github.md), [Alarmes](../activities/alarms.md).

## Mécanique commune

- Les tâches sont démarrées au lancement de l'API (`apps/api/src/index.ts`), par `schedulePerWorkspace(label, job, { delay, interval, kind? })` : une première exécution `delay` ms après le démarrage, puis toutes les `interval` ms (minuteries Node, pas de cron).
- Chaque exécution parcourt les espaces (d'un type éventuellement) dans l'ordre du sélecteur et lance la tâche **dans** chaque espace (`runInWorkspace`) : les données lues et écrites sont celles de cet espace.
- Une erreur dans un espace est journalisée (« Workspace « X » : … ») et n'arrête pas les autres ; un échec global est journalisé (« Envois programmés en échec. »…) et l'exécution suivante a lieu quand même.
- Rien n'est persisté sur l'état des minuteries : un redémarrage relance tout ; les tâches rattrapent ce qui est dû (dates passées, curseurs).

## Tâches de l'API

| Tâche                                     | Libellé du journal          | Premier passage | Intervalle | Espaces |
| ----------------------------------------- | --------------------------- | --------------- | ---------- | ------- |
| Envois programmés de mails                | « Envois programmés »       | 10 s            | 30 s       | tous    |
| Suivi des conversations liées aux projets | « Suivi des conversations » | 30 s            | 5 min      | tous    |
| Émission des factures récurrentes         | « Factures récurrentes »    | 20 s            | 1 h        | PRO     |
| Synchronisation GitHub                    | « Synchronisation GitHub »  | 30 s            | 10 min     | tous    |

### Envois programmés (`scheduleMailSending`)

- Envoie les mails programmés en attente (`PENDING`) dont l'heure est passée, les plus anciens d'abord, un par un ; un échec d'envoi est journalisé (« Envoi programmé en échec. ») et n'arrête pas les autres.
- Les mails d'une boîte archivée attendent sa restauration.
- Au démarrage, un mail resté « en cours d'envoi » (`SENDING`, interrompu par un redémarrage) passe en échec (`FAILED`) avec le message « Envoi interrompu (redémarrage) : vérifiez s’il est parti avant de le renvoyer. » : il peut être renvoyé à la main, jamais envoyé deux fois automatiquement.

### Suivi des conversations (`scheduleConversationFollowUp`)

- Pour chaque boîte non archivée, lit les nouveaux messages des boîtes de réception et du dossier « Envoyés » (trouvé par son drapeau `\Sent` ou son nom usuel) depuis le dernier passage (curseur `MailFolderCursor` par boîte et dossier, avec `uidValidity`).
- Un message qui répond (en-têtes `In-Reply-To` / `References`) à une conversation liée à un projet est copié dans ce projet (jamais en double) ; un message ne rejoint pas un projet auquel il appartient déjà lui-même.
- Premier passage ou dossier reconstruit : seuls les 200 derniers messages sont examinés.
- Une boîte injoignable est ignorée pour ce passage (« Suivi des conversations : boîte X ignorée. ») ; deux passages ne se chevauchent pas.

### Factures récurrentes (`scheduleRecurringInvoices`)

- Dans chaque espace PRO, émet une facture par date d'émission passée non encore émise (rattrapage après un arrêt), au plus **24 par échéancier et par passage** (un long arrêt n'inonde pas les brouillons).
- La facture est créée depuis le modèle de l'échéancier ; sa date d'échéance est décalée d'autant que sa date d'émission ; elle reste brouillon, ou est validée si l'échéancier le demande (`autoFinalize` ; un échec de validation est journalisé, la facture reste brouillon).
- Seuls les échéanciers actifs et non archivés émettent. Les échéanciers archivés voient leur prochaine date avancée après aujourd'hui sans rien émettre : restaurés, ils reprennent à la prochaine date à venir.
- « Aujourd'hui » est le jour à Paris. Détails : [Comptabilité](../finances/accounting.md).

### Synchronisation GitHub (`scheduleGithubSync`)

- Dans chaque espace qui a une connexion GitHub, synchronise chaque lien de projet activé ; un échec est journalisé et gardé sur le lien (`lastSyncError`, `lastSyncAt`), le résumé du dernier passage aussi (`lastSyncSummary`). Une synchronisation déjà en cours pour un projet est refusée (« Une synchronisation de ce projet est déjà en cours. ») : le passage suivant la reprendra. Détails : [GitHub](github.md).

### Autres travaux en arrière-plan

- Mails d'avis du compte (mot de passe modifié, email modifié, lien de réinitialisation) : envoyés sans bloquer la réponse, échec journalisé (voir [Espaces et accès](workspaces-and-access.md)).
- Purge des sessions expirées : à chaque connexion (pas de minuterie).
- Connexions IMAP : fermées après 5 minutes d'inactivité (`IDLE_MS`, `apps/api/src/services/mail/imap.ts`).
- Les **relances** d'impayés ne sont pas automatiques dans le code actuel : elles s'envoient à la main (`sendRemindersSchema`) ; `docs/deployment.md` les cite parmi les tâches de fond (à vérifier).

## Tâches périodiques du navigateur

Elles ne tournent que lorsque l'application est ouverte :

| Composant                                                                                 | Rôle                                                                                      | Intervalle                                               |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `AlarmCenter` (`apps/web/src/features/alarms/components/AlarmCenter.tsx`)                 | Recharge les alarmes ; vérifie celles qui doivent sonner                                  | 5 min ; 15 s                                             |
| `ElsewhereNotifier` (`apps/web/src/features/workspaces/components/ElsewhereNotifier.tsx`) | Notifications des autres espaces (alarmes, rappels d'agenda des 8 prochains jours, mails) | rechargements périodiques ; vérification toutes les 15 s |
| `MailWatcher` (`apps/web/src/features/mail/components/MailWatcher.tsx`)                   | Nouveaux mails                                                                            | 10 min (`MAIL_CHECK_MS`), et sur demande                 |
| `UpdatePrompt` (`apps/web/src/app/UpdatePrompt.tsx`)                                      | Nouvelle version de l'application (service worker)                                        | 1 h                                                      |

## Hébergement : garder l'app éveillée

Sur o2switch, Passenger endort l'application sans visite : les minuteries s'arrêtent alors (envois programmés, factures récurrentes, synchronisation GitHub, suivi des conversations). Une tâche cron cPanel appelle le site toutes les 5 minutes en production pour la garder éveillée (voir `docs/deployment.md`, « Garder l'app éveillée ») :

```text
*/5 * * * * curl -fsS https://ordo.onoko.dev/ > /dev/null
```

Au réveil, les tâches rattrapent ce qui est dû (premier passage 10 à 30 s après le démarrage).
