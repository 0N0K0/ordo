# Règles métier : lieux, adresses et trajets

Règles des lieux enregistrés (et de leurs zones), de la recherche d’adresses, de l’adresse d’un point et du calcul des temps de trajet. Sources : `apps/api/src/services/core/geo.ts`, `apps/api/src/graphql/modules/geo.ts`, `apps/api/src/graphql/located-fields.ts`, `packages/shared/src/core/geo.ts`.

## Lieux et zones

Un **lieu** (« Maison », « Bureau »…) a une adresse et un point (latitude, longitude). Une **zone** (cuisine, salle de bain…) est rattachée à un lieu ou à une autre zone ; elle n’a pas d’adresse ni de point propres : elle prend ceux du lieu qui la contient.

### Champs (`placeSchema`)

| Champ          | Règle                                                                                        | Message                                                |
| -------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `label`        | requis, coupé, 60 caractères au plus                                                         | « Le libellé est requis. », « 60 caractères maximum. » |
| `address`      | coupée, 300 caractères au plus, vide par défaut                                              | « 300 caractères maximum. »                            |
| `lat`, `lon`   | WGS 84 : latitude de -90 à 90, longitude de -180 à 180 ; obligatoires pour un lieu           | « Choisissez une adresse proposée. » (sur `address`)   |
| `parentId`     | lieu ou zone qui contient une zone ; `null` pour un lieu                                     | —                                                      |
| `color`, image | apparence commune des listes de paramètres (`services/core/settings-lists.ts`, type `PLACE`) | —                                                      |

- Un lieu doit donc avoir un point, obtenu en choisissant une adresse proposée ou en cliquant sur la carte.
- Pour une zone, l’adresse et le point envoyés sont ignorés : ils sont remis à vide (`address: ''`, `lat`/`lon` nuls).

### Unicité des libellés

- Parmi les lieux (racines) : « Un lieu porte déjà ce libellé. » (contrôle applicatif sur le champ `label`).
- Parmi les zones d’un même parent : « Une zone de ce lieu porte déjà ce libellé. » (contrainte en base).

### Création et modification

`savePlace(id | null, input)` passe par le service d’arbre commun (`treeListService` de `services/core/trees.ts`) :

- Lieu ou zone introuvable : « Lieu introuvable. ». Parent introuvable : « Lieu introuvable. ».
- Une zone ne peut pas être placée dans elle-même ni dans l’une de ses sous-zones : « Une zone ne peut pas être dans elle-même. ».
- Un élément archivé, ou un nouveau parent archivé, est refusé (« Élément archivé… »).
- Sous un autre parent, l’élément va en dernier.

### Déplacement

`movePlace(id, parentId, index)` :

- Refusé si l’élément est archivé.
- Un lieu reste un lieu : « Un lieu garde son adresse : il ne peut pas devenir une zone. ».
- Une zone reste une zone : « Une zone n’a pas d’adresse : elle ne peut pas devenir un lieu. ».
- Une zone peut passer sous un autre lieu ou une autre zone, jamais sous elle-même ni sous l’une de ses zones ; l’index est pris parmi ses nouveaux frères.

### Suppression

`deletePlace(id)` supprime le lieu et ses zones (« Lieu introuvable. » sinon). Les évènements et routines qui l’utilisaient gardent leur lieu **en texte** (avec son point).

### Lecture

`places()` rend les lieux de l’espace en ordre manuel (puis par libellé), chaque zone avec :

- `lat`, `lon` : le point du premier ancêtre localisé ;
- `address` : la sienne, sinon celle de ce lieu ;
- `path` : libellé complet « Maison › Cuisine » ;
- `archived` : archivé (masqué par défaut, en lecture seule).

Un élément sans aucun ancêtre localisé n’est pas rendu.

## Recherche d’adresses

`searchAddresses(text, near)` interroge Photon (OpenStreetMap, `env.PHOTON_URL`) :

- Moins de 3 caractères (après trim) : aucune proposition, pas d’appel.
- Texte coupé à 200 caractères, 6 résultats au plus, langue française ; avec `near`, les résultats proches de ce point passent en premier (le web envoie le premier lieu actif).
- Chaque résultat devient une adresse en mots : nom du lieu (s’il diffère de la rue et de la ville), numéro et rue, code postal et ville (ou bourg, village, quartier), pays. Les doublons d’adresse sont retirés.

`reverseAddress(point)` rend l’adresse la plus proche d’un point (clic sur la carte), ou `null` ; le point rendu est celui demandé.

## Temps de trajet

`travelTime(from, to, mode)` interroge OSRM (`env.ROUTING_URL`, profil `car`, `bike` ou `foot`) :

- `TRAVEL_MODES = ['CAR', 'BIKE', 'FOOT']`, libellés « Voiture », « Vélo », « À pied ».
- Résultat : durée en secondes et distance en mètres, arrondies.
- Aucun itinéraire : « Aucun itinéraire trouvé entre ces deux points. ».
- Cache en mémoire par mode et coordonnées (6 décimales), vidé au-delà de 1000 entrées.
- Pas de trafic ni de transports en commun.

### Durées saisies sur un élément

- Les champs d’un élément localisé (évènement, routine) : `locationLat`, `locationLon` (facultatifs) et `travelBefore`, `travelAfter` (`locatedFields`).
- Trajet aller ou retour : entier de 0 à 1440 minutes (24 h), 0 par défaut : « Durée positive attendue. », « 24 h maximum. ».
- `travelMinutes(seconds)` arrondit une durée calculée aux **5 minutes supérieures**.
- À la création, sans valeur : pas de lieu, trajets à 0 (`locatedInput`). En modification, un lieu changé remplace aussi son point (`null` : aucun) ; un trajet omis ou `null` reste inchangé (`locatedChanges`).

## Erreurs des services cartographiques

Source : `getJson` de `services/core/geo.ts`. Délai maximal 8 s ; en-tête `User-Agent: Ordo (self-hosted calendar)`.

- Pas de réponse : « Le service de cartographie ne répond pas. » (`SERVICE_UNAVAILABLE`).
- Réponse en erreur : « Le service de cartographie a répondu <code>. » (`SERVICE_UNAVAILABLE`).
