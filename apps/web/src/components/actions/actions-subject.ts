import { linkProps } from './link-props';
import type { RowAction } from './ActionsMenu';

/** What actions are about: an element by its name (quoted: « Actions de « Urgent » »), or described when it has none (« Actions de la barre latérale »). */
export interface ActionsSubject {
  /** Name of the element, quoted in the hidden labels. Optional: `about` when empty. */
  name?: string | null;
  /** The element described, used when `name` is empty (« la barre latérale », « ce temps »). Optional. */
  about?: string;
}

/**
 * What actions are about, in their hidden labels: its name quoted, or its description.
 * @param {ActionsSubject} subject Element.
 * @returns {string} « « Urgent » », « la barre latérale ».
 */
export const subjectText = ({ name, about }: ActionsSubject): string => (name ? `« ${name} »` : (about ?? ''));

/**
 * Props of the icon button of an action, the same in rows and lists (RowActions, InlineActions): its label, its subject,
 * its hint, red when destructive, spinning while it runs, its link.
 * @param {RowAction} action Action.
 * @param {ActionsSubject} subject What it is about.
 * @returns {object} Props of IconAction (but its icon).
 */
export function actionIconProps(action: RowAction, subject: ActionsSubject) {
  return {
    label: action.label,
    ...(subject.name ? { item: subject.name } : { 'aria-label': subject.about ? `${action.label} ${subject.about}` : action.label }),
    hint: action.hint,
    color: action.danger ? 'red' : 'gray',
    disabled: action.disabled,
    loading: action.loading,
    onClick: action.onClick,
    ...linkProps(action),
  };
}
