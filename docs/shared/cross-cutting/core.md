# Paquet partagé : `core`

Briques transverses de `@ordo/shared` : règles de saisie (textes, noms, couleurs), authentification, mots de passe, espace de travail et projets, géographie, nombres, textes, arbres et collections. Source : `packages/shared/src/core/`. Tout est réexporté par `packages/shared/src/index.ts`, sauf `password-strength.ts`, exposé à part sous `@ordo/shared/password-strength` (voir plus bas).

Voir aussi : [Nommage](../../business-rules/cross-cutting/naming.md), [Erreurs](../../business-rules/cross-cutting/errors.md), [Espaces et accès](../../business-rules/cross-cutting/workspaces-and-access.md), [Fichiers et pièces jointes](../../business-rules/cross-cutting/files-and-attachments.md).

## `rules.ts` — règles de saisie communes

Briques zod réutilisées par tous les schémas de formulaire (web) et d'entrée (API).

| Export                                                        | Rôle                                                                                                                                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TEXT_MAX`                                                    | `250` : longueur maximale d’un texte court libre (libellé, nom, titre, lieu, motif, adresse, libellé de lien… ; décision DO).                                                                                 |
| `LEGAL_TEXT_MAX`                                              | `500` : longueur maximale d’une mention légale de la société ou d’un document comptable (mention de TVA, conditions de règlement, intérêts de retard, immatriculation ; décision DO, complétée).              |
| `PLAIN_TEXT_MAX`                                              | `4000` : longueur maximale d’un texte multiligne sans markdown (zone de texte simple : notes, « Autres mentions »… ; décision DO).                                                                            |
| `MARKDOWN_MAX`                                                | `65 536` : longueur maximale d’un texte markdown (description, commentaire, objectif, note éditée en markdown ; décision DO).                                                                                 |
| `TEXT_TOO_LONG` / `PLAIN_TEXT_TOO_LONG` / `MARKDOWN_TOO_LONG` | Messages « 250 caractères maximum. », « 4 000 caractères maximum. », « Texte trop long. » : un message par taille.                                                                                            |
| `LEGAL_TEXT_TOO_LONG`                                         | Message « 500 caractères maximum. » d’une mention légale.                                                                                                                                                     |
| `shortTextSchema`                                             | Texte court : `trim`, au plus `TEXT_MAX`, peut être vide.                                                                                                                                                     |
| `requiredText(required?)`                                     | Texte court obligatoire : `trim`, au moins 1 caractère (message `required`, par défaut « Le libellé est requis. », décision AD), au plus `TEXT_MAX`.                                                          |
| `optionalText(max?)`                                          | Texte court facultatif : `trim`, au plus `TEXT_MAX` ; une chaîne vide devient `null` ; accepte `null`. Seul un champ à format (numéro de TVA, code d’activité, téléphone) passe sa constante nommée.          |
| `legalTextSchema` / `optionalLegalText()`                     | Mention légale : `trim`, au plus `LEGAL_TEXT_MAX`, peut être vide ; la forme facultative enregistre `null` pour un texte vide. La mention de TVA de la société y ajoute « La mention est requise. ».          |
| `plainTextSchema` / `optionalPlainText()`                     | Texte multiligne : `trim`, au plus `PLAIN_TEXT_MAX` ; la forme facultative enregistre `null` pour un texte vide.                                                                                              |
| `markdownTextSchema` / `markdownSchema`                       | Texte markdown tel qu’écrit (espaces gardés), au plus `MARKDOWN_MAX` ; `markdownSchema` enregistre `null` pour un texte blanc (déplacé de `tasks/tasks.ts`).                                                  |
| `PERSON_NAME_REQUIRED`                                        | Message « Le nom est requis. » (le mot « Nom » est réservé aux personnes, décision AD).                                                                                                                       |
| `personNameSchema`                                            | `requiredText(PERSON_NAME_REQUIRED)` : nom de personne physique ou morale (contributeur, relation, contact, client, contrepartie, entreprise ; décision BB), `TEXT_MAX` comme tout texte court (décision DO). |
| `END_AFTER_START`                                             | Message « La fin doit suivre le début. » (décision Q), pour toute paire début / fin (dates, heures, min / max).                                                                                               |
| `endsAfter(start, end, strict?)`                              | Vrai si `end >= start` (ou `>` si `strict`) ; une borne absente (`null`, `undefined`, `''`) donne toujours vrai. Compare des chaînes (YYYY-MM-DD, HH:MM) ou des nombres.                                      |
| `endAfter(startKey, endKey, strict?)`                         | Paire `[check, issue]` à étaler dans `.refine(...endAfter('from', 'to'))` : l'erreur `END_AFTER_START` est posée sur le champ de fin.                                                                         |

## `auth.ts` — schémas des formulaires d'authentification et de compte

| Export                                                  | Rôle                                                                                                                                                                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `usernameSchema`                                        | Identifiant : `trim`, minuscules, 3 à 32 caractères (« Au moins 3 caractères. », « 32 caractères maximum. »), uniquement `[a-z0-9._-]` (« Lettres, chiffres, « . », « _ » et « - » uniquement. »).              |
| `emailSchema`                                           | Email : `trim`, minuscules, requis (« Champ requis. »), 254 caractères max (« Adresse trop longue. »), format email (« Adresse email invalide. »).                                                              |
| `identifierSchema`                                      | Identifiant saisi à la connexion (nom d'utilisateur ou email) : `trim`, minuscules, requis.                                                                                                                     |
| `passwordSchema`                                        | Nouveau mot de passe : longueur seule, `MIN_PASSWORD_LENGTH` à `MAX_PASSWORD_LENGTH` (« Au moins 12 caractères. », « 128 caractères maximum. »). Le score de robustesse est vérifié par `strongPasswordSchema`. |
| `loginFormSchema` / `LoginFormValues`                   | Connexion : `identifier`, `password` (requis).                                                                                                                                                                  |
| `forgotPasswordFormSchema` / `ForgotPasswordFormValues` | Mot de passe oublié : `identifier`.                                                                                                                                                                             |
| `resetPasswordFormSchema` / `ResetPasswordFormValues`   | Réinitialisation : `password`, `confirmation` ; la confirmation doit être identique (« Les mots de passe ne correspondent pas. », sur `confirmation`).                                                          |
| `changePasswordFormSchema` / `ChangePasswordFormValues` | Changement de mot de passe : `currentPassword` (requis), `password`, `confirmation` (identique).                                                                                                                |
| `changeUsernameFormSchema` / `ChangeUsernameFormValues` | Changement d'identifiant : `username`, `currentPassword`.                                                                                                                                                       |
| `changeEmailFormSchema` / `ChangeEmailFormValues`       | Changement d'email : `email`, `currentPassword`.                                                                                                                                                                |

Interne : `withConfirmation(schema)` ajoute la règle « confirmation identique » ; `currentPasswordSchema` (mot de passe actuel requis).

## `password-rules.ts` — constantes de mot de passe (sans zxcvbn)

Importable par le bundle principal du web (pas de dictionnaire).

| Export                | Rôle                                                                   |
| --------------------- | ---------------------------------------------------------------------- |
| `MIN_PASSWORD_LENGTH` | `12`.                                                                  |
| `MAX_PASSWORD_LENGTH` | `128`.                                                                 |
| `MIN_PASSWORD_SCORE`  | `3` : score zxcvbn minimal (0 à 4) accepté.                            |
| `PasswordStrength`    | Type `{ score: 0–4, warning: string \| null, suggestions: string[] }`. |

## `password-strength.ts` — robustesse (zxcvbn), entrée `@ordo/shared/password-strength`

zxcvbn et ses dictionnaires pèsent environ 1,3 Mo : ce fichier n'est pas dans `index.ts`. L'API l'importe directement, le web le charge à la demande.

| Export                                         | Rôle                                                                                                                                                                                          |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkPasswordStrength(password, userInputs?)` | Score zxcvbn et retours en français (dictionnaires commun et français). `userInputs` (identifiant, email) sont pénalisés. L'instance zxcvbn est créée au premier appel.                       |
| `strongPasswordSchema(userInputs?)`            | `passwordSchema` + score : si la longueur est suffisante et que le score est inférieur à `MIN_PASSWORD_SCORE`, erreur avec l'avertissement zxcvbn ou « Mot de passe trop facile à deviner. ». |

