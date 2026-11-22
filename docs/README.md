# Documentation d’Ordo

Référence de l’application : ce qu’elle permet de faire, les règles qu’elle applique, et le rôle de chaque morceau du code web et du code partagé. Les dossiers suivent les groupes du menu de l’application : Activités, Économat, Finances, Ressources, plus ce qui est transversal.

- [Déploiement](deployment.md) : hébergement, environnements, mise en production.
- [Redondances du code](code-redundancies.md) : ce qui reste en double ou contourne une brique commune dans le code.
- [Écarts relevés](discrepancies.md) : bugs, incohérences et points à confirmer relevés en écrivant cette documentation.

Chaque page dit la règle telle qu’elle est : ni lettre de décision, ni lot, ni date, ni historique. `npm run lint` (à la racine) le vérifie par `scripts/check-docs.mjs`, qui refuse aussi un lien relatif ou une ancre qui ne mène nulle part ; la règle des références au plan est celle du code (`PLAN_REFERENCE` de `packages/shared/eslint-rules.js`).

## Fonctionnalités

Ce que l’utilisateur peut faire, écran par écran : pages, tableaux, formulaires, actions, différences PRO / PERSO.

- **Activités** : [Alarmes](features/activities/alarms.md) · [Agenda](features/activities/calendar.md) · [Routines](features/activities/routines.md) · [Tâches](features/activities/tasks.md) · [Temps passé et chrono](features/activities/time.md)
- **Économat** : [Fiches](features/supplies/sheets.md) · [Achats](features/supplies/shopping.md) · [Inventaire](features/supplies/stock.md)
- **Finances** : [Facturation](features/finances/accounting.md) · [Trésorerie](features/finances/treasury.md)
- **Ressources** : [Tableaux de bord](features/resources/dashboards.md) · [Documents (bibliothèque)](features/resources/library.md) · [Mails](features/resources/mail.md)
- **Transversal** : [Mon compte](features/cross-cutting/account.md) · [Connexion et mot de passe](features/cross-cutting/auth.md) · [Bénéficiaires](features/cross-cutting/beneficiaries.md) · [Commentaires](features/cross-cutting/comments.md) · [Fichiers : visionneuse et téléchargement](features/cross-cutting/files.md) · [Lieux, adresses et trajets](features/cross-cutting/geo.md) · [GitHub](features/cross-cutting/github.md) · [Accueil](features/cross-cutting/home.md) · [Projets et clients](features/cross-cutting/projects.md) · [Paramètres](features/cross-cutting/settings.md) · [Espaces](features/cross-cutting/workspaces.md)

## Règles métier

Ce que l’API et les schémas partagés imposent : validations, calculs, archivage, suppressions, messages d’erreur, tâches de fond.

- **Activités** : [Règles des alarmes](business-rules/activities/alarms.md) · [Règles de l’agenda](business-rules/activities/calendar.md) · [Règles des routines](business-rules/activities/routines.md) · [Règles métier — Tâches](business-rules/activities/tasks.md) · [Règles métier — Automatisations des tâches](business-rules/activities/task-automations.md) · [Règles métier — Temps passé et chrono](business-rules/activities/time.md)
- **Économat** : [Règles des fiches](business-rules/supplies/sheets.md) · [Règles des achats](business-rules/supplies/shopping.md) · [Règles du stock](business-rules/supplies/stock.md)
- **Finances** : [Règles métier de la facturation](business-rules/finances/accounting.md) · [Règles de la trésorerie](business-rules/finances/treasury.md)
- **Ressources** : [Règles des tableaux de bord](business-rules/resources/dashboards.md) · [Règles de la bibliothèque](business-rules/resources/library.md) · [Règles métier des mails](business-rules/resources/mail.md)
- **Transversal** : [Archivage](business-rules/cross-cutting/archiving.md) · [Tâches de fond](business-rules/cross-cutting/background-jobs.md) · [Règles métier — Commentaires](business-rules/cross-cutting/comments.md) · [Dates : jours, périodes, semaines, fuseaux, répétitions](business-rules/cross-cutting/dates.md) · [Erreurs](business-rules/cross-cutting/errors.md) · [Fichiers et pièces jointes](business-rules/cross-cutting/files-and-attachments.md) · [Règles métier : lieux, adresses et trajets](business-rules/cross-cutting/geo.md) · [Règles métier : liaison et synchronisation GitHub](business-rules/cross-cutting/github.md) · [Nommage : libellés, noms, doublons, limites](business-rules/cross-cutting/naming.md) · [Ordre manuel](business-rules/cross-cutting/ordering.md) · [Personnes : contributeurs, « Moi », membres, relations, assignés, bénéficiaires](business-rules/cross-cutting/people.md) · [Règles métier : projets, clients, statuts, catégories, ressources, contributeurs](business-rules/cross-cutting/projects.md) · [Espaces de travail et accès](business-rules/cross-cutting/workspaces-and-access.md) · [Règles métier : espaces (PRO / PERSO) et changement d’espace](business-rules/cross-cutting/workspaces.md)

