import { ArrowUUpLeftIcon } from '@phosphor-icons/react';
import type { SelectionAction } from '../data-table/selection/SelectionBar';
import { openFormPanel } from '../panels/panels';
import { InheritanceForm, type InheritableFieldOption } from './InheritanceForm';

/**
 * « Héritage… » action of the rows checked or of one row (its menu), the same on every table of sub-items: opens
 * `InheritanceForm` in the side panel; disabled when none of them has a parent.
 * @param {{ fields: readonly InheritableFieldOption<F>[], about: string, withParent: number, onApply: (change: { inheritFields: F[], clearFields: F[] }) => Promise<unknown>, onDone?: () => void }} options Fields, items told, items with a parent, change, after a success (the selection cleared).
 * @returns {SelectionAction} Action.
 */
export function inheritanceRowsAction<F extends string>({
  fields,
  about,
  withParent,
  onApply,
  onDone,
}: {
  fields: readonly InheritableFieldOption<F>[];
  about: string;
  withParent: number;
  onApply: (change: { inheritFields: F[]; clearFields: F[] }) => Promise<unknown>;
  onDone?: () => void;
}): SelectionAction {
  return {
    label: 'Héritage…',
    icon: <ArrowUUpLeftIcon aria-hidden />,
    disabled: withParent === 0,
    onClick: () =>
      openFormPanel('Héritage', (close) => (
        <InheritanceForm
          fields={fields}
          about={about}
          onApply={async (change) => {
            await onApply(change);
            onDone?.();
          }}
          onDone={close}
        />
      )),
  };
}
