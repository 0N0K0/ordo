# Code web : lieux, adresses et trajets

Tous les fichiers de `apps/web/src/features/geo/` : API des lieux, de la recherche d’adresses et des trajets, champ d’adresse, carte Leaflet, gestion des lieux, calcul et champ des trajets. Fonctionnalités : [Lieux](../../../features/cross-cutting/geo.md) ; règles : [Règles des lieux](../../../business-rules/cross-cutting/geo.md).

## `api/`

### `api/index.ts`

| Export                         | Rôle                                                                                                                                                                  | Utilisé par                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `Place`                        | Lieu ou zone de la requête `Places` (`id`, `archived`, `label`, `address`, `parentId`, `lat`, `lon`, `path`, `color`, `iconUrl`, `position`).                         | composants du dossier                               |
| `AddressSuggestion`            | Adresse proposée (`address`, `label`, `lat`, `lon`).                                                                                                                  | —                                                   |
| `placesInTree(places)`         | Lieux dans l’ordre de l’arbre (chaque lieu suivi de ses zones), avec `depth` ; un parent absent compte comme racine.                                                  | `AddressInput`                                      |
| `rootPlace(place, byId)`       | Lieu à adresse qui contient une zone (lui-même pour un lieu).                                                                                                         | `AddressInput`                                      |
| `zonesText(root, zones)`       | Texte « Maison › Cuisine, Salle de bain » (séparateur `LEVEL`, zones séparées par « , »).                                                                             | `AddressInput`                                      |
| `zonesOfText(text, places)`    | Inverse : lieu et zones nommés par un texte, ou `null`.                                                                                                               | `AddressInput`                                      |
| `usePlaces()`                  | Requête des lieux (clé `['places']`).                                                                                                                                 | `AddressInput`, `PlacesManager`, `TravelCalculator` |
| `useAddressSearch(text, near)` | Recherche d’adresses à partir de 3 caractères, attente de 350 ms annulée par la frappe suivante, résultats gardés 5 min et précédents affichés pendant le chargement. | `AddressInput`                                      |
| `reverseAddress(point)`        | Adresse d’un point.                                                                                                                                                   | `pickedAddress`                                     |
| `pickedAddress(point)`         | Règle commune d’un clic sur la carte : `{ label, address }`, l’adresse trouvée sinon les coordonnées à 5 décimales ; un échec est signalé par `notifyFailure`.        | `EventLocation`, `PlacesManager`                    |
| `travelTime(from, to, mode)`   | Durée et distance d’un trajet.                                                                                                                                        | `TravelCalculator`                                  |
| `usePlaceMutations()`          | `{ save, remove, move }` invalidant `['places']`.                                                                                                                     | `PlacesManager`                                     |

Internes : `placesKey`, documents GraphQL `Places`, `SearchAddresses`, `ReverseAddress`, `TravelTime`, `SavePlace`, `MovePlace`, `DeletePlace`, `ZONE_SEPARATOR`.

## `components/`

### `components/AddressInput.tsx`

