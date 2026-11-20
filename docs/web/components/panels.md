# Panneau latéral et modales

Le panneau latéral de droite, qui reçoit tous les formulaires et détails, et l'ouverture des modales (réservées aux confirmations et questions). Source : `apps/web/src/components/panels/`.

Règle : un formulaire s'ouvre toujours dans le panneau latéral (`openFormPanel`) ; une modale (`openModal`) ne sert qu'aux confirmations. Le panneau d'un élément existant s'enregistre champ par champ (décision D22, `useFieldSave` de `lib/form.ts`, `SaveStatus`). eslint interdit `modals.open` et `modals.openConfirmModal` hors de `openModal`.

## `panels.ts`

État des panneaux ouverts, hors de React (une pile en module avec ses abonnés, lue par `useSyncExternalStore`).

- `PanelSize` (type) : `'md'` (formulaire) ou `'lg'` (large, comme le panneau d'une tâche).
- `openFormPanel(title, render, options?)` : ouvre un formulaire dans le panneau de droite, en donnant au contenu la fonction qui le ferme ; rend cette fonction. Options : une taille, ou `{ size, panelId, locked, onClose }` : `panelId` (rouvert avec le même id, il se remplace : le panneau d'un graphique), `locked` (seul le contenu le ferme : formulaire qui demande d'abord s'il faut garder la saisie), `onClose` (après la fermeture, par le bouton, Échap, un clic dehors ou `closePanel`). C'est l'ouverture de tous les formulaires de l'application (~54 fichiers).
- `closePanel(panelId)` : ferme un panneau et appelle son `onClose`.
- `useOpenPanels()` : panneaux ouverts, le dernier au-dessus.
- Internes : `OpenPanel` (type), `openPanel` (ajoute ou remplace un panneau), `emit`.

## `SidePanel.tsx`

- `PanelTitle` : titre d'un panneau de droite (texte `sm`, graisse 600), le même dans les panneaux latéraux et les réglages de page (décision CL). Utilisé par `SettingsAside`.
- `SidePanel` : `Drawer` à droite, largeur `min(40rem, 100%)` (`md`) ou `min(72rem, 100%)` (`lg`), marge `lg`, bouton de fermeture « Fermer », `zIndex` 190 (sous les modales : une confirmation demandée depuis un panneau s'affiche par-dessus). Props de `Drawer` sauf position, taille, titre et marge ; `title`, `size`. Utilisé directement par le panneau de tâche et la trésorerie.
- `SidePanelHost` : hôte des panneaux ouverts par `openFormPanel`, placé dans `AppLayout` ; un panneau `locked` n'a ni bouton de fermeture, ni fermeture par Échap ou clic dehors.

## `open-modal.ts`

`openModal(title, render, options?)` : ouvre une modale Mantine (confirmation, question), le contenu recevant sa fonction de fermeture ; rend cette fonction. Options : `size`, `onClose` (après la fermeture, par le contenu, Échap ou un clic dehors). Id unique par modale (`modal-N`). Les modales sont centrées, avec un bouton « Fermer » (`ModalsProvider` d'`AppLayout`). Utilisé par `confirmDestructive`, les mails, la facturation, les tâches, les projets, les fichiers, l'agenda.

À noter : `RepetitionModal` (voir [Répétitions](recurrence.md)) utilise un `Modal` Mantine directement pour tous les réglages de répétition.
