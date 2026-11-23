# Dialogues et boutons de formulaire

Briques des confirmations destructives, des boutons de bas de formulaire et du formulaire de libellé seul. Source : `apps/web/src/components/dialogs/`. Les modales elles-mêmes s'ouvrent par `openModal` et les formulaires par `openFormPanel` (voir [Panneaux](panels.md)).

Règle UX : un formulaire s'ouvre dans le panneau latéral ; une modale ne sert qu'aux confirmations (voir [Conventions](../app.md#conventions)).

## `confirm-destructive.tsx`

### `confirmDestructive(options)`

Demande la confirmation d'une action destructive : la modale de toutes (~40 fichiers). Ouvre une modale (`openModal`) avec les risques (`DestructiveRisks`, suivis de « Cette action est irréversible. », ajoutée par lui dans toutes les confirmations destructives) puis les boutons `DestructiveActions` (confirmation rouge d'abord, « Annuler » ensuite, en bas à droite).

Exception : « Annuler » un minuteur ne demande rien (rien de durable n'est perdu, il se relance en deux gestes ; `CountdownControls`).

Options :

- `title` : titre (« Supprimer le budget ») ;
- `risks` : ce que l'action fait et ce qui est perdu ;
- `confirmLabel` (défaut « Supprimer »), `confirmIcon` (défaut corbeille) ;
- `onConfirm` : l'action, une fois confirmée ;
- `run` : l'action en promesse (`mutateAsync`) ; son échec va dans un toast d'erreur (`onMutationError`) ;
- `done` : message de succès de `run` (« Alarme supprimée. »), sinon pas de toast ;
- `onCancel` : ce qui suit un refus (« Annuler », Échap, clic à côté), par exemple pour une confirmation attendue en promesse (`withLossConfirmation`) ;
- `reversible` : l'action inverse la défait (une conversion entre créneau et éphéméride) : « Cette action est irréversible. » n'est pas ajoutée.

`confirmedDestructive(options)` : la même modale attendue en promesse (`title`, `risks`, `confirmLabel`, `confirmIcon`) : résolue une fois confirmée, refusée par `ActionDeclined` (silencieux dans les toasts d'erreur). Utilisée par `withLossConfirmation` et la catégorie d'un statut de tâche (`useTaskStatusItems`).

La modale se ferme avant l'action. eslint interdit d'écrire « irréversible » ailleurs et d'appeler `notifySuccess` dans `onConfirm` (utiliser `run` + `done`).

## `DestructiveActions.tsx`

- `DestructiveActions` : boutons de tout dialogue destructif, en bas à droite : confirmation (rouge plein, `data-autofocus`) puis « Annuler » (`secondary`). Props : `onConfirm`, `onCancel`, `loading`, `confirmLabel` (défaut « Supprimer »), `confirmIcon`. Utilisé par `confirmDestructive` et par les dialogues destructifs à options (agenda, tâches, projets).
- `DeleteButton` : bouton « Supprimer » d'un formulaire (corbeille, rouge plein), à placer dans la zone `danger` de `FormActions` ; la suppression passe par `confirmDestructive`. Props : `onClick`, `loading`, `children` (défaut « Supprimer »).
- `DestructiveRisks({ children, reversible? })` : texte des risques suivi de « Cette action est irréversible. » (constante interne `IRREVERSIBLE`, le seul endroit où la phrase est écrite), sauf `reversible`.
- `CascadeChoice` : choix, lors d'une suppression, pour ce qui dépend de l'élément (sous-tâches, sous-projets) : garder (`'detach'`, libellé `keepLabel`) ou « Les supprimer aussi, définitivement » (`'delete'`, en rouge). Props : `label`, `keepLabel`, `value`, `onChange`. Utilisé par les tâches et les projets.

## `FormActions.tsx`

### `FormActions`

Boutons de tout formulaire et dialogue, en bas à droite : « Annuler » (`secondary`) puis l'action (`primary`, soumet le formulaire). ~65 fichiers. Props :

- `submitLabel` (défaut « Enregistrer » ; `null` : pas de bouton de soumission, dialogue seulement fermé) ;
- `submitIcon` : défaut selon le libellé (fonction interne `defaultSubmitIcon`) : disquette pour « Enregistrer… », « + » pour « Créer… » / « Ajouter… », crayon pour « Renommer », flèches pour « Déplacer » / « Transférer », téléchargement pour « Télécharger… », coche sinon ;
- `onCancel` (sans lui, pas d'« Annuler »), `cancelLabel` (défaut « Annuler »), `cancelIcon` (défaut croix) ;
- `loading`, `disabled` ;
- `onSubmit` : lance une action au lieu de soumettre (bouton `type="button"`) ;
- `autoFocus` : le bouton de soumission prend le focus à l'ouverture ;
- `size` : boutons plus petits pour une édition en place (`xs` : espacement réduit) ;
- `danger` : actions à gauche, à part (« Supprimer » avec `DeleteButton` d'abord).

Les dialogues destructifs ont leurs propres boutons, dans l'ordre inverse (`DestructiveActions`).

## `ask-choice.tsx`, `ChoiceList.tsx`

Question qui n'est pas la confirmation d'une action destructive, posée dans une modale (`openModal`) et attendue en promesse.

- `Choice<T>` (interface) : une réponse : `value`, `label`, `icon`, `danger` (rouge).
- `ChoiceList({ question, choices, onAnswer })` (`ChoiceList.tsx`) : la question, un bouton par réponse (l'un sous l'autre), puis « Annuler » en bas à droite (`FormActions` sans bouton de soumission) ; `onAnswer(null)` pour « Annuler ». Utilisé par `ScopeChoices` (agenda) et `askChoice`.
- `answerInModal(title, render)` : ouvre la modale et attend la réponse que donne son contenu ; `null` si elle est fermée sans réponse (« Annuler », Échap, clic à côté). Utilisé par `askScope` (agenda) et `askChoice`.
- `askChoice(title, question, choices)` : `ChoiceList` dans `answerInModal`. Utilisé par `askSameDay` (routines : « Garder les deux » / « Fusionner »).

eslint interdit une promesse écrite à la main autour d'`openModal` (`answerInModal` ou `askChoice`).

## `LabelForm.tsx`

- `LabelFormProps` (interface) : `initial`, `schema` (règle zod du libellé, ex. `requiredText()` ou `mailFolderNameSchema`), `submitLabel` (« Créer », « Renommer »), `onSubmit(label)` (une promesse garde le formulaire ouvert, en attente ; son échec va sous le champ ou en toast), `onDone`, `fieldLabel` (défaut « Libellé » : « Nom » seulement pour une personne), `placeholder`.
- `LabelForm` : formulaire d'un seul libellé (créer ou renommer une vue, un tableau de bord, un dossier), validé comme les autres (`useAppForm` : au blur puis à chaque changement), envoyé par `useAsyncAction` ; le libellé est passé par `schema.parse` (donc nettoyé). Champ requis, autofocus.

## `open-label-form.tsx`

`openLabelForm(title, props)` : ouvre `LabelForm` dans le panneau latéral (`openFormPanel`), fermé une fois enregistré ou annulé. Seule façon de renommer : aucun renommage en ligne (titre d'un panneau, d'un graphique, arbre des projets, liste des espaces compris) ; utilisé par les espaces, les tâches, les projets, les mails, les tableaux de bord et les vues de `data-table`.
