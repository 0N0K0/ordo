import { useState } from 'react';

/**
 * Mails ticked on the page of a list shown: forgotten when the page changes (another folder, page, filter or search).
 * @param {string} pageKey What the page shows (its folder, page, filters…).
 * @returns {{ selected: K[], setSelected: (items: K[]) => void, tick: (item: K, checked: boolean) => void }} Ticked mails, their change, and a tick of one.
 */
export function usePageSelection<K>(pageKey: string) {
  const [selection, setSelection] = useState<{ key: string; items: K[] }>({ key: '', items: [] });
  const selected = selection.key === pageKey ? selection.items : [];
  /**
   * Ticks these mails of the page.
   * @param {K[]} items Mails.
   * @returns {void}
   */
  const setSelected = (items: K[]) => setSelection({ key: pageKey, items });
  /**
   * Ticks or unticks a mail.
   * @param {K} item Mail.
   * @param {boolean} checked Ticked.
   * @returns {void}
   */
  const tick = (item: K, checked: boolean) => setSelected(checked ? [...selected, item] : selected.filter((other) => other !== item));
  return { selected, setSelected, tick };
}

/**
 * State of the mails ticked, for the actions on them: all done, and the flags they all have.
 * @param {readonly { done: boolean, labelIds: string[] }[]} messages Mails ticked.
 * @param {readonly { id: string }[] | undefined} labels Flags.
 * @returns {{ done: boolean, labelIds: string[] }} State.
 */
export function selectionFlags(messages: readonly { done: boolean; labelIds: string[] }[], labels: readonly { id: string }[] | undefined) {
  const any = messages.length > 0;
  return {
    done: any && messages.every((message) => message.done),
    labelIds: (labels ?? []).map((label) => label.id).filter((id) => any && messages.every((message) => message.labelIds.includes(id))),
  };
}