| Élément                                                                                                               | Rôle                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AddressValue` (export)                                                                                               | `{ text, point }` : texte saisi ou choisi, point quand il vient d’un lieu ou d’une recherche.                                                                                                                                                                                                                                                                                             |
| `AddressInput({ value, onChange, placeholder?, withPlaces = true, withinPortal = true, onBlur?, ...InputBaseProps })` (export) | Champ `Combobox` : texte libre, lieux enregistrés filtrés puis adresses OpenStreetMap ; bouton menu « Lieux enregistrés » ; cases des zones du lieu choisi (`Checkbox.Group` dans `StackedValues`) ; icône d’épingle pleine quand le point est connu ; un nouveau texte efface le point. `withPlaces={false}` pour l’adresse d’un lieu lui-même ; `withinPortal={false}` dans un popover. |
| `LIST_HEIGHT` (interne)                                                                                               | Hauteur maximale des listes (320 px).                                                                                                                                                                                                                                                                                                                                                     |
| `placeText` (interne)                                                                                                 | « Libellé, adresse » d’un lieu.                                                                                                                                                                                                                                                                                                                                                           |
| fonctions internes                                                                                                    | `setZones`, `choosePlace` (lieu choisi, ou zone cochée / décochée), `ticked`, `choose` (clé `place:<id>` ou `address:<index>`, `taggedKey` / `parseTaggedKey`).                                                                                                                                                                                                                           |

Utilisé par `EventLocation`, `LocationCell`, `PlacesManager`, `TravelCalculator`, `shopping/components/OrderPanel.tsx`. `onBlur` : sortie du champ (après la fermeture de la liste).

### `components/EventLocation.tsx`

`EventLocation({ value, onChange, error?, onBlur? })` : champ « Lieu » d'un évènement, d'une routine ou d'une tâche (`AddressInput`) et, avec un point, une `PlaceMap` de 180 px où un clic déplace le point (adresse recherchée par `pickedAddress`). `onBlur` : sortie du champ (le panneau d'une tâche y enregistre un texte libre). Utilisé par `calendar/components/EventForm.tsx`, `routines/components/RoutineSchedule.tsx`, `tasks/components/TaskCreateForm.tsx` et `tasks/components/TaskLocation.tsx`.

### `components/LocationCell.tsx`

`LocationCell({ item, label, readOnly?, count?, onSave })` : cellule « Lieu » d'un tableau (routines, tâches) : le lieu (« — » sans lieu), une bulle avec `AddressInput` sans portail ; enregistré par `useLocationDraft` (`onSave({ location, locationLat, locationLon })`, texte nettoyé, vide → `null`) au choix d'une adresse proposée, quand le texte est vidé, ou pour un texte libre à la fermeture de la bulle (en quittant la cellule), comme le panneau d'une tâche ; `count` (lignes que la modification touche) : sur une sélection de plusieurs lignes, le lieu choisi va à toutes, même si la ligne cliquée l'a déjà. Utilisé par `RoutineLocationCell` (routines) et `TaskLocationCell` (tâches).

## `hooks/`

### `hooks/use-location-draft.ts`

`useLocationDraft(item, save, several?)` → `{ value, onChange, leave }` : lieu d'un élément existant tapé en place, la même règle partout : enregistré (`save({ location, locationLat, locationLon })`) au choix d'une adresse proposée ou d'un clic sur la carte (avec son point), quand le texte est vidé, ou à `leave()` (sortie du champ) pour un texte libre ; rien quand le lieu ne change pas, sauf avec `several` (une sélection de plusieurs lignes : les autres prennent le lieu de la ligne cliquée). Imposé par eslint (`x.point || !x.text.trim()` écrit à la main). Utilisé par `LocationCell`, `tasks/components/TaskLocation.tsx` et `useFormLocation`.

`useFormLocation(values, set, commit?)` → comme `useLocationDraft` : champ « Lieu » du formulaire d'un évènement ou d'une routine, `useLocationDraft` sur ses valeurs ; le lieu va dans le formulaire (`set`, texte jamais `null`) quand il est choisi, vidé ou quitté, puis est enregistré tout de suite par `commit(PLACE_FIELDS)` dans un panneau enregistré champ par champ (décision D22). `PLACE_FIELDS` : `['location', 'locationLat', 'locationLon']`, enregistrés ensemble. Utilisé par `EventForm` et `RoutineSchedule`.

## `lib/`

### `lib/location.ts`

| Export                  | Rôle                                                                                                                               | Utilisé par                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `ItemLocation`          | Type `{ location, locationLat, locationLon }` d'un évènement, d'une routine ou d'une tâche.                                        | `LocationCell`, `useLocationDraft`                                           |
| `addressOf(item)`       | `AddressValue` du lieu d'un élément (ou des valeurs de son formulaire) : son texte, son point s'il a ses deux coordonnées. Imposé par eslint. | `EventForm`, `RoutineSchedule`, `TaskCreateForm`, `TaskLocation`, `LocationCell` |
| `locationOf(value)`     | Champs `location`, `locationLat`, `locationLon` d'une adresse, texte tel que tapé (le schéma le nettoie).                         | les mêmes                                                                    |

### `components/LazyPlaceMap.tsx`

`LazyPlaceMap(props)` : `PlaceMap` chargée avec sa bibliothèque de cartes à sa première apparition (`lazyNamed`), `BlockSkeleton` en attendant. C'est elle qu'utilisent `EventLocation` et `PlacesManager` (règle eslint : pas d'import direct de `PlaceMap`).

### `components/PlaceMap.tsx` (+ `PlaceMap.module.css`)

`PlaceMap({ points, onPick?, onSelect?, height = 240 })` : carte `react-leaflet` (tuiles OpenStreetMap) avec un `CircleMarker` et une infobulle par point (le point `active` plus grand), centrée sur la France sans point. Internes : `MapPoint`, `DEFAULT_CENTER`, `Framing` (cadre sur un point au zoom 15 au moins, ou sur tous), `Resizing` (`ResizeObserver` → `invalidateSize`), `Picking` (clic → `onPick`). Utilisé par `EventLocation` et `PlacesManager`.

### `components/PlacesManager.tsx` (+ `PlacesManager.module.css`)

`PlacesManager()` : onglet « Lieux » de `SettingsPage` : carte (clic = nouveau lieu prérempli via `adderRef`) et `SettingsList` de type `PLACE` en arbre (`nested`, couleur facultative, `placeSchema`, champ d’adresse en plus par `extra`, `canMove` : un lieu reste à la racine, une zone sous un lieu, message de suppression). Hauteur par `useFillHeight(400)`. Internes : `PlaceAddressValues`, `pick`, `input` (entrée d’un lieu ou d’une zone), `points`.

### `components/TravelCalculator.tsx`

`TravelCalculator({ eventPoint, onResult })` : bouton « Calculer les trajets » et popover : aller et retour activables, départ et retour parmi les lieux (`itemOptions`, lieux racines) ou « Autre adresse… » (`AddressInput` sans portail), mode (`TRAVEL_MODES`, `TRAVEL_MODE_LABELS`) ; `useAsyncAction` lance les deux calculs en parallèle et rend `{ before?, after? }` en minutes (`travelMinutes`) avec un résumé. Internes : `OTHER`, `SAME`, `pointOf`. Utilisé par `EventForm` et `RoutineSchedule`.

### `components/TravelField.tsx`

`TravelField({ way: 'before' | 'after', ...NumberInputProps })` : `NumberInput` « Trajet aller » / « Trajet retour », suffixe « min », 0 à 1440, pas de 5, entier. Utilisé par `EventForm` et `RoutineSchedule`.
