# Écarts relevés

Écarts entre le code, l’interface et la documentation, relevés en écrivant la documentation de référence (19 novembre 2026). Les pages de référence décrivent le comportement actuel sans le juger ; cette page liste ce qui semble incohérent, incomplet ou à confirmer. Chaque point renvoie à la page qui décrit le comportement.

## Bugs corrigés

Corrigés par le commit `5e1bc2de`.

- **Agenda : récursion infinie.** `relationIdsOf` (`apps/api/src/services/calendar/calendar-events.ts`) s’appelait elle-même sans condition d’arrêt : toute construction d’occurrence (`toOccurrence`) ou de série (`seriesInput`) échouait. Introduit par le commit `cdb8fcb7`. Voir [Règles de l’agenda](business-rules/activities/calendar.md).
- **Courses : dates de livraison perdues.** `DeliveryForm` (`apps/web/src/features/shopping/components/OrderPanel.tsx`) liait ses dates à `expectedFrom` / `expectedTo` au lieu de `windowFrom` / `windowTo` : les dates saisies n’étaient pas envoyées et les dates existantes ne s’affichaient pas. Voir [Code web des achats](web/features/supplies/shopping.md).

## Règles imposées seulement par l’interface

L’API accepte ce que l’interface empêche.

- **Liste de courses clôturée :** lecture seule dans l’interface ; l’API ne refuse les changements que si la liste est archivée. Voir [Achats](features/supplies/shopping.md) et [Règles des achats](business-rules/supplies/shopping.md).
- **Copie d’une tâche archivée :** `duplicateTask` ne refuse pas une source archivée ; l’interface ne propose la copie que sur les tâches non archivées. Voir [Règles des tâches](business-rules/activities/tasks.md).
- **Déplacement d’un projet archivé :** `moveProject` l’accepte ; l’interface ne le propose pas. Voir [Règles des projets](business-rules/cross-cutting/projects.md).
- **Ouverture et échéance d’une tâche :** l’ordre « Ouverture » / « Échéance » n’est vérifié que par le formulaire (`taskFormSchema`) ; l’API (`assertDateRange`) ne vérifie que début / fin. Voir [Règles des tâches](business-rules/activities/tasks.md).
- **Inventaire :** l’API ne vérifie pas que les articles comptés sont dans l’emplacement choisi ; seule l’interface les filtre. Voir [Règles du stock](business-rules/supplies/stock.md).
- **Occurrence seule d’un évènement récurrent :** `updateCalendarEvent` en `THIS` ignore sans erreur les champs de la série reçus (répétition, calendrier, projet, contributeurs, bénéficiaires, relations, catégories, tâches, rappels) ; depuis le lot 14a, le panneau les met en lecture seule quand il est ouvert sur « Cette occurrence ». Voir [Règles de l’agenda](business-rules/activities/calendar.md) et [Agenda](features/activities/calendar.md).

## Archivage incomplet

- **Tableau de bord archivé :** `deleteDashboard` le supprime, alors que renommer ou déplacer le refuse. Voir [Règles des tableaux de bord](business-rules/resources/dashboards.md).
- **Évènement archivé :** sa suppression n’est pas refusée, alors que modification, annulation et report le sont. Voir [Règles de l’agenda](business-rules/activities/calendar.md).
- **Mouvement de trésorerie archivé :** sa suppression ne vérifie pas l’archivage. Voir [Règles de la trésorerie](business-rules/finances/treasury.md).
- **Listes à cocher :** elles ne vérifient pas l’archivage de leur propriétaire (routine, évènement, tâche). Voir [Règles des fiches](business-rules/supplies/sheets.md).

## Incohérences entre le web et l’API

- **Éditeur d’un texte selon sa taille (décision DO) :** l’introduction et la conclusion d’un document comptable et la description d’un projet ou d’un produit du catalogue sont imprimées ou affichées en markdown mais saisies dans une zone de texte simple. Voir [Nommage](business-rules/cross-cutting/naming.md).
- **Dossier de recherche créé depuis un projet :** l’entrée GraphQL `MailSearchInput` n’a pas de `projectId` ; il n’est pas sûr que le dossier garde la limite au projet. Voir [Règles des mails](business-rules/resources/mail.md).
- **Date de péremption d’un produit :** la description GraphQL de `ShoppingProduct.expiresAt` dit qu’une fois la date passée le produit est marqué manquant ; aucun code ni tâche de fond ne le fait. Voir [Règles des achats](business-rules/supplies/shopping.md).

