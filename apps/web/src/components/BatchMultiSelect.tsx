import { MultiSelect, type MultiSelectProps } from '@mantine/core';
import { useRef, useState } from 'react';

/**
 * Same values, whatever their order.
 * @param {string[]} a Values.
 * @param {string[]} b Values.
 * @returns {boolean} Same.
 */
const sameValues = (a: string[], b: string[]) => a.length === b.length && a.every((item) => b.includes(item));

/**
 * Multi-select checking several options in one go: while its list is open, the choices are a draft, given (once) when
 * it closes; a pill removed with the list closed is given at once. Saving on each choice would redraw what holds it
 * (a table row) and close the list after every click.
 * @param {MultiSelectProps} props Props of Mantine's MultiSelect (value and onChange: the committed value).
 * @returns {JSX.Element} Multi-select.
 */
export function BatchMultiSelect({ value, defaultValue, onChange, onDropdownOpen, onDropdownClose, ...props }: MultiSelectProps) {
  const [uncontrolled, setUncontrolled] = useState<string[]>(defaultValue ?? []);
  const committed = value ?? uncontrolled;
  const [draft, setDraft] = useState<string[] | null>(null);
  const draftRef = useRef<string[] | null>(null);

  /**
   * Gives the value chosen, when it changed.
   * @param {string[]} next Value.
   * @returns {void}
   */
  const commit = (next: string[]) => {
    if (sameValues(next, committed)) return;
    if (value === undefined) setUncontrolled(next);
    onChange?.(next);
  };

  return (
    <MultiSelect
      {...props}
      value={draft ?? committed}
      onDropdownOpen={() => {
        draftRef.current = committed;
        setDraft(committed);
        onDropdownOpen?.();
      }}
      onDropdownClose={() => {
        const next = draftRef.current;
        draftRef.current = null;
        setDraft(null);
        if (next) commit(next);
        onDropdownClose?.();
      }}
      onChange={(next) => {
        if (draftRef.current) {
          draftRef.current = next;
          setDraft(next);
        } else commit(next);
      }}
    />
  );
}
