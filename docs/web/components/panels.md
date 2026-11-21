# Panneau latéral et modales

Le panneau latéral de droite, qui reçoit tous les formulaires et détails, et l'ouverture des modales (réservées aux confirmations et questions). Source : `apps/web/src/components/panels/`.

Règle : un formulaire s'ouvre toujours dans le panneau latéral (`openFormPanel`) ; une modale (`openModal`) ne sert qu'aux confirmations. Le panneau d'un élément existant s'enregistre champ par champ (`useFieldSave` de `lib/form.ts`, `SaveStatus`) ; un panneau d'action (une opération faite une fois : utiliser une fiche, faire l'inventaire, ajouter au stock, ajouter des produits) reste un formulaire avec son bouton. eslint interdit `modals.open` et `modals.openConfirmModal` hors de `openModal`.

## `panels.ts`

État des panneaux ouverts, hors de React (une pile en module avec ses abonnés, lue par `useSyncExternalStore`).

- `PanelSize` (type) : `'md'` (formulaire) ou `'lg'` (large, comme le panneau d'une tâche).
- `openFormPanel(title, render, options?)` : ouvre un formulaire dans le panneau de droite, en donnant au contenu la fonction qui le ferme ; rend cette fonction. Options : une taille, ou `{ size, panelId, locked, onClose }` : `panelId` (rouvert avec le même id, il se remplace : le panneau d'un graphique), `locked` (seul le contenu le ferme : formulaire qui demande d'abord s'il faut garder la saisie), `onClose` (après la fermeture, par le bouton, Échap, un clic dehors ou `closePanel`). C'est l'ouverture de tous les formulaires de l'application (~54 fichiers).
- `closePanel(panelId)` : ferme un panneau et appelle son `onClose`.
- `useOpenPanels()` : panneaux ouverts, le dernier au-dessus.
- `PanelFlush` (type) : `() => boolean`, enregistre ce que le contenu d'un panneau n'a pas encore enregistré (un texte en cours de saisie) ; `false` quand un champ est invalide, donc pas enregistré (son erreur dessous).
- `PanelFlushContext` : contexte donné par `SidePanel` à son contenu, l'inscription d'un `PanelFlush` (rend sa désinscription) ; aucun hors d'un panneau.
- `usePanelFlush(flush)` : enregistre ce que le composant n'a pas encore enregistré avant que son panneau se ferme par son bouton, Échap ou un clic dehors (inscrit auprès de `SidePanel`), quand le composant disparaît (panneau fermé par son contenu ou remplacé, autre page), et quand le navigateur quitte la page (`pagehide`, autant que le navigateur laisse partir la requête). Le dernier `flush` donné est appelé. Utilisé par `useFieldSave` (`lib/form.ts`) et `useLocationDraft` (`features/geo`) : un texte tapé sans quitter le champ n'est pas perdu.
- Internes : `OpenPanel` (type), `openPanel` (ajoute ou remplace un panneau), `emit`.

## `SidePanel.tsx`

- `PanelTitle` : titre d'un panneau de droite (texte `sm`, graisse 600), le même dans les panneaux latéraux et les réglages de page (celui du panneau latéral partout). Utilisé par `SettingsAside`.
- `SidePanel` : `Drawer` à droite, marge `lg`, bouton de fermeture « Fermer », `zIndex` 190 (sous les modales : une confirmation demandée depuis un panneau s'affiche par-dessus). Props de `Drawer` sauf position, taille, titre et marge ; `title`, `size`. **Redimensionnable comme la barre de navigation**, par les mêmes briques : poignée `ResizeHandle` « Redimensionner le panneau » sur son bord gauche, `useResizablePanel` avec `SIDE_PANELS[size]` (une largeur gardée par taille, `localStorage` propre à chaque fenêtre) : glisser élargit ou rétrécit, glisser sous la largeur minimale le ferme, double clic sur la poignée : largeur minimale. Largeurs : `md` 640 px par défaut, au moins un quart de la fenêtre et jamais sous 480 px, 1280 px et 90 % de la fenêtre au plus ; `lg` 1152 px par défaut, 640 px au moins, 1920 px et 90 % de la fenêtre au plus. Sur téléphone : toute la largeur, sans poignée. Pendant un redimensionnement : `data-resizing` sur la racine (curseur `col-resize`, pas de sélection). Le panneau ne défile pas lui-même : son corps défile (`SidePanel.module.css`), l'en-tête et la poignée restent. Fermé par son bouton, Échap, un clic dehors ou sa poignée (glissée sous le minimum ; pas un panneau sans bouton de fermeture), il appelle d'abord les `PanelFlush` inscrits par son contenu (`usePanelFlush`) : ce qui n'était pas enregistré l'est ; si un champ est invalide (donc pas enregistré), le panneau reste ouvert la première fois, le champ en erreur (`aria-invalid`) prend le focus, son erreur dessous ; fermé une seconde fois, il se ferme (la valeur invalide n'est pas enregistrée). Le contenu est enveloppé dans un `div` en `display: contents` (recherche du champ en erreur). Utilisé directement par le panneau de tâche et la trésorerie.
- `SidePanelHost` : hôte des panneaux ouverts par `openFormPanel`, placé dans `AppLayout` ; un panneau `locked` n'a ni bouton de fermeture, ni fermeture par Échap ou clic dehors.

## Panneaux redimensionnables

Briques communes à la barre de navigation, aux réglages de page (`AppLayout`, `SettingsAside`, voir [Application](../app.md)) et au panneau latéral. eslint interdit un `useLocalStorage` dont la clé finit par `width` : une largeur de panneau se garde par `useResizablePanel`.

- `panel-widths.ts` :
  - `SIDEBAR_PANEL` : barre de navigation à gauche, 280 px par défaut, 200 px au moins (en dessous elle se ferme), 480 px et 40 % de la fenêtre au plus ; double clic à la largeur minimale : largeur de son contenu (`fitContent`) ; clé `ordo.sidebar.width` ;
  - `SETTINGS_PANEL` : réglages à droite, 640 px par défaut, au moins un quart de la fenêtre et jamais sous 480 px, 1280 px et 90 % de la fenêtre au plus ; clé `ordo.settings.width` ;
  - `SIDE_PANELS` : panneau latéral, par taille : `md` (clé `ordo.panel.md.width`, limites des réglages, 640 px par défaut) et `lg` (clé `ordo.panel.lg.width`, 1152 px par défaut, 640 px au moins, 1920 px et 90 % de la fenêtre au plus).
- `useResizablePanel(options)` : largeur gardée (`localStorage`, propre à chaque fenêtre : une nouvelle fenêtre part de la dernière) d'un panneau sur un côté, avec une poignée sur son bord intérieur : glisser sous le minimum le ferme, revenir le rouvre ; double clic : largeur minimale (et avec `fitContent`, déjà au minimum : largeur du contenu, fonction interne `hiddenWidth`). La largeur affichée reste dans les limites de la fenêtre, la largeur enregistrée reste celle choisie. Rend `{ width, resizing, onResizeStart, onResizeReset }`.
- `ResizeHandle` : poignée (`role="separator"` vertical, libellé accessible) sur le bord d'un panneau : glissée pour redimensionner, double-cliquée pour remettre la largeur ; surlignée au survol et pendant le redimensionnement (transition de couleur sobre). Pas de commande au clavier. `z-index` réglable par `--resize-handle-z-index` (2 par défaut ; 1001 dans le panneau latéral, au-dessus de son en-tête).

## `open-modal.ts`

`openModal(title, render, options?)` : ouvre une modale Mantine (confirmation, question), le contenu recevant sa fonction de fermeture ; rend cette fonction. Options : `size`, `onClose` (après la fermeture, par le contenu, Échap ou un clic dehors). Id unique par modale (`modal-N`). Les modales sont centrées, avec un bouton « Fermer » (`ModalsProvider` d'`AppLayout`). Utilisé par `confirmDestructive`, les mails, la facturation, les tâches, les projets, les fichiers, l'agenda.

À noter : `RepetitionModal` (voir [Répétitions](recurrence.md)) utilise un `Modal` Mantine directement pour tous les réglages de répétition.
