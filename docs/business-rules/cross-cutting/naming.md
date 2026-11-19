# Nommage : libellés, noms, doublons, limites

Règles communes aux libellés et aux noms : mots employés, longueurs maximales, unicité, comparaison des noms, copies et noms de fichiers. Sources : `packages/shared/src/core/rules.ts`, `packages/shared/src/core/text.ts`, `packages/shared/src/core/workspace.ts`, `apps/api/src/services/core/labels.ts`, `apps/api/src/graphql/errors.ts`, `apps/api/prisma/schema.prisma`.

Voir aussi : [core](../../shared/cross-cutting/core.md), [Erreurs](errors.md), [Archivage](archiving.md).

## Libellé ou nom

- Décision AD : le champ s'appelle « Libellé » pour tout `label` ; « Nom » seulement pour les personnes physiques ou morales (contributeurs, relations, contacts, clients, tiers, entreprise).
- Dans la base, l'API et les données JSON (sources des fiches, jeux de données des graphiques, instantané de prestation), tout libellé s'appelle `label`, titres et espaces de travail compris ; seules les personnes gardent `name` : contributeurs, utilisateurs, relations, contacts, clients, tiers de trésorerie.
- Message d'un libellé vide : « Le libellé est requis. » (`requiredText`) ; d'un nom vide : « Le nom est requis. » (`personNameSchema`) ; variantes : « Le prénom est requis. », « Le nom de la société est requis. », « Le numéro est requis. ».
- Tout libellé est « trimé » ; un texte facultatif vide est enregistré `null` (`optionalText`).
- Message de longueur : « N caractères maximum. ».

## Longueurs maximales

