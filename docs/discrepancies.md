# Écarts relevés

Écarts entre le code, l’interface et la documentation, relevés en écrivant la documentation de référence. Les pages de référence décrivent le comportement actuel sans le juger ; cette page liste ce qui semble incohérent, incomplet ou à confirmer. Chaque point renvoie à la page qui décrit le comportement.

## Incohérences entre le web et l’API

- **Éditeur d’un texte selon sa taille :** un texte imprimé ou affiché en markdown se saisit dans l’éditeur markdown ; l’introduction et la conclusion d’un document comptable et la description d’un projet ou d’un produit du catalogue sont pourtant saisies dans une zone de texte simple. Voir [Nommage](business-rules/cross-cutting/naming.md). _A aligner avec le reste_
- **Date de péremption d’un produit :** la description GraphQL de `ShoppingProduct.expiresAt` dit qu’une fois la date passée le produit est marqué manquant ; aucun code ni tâche de fond ne le fait. Voir [Règles des achats](business-rules/supplies/shopping.md). _il faut enlever la doc, un produit périmé n'est pas forcément manquant_

## Formulaires de données hors de la disposition commune

Règle : tout formulaire de données suit `DetailLayout` (en-tête, contenu principal, côté en groupes titrés), voir [Application web](web/app.md#formulaires-et-modales). Aujourd'hui seuls les panneaux d'une tâche, d'une routine et d'un évènement la suivent. Ne la suivent pas encore, par domaine (à reprendre avec chaque chantier) :

- **Économat** : listes d'achats, produits et articles, livraisons et commandes (`features/shopping`), stock (`features/stock`), fiches et listes à cocher (`features/sheets`).
- **Finances** : documents comptables, clients et contacts, catalogue, échéanciers (`features/accounting`) ; mouvements, lignes, budgets, comptes, relations (`features/treasury`).
- **Ressources** : mails et dossiers de recherche (`features/mail`), tableaux de bord (`features/dashboards`) ; la bibliothèque (`features/library`) sera refaite.
- **Activités, en dehors des trois panneaux** : alarmes (`AlarmForm`), minuteurs (`CountdownForm`), temps passés (`features/time`), créneaux et éphémérides (`features/calendar`, panneaux d'un créneau et d'une occurrence), personnes (contributeurs, membres, proches), projets (`ProjectForm`), espaces (`features/workspaces`).

## Comportements à confirmer

- **Sens d’une catégorie de trésorerie :** le changement de sens n’est refusé que si des mouvements utilisent la catégorie ; les lignes de répartition ne sont pas vérifiées. Voir [Règles de la trésorerie](business-rules/finances/treasury.md). _il ne faudrait pas obliger à retirer toutes les lignes de la répartition pour pouvoir changer de sens_
- **Suppression d’un contexte de trésorerie :** ses budgets sont supprimés aussi (`onDelete: Cascade`), mais la confirmation de l’interface ne le dit pas. Voir [Règles de la trésorerie](business-rules/finances/treasury.md). _à corriger_
- **Unité renommée ou supprimée :** les unités se règlent aussi dans les paramètres des fiches et de l’inventaire, mais renommer une unité ne la renomme que dans les produits et les éléments des listes d’achats, et la supprimer ne la retire que d’eux : les éléments de fiches, les articles du stock et les éléments des listes à cocher gardent l’ancien libellé (leur usage n’est donc pas compté). Voir [Règles des achats](business-rules/supplies/shopping.md#unités). _à confirmer_
- **Décocher un achat :** retire aussi du stock ce qui avait été ajouté à la main par « Ajouter au stock ». Voir [Règles du stock](business-rules/supplies/stock.md). _à corriger_
- **Commentaires d’un mail :** sans clé étrangère, ils ne sont pas supprimés avec le mail, et le mail n’est pas vérifié à l’ajout (seul un identifiant vide est refusé). Voir [Règles des commentaires](business-rules/cross-cutting/comments.md). _à corriger_
- **PDF des documents :** la forme juridique, le capital et l’immatriculation du profil de la société ne sont pas imprimés, alors que les réglages « Ma société » les présentent comme imprimés et que le commentaire du pied de page parle d’« identité légale ». Voir [Règles de la facturation](business-rules/finances/accounting.md) et [Réglages](features/cross-cutting/settings.md). _à corriger_
- **Personnes liées dans des états différents :** un contributeur et sa relation déjà enregistrés l'un archivé, l'autre non, le restent (aucune migration ne les aligne) ; le prochain archivage ou la prochaine restauration de l'un met l'autre dans le même état. Voir [Archivage](business-rules/cross-cutting/archiving.md#personnes-liées). _passer, rien n'est archivé pour l'instant en prod_
- **Durée « Jusqu’à un jour » sans numéro de jour :** une durée enregistrée sans jour (données anciennes, `day` vide) affiche 1 dans le champ (`DurationFields`), alors que le calcul prend le jour du premier jour de l’occurrence (`spanEnd`) et que son libellé reste vide (« jusqu’au »). Voir [Dates](business-rules/cross-cutting/dates.md#répétitions). _à corriger_
- **Lien de routine d’un jour qui montre plusieurs occurrences perdues :** quand une série décalée perd des occurrences, un lien de routine dont le jour montre plusieurs occurrences de l’évènement part par son jour (vers la série qui a ce jour, sinon celle de l’occurrence modifiée), même si toutes ces occurrences sont perdues et leurs commentaires supprimés. Voir [Agenda](business-rules/activities/calendar.md). _à confirmer_

## Écarts relevés par les tests

Chacun est gardé par un test marqué `it.fails` (voir [Tests](README.md#tests)) : corrigé, ce test échoue et se remet en test ordinaire.

Aucun pour l’instant.

## Documentation à mettre à jour ou à compléter

- **Relances d’impayés :** [Déploiement](deployment.md) les cite parmi les tâches de fond, mais le code ne les envoie qu’à la main (`sendRemindersSchema`). Voir [Tâches de fond](business-rules/cross-cutting/background-jobs.md). _à corriger_
- **Suppression d’un client qui a des documents :** refusée par la relation `Restrict` du schéma ; le message affiché n’a pas été relevé. Voir [Règles de la facturation](business-rules/finances/accounting.md). _à corriger_
- **Unicité des libellés dans les arbres :** aucune contrainte dans le schéma pour les projets, fiches, listes, comptes, catégories et emplacements ; à confirmer arbre par arbre (les tâches, évènements et routines n’ont pas de libellé unique ; les calendriers en ont un). Voir [Noms et libellés](business-rules/cross-cutting/naming.md). _pas d'unicité pour les emplacement ; unicité pour les comptes ; projets fiches, listes et catégories à voir plus tard_
- **Partage multi-utilisateur :** aucun rôle ni permission par espace dans le code actuel ; prévu sur la branche `multi-user-sharing`. Voir [Espaces et accès](business-rules/cross-cutting/workspaces-and-access.md). À limiter alors aux espaces de l'utilisateur connecté : les lectures d'autres espaces par `unscopedPrisma` qui prennent aujourd'hui « tout espace autre que l'espace courant » — `foreignScheduleKinds` et `otherWorkspaceSchedules` (`services/calendar/work-schedules.ts`), `assertConditionSchedules` et `loadSlotsOn` (`services/calendar/slot-conditions.ts`), et `settleScheduleChange` (`services/routines/routines.ts`), qui lit et règle les routines des autres espaces par `runInWorkspace`. De même les contextes du budget partagés entre espaces (`syncKindContexts`, `addSharedContexts`, `assertKindContextsKept` dans `services/treasury/treasury-contexts.ts`, qui prennent « tous les espaces »), et `contextEphemerides` (`services/treasury/treasury-team.ts`), qui lit les éphémérides d'un type d'un autre espace. Les sonneries hors de l'app (`services/tasks/outside-rings.ts`) sont poussées à tous les utilisateurs pour tous les espaces : à limiter aux espaces de chacun. Les minuteurs (`services/tasks/countdowns.ts`, `startCountdown`) enregistrent l'espace (`workspaceId`) et le lien (`path`) envoyés sans les vérifier côté serveur (espace de l'utilisateur, chemin de l'app). Le « Moi » des conditions des règles d'automatisation des tâches est celui du premier utilisateur (`firstUserContributorId`) : à revoir (l'utilisateur qui agit, ou l'auteur de la règle).
- **Dossier `components/address/` vide :** à supprimer, ou à garder pour une brique commune. Voir [Adresses](web/components/address.md). _il devrait contenir un composant puisque les adresses sont utilisées dans les clients, leurs services et la société_
