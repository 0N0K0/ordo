# Markdown : éditeur, rendu, références

L'éditeur markdown façon GitHub et le rendu des textes (descriptions, commentaires, notes), avec références de tâches « #12 », mentions « @ », listes de tâches cochables et pièces jointes. Source : `apps/web/src/components/markdown/`.

## `MarkdownEditor.tsx`

### `MarkdownSuggestions` (interface)

Ce que l'éditeur propose à la saisie : `projectId` (projet du texte : ses tâches viennent d'abord, sans leur projet), `tasks` (`ReferenceTask[]`), `contributors` (`{ handle, name, avatarUrl }[]`).

### `MarkdownEditor`

Champ markdown à la GitHub (~17 fichiers : tâches, trésorerie, temps, facturation, achats, routines…). Props : `value`, `onChange`, `suggestions`, `label`, `placeholder` (défaut « Écrivez en markdown… »), `minRows` (6, jusqu'à 30 lignes en hauteur auto), `autoFocus`, `error` (sous le champ, en rouge), `onSubmitShortcut` (Ctrl/⌘ + Entrée), `onBlur`.

Fonctionnement :

- onglets « Écrire » / « Aperçu » (l'aperçu est un `MarkdownView` dont les cases restent cochables ; vide : « Rien à prévisualiser. ») ;
- barre d'outils « Mise en forme » (onglet Écrire), table `COMMANDS` : « Titre » (`### `), « Gras » (Ctrl+B), « Italique » (Ctrl+I), « Citation », « Code » (Ctrl+E : en ligne, ou bloc si plusieurs lignes, fonction interne `codeCommand`), « Lien » (Ctrl+K), « Liste à puces », « Liste numérotée », « Liste de tâches », « Mentionner un contributeur » (insère « @ »), « Référencer une tâche » (insère « # ») ; les commandes s'annulent si la sélection est déjà mise en forme ;
- « Joindre des fichiers » : fichiers choisis, glissés ou collés, envoyés (`uploadAttachment`) et insérés un par ligne (image affichée, autre fichier en lien) ; taille maximale `MAX_ATTACHMENT_BYTES` (message `fileTooLarge`), échecs en toast ; pied « Envoi de N fichiers… » pendant l'envoi ;
- Entrée continue une liste (« - », « * », « 1. », « - [ ] », « > ») ou la termine sur un élément vide ;
- coller une URL sur une sélection en fait un lien ;
- autocomplétion « # » (tâches : numéro ou libellé, celles du projet du texte d'abord, 8 au plus ; insère `[#12](?task=<id>)`) et « @ » (contributeurs : handle ou nom ; insère `@handle`) ; flèches, Entrée / Tab pour choisir, Échap pour fermer ;
- les modifications passent par `document.execCommand` pour garder l'historique d'annulation natif (fonction interne `apply`) ;
- pied : « Markdown pris en charge — « # » pour une tâche, « @ » pour un contributeur. Glissez, collez ou joignez des fichiers. ».

Fonctions internes : `triggerCommand`, `codeCommand`. Constantes : `MAX_SUGGESTIONS` (8), `LIST_ITEM`. Styles : `MarkdownEditor.module.css`.

## `MarkdownView.tsx`

### `MarkdownView`

Rendu GitHub Flavored Markdown (tableaux, listes de tâches, barré, liens automatiques), assaini (`rehype-sanitize`, l'attribut `dataTaskOffset` autorisé sur `li`), avec les références « #12 » en liens. Props : `children` (source), `targets` (`ReferenceTargets`), `emptyText` (défaut « Aucune description. », en italique atténué), `onChange` (avec lui, les cases des listes de tâches se cochent et la source est mise à jour, affichée tout de suite en attendant l'enregistrement ; sans lui, cases en lecture seule).

Composants internes :

- `MarkdownLink` : un lien « ?task=… » ouvre la tâche par-dessus la page courante (paramètre ajouté à l'URL) ; `/api/attachments/…` passe par `FileLink` de `features/files` (PDF et images dans la visionneuse, autres fichiers téléchargés) ; un chemin interne passe par le routeur ; un lien externe s'ouvre dans un nouvel onglet ;
- `MarkdownImage` : image à la largeur du texte, ouverte en grand au clic.

Exception eslint connue : ce fichier importe `features/files` (une brique commune ne dépend normalement pas d'une feature).

## `remark-references.ts`

- `ReferenceTask` (interface) : tâche référençable : `id`, `projectId` (null : sans projet), `number` (numéro dans son projet, null sans projet), `label`, `place` (« Client › Projet › Sous-projet »).
- `ReferenceTargets` (interface) : `projectId` du texte (« #12 » = tâche 12 de ce projet ; sans projet, « #12 » reste du texte), `taskById`, `taskByNumber` (clé `<projectId>:<number>`).
- `taskNumberKey(projectId, number)` : clé `« <projectId>:<number> »`.
- `referenceTargets(tasks)` : `taskById` et `taskByNumber` (seules les tâches d'un projet ont un numéro).
- `NO_TARGETS` : cibles d'un texte sans références. `NO_SUGGESTIONS` : suggestions vides (pas de tâche ni de contributeur).
- `referenceLabel(task, projectId)` : libellé d'une référence vue depuis le projet du texte (via `taskShortRef` avec `task.place`).
- `taskShortRef(task, projectId, place)` : « #12 » dans le même projet, « Projet #12 » sinon, le libellé pour une tâche sans projet.
- `taskReferenceUrl(id)` : adresse d'une tâche dans un texte, `?task=<id>` (par id : le numéro change avec un transfert).
- `remarkReferences(targets)` : plugin remark : un « #12 » tapé devient un lien vers la tâche 12 du projet du texte ; un lien `?task=<id>` affiche le numéro actuel (avec client et projet si autre projet). Numéros inconnus et mentions « @handle » restent du texte (décision DK). Pas de remplacement dans les liens, le code et les définitions ; « a#1 » (collé à un mot) n'est pas touché.

## `task-list.ts`

- `remarkTaskOffsets()` : plugin remark : chaque élément de liste de tâches porte la position de son début dans la source (`dataTaskOffset`).
- `toggleTask(source, offset)` : source avec la case de cet élément basculée (`[ ]` ↔ `[x]`), inchangée sans case sur sa première ligne.

## `markdown-commands.ts`

Fonctions pures d'édition (texte + sélection → `EditResult` `{ value, selectionStart, selectionEnd }`) :

- `wrapSelection(value, start, end, before, after, placeholder)` : entoure la sélection (ou un texte par défaut) de marqueurs ; les retire si déjà présents ;
- `prefixLines(value, start, end, prefix)` : préfixe chaque ligne touchée (listes, citation, titre ; fonction pour les listes numérotées) ; retire le préfixe si toutes l'ont ;
- `insertLink(value, start, end, url?)` : `[texte](url)`, « url » sélectionné pour être saisi ;
- `ReferenceToken` (interface) et `referenceAt(value, caret)` : le « #… » ou « @… » en cours de saisie avant le curseur ;
- `completeReference(value, token, caret, reference)` : remplace le jeton par la référence suivie d'un espace ;
- `isUrl(text)` : un texte collé est une seule URL http(s).

## `attachments.ts`

- `uploadAttachment(file)` : envoie un fichier (mutation GraphQL `uploadAttachment`) et rend `{ id, filename, url, isImage }`. Utilisé par l'éditeur et les mails.
- `attachmentMarkdown(attachment)` : markdown d'une pièce jointe : `![nom](url)` pour une image, `[nom](url)` sinon (crochets échappés).

Voir aussi [Fichiers et pièces jointes](../../business-rules/cross-cutting/files-and-attachments.md).