| Élément                                                                                                                | Max    | Constante / source                                 |
| ---------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------- |
| Nom de personne (contributeur, relation, contact, client, tiers, entreprise)                                           | 100    | `PERSON_NAME_MAX` (décision BB)                    |
| Libellé d'élément paramétrable (statut, priorité, type, étiquette, catégorie de projet, magasin, unité, drapeau mail…) | 50     | `LABEL_MAX`                                        |
| Espace                                                                                                                 | 60     | `WORKSPACE_LABEL_MAX`                              |
| Vue enregistrée                                                                                                        | 60     | `VIEW_LABEL_MAX`                                   |
| Tableau de bord                                                                                                        | 60     | `DASHBOARD_LABEL_MAX`                              |
| Graphique                                                                                                              | 120    | `CHART_LABEL_MAX`                                  |
| Projet                                                                                                                 | 120    | `projectLabelSchema`                               |
| Lien de projet                                                                                                         | 200    | `projectLinkSchema`                                |
| Tâche                                                                                                                  | 256    | `TASK_LABEL_MAX`                                   |
| Jalon, sprint                                                                                                          | 120    | `MILESTONE_LABEL_MAX`, `SPRINT_LABEL_MAX`          |
| Alarme                                                                                                                 | 200    | `ALARM_LABEL_MAX`                                  |
| Événement                                                                                                              | 300    | `EVENT_LABEL_MAX`                                  |
| Agenda, catégorie d'agenda                                                                                             | 80     | `calendarFormSchema`, `calendarCategoryFormSchema` |
| Plage (horaire)                                                                                                        | 100    | `WORK_SCHEDULE_LABEL_MAX`                          |
| Type de plage                                                                                                          | 60     | `scheduleTypeSchema`                               |
| Lieu                                                                                                                   | 60     | `placeSchema`                                      |
| Routine                                                                                                                | 200    | `ROUTINE_LABEL_MAX`                                |
| Catégorie de routine                                                                                                   | 100    | `routineCategorySchema`                            |
| Fiche                                                                                                                  | 100    | `SHEET_LABEL_MAX`                                  |
| Catégorie de fiche                                                                                                     | 60     | `sheetCategorySchema`                              |
| Article de fiche, article de stock                                                                                     | 200    | `sheetItemSchema`, `stockItemSchema`               |
| Produit, article de courses                                                                                            | 120    | `SHOPPING_LABEL_MAX`                               |
| Liste de courses                                                                                                       | 120    | `SHOPPING_LIST_LABEL_MAX`                          |
| Liste type                                                                                                             | 80     | `shoppingBaseListLabelSchema`                      |
| Catégorie de courses                                                                                                   | 100    | `shoppingCategorySchema`                           |
| Emplacement de stock                                                                                                   | 80     | `stockLocationSchema`                              |
| Unité (texte d'un article)                                                                                             | 50     | `UNIT_MAX`                                         |
| Boîte mail                                                                                                             | 80     | `mailAccountFormSchema`                            |
| Dossier de recherche mail                                                                                              | 60     | `mailSearchSchema`                                 |
| Mouvement de trésorerie                                                                                                | 300    | `ENTRY_LABEL_MAX`                                  |
| Ligne de ventilation                                                                                                   | 200    | `ENTRY_LINE_LABEL_MAX`                             |
| Compte, catégorie, moyen de paiement                                                                                   | 100    | `treasury.ts`                                      |
| Contexte de dépense                                                                                                    | 60     | `treasuryContextSchema`                            |
| Service client                                                                                                         | 120    | `clientServiceSchema`                              |
| Ligne de document comptable                                                                                            | 300    | `accountingLineSchema`                             |
| Produit du catalogue                                                                                                   | 300    | `catalogItemSchema`                                |
| Facture récurrente                                                                                                     | 200    | `recurringInvoiceSchema`                           |
| Description                                                                                                            | 5000   | `descriptionSchema`                                |
| Texte markdown (description de tâche, commentaire, description d'événement)                                            | 65 536 | `markdownSchema`, `commentBodySchema`              |
| Identifiant de mention                                                                                                 | 2 à 39 | `handleSchema`                                     |
| Identifiant de connexion                                                                                               | 3 à 32 | `usernameSchema`                                   |

## Unicité

L'unicité est garantie par la base (contraintes `@@unique` de `schema.prisma`) ; l'API transforme la violation en `CONFLICT` sous le champ (`rethrowUnique`). La comparaison de la base est exacte (sensible à la casse et aux accents).

| Élément                                  | Unique dans                                                                                                         | Message                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Statut de projet, statut de tâche        | l'espace                                                                                                            | « Un statut porte déjà ce libellé. »                                                |
| Catégorie de projet, catégorie de fiche  | l'espace                                                                                                            | « Une catégorie porte déjà ce libellé. »                                            |
| Priorité de tâche                        | l'espace                                                                                                            | « Une priorité porte déjà ce libellé. »                                             |
| Type de tâche, type de plage             | l'espace                                                                                                            | « Un type porte déjà ce libellé. »                                                  |
| Étiquette de tâche                       | l'espace                                                                                                            | « Une étiquette porte déjà ce libellé. »                                            |
| Statut de suivi de document              | l'espace et sa portée (devis / factures)                                                                            | « Un statut porte déjà ce libellé. »                                                |
| Drapeau mail                             | l'espace                                                                                                            | « Un drapeau porte déjà ce libellé. »                                               |
| Magasin, mode de conservation, unité     | l'espace                                                                                                            | « Un magasin… », « Un mode de conservation… », « Une unité porte déjà ce libellé. » |
| Contexte de dépense                      | l'espace                                                                                                            | « Un contexte porte déjà ce libellé. »                                              |
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

`copyName(name, max)` : « Nom (copie) », le nom coupé si nécessaire pour garder le suffixe dans la longueur maximale. Utilisé pour dupliquer un graphique, une liste de courses, une fiche.

## Textes venus d'ailleurs

`clipText(text, max)` coupe un texte importé (titre GitHub, libellé de relevé bancaire, ancienne fiche) à la longueur de sa règle.

## Noms de fichiers

- `safeFilename(name)` remplace `\ / : * ? " < > |` et le caractère nul par « - » ; vide : « sans-nom » (`UNNAMED_FILE`).
- `fileName(label, extension)` : nom d'un export ou d'un téléchargement.
- Fichier stocké : nom coupé à 200 caractères puis nettoyé (voir [Fichiers et pièces jointes](files-and-attachments.md)).
- Document sans numéro : « Brouillon » (décision CD), sans parenthèses ni espace final.
