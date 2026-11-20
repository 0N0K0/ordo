# Nommage : libellés, noms, doublons, limites

Règles communes aux libellés et aux noms : mots employés, longueurs maximales, unicité, comparaison des noms, copies et noms de fichiers. Sources : `packages/shared/src/core/rules.ts`, `packages/shared/src/core/text.ts`, `packages/shared/src/core/workspace.ts`, `apps/api/src/services/core/labels.ts`, `apps/api/src/graphql/errors.ts`, `apps/api/prisma/schema.prisma`.

Voir aussi : [core](../../shared/cross-cutting/core.md), [Erreurs](errors.md), [Archivage](archiving.md).

## Libellé ou nom

- Décision AD : le champ s'appelle « Libellé » pour tout `label` ; « Nom » seulement pour les personnes physiques ou morales (contributeurs, relations, contacts, clients, tiers, entreprise).
- Dans la base, l'API et les données JSON (sources des fiches, jeux de données des graphiques, instantané de prestation), tout libellé s'appelle `label`, titres et espaces de travail compris ; seules les personnes gardent `name` : contributeurs, utilisateurs, relations, contacts, clients, tiers de trésorerie.
- Message d'un libellé vide : « Le libellé est requis. » (`requiredText`) ; d'un nom vide : « Le nom est requis. » (`personNameSchema`) ; variantes : « Le prénom est requis. », « Le nom de la société est requis. », « Le numéro est requis. ».
- Tout libellé est « trimé » ; un texte facultatif vide est enregistré `null` (`optionalText`).
- Message de longueur : « 250 caractères maximum. » (texte court), « 500 caractères maximum. » (mention légale), « 4 000 caractères maximum. » (zone de texte), « Texte trop long. » (markdown).

## Mots employés