## Code web

Chaque fichier, composant, hook, fonction et constante de `apps/web/src`, avec son rôle.

- [Application](web/app.md) : routes, mise en page, thème, conventions du code.
- [Utilitaires](web/lib.md) : `apps/web/src/lib`.
- **Composants communs** : [Actions : boutons, menus, pliage](web/components/actions.md) · [Adresses (composants communs)](web/components/address.md) · [Fil de commentaires (composant commun)](web/components/comments.md) · [Tableau de données (composants web)](web/components/data-table.md) · [Dialogues et boutons de formulaire](web/components/dialogs.md) · [Glisser-déposer (composants web)](web/components/dnd.md) · [Retours : alertes, états vides, chargements, badges d'état](web/components/feedback.md) · [Filtres (composants web)](web/components/filters.md) · [Héritage : champs hérités d’un parent](web/components/inheritance.md) · [Champs de saisie communs](web/components/inputs.md) · [Éléments des listes de réglages : avatars, badges, options](web/components/items.md) · [Markdown : éditeur, rendu, références](web/components/markdown.md) · [Montants signés](web/components/money.md) · [Structure des pages : en-têtes, sections, tuiles](web/components/page.md) · [Panneau latéral et modales](web/components/panels.md) · [Personnes : sélections, clés, libellés](web/components/people.md) · [Répétitions : règles, cas, durées](web/components/recurrence.md) · [Réglages (composants web)](web/components/settings.md) · [Onglets (composants web)](web/components/tabs.md) · [Arbres (composants web)](web/components/tree.md)

### Fonctionnalités

`apps/web/src/features/<fonctionnalité>`, rangées comme le menu.

- **Activités** : [Code web des alarmes](web/features/activities/alarms.md) · [Code web de l’agenda](web/features/activities/calendar.md) · [Code web : routines](web/features/activities/routines.md) · [Code web — Tâches](web/features/activities/tasks.md) · [Code web — Temps passé](web/features/activities/time.md) · [Code web des minuteurs et des temps morts](web/features/activities/countdowns.md)
- **Économat** : [Code web : fiches](web/features/supplies/sheets.md) · [Code web : achats](web/features/supplies/shopping.md) · [Code web : inventaire](web/features/supplies/stock.md)
- **Finances** : [Code web de la facturation](web/features/finances/accounting.md) · [Code web de la trésorerie](web/features/finances/treasury.md)
- **Ressources** : [Code web des tableaux de bord](web/features/resources/dashboards.md) · [Code web de la bibliothèque](web/features/resources/library.md) · [Code web : mails](web/features/resources/mail.md)
- **Transversal** : [Code web : mon compte](web/features/cross-cutting/account.md) · [Code web : connexion](web/features/cross-cutting/auth.md) · [Code web : bénéficiaires](web/features/cross-cutting/beneficiaries.md) · [Code web — Commentaires](web/features/cross-cutting/comments.md) · [Code web : fichiers](web/features/cross-cutting/files.md) · [Code web : lieux, adresses et trajets](web/features/cross-cutting/geo.md) · [Code web : GitHub](web/features/cross-cutting/github.md) · [Code web : accueil](web/features/cross-cutting/home.md) · [Code web : projets et clients](web/features/cross-cutting/projects.md) · [Code web : espaces](web/features/cross-cutting/workspaces.md)

## Code partagé

`packages/shared/src` (`@ordo/shared`), utilisé par le web et l’API : schémas, constantes, calculs.

- **Activités** : [Paquet partagé : `calendar`](shared/activities/calendar.md) · [Paquet partagé : `routines`](shared/activities/routines.md) · [Paquet partagé : `tasks`](shared/activities/tasks.md)
- **Économat** : [Paquet partagé : `shopping`](shared/supplies/shopping.md)
- **Finances** : [Paquet partagé : `accounting`](shared/finances/accounting.md)
- **Ressources** : [Paquet partagé : `dashboards`](shared/resources/dashboards.md) · [Paquet partagé : `mail`](shared/resources/mail.md)
- **Transversal** : [Paquet partagé : `core`](shared/cross-cutting/core.md) · [Paquet partagé : `dates`](shared/cross-cutting/dates.md) · [Paquet partagé : `tables`](shared/cross-cutting/tables.md)
