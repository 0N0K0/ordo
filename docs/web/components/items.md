# Éléments des listes de réglages : avatars, badges, options

Affichage des éléments des listes paramétrables (statuts, catégories, étiquettes, drapeaux…), des fichiers et des liens : avatars, badges, options de sélection avec avatar, archivés exclus. Source : `apps/web/src/components/items/` ; aussi la carte des listes de cartes (`ListCard`). Les listes elles-mêmes (`SettingsList`) sont dans [Réglages](settings.md).

## `ListCard.tsx` et `ListCard.module.css`

`ListCard({ children, onClick?, label?, muted? })` : une carte d’une liste de cartes posées l’une sous l’autre (les colonnes de la page « Alarmes » : une alarme, un minuteur enregistré, un rappel à venir), la même partout : bordée, arrondie (`md`), marges `md`. `muted` : estompée (`--onoko-muted-opacity`, une alarme inactive). Avec `onClick`, toute la carte est un bouton (`Paper` en `button`, nom accessible `label` ou son texte) : teintée sous le pointeur, contour au focus clavier. Utilisé par `AlarmList`, `SavedCountdownCards`, `UpcomingReminderList` (alarmes).

## `ItemAvatar.tsx`

### `ItemAvatar`

Avatar d'un élément (élément de liste de réglages, projet, client) dans une liste, une sélection, une puce ou un en-tête : son image, ou ses initiales sur sa couleur. Image non glissable, ne rétrécit pas. Props : `name` (initiales), `iconUrl`, `color` (défaut gris ; `'initials'` : couleur tirée du nom par Mantine), `size` (défaut 18), `radius` (défaut `sm`), `contain` (image entière, logos clients). ~20 fichiers.

## `ItemBadge.tsx`

### `ItemBadge`

Badge d'un élément de liste de réglages, le même partout : dans sa couleur (léger, `radius="sm"`), son image avant le nom s'il en a une (sinon `leftSection` donné). Sans élément : `empty` ou rien. Props : `item` (`{ label, color?, iconUrl? }`), `empty`, `onClick`, et les props de `Badge`. Utilisé par les projets, les tâches, les mails, l'accueil, la facturation, et les colonnes d'état des tableaux (`stateColumn`).

## `FileBadge.tsx`

### `FileBadge`

Badge d'un fichier, le même partout (pièces jointes, justificatifs, fichiers d'un mail) : trombone, nom coupé à `max` caractères (24 par défaut, nom complet en infobulle), taille facultative (« · 12 Ko », `fmt.fileSize`). Props : `filename`, `size`, `max`, `href` (lien), `external` (nouvel onglet, `EXTERNAL_LINK`), `onClick` (visionneuse, téléchargement), `onRemove` (croix grise `RemoveButton variant="field"`), `badgeSize` (`sm`). Imposé par eslint (un `PaperclipIcon` dans un `FileLink` est interdit). Utilisé par la facturation, les mails, la trésorerie.

## `ItemLinks.tsx`

### `ItemLinks`

Liens d'un évènement, d'une tâche ou d'une routine, affichés pareil partout : leur libellé (sinon leur adresse), coupés à la largeur, ouverts dans un nouvel onglet (`EXTERNAL_LINK`) ; rien sans lien. Prop : `links`. Utilisé par `SubscribedEvent` (agenda) et `TaskLinks` (panneau d'une tâche). Imposé par eslint (un `.links.map` qui dessine des `Anchor`).

## `item-look.tsx`

Options de sélection des éléments d'une liste plate de réglages, avec leur avatar, les archivés exclus sauf la valeur en cours (voir [Archivage](../../business-rules/cross-cutting/archiving.md)).

- `hasAvatar(option)` : l'option montre un avatar si elle a une couleur ou une image.
- `itemRenderOption(options)` : rendu (`renderOption`) des options : avatar si besoin, libellé tronqué.
- `itemOptions(items, label?, keep?)` : options (`value` = id, `label`, `color` défaut `gray`, `iconUrl`) des éléments non archivés (`unarchived`), plus les valeurs en cours `keep`.
- `itemChoices(items, label?)` : choix d'un filtre de colonne : tous les éléments (les archivés gardent leur libellé dans les groupes et les filtres enregistrés), les archivés marqués `archived: true` pour que le filtre ne les propose que s'ils y sont déjà.
- `listSelectProps(items, label?, keep?)` : props `data` + `renderOption` d'un `Select` ou `MultiSelect` de ces éléments.
- `chosenAvatar(items, value, label?)` : avatar de l'élément choisi, à mettre avant la valeur.
- `itemSelectProps(items, value, label?, keep = value)` : props d'un `Select` d'un seul élément : `listSelectProps` + `leftSection` = avatar du choix. ~16 fichiers, surtout la trésorerie.
- Types internes : `ItemOption` (option avec `color`, `iconUrl`), `OptionItem` (élément d'entrée : `id`, `label`, `color`, `iconUrl`, `archived`), `KeptValues`.

eslint impose `itemSelectProps` / `chosenAvatar` (avatar de choix écrit à la main interdit) et `itemChoices`.
