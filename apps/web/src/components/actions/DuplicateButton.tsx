import { CopyIcon } from '@phosphor-icons/react';
import { useAsyncAction } from '../../lib/use-async-action';
import { duplicateItems, type DuplicateOptions } from '../data-table/selection/selection-actions';
import { ActionButton } from './ActionButton';
import { IconAction } from './IconAction';

// eslint-disable-next-line no-restricted-syntax -- the one « Dupliquer » button.
const DUPLICATE = 'Dupliquer';

type DuplicateButtonProps<R, C> = DuplicateOptions<R, C> & {
  /** Item copied. */
  item: R;
  /** Tooltip (what is copied). Optional. */
  hint?: string;
  /** Icon alone (a toolbar), its label in its tooltip. Optional. Default = a secondary button with its label. */
  iconOnly?: boolean;
  /** Size of the icon alone. Optional. */
  size?: 'md' | 'lg';
};

/**
 * « Dupliquer » button of a form or of a toolbar (decision D20): the copy is saved at once (`duplicateItems`), told in
 * a toast, then opens; the button waits meanwhile. The menus take `duplicateRowsAction` instead.
 * @param {DuplicateButtonProps<R, C>} props Component props.
 * @returns {JSX.Element} Button.
 */
export function DuplicateButton<R, C>({ item, hint, iconOnly = false, size, ...options }: DuplicateButtonProps<R, C>) {
  // duplicateItems tells its own success and failure.
  const { run, loading: pending } = useAsyncAction(() => duplicateItems([item], options));
  if (iconOnly) {
    return (
      <IconAction label={DUPLICATE} hint={hint} size={size} disabled={pending} onClick={() => void run()}>
        <CopyIcon aria-hidden />
      </IconAction>
    );
  }
  return (
    <ActionButton priority="secondary" hint={hint} icon={<CopyIcon aria-hidden />} loading={pending} onClick={() => void run()}>
      {DUPLICATE}
    </ActionButton>
  );
}
