# Retours : alertes, états vides, chargements, badges d'état

Briques qui disent l'état de ce qui est affiché : alertes, états vides, pages d'erreur, squelettes de chargement, badges « Archivé », retard et compteurs. Source : `apps/web/src/components/feedback/`. Les toasts sont dans `lib/notify` (voir [lib](../lib.md#notifytsx)), qui reprend les couleurs et icônes de ce dossier.

## Couleurs et icônes

### `feedback-colors.ts`

- `FEEDBACK_COLORS` : couleur de chaque type de retour, commune aux alertes et aux toasts, avec une icône par type : `success` vert, `info` bleu, `warning` orange, `error` rouge.
- `FAVORITE_COLOR` : couleur d'un favori (son étoile pleine), le jaune Mantine du thème (`yellow`). Utilisé par `YesNoIcon`.
- `LATE_COLOR` : couleur d'un retard (accueil, facturation, trésorerie, tâches, routines, badge de navigation…), orange (`FEEDBACK_COLORS.warning`), partout ; seuls les impayés de plus de 45 jours passent au rouge (second palier). Imposée par eslint (pas de `red` / `orange` choisi à la main sur un test `late` / `overdue`).

### `feedback-icons.tsx`

Une icône par type de retour, commune aux alertes et aux toasts : `SuccessFeedbackIcon` (cercle coché), `ErrorFeedbackIcon` (cercle d'avertissement), `InfoFeedbackIcon` (info), `WarningFeedbackIcon` (triangle).

## Alertes

- `ErrorAlert` (`ErrorAlert.tsx`) : erreur affichée dans une page ou un panneau (chargement échoué, lien cassé), alerte rouge avec son icône. Props d'`Alert` sauf `color` et `icon`. Imposée par eslint (`Alert color="red"` interdit). Utilisée par les mails, les tableaux de bord, l'authentification, la facturation…
- `NoticeAlert` (`NoticeAlert.tsx`) : avis dans une page, un panneau ou un formulaire ; `kind` = `'success'` (vert), `'info'` (bleu, aussi « à configurer d'abord ») ou `'warning'` (orange), chacun avec son icône (table interne `KINDS`). Imposée par eslint pour les autres couleurs d'`Alert`.
- `ArchivedNotice` (`ArchivedNotice.tsx`) : bandeau gris (icône archive) d'un élément archivé affiché en lecture seule (formulaire, éditeur, tableau de bord), qui dit comment le restaurer. Props : `title` (facultatif), `children`. Utilisé par les tableaux de bord et la facturation.

## États vides et pages d'erreur

### `EmptyState`

Ce qu'affiche une liste, un tableau ou une section sans contenu (~60 fichiers). Props :

- `message` : ce qui est vide et quoi faire ;
- `icon`, `iconColor` (défaut `gray` ; vert : plus rien à faire) ;
- `action` : seulement une action donnée nulle part ailleurs (« Retour… », « Effacer les filtres ») ; un « Nouveau… » est dans l'en-tête, à droite ;
- `compact` : dans une section, un panneau ou la barre latérale (« Aucun client pour le moment. »), sur une ligne sans cadre (action à droite) ;
- `plain` : centré sans cadre (dans un graphique, une liste de mails).

Par défaut : bloc encadré centré (`Paper`), icône dans un `ThemeIcon` rond.

### `PageMessage`

Page qui ne peut pas s'afficher (introuvable, indisponible dans cet espace) : icône, code HTTP facultatif au-dessus (« 404 »), titre (`h1` taille `h3`), message, et bouton « Retour à l'accueil » (`secondary`, vers `PAGES.home.path`). Utilisé par `NotFoundPage`, `DetailNotFound` et `features/workspaces` (`ProOnly`).

### `DetailNotFound`

Page de détail dont l'élément n'existe pas (supprimé, mauvaise adresse) : `BackLink` vers sa liste au-dessus (si `backTo`), puis `PageMessage` « Introuvable », « `what` n’existe pas ou a été supprimé. » (« supprimée » au féminin). Props : `what` (« Cette fiche »), `feminine` (accord via `agreed`), `backTo`, `backLabel`. Utilisé par les projets, la facturation, les tâches, les achats, les fiches.

### `SaveStatus`

État d'un panneau de détail enregistré champ par champ (`useFieldSave`), en haut du panneau : « Enregistrement… » (petit chargement) pendant un enregistrement, « Enregistré » (coche) sinon ; même place dans les deux cas, lu par les lecteurs d'écran quand il change (`role="status"`). Prop `saving`. Dans l’en-tête de `DetailLayout` pour les tâches, les routines et les évènements. Utilisé par tous les panneaux de détail enregistrés champ par champ (tâches, routines, évènements, temps, alarmes, achats, fiches, facturation, trésorerie, projets, clients, réglages, mail…).

### `RunningPill`

Pastille de l’en-tête de ce qui tourne, la même pour les chronos (`TimerWidget`, point rouge) et les minuteurs (`CountdownWidget`, `tone="countdown"`, point orange) : point qui pulse (gris et immobile en pause, `paused`), sujet (masqué sur téléphone), horloge ; clic : bulle `details` (largeur `detailsWidth`, 380 par défaut) ; puis `controls`. Props : `label` (nom du bouton, « Détails du chrono »), `tone?`, `paused?`, `subject?`, `clock`, `details`, `detailsWidth?`, `controls?`. Styles `RunningPill.module.css` (`running`, `summary`, `dot`).

### `FullPageLoader`

Chargement plein écran (`Center` de hauteur `100dvh` + `Loader`) pendant le chargement de ce dont toute page a besoin (session, espace). Prop `label` (libellé accessible). Utilisé par `features/auth` (gardes) et `features/workspaces` (`WorkspaceGate`). Imposé par eslint.

## Squelettes (`Skeletons.tsx`)

Squelettes de chargement alignés sur le rythme vertical (`--onoko-vertical-step`, 24 px) : la fonction interne `steps(n)` donne `calc(n * var(--onoko-vertical-step))`. Chaque squelette porte `aria-label="Chargement"`. Styles : `Skeletons.module.css`.

| Composant        | Rôle                                                                               | Props                                                                         |
| ---------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `TextSkeleton`   | Lignes de texte (titre, paragraphe, carte), un pas chacune ; dernière ligne à 60 % | `lines` (3), `title` (ligne de titre plus épaisse, 2 pas)                     |
| `TableSkeleton`  | Tableau : en-tête puis lignes de deux pas, largeurs variées en première colonne    | `rows` (5), `columns` (4)                                                     |
| `ListSkeleton`   | Liste (cartes, réglages, dossiers) : éléments d'un pas de plus que leurs lignes    | `items` (3), `lines` (1), `avatar`, `dense` (éléments d'un pas : menu, arbre) |
| `FormSkeleton`   | Formulaire : chaque champ = ligne de libellé + champ (3 pas)                       | `fields` (4)                                                                  |
| `DetailSkeleton` | Détail (panneau, page) : titre, deux lignes, puis champs                           | `fields` (3)                                                                  |
| `BlockSkeleton`  | Bloc de hauteur connue (graphique, agenda, éditeur)                                | `height` (en pas)                                                             |

Composant interne `Line` (barre d'une ligne de texte, un demi-pas d'épaisseur centrée sur un pas). Constante interne `WIDTHS` (largeurs variées des lignes).

## Badges

Tous les badges sont en capitales (défaut de Mantine) ; aucun ne les annule (`tt="none"` interdit).

- `ArchivedBadge` : badge gris « Archivé » / « Archivée » (icône archive) d'un élément archivé (tâche, projet, liste, compte), le même partout (~27 fichiers). Props : `feminine`, `size`.
- `LateBadge` : retard d'une ligne de l'accueil, « 3 j de retard » (`fmt.daysLate`) en orange (`LATE_COLOR`). Props : `due`, `today` (YYYY-MM-DD). Utilisé par `features/home`.
- `ProgressBadge({ done, total, label, size?, color?, withEmpty? })` : avancement « 2/3 », le même partout où des éléments sont faits sur un nombre prévu (pastille « Routines » du menu, routine parente, liste de courses) : clair, `color` (couleur primaire par défaut) tant que tout n’est pas fait, vert ensuite ; `label` en infobulle et pour les lecteurs d’écran ; rien pour un total nul, sauf `withEmpty` (« 0/0 »). Taille `sm` par défaut. Utilisé par `RoutinesNavBadge`, `RoutineGroupProgress` et `ShoppingProgressBadge`. Imposé par eslint (pas de `Badge` « a/b » écrit à la main).
- `CountBadge` : petit compte d'un onglet, d'un bouton ou d'une entrée de navigation (filtres, documents à envoyer, mails non lus) ; rond tant qu'il tient sur un chiffre (taille `xs`), rien pour 0 ou moins. Props : `count`, `color` (défaut couleur primaire), `variant` (`filled` par défaut, `light`), `size` (`xs`), `label` (pour les lecteurs d'écran, « 3 non lus ») ; les autres props vont au badge. Imposé par eslint (pas de `Badge` avec un compte seul).
