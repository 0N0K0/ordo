# Lieux, adresses et trajets

Lieux enregistrés (« Maison », « Bureau »…) et leurs zones, champ d’adresse avec recherche OpenStreetMap, carte, et calcul des temps de trajet des évènements et routines. Code web : `apps/web/src/features/geo/` (voir [Lieux, code web](../../web/features/cross-cutting/geo.md)) ; règles : [Règles des lieux](../../business-rules/cross-cutting/geo.md).

## Paramètres › Lieux

Route `/settings?tab=places`. Composant `PlacesManager`. La zone prend la hauteur que laisse la fenêtre.

- **Carte** OpenStreetMap avec un point par lieu (pas par zone), cadrée sur l’ensemble ; survoler un point montre son libellé. Un **clic sur la carte** ouvre le formulaire d’un nouveau lieu à ce point, avec l’adresse trouvée (et le nom du lieu s’il en a un), sinon les coordonnées (« 48.85660, 2.35220 »).
- **Liste « Lieux »** en arbre (liste de paramètres commune, voir [Paramètres](settings.md)) : « Vos adresses habituelles (maison, bureau…) : proposées pour le lieu des évènements et des routines, et pour calculer les temps de trajet. Un lieu a une adresse (cherchée, ou d’un clic sur la carte) et peut avoir des zones, sans adresse (cuisine, salle de bain… pour le ménage), qui prennent son point. »
  - Chaque élément : libellé, couleur (facultative) et image ; l’adresse s’affiche sous un lieu.
  - Ajout de lieux et de zones, modification, archivage, suppression.
  - Glisser-déposer : les lieux se réordonnent entre eux ; une zone passe sous un autre lieu ou une autre zone. Un lieu ne devient jamais une zone, ni une zone un lieu.
- **Formulaire** : « Libellé » (250 caractères, unique parmi les lieux ou parmi les zones d’un même lieu) ; pour un lieu seulement, « Adresse » (requise, « Adresse, ou un clic sur la carte ») qu’il faut choisir parmi les propositions : « Choisissez une adresse proposée. ».
- **Suppression** : « Le lieu « X » sera supprimé définitivement avec ses zones ; les évènements et routines gardent leur lieu en texte ; il ne sera plus proposé. » (« La zone… supprimée » pour une zone).

## Champ d’adresse

Composant `AddressInput` : lieu d’un évènement ou d’une routine (formulaire et cellule « Lieu » du tableau des routines), lieu de livraison ou de retrait d’une commande d’achats ([Achats](../supplies/shopping.md)), adresse d’un lieu enregistré.

- Texte libre accepté (une salle, une visio…) : il n’a alors pas de point sur la carte (icône d’épingle vide).
- En tapant, la liste propose :
  - « Lieux enregistrés » : lieux et zones dont le chemin ou l’adresse contient le texte (sans accents ni casse) ;
  - « Adresses (OpenStreetMap) » : à partir de 3 caractères, après une courte pause de frappe, 6 au plus, les plus proches du premier lieu enregistré d’abord.
- Choisir une proposition donne au champ son point (épingle pleine « Adresse située sur la carte »). Retaper du texte oublie le point.
- Bouton « Lieux enregistrés » (maison) : tous les lieux et zones, en arbre.
- **Zones** : après le choix d’un lieu qui a des zones, des cases « Zones de X » (« Facultatif : une ou plusieurs ; aucune, le lieu entier. ») permettent d’en cocher plusieurs ; le lieu devient « Maison › Cuisine, Salle de bain », avec le point de la maison. Au-delà de 5 zones, 4 sont montrées et « X de plus ».
- Les lieux archivés (et les zones d’un lieu archivé) ne sont plus proposés, sauf celui déjà choisi.

## Lieu d’un évènement ou d’une routine

Champ « Lieu » (« Adresse, lieu enregistré, salle, visio… ») ; quand le lieu a un point, une petite carte le montre et un clic dessus le déplace (l’adresse est recherchée de nouveau, sinon les coordonnées ; un échec de recherche est signalé par un toast). Voir [Agenda](../activities/calendar.md) et [Routines](../activities/routines.md).

## Temps de trajet

- Champs « Trajet aller » et « Trajet retour » : minutes, par pas de 5, de 0 à 1440 (24 h).
- Bouton « Calculer les trajets » : désactivé tant que le lieu n’a pas de point (« Choisissez d’abord une adresse proposée pour le lieu »). Il ouvre un panneau :
  - « Aller » (interrupteur) : « Départ » parmi les lieux enregistrés ou « Autre adresse… », et le mode « Voiture » / « Vélo » / « À pied » ;
  - « Retour » (interrupteur) : « Retour vers » « Le lieu de départ », un lieu enregistré ou « Autre adresse… », et son mode ;
  - bouton « Calculer » : remplit seulement les trajets cochés, arrondis aux 5 minutes supérieures, et affiche le détail (« Aller voiture 25 min (18,2 km), retour vélo… Arrondis aux 5 minutes. ») ;
  - « Itinéraires OpenStreetMap, sans trafic ni transports en commun. Un trajet décoché garde sa durée. ».
- Erreurs possibles : « Aucun itinéraire trouvé entre ces deux points. », « Le service de cartographie ne répond pas. ».

Les trajets réservent du temps avant et après l’évènement ou la routine : voir [Agenda](../activities/calendar.md) et [Routines](../activities/routines.md).
