# Nommage : libellés, noms, doublons, limites

Règles communes aux libellés et aux noms : mots employés, longueurs maximales, unicité, comparaison des noms, copies et noms de fichiers. Sources : `packages/shared/src/core/rules.ts`, `packages/shared/src/core/text.ts`, `packages/shared/src/core/workspace.ts`, `apps/api/src/services/core/labels.ts`, `apps/api/src/graphql/errors.ts`, `apps/api/prisma/schema.prisma`.

Voir aussi : [core](../../shared/cross-cutting/core.md), [Erreurs](errors.md), [Archivage](archiving.md).

## Libellé ou nom

- Le champ s'appelle « Libellé » pour tout `label` ; « Nom » seulement pour les personnes physiques ou morales (contributeurs, relations, contacts, clients, tiers, entreprise).
- Dans la base, l'API et les données JSON (sources des fiches, jeux de données des graphiques, instantané de prestation), tout libellé s'appelle `label`, titres et espaces de travail compris ; seules les personnes gardent `name` : contributeurs, utilisateurs, relations, contacts, clients, tiers de trésorerie.
- Message d'un libellé vide : « Le libellé est requis. » (`requiredText`) ; d'un nom vide : « Le nom est requis. » (`personNameSchema`) ; variantes : « Le prénom est requis. », « Le nom de la société est requis. », « Le numéro est requis. ».
- Tout libellé est « trimé » ; un texte facultatif vide est enregistré `null` (`optionalText`).
- Message de longueur : « 250 caractères maximum. » (texte court), « 500 caractères maximum. » (mention légale), « 4 000 caractères maximum. » (zone de texte), « Texte trop long. » (markdown).

## Mots employés