- **Héritage (lot 13a, décision D11) : ce qui lit encore les valeurs propres.**
  - Occurrences des routines (agenda, rappels, état, coches, « faisable », report des rappels, pertes d’occurrences) : elles se calculent sur les colonnes propres, pas sur le « quand », la condition et l’« Ouverture » hérités ; le lot 13c les fera passer par `effectiveRoutine`. Les exceptions (`moves`) d’une routine qui les hérite s’écrivent encore sur elle.
  - Le web filtre, trie, groupe et exporte les tâches et routines sur leurs champs propres (`assigneeIds`, `priorityId`, `milestoneId`, `projectId`, `slotCondition`…), sauf les dates (`effectiveMinDate`, `effectiveDeadline`) : à passer sur `effective` au lot 13b.
  - GitHub : ce qui est envoyé à GitHub (priorité, échéance, jalon, assignés) reste la valeur propre de la tâche, pas la valeur héritée ; une sous-tâche détachée de son parent par GitHub (parent retiré) ne reçoit pas les valeurs qu’elle héritait.
  - Les liens « relative à » / dépendances des routines restent limités par le projet enregistré, qui est le projet suivi (le projet hérité est recopié), donc sans écart.
  Voir [Tâches](business-rules/activities/tasks.md#héritage), [Routines](business-rules/activities/routines.md#héritage).

## Comportements à confirmer

- **Sens d’une catégorie de trésorerie :** le changement de sens n’est refusé que si des mouvements utilisent la catégorie ; les lignes de répartition ne sont pas vérifiées. Voir [Règles de la trésorerie](business-rules/finances/treasury.md).
- **Suppression d’un contexte de trésorerie :** ses budgets sont supprimés aussi (`onDelete: Cascade`), mais la confirmation de l’interface ne le dit pas. Voir [Règles de la trésorerie](business-rules/finances/treasury.md).
- **Décocher un achat :** retire aussi du stock ce qui avait été ajouté à la main par « Ajouter au stock ». Voir [Règles du stock](business-rules/supplies/stock.md).
- **Commentaires d’un mail :** sans clé étrangère, ils ne sont pas supprimés avec le mail, et le mail n’est pas vérifié à l’ajout (seul un identifiant vide est refusé). Voir [Règles des commentaires](business-rules/cross-cutting/comments.md).
- **Alarme de durée du chrono :** elle compte tout chrono en cours, sans vérifier qu’il porte sur sa tâche ou son projet. Voir [Règles des alarmes](business-rules/activities/alarms.md).
- **PDF des documents :** la forme juridique, le capital et l’immatriculation du profil de la société ne sont pas imprimés, alors que les réglages « Ma société » les présentent comme imprimés et que le commentaire du pied de page parle d’« identité légale ». Voir [Règles de la facturation](business-rules/finances/accounting.md) et [Réglages](features/cross-cutting/settings.md).
- **Message du tableau des tâches vide :** « Créez d’abord un projet : chaque tâche appartient à un projet. », alors que des tâches sans projet existent. Voir [Tâches](features/activities/tasks.md).
- **Anniversaires cités par les conditions de créneaux (lot 16c) :** une personne sans date de naissance est acceptée dans une condition (son anniversaire ne permet aucun moment, comme un type sans créneau), sans avertissement ; une personne supprimée, ou archivée sans date de naissance à elle (une relation archivée dont seul le contributeur lié est daté), est écrite « anniversaire retiré » (son nom n'est plus connu des anniversaires). La confirmation des occurrences perdues, le rechargement des routines et le suivi du contributeur lié sont faits (décision FQ). Voir [Personnes](business-rules/cross-cutting/people.md#coordonnées-date-de-naissance-anniversaire).

## Documentation à mettre à jour ou à compléter
- **Héritage, date vidée exprès :** elle saute le parent mais garde le repli jalon / projet / sprint (comme une tâche du premier niveau) ; à confirmer (l’autre lecture : « aucune » date du tout).


- **Relances d’impayés :** [Déploiement](deployment.md) les cite parmi les tâches de fond, mais le code ne les envoie qu’à la main (`sendRemindersSchema`). Voir [Tâches de fond](business-rules/cross-cutting/background-jobs.md).
- **Suppression d’un client qui a des documents :** refusée par la relation `Restrict` du schéma ; le message affiché n’a pas été relevé. Voir [Règles de la facturation](business-rules/finances/accounting.md).
- **Unicité des libellés dans les arbres :** aucune contrainte dans le schéma pour les projets, tâches, évènements, routines, fiches, listes, comptes, catégories, emplacements et agendas ; à confirmer arbre par arbre. Voir [Noms et libellés](business-rules/cross-cutting/naming.md).
- **Erreurs des fonctions partagées :** certaines lèvent une `Error` simple au message destiné à l’utilisateur ; sa conversion en erreur client par chaque service appelant n’a pas été vérifiée. Voir [Erreurs](business-rules/cross-cutting/errors.md).
- **Partage multi-utilisateur :** aucun rôle ni permission par espace dans le code actuel ; prévu sur la branche `multi-user-sharing`. Voir [Espaces et accès](business-rules/cross-cutting/workspaces-and-access.md). À limiter alors aux espaces de l'utilisateur connecté : les lectures d'autres espaces par `unscopedPrisma` qui prennent aujourd'hui « tout espace autre que l'espace courant » — `foreignScheduleKinds` et `otherWorkspaceSchedules` (`services/calendar/work-schedules.ts`), `assertConditionSchedules` et `loadSlotsOn` (`services/calendar/slot-conditions.ts`), et `settleScheduleChange` (`services/routines/routines.ts`), qui lit et règle les routines des autres espaces par `runInWorkspace`. Lot 16 : de même les contextes du budget partagés entre espaces (`syncKindContexts`, `addSharedContexts`, `assertKindContextsKept` dans `services/treasury/treasury-contexts.ts`, qui prennent « tous les espaces »), et `contextEphemerides` (`services/treasury/treasury-team.ts`), qui lit les éphémérides d'un type d'un autre espace.
- **Dossier `components/address/` vide :** à supprimer, ou à garder pour une brique commune. Voir [Adresses](web/components/address.md).