## `workspace.ts` — espaces, projets, libellés, couleurs, limites de fichiers

| Export                                    | Rôle                                                                                                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MAX_ICON_BYTES`                          | 1 Mo : taille maximale d'une icône (espace, projet…).                                                                                                                         |
| `MAX_ATTACHMENT_BYTES`                    | 10 Mo : taille maximale d'un fichier joint à un texte markdown (et des ressources).                                                                                           |
| `ICON_ERRORS`                             | Messages d'icône refusée, identiques web / API : `tooLarge` « Image trop lourde (1 Mo maximum). », `format` « Format non pris en charge (JPG, PNG, WebP ou SVG). ».           |
| `fileTooLarge(name)`                      | Message « « `name` » est trop lourd (10 Mo maximum). ».                                                                                                                       |
| `ICON_MIME_TYPES`                         | Types acceptés pour une icône : `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`.                                                                                     |
| `MAX_PROJECT_DEPTH`                       | `5` : profondeur maximale des sous-projets (un projet racine est au niveau 1).                                                                                                |
| `projectLabelSchema`                      | Libellé de projet : `requiredText()` (non unique).                                                                                                                            |
| `projectLinkSchema` / `ProjectLinkInput`  | Lien de projet : `label` (requis, 250), `url` (http ou https, sinon « Lien invalide (http ou https). »), `note` (facultative, multiligne, 4 000).                             |
| `WORKSPACE_KINDS`                         | `['PRO', 'PERSO']` : espace professionnel (facturation, clients, entreprise) ou personnel.                                                                                    |
| `NOTIFICATION_SOURCES`                    | `['ALARMS', 'CALENDAR', 'MAILS']` : types de notifications qu'un espace peut émettre pendant qu'un autre est ouvert.                                                          |
| `PROJECT_RESOURCE_KINDS`                  | `['FILE', 'LINK']` : ressource de projet téléversée ou lien.                                                                                                                  |
| `workspaceLabelSchema`                    | Libellé d’espace : `requiredText()`.                                                                                                                                          |
| `labelTextSchema`                         | Libellé d’un élément paramétrable (catégorie, statut, étiquette…) : `requiredText()`.                                                                                         |
| `DEFAULT_LABEL_COLOR`                     | `#868e96` (gris Mantine) : couleur d'un libellé créé sans couleur (étiquette GitHub, statut par défaut).                                                                      |
| `colorSchema`                             | Couleur `#rrggbb` (« Couleur invalide (format #rrggbb). »), mise en minuscules.                                                                                               |
| `optionalColorSchema`                     | Couleur facultative : `null` ou `''` l'efface.                                                                                                                                |
| `descriptionSchema`                       | Description d’un projet : `markdownSchema` (affichée en markdown).                                                                                                            |
| `dateSchema`                              | Jour YYYY-MM-DD facultatif (`daySchema().nullable()`).                                                                                                                        |
| `clientFormSchema` / `ClientFormValues`   | Client : `name` (nom de personne), `color` (facultative).                                                                                                                     |
| `projectFormSchema` / `ProjectFormValues` | Projet : `label`, `clientId`, `parentId` (le client est alors hérité du parent), `categoryIds`, `statusId`, `description`, `startDate`, `endDate` (fin après début), `color`. |
| `labelFormSchema` / `LabelFormValues`     | Libellé paramétrable : `label` (requis, 50) et `color` (requise). L'unicité est vérifiée côté API.                                                                            |

## `geo.ts` — lieux et trajets

| Export                        | Rôle                                                                                                                                                                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GeoPoint`                    | Type `{ lat, lon }` (WGS 84, lat −90…90, lon −180…180).                                                                                                                                                                                                        |
| `locatedFields`               | Champs d'un élément localisé (événement, routine) : `locationLat`, `locationLon` (facultatifs), `travelBefore`, `travelAfter` (minutes entières, 0 à 1440, par défaut 0 ; « Durée positive attendue. », « 24 h maximum. »).                                    |
| `TRAVEL_MODES` / `TravelMode` | `CAR`, `BIKE`, `FOOT`.                                                                                                                                                                                                                                         |
| `TRAVEL_MODE_LABELS`          | « Voiture », « Vélo », « À pied ».                                                                                                                                                                                                                             |
| `placeSchema` / `PlaceInput`  | Lieu enregistré (« Maison », « Bureau »…) : `label` (requis, 60), `address` (300 max), `lat` / `lon`, `parentId` (zone dans un autre lieu, ex. une pièce). Un lieu sans parent doit avoir un point : sinon « Choisissez une adresse proposée. » sur `address`. |
| `travelMinutes(seconds)`      | Durée d'un trajet arrondie aux 5 minutes supérieures.                                                                                                                                                                                                          |

## `numbers.ts` — nombres

| Export                               | Rôle                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| `LOCALE`                             | `'fr-FR'` : locale de tous les textes du web et de l'API.                              |
| `formatNumber(value, decimals = 2)`  | « 1 234,5 » : au plus `decimals` décimales (formats mis en cache).                     |
| `formatPercent(value, decimals = 2)` | « 12,5 % » (taux donné en pourcents).                                                  |
| `twoDigits(value)`                   | Nombre sur deux chiffres (« 07 ») : heures, minutes, jours, mois, canaux hexadécimaux. |

## `text.ts` — textes, noms, fichiers, accords

| Export                                          | Rôle                                                                                                                                                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collator`                                      | `Intl.Collator('fr', { sensitivity: 'base', numeric: true })` : tri des noms sans casse ni accents, nombres par valeur (« 2 » avant « 10 »).                                                                           |
| `normalize(text)`                               | Minuscules sans accents (recherche).                                                                                                                                                                                   |
| `nameKey(name)`                                 | Clé d'un nom (décision CB) : espaces de bord retirés, espaces internes réduits à un, sans casse ni accents. Deux noms de même clé sont le même nom (unicité).                                                          |
| `sameName(a, b)`                                | Égalité des `nameKey`.                                                                                                                                                                                                 |
| `UNNAMED_FILE`                                  | `'sans-nom'`.                                                                                                                                                                                                          |
| `safeFilename(name)`                            | Remplace `\ / : * ? " < > \|` et le caractère nul par « - », `trim` ; « sans-nom » si vide.                                                                                                                            |
| `fileName(label, extension)`                    | Nom de fichier d'un export : `safeFilename(label)` + `.extension`.                                                                                                                                                     |
| `clipText(text, max?)`                          | Texte coupé à `max` (par défaut `TEXT_MAX`) : titre venu de GitHub, libellé de relevé, libellé construit (« Nom — client »).                                                                                           |
| `copyName(name)`                                | « Nom (copie) », le nom coupé pour que le tout tienne dans `TEXT_MAX` avec son suffixe.                                                                                                                                |
| `fitName(before, name, after?)`                 | Nom entre des mots fixes (« Report de l’évènement « X » », « Facture N — client ») : le nom est coupé pour que le tout tienne dans `TEXT_MAX`, les mots fixes restent entiers (coupé en entier s’ils dépassent seuls). |
| `plural(count, word, many?)`                    | Pluriel au-delà de 1 (français : 0 et 1 au singulier).                                                                                                                                                                 |
| `agreed(word, feminine?, count?)`               | Accord d'un participe / adjectif (« supprimé », « archivées »).                                                                                                                                                        |
| `countOf(count, word, many?)`                   | « 1 tâche », « 3 tâches ».                                                                                                                                                                                             |
| `countWith(count, word, [one, several], many?)` | « sa tâche » / « ses 3 tâches », « de la tâche » / « des 2 tâches ».                                                                                                                                                   |
| `ellipsis(text, max)`                           | Coupe avec « … » (ellipse comprise dans `max`).                                                                                                                                                                        |
| `escapeText(text)`                              | Texte échappé pour du HTML (`&`, `<`, `>`, `"`) : contenu d'un élément ou valeur d'un attribut entre guillemets.                                                                                                       |
| `capitalize(text)`                              | Première lettre en capitale.                                                                                                                                                                                           |

## `tree.ts` — arbres (projets, lieux, catégories…)

| Export                                  | Rôle                                                                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `LEVEL`                                 | `' › '` : séparateur de chemin (« Maison › Cuisine »).                                                                  |
| `TreeItem`                              | `{ id, parentId? }`.                                                                                                    |
| `subtreeOf(items, id, withSelf = true)` | L'élément et tous ses descendants (cycles stoppés).                                                                     |
| `lineageOf(byId, id)`                   | L'élément puis ses ancêtres, le plus proche d'abord.                                                                    |
| `ancestorsOf(byId, id)`                 | Ancêtres seuls.                                                                                                         |
| `pathOf(byId, id, label)`               | Chemin complet du haut vers l'élément, joint par `LEVEL`.                                                               |
| `childrenByParent(items)`               | Enfants par parent ; parent absent : niveau racine (`null`).                                                            |
| `reaches(next, starts, target)`         | Vrai si `target` est atteignable depuis `starts` (chaîne de blocage, dépendances), cycles stoppés.                      |
| `isUnderOrSelf(parentOf, start, id)`    | Vrai si `id` est `start` ou un de ses ancêtres : déplacer `id` sous `start` le mettrait sous lui-même (refus de cycle). |

## `collections.ts` — listes

| Export                                | Rôle                                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `mapById(items)`                      | `Map` par `id` (le dernier gagne).                                                                       |
| `groupBy(items, keyOf)`               | Groupes par clé, dans l'ordre d'apparition.                                                              |
| `byPosition(a, b)`                    | Comparateur par `position` (ordre manuel, voir [Ordre](../../business-rules/cross-cutting/ordering.md)). |
| `countBy(items, keysOf)`              | Nombre d'éléments par clé (une ou plusieurs clés par élément).                                           |
| `changedList(list, added?, removed?)` | Liste d'ids avec ajouts et retraits, sans doublon (modifications groupées).                              |
| `sumOf(items, valueOf)`               | Somme (0 pour une liste vide).                                                                           |
| `movedTo(others, moved, index)`       | Liste avec un élément inséré à un index borné (réordonnancement).                                        |
| `joinedKey(...parts)`                 | Clé composite « a\|b » (partie absente : vide).                                                          |