- Un horaire prévu de l'agenda (`WorkSchedule`) s'appelle partout « créneau » (« un créneau », « Créneaux de travail » en PRO, « Créneaux » en PERSO, « Type de créneau »), dans l'interface, les messages de l'API et la documentation. Les heures d'un créneau un jour donné sont ses « horaires » (« Créneau du 12 mai » dans le formulaire du jour, « Horaires retirés du créneau. ») ; un intervalle de dates qui n'est pas un créneau est une « période ».
- « Ouverture » et « Échéance » : les deux jours qui bornent une tâche (`minDate`, `deadline`) s'appellent « Ouverture » et « Échéance » (« l'ouverture », « l'échéance », au féminin ; « date d'ouverture » quand un groupe nominal se lit mieux) ; le jour dès lequel une occurrence de routine peut être faite (`opensOn`, son premier jour) s'appelle aussi « Ouverture ». « À partir du » ne sert que dans les phrases ordinaires et pour les dates de début d'une alarme, d'un créneau, d'une recherche de mails ou d'une livraison.
- Copier un élément se dit partout « Dupliquer » (la copie, « … (copie) », est enregistrée tout de suite puis ouverte) ; « Cloner » n'est pas employé.
- Changer une tâche en routine ou une routine en tâche se dit « Transformer en routine » / « Transformer en tâche » (toasts « Tâche transformée en routine : choisissez sa répétition. », « Routine transformée en tâche. »).
- Un créneau d'une autre nature (vacances, jours fériés, anniversaires…) s'appelle « éphéméride », au féminin (« une éphéméride », « cette éphéméride », « Éphémérides », « Nouvelle éphéméride », « Types d'éphémérides », « Éphéméride créée. », « Aucune éphéméride. ») ; changer de nature se dit « Convertir en éphéméride » / « Convertir en créneau » (et « Convertir en type d'éphémérides » / « Convertir en type de créneaux ») ; les périodes d'un contexte de trésorerie sont ses éphémérides.
- L'anniversaire d'une personne s'appelle « Anniversaire de Paul — 40 ans » (« — 1 an » ; sans âge quand l'année de naissance n'est pas connue), dans l'agenda et les rappels ; les champs des personnes sont « Date de naissance », « Rappels d’anniversaire », « Adresses mail » (« Ajouter une adresse », « Libellé de l’adresse mail », « Retirer l’adresse »), « Téléphones » ; un rappel quelques jours avant se dit « N jours avant, à HH:MM » (« 1 jour avant, à 09:00 »).
- Dans une condition de créneaux, l'anniversaire d'une personne se dit « Anniversaire de Paul (éphéméride) » (parmi les créneaux) et tous les anniversaires « Anniversaires (éphéméride) » (parmi les types) ; celui d'une personne qui n'en a pas ou plus (archivée, retirée) « anniversaire retiré ».
- Un rappel d'évènement compte depuis « le début » ou « la fin » (« À la fin », « 15 min avant la fin », « À 18:00, le dernier jour », « 3 jours avant le premier jour, à 09:00 ») ; un rappel de routine depuis « le début de l’ouverture », « la fin de l’ouverture », « le début de l’échéance » ou « la fin de l’échéance » (« Au début de l’ouverture », « 15 min avant la fin de l’échéance », « À 18:00, le jour de l’échéance », « 3 jours avant l’ouverture, à 09:00 ») ; l'éditeur : « Ajouter un rappel », « Le jour J » (« Chaque jour » pour une tâche), « min » / « h » / « jours », « avant », « Depuis », « à », « Ce rappel est déjà dans la liste. » ; la « sonnerie » est le son choisi (« Sonneries » d'un rappel, « Celle des réglages »), « Sonnerie des alarmes » la section des réglages (« Durée de la sonnerie », « Répéter toutes les », « En boucle », « Sonner hors de l’app », « Écouter ») ; le toast offre « Arrêter » et « Répéter dans N min », et dit « Sonne à nouveau à HH:MM ».
- Le **chrono** mesure le temps passé (« Démarrer le chrono », « Chrono démarré. », « Chrono en cours », « Arrêter le chrono », « 2 chronos », « Arrêter tout », « 2 chronos arrêtés. ») ; le **minuteur** compte à rebours et sonne à la fin (« un minuteur », « Nouveau minuteur », « Lancer un minuteur », « Lancer », « Minuteur lancé : 10 min. », « Minuteur de 10 min terminé », « + 1 min », « Annuler », sans confirmation, « Minuteur annulé. », « Aucun minuteur en cours. » ; sans nom : « Minuteur ») ; un **temps mort** est une attente d’une tâche ou d’une routine (« un temps mort », « Temps morts », « Ajouter un temps mort », « Lancer « Lave-linge (1 h 30) » », « Lancer un temps mort · Lessive ») ; ni le minuteur ni le temps mort ne sont du temps passé.
- « Sonner hors de l’app » envoie des **notifications push** aux **appareils** (« un appareil », « Cet appareil », « Recevoir sur cet appareil », « Tester », « Retirer », « Retirer l’appareil », « Appareil retiré. », « Aucun appareil ne reçoit les sonneries hors de l’app. ») ; la notification garde les boutons du toast, « Arrêter » et « Répéter dans N min ».
- Personnes : « Contributeurs » et « Relations » en PRO, « Contributeurs » et « Proches » en PERSO ; le profil de l'utilisateur s'affiche « Prénom (moi) » partout.
- Catégories de statut, accordées avec le nom qualifié : « Terminé » / « Annulé » pour un statut, « Terminée » / « Annulée » pour une tâche comptée ou groupée par elles (`TASK_STATUS_CATEGORY_LABELS`).
- Sens d'un mouvement : « Entrées » / « Sorties » partout.
- États d'une période : « À venir », « En cours », « Passée ».
- Pliage d’un élément ou d’un groupe : « Développer » / « Réduire » ; le menu de la barre latérale offre « Tout déplier » / « Tout replier ».
- Un évènement sur des jours entiers : « Journée entière », avec un interrupteur.
- Calques de l'agenda venus d'un autre espace : suffixe « · Espace ».
- Compte mail : « Nom <adresse> » partout (`accountLabel`).
- Menu d'actions d'un élément : « Actions de « X » », le nom entre guillemets.
- Bouton icône : l'infobulle dit l'action (« Modifier ») ; le libellé caché, lu par les lecteurs d'écran, dit l'action et l'élément (« Modifier « Urgent » »). Une cellule modifiable sur une sélection ajoute « (appliqué aux N cellules sélectionnées) ».
- Confirmation destructive : elle dit toujours « Cette action est irréversible. ».

## Longueurs maximales

Une seule taille par sorte de texte, partout dans l'application (`packages/shared/src/core/rules.ts`).

| Sorte de texte                                                                                                                                                                                                                                                                                                                                 | Max    | Constante, schémas                                                                 | Message                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------- | ----------------------------- |
| Texte court libre : libellés de tous les items et des listes de réglages, noms de personnes (un seul schéma, `personNameSchema`), titres, lieu, adresse, motif, libellé de lien, recherche, critères de recherche mail, capital et mode de règlement de la société et des documents comptables                                                                        | 250    | `TEXT_MAX` ; `requiredText`, `optionalText`, `shortTextSchema`, `personNameSchema` | « 250 caractères maximum. »   |
| Zone de texte simple (plusieurs lignes, sans markdown) : notes de fiche, de ressource de projet, de relance, de tiers et de relation, description d'une alarme, « Autres mentions »                                                                                                                                                            | 4 000  | `PLAIN_TEXT_MAX` ; `plainTextSchema`, `optionalPlainText`                          | « 4 000 caractères maximum. » |
| Mention légale de la société et des documents comptables : mention d'exonération de TVA, conditions de règlement, intérêts de retard, immatriculation                                                                                                                                                                                          | 500    | `LEGAL_TEXT_MAX` ; `legalTextSchema`, `optionalLegalText`                          | « 500 caractères maximum. »   |
| Markdown : description (tâche, routine, évènement, projet, jalon, temps, ligne et produit du catalogue, document importé, mouvement de trésorerie), commentaire, objectif de sprint, introduction et conclusion d'un document comptable, note d'un produit, note d'un mouvement de stock, note d'un inventaire                                  | 65 536 | `MARKDOWN_MAX` ; `markdownSchema`, `markdownTextSchema`, `commentBodySchema`       | « Texte trop long. »          |

- Un champ édité avec l'éditeur markdown compte comme markdown (description d'une routine, d'un temps).
- Hors règle, chacun avec sa constante nommée : les champs à format (identifiant de mention 2 à 39, `HANDLE_MAX` ; identifiant de connexion 3 à 32 ; email 254 ; couleur ; heure ; clé de tableau 64, `TABLE_KEY_MAX` ; code postal 20 ; téléphone 30 ; numéro de TVA 20 ; code d'activité 20 ; SIREN, SIRET, IBAN, BIC ; serveur et identifiant de boîte mail 255 ; objet d'un mail 998), les adresses URL, la signature HTML d'une boîte mail (100 000, « Signature trop longue. »), le nom d'un fichier stocké (coupé à 200).
- Le web reprend les mêmes constantes pour `maxLength` (l'éditeur markdown est limité à `MARKDOWN_MAX`).
- La migration `20261119150000_text_sizes` a raccourci les valeurs enregistrées plus longues, documents comptables définitifs compris (leurs textes, leurs lignes et la société figée comme vendeur) : c'est la seule exception à la règle « un document définitif n'est jamais modifié ».
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
| Contexte de dépense                      | l'espace (c'est un type d'éphémérides : même unicité que les types)                                         | « Un type porte déjà ce libellé. »                                                  |
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

Deux noms sont le même nom s'ils ont la même clé `nameKey` : espaces de bord retirés, espaces internes réduits à un, sans casse ni accents (« eleve » = « Élève »). `sameName(a, b)` compare deux noms ; c'est la seule règle de comparaison, reprise par `labelKey` et `productKey`.

- Le web s'en sert pour ne pas proposer de créer une valeur qui existe déjà dans une liste « créable » (`apps/web/src/components/inputs/creatable.ts`), et pour retrouver un produit par son libellé.
- `productKey` (voir [shopping](../../shared/supplies/shopping.md)) en dérive : deux lignes de même libellé et unité (clé) sont le même produit dans les fiches, les listes et le stock.
- La synchronisation GitHub compare les étiquettes par `nameKey`.
- Tri des noms : `collator` français, sans casse ni accents, nombres par valeur.

## Identifiants de mention

- `handleSchema` : minuscules, chiffres, « - » et « _ », 2 à 39 caractères, ni « - » ni « _ » au début ou à la fin.
- `suggestHandle(name)` propose un identifiant depuis un nom ; `freeHandle` (`apps/api/src/services/projects/contributors.ts`) trouve un identifiant libre : « membre » si le nom est trop court, puis `-suffixe` et un numéro (« tom », « tom-2 » ; pour le profil « Moi » : « tom », « tom-moi », « tom-moi-2 »).

## Copies

`copyName(name)` : « Nom (copie) », le nom coupé si nécessaire pour garder le suffixe dans les 250 caractères. Utilisé par « Dupliquer » : un graphique, une liste de courses, une fiche, une tâche, une routine, une alarme, un évènement, une vue, un créneau, un mouvement ou une prévision de trésorerie.

## Textes venus d'ailleurs

`clipText(text, max?)` coupe un texte importé (titre GitHub, libellé de relevé bancaire, ancienne fiche) à la longueur de sa règle, 250 par défaut.

## Noms de fichiers

- `safeFilename(name)` remplace `\ / : * ? " < > |` et le caractère nul par « - » ; vide : « sans-nom » (`UNNAMED_FILE`).
- `fileName(label, extension)` : nom d'un export ou d'un téléchargement.
- Fichier stocké : nom coupé à 200 caractères puis nettoyé (voir [Fichiers et pièces jointes](files-and-attachments.md)).
- Document sans numéro : « Brouillon », sans parenthèses ni espace final.
