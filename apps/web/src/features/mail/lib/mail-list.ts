/** Done state a list of mails shows: all, those to process, those processed. */
export type DoneFilter = 'all' | 'todo' | 'done';

/** Choices of the done state. */
export const DONE_FILTERS: { value: DoneFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'todo', label: 'À traiter' },
  { value: 'done', label: 'Traités' },
];

/** Orders of a list of mails (by size: only within a folder, where the size is known). */
export const MAIL_SORTS = [
  { value: 'date-desc', label: 'Plus récents' },
  { value: 'date-asc', label: 'Plus anciens' },
  { value: 'correspondent-asc', label: 'Expéditeur (A → Z)' },
  { value: 'correspondent-desc', label: 'Expéditeur (Z → A)' },
  { value: 'subject-asc', label: 'Objet (A → Z)' },
  { value: 'subject-desc', label: 'Objet (Z → A)' },
  { value: 'size-desc', label: 'Plus lourds' },
  { value: 'size-asc', label: 'Plus légers' },
];

/** Orders of the mails read across folders (no size). */
export const MAIL_SORTS_ACROSS = MAIL_SORTS.filter((sort) => !sort.value.startsWith('size'));