- Décision DZ : un horaire prévu de l'agenda (`WorkSchedule`) s'appelle partout « créneau » (« un créneau », « Créneaux de travail » en PRO, « Créneaux » en PERSO, « Type de créneau ») ; l'ancien mot (voir décision DZ) n'est plus employé, ni dans l'interface, ni dans les messages de l'API, ni dans la documentation.
- « Ouverture » et « Échéance » : les deux jours qui bornent une tâche (`minDate`, `deadline`) s'appellent « Ouverture » et « Échéance » (« l'ouverture », « l'échéance », au féminin ; « date d'ouverture » quand un groupe nominal se lit mieux) ; le jour dès lequel une occurrence de routine peut être faite (`opensOn`, son premier jour) s'appelle aussi « Ouverture ». Les anciens libellés « Date min » / « Date max » (tâches) et « À partir du » (tâches et routines) ne sont plus employés, ni dans l'interface, ni dans les messages de l'API, ni dans la documentation (« à partir du » reste dans les phrases ordinaires et pour les dates de début d'une alarme, d'un créneau, d'une recherche de mails ou d'une livraison).
- Décision D20 (EZ) : copier un élément se dit partout « Dupliquer » (la copie, « … (copie) », est enregistrée tout de suite puis ouverte) ; « Cloner » n'est plus employé.
- Décision FL (lot 15) : changer une tâche en routine ou une routine en tâche se dit « Transformer en routine » / « Transformer en tâche » (toasts « Tâche transformée en routine : choisissez sa répétition. », « Routine transformée en tâche. »).
- Décision FM (lot 16) : un créneau d'une autre nature (vacances, jours fériés, anniversaires…) s'appelle « éphéméride », au masculin comme le dit l'utilisateur (« un éphéméride », « Éphémérides », « Nouvel éphéméride », « Type d'éphémérides », « Éphéméride créé. ») ; changer de nature se dit « Convertir en éphéméride » / « Convertir en créneau » (et « Convertir en type d'éphémérides » / « Convertir en type de créneaux ») ; les périodes d'un contexte de trésorerie sont ses éphémérides (« Contextes planifiés » et « période planifiée » ne sont plus employés).
- Les heures d'un créneau un jour donné sont ses « horaires » (« Créneau du 12 novembre » dans le formulaire du jour, « Horaires retirés du créneau. ») ; un intervalle de dates qui n'est pas un créneau est une « période ».

## Longueurs maximales

Décision DO : une seule taille par sorte de texte, partout dans l'application (`packages/shared/src/core/rules.ts`).

| Sorte de texte                                                                                                                                                                                                                                                                                                                                 | Max    | Constante, schémas                                                                 | Message                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------- | ----------------------------- |
| Texte court libre : libellés de tous les items et des listes de réglages, noms de personnes (décision BB), titres, lieu, adresse, motif, libellé de lien, recherche, critères de recherche mail, capital et mode de règlement de la société et des documents comptables                                                                        | 250    | `TEXT_MAX` ; `requiredText`, `optionalText`, `shortTextSchema`, `personNameSchema` | « 250 caractères maximum. »   |
| Zone de texte simple (plusieurs lignes, sans markdown) : notes de fiche, de ressource de projet, de relance, de tiers et de relation, description d'une alarme, « Autres mentions »                                                                                                                                                            | 4 000  | `PLAIN_TEXT_MAX` ; `plainTextSchema`, `optionalPlainText`                          | « 4 000 caractères maximum. » |
| Mention légale de la société et des documents comptables : mention d'exonération de TVA, conditions de règlement, intérêts de retard, immatriculation                                                                                                                                                                                          | 500    | `LEGAL_TEXT_MAX` ; `legalTextSchema`, `optionalLegalText`                          | « 500 caractères maximum. »   |
| Markdown : description (tâche, routine, évènement, projet, jalon, temps, ligne et produit du catalogue, document importé, mouvement de trésorerie), commentaire, objectif de sprint, introduction et conclusion d'un document comptable, note d'un produit, note d'un mouvement de stock, note d'un inventaire                                  | 65 536 | `MARKDOWN_MAX` ; `markdownSchema`, `markdownTextSchema`, `commentBodySchema`       | « Texte trop long. »          |

- Un champ édité avec l'éditeur markdown compte comme markdown, même s'il était une zone de texte simple avant (description d'une routine, d'un temps).
- Hors règle, chacun avec sa constante nommée : les champs à format (identifiant de mention 2 à 39, `HANDLE_MAX` ; identifiant de connexion 3 à 32 ; email 254 ; couleur ; heure ; clé de tableau 64, `TABLE_KEY_MAX` ; code postal 20 ; téléphone 30 ; numéro de TVA 20 ; code d'activité 20 ; SIREN, SIRET, IBAN, BIC ; serveur et identifiant de boîte mail 255 ; objet d'un mail 998), les adresses URL, la signature HTML d'une boîte mail (100 000, « Signature trop longue. »), le nom d'un fichier stocké (coupé à 200).
- Le web reprend les mêmes constantes pour `maxLength` (l'éditeur markdown est limité à `MARKDOWN_MAX`).
- Les valeurs déjà enregistrées plus longues ont été raccourcies (migration `20261119150000_text_sizes`), documents comptables définitifs compris (leurs textes, leurs lignes et la société figée comme vendeur) : c'est la seule exception à la règle « un document définitif n'est jamais modifié ».
- Un libellé construit reste dans les 250 : copie (`copyName`), report d'un évènement et mouvement de trésorerie d'une facture ou d'un règlement (`fitName`, le nom coupé, les mots fixes entiers), comparaison d'un graphique et libellé « échéancier — client » (`clipText`).

## Unicité

L'unicité est garantie par la base (contraintes `@@unique` de `schema.prisma`) ; l'API transforme la violation en `CONFLICT` sous le champ (`rethrowUnique`). La comparaison de la base est exacte (sensible à la casse et aux accents).

| Élément                                  | Unique dans                                                                                                         | Message                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Statut de projet, statut de tâche        | l'espace                                                                                                            | « Un statut porte déjà ce libellé. »                                                |
| Catégorie de projet, catégorie de fiche  | l'espace                                                                                                            | « Une catégorie porte déjà ce libellé. »                                            |
| Priorité de tâche                        | l'espace                                                                                                            | « Une priorité porte déjà ce libellé. »                                             |
| Type de tâche, type de créneau             | l'espace                                                                                                            | « Un type porte déjà ce libellé. »                                                  |
| Étiquette de tâche                       | l'espace                                                                                                            | « Une étiquette porte déjà ce libellé. »                                            |
| Statut de suivi de document              | l'espace et sa portée (devis / factures)                                                                            | « Un statut porte déjà ce libellé. »                                                |
| Drapeau mail                             | l'espace                                                                                                            | « Un drapeau porte déjà ce libellé. »                                               |
| Magasin, mode de conservation, unité     | l'espace                                                                                                            | « Un magasin… », « Un mode de conservation… », « Une unité porte déjà ce libellé. » |
| Contexte de dépense                      | l'espace (c'est un type d'éphémérides, lot 16 : même unicité que les types)                                         | « Un type porte déjà ce libellé. »                                                  |
| Relation                                 | l'espace (par nom, et un contributeur au plus une fois)                                                             | « Une relation porte déjà ce nom. », « Ce contributeur est déjà une relation. »     |
| Lieu                                     | l'espace, parmi les lieux de premier niveau (vérifié par le service) ; zone : parmi les zones d'un même lieu (base) | « Un lieu porte déjà ce libellé. », « Une zone de ce lieu porte déjà ce libellé. »  |
| Identifiant de mention d'un contributeur | l'espace                                                                                                            | « Cet identifiant est déjà utilisé. »                                               |
| Identifiant de connexion                 | l'application                                                                                                       | « Cet identifiant est déjà utilisé. »                                               |
| Email                                    | l'application                                                                                                       | « Cette adresse est déjà utilisée. »                                                |
| Numéro de document comptable             | l'espace                                                                                                            | (numérotation automatique)                                                          |
| Numéro de document importé               | l'espace et son type                                                                                                | « Un document importé de ce type porte déjà ce numéro. »                            |
| Numéro de tâche                          | son projet                                                                                                          | (numérotation automatique)                                                          |

Ne sont **pas** uniques : projets, tâches, événements, routines, fiches, listes, comptes de trésorerie, catégories de trésorerie et de courses, emplacements, agendas, catégories d'agenda (pas de contrainte dans le schéma).

## Comparaison des noms

Décision CB : deux noms sont le même nom s'ils ont la même clé `nameKey` : espaces de bord retirés, espaces internes réduits à un, sans casse ni accents (« eleve » = « Élève »). `sameName(a, b)` compare deux noms.

- Le web s'en sert pour ne pas proposer de créer une valeur qui existe déjà dans une liste « créable » (`apps/web/src/components/inputs/creatable.ts`), et pour retrouver un produit par son libellé.
- `productKey` (voir [shopping](../../shared/supplies/shopping.md)) en dérive : deux lignes de même libellé et unité (clé) sont le même produit dans les fiches, les listes et le stock.
- La synchronisation GitHub compare les étiquettes par `nameKey`.
- Tri des noms : `collator` français, sans casse ni accents, nombres par valeur.

## Identifiants de mention

- `handleSchema` : minuscules, chiffres, « - » et « _ », 2 à 39 caractères, ni « - » ni « _ » au début ou à la fin.
- `suggestHandle(name)` propose un identifiant depuis un nom ; `freeHandle` (`apps/api/src/services/projects/contributors.ts`) trouve un identifiant libre : « membre » si le nom est trop court, puis `-suffixe` et un numéro (« tom », « tom-2 » ; pour le profil « Moi » : « tom », « tom-moi », « tom-moi-2 »).

## Copies

`copyName(name)` : « Nom (copie) », le nom coupé si nécessaire pour garder le suffixe dans les 250 caractères. Utilisé par « Dupliquer » (décision D20) : un graphique, une liste de courses, une fiche, une tâche, une routine, une alarme, un évènement, une vue, un créneau, un mouvement ou une prévision de trésorerie.

## Textes venus d'ailleurs

`clipText(text, max?)` coupe un texte importé (titre GitHub, libellé de relevé bancaire, ancienne fiche) à la longueur de sa règle, 250 par défaut.

## Noms de fichiers

- `safeFilename(name)` remplace `\ / : * ? " < > |` et le caractère nul par « - » ; vide : « sans-nom » (`UNNAMED_FILE`).
- `fileName(label, extension)` : nom d'un export ou d'un téléchargement.
- Fichier stocké : nom coupé à 200 caractères puis nettoyé (voir [Fichiers et pièces jointes](files-and-attachments.md)).
- Document sans numéro : « Brouillon » (décision CD), sans parenthèses ni espace final.
