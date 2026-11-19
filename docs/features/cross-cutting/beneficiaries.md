# Bénéficiaires

Le champ « Bénéficiaires » dit pour qui est une tâche, une routine ou un évènement (« l’anniversaire est pour mon fils ») : des contributeurs et des relations. Code web : `apps/web/src/features/beneficiaries/` (voir [Bénéficiaires, code web](../../web/features/cross-cutting/beneficiaries.md)) ; API : `apps/api/src/services/core/beneficiaries.ts` ; règles : [Personnes](../../business-rules/cross-cutting/people.md).

## Où on le trouve

- Formulaires : création et panneau d’une tâche, formulaire d’une routine, formulaire d’un évènement.
- Tableaux : colonne « Bénéficiaires » des tâches, des routines et des évènements (cellule modifiable en place, enregistrée à la fermeture de la liste ; modification groupée sur une sélection : les personnes ajoutées sont ajoutées à chaque ligne, celles retirées sont retirées).
- Tri, recherche et exports des tâches utilisent les noms des bénéficiaires.

## Le champ

- Libellé « Bénéficiaires », aide « Pour qui c’est : contributeurs ou relations. » (« proches » au lieu de « relations » dans un espace PERSO), texte « Personne en particulier » quand il est vide.
- Personnes proposées, groupées :
  - les contributeurs (« Prénom (moi) » pour l’utilisateur) ;
  - les relations qui ne sont pas déjà un contributeur (une relation liée à un contributeur est ce contributeur) ; une relation déjà choisie reste proposée.
- Les personnes archivées ne sont plus proposées, sauf celles déjà choisies.
- Plusieurs choix possibles, ou aucun.

## Filtre de colonne

Le filtre « Bénéficiaires » des tableaux propose tous les contributeurs et relations (sans contributeur), les archivés signalés comme tels.

## Règles côté API

Tout contributeur et toute relation peut être bénéficiaire (contrairement aux assignés, limités aux contributeurs du projet : voir [Personnes](../../business-rules/cross-cutting/people.md)) ; ils doivent exister (« Bénéficiaire introuvable. ») et ne pas être archivés, sauf s’ils étaient déjà bénéficiaires (« Élément archivé : restaurez-le pour le modifier. »).
