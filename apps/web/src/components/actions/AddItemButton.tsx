import { PlusIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { ActionButton } from './ActionButton';

interface AddItemButtonProps {
  /** Precise label: « Ajouter un numéro », « Ajouter une ligne »… */
  children: ReactNode;
  onClick: () => void;
  /** Icon instead of the « + » (a group of filters…). Optional. */
  icon?: ReactNode;
  /** Nothing left to add. Optional. Default = false. */
  disabled?: boolean;
}

/**
 * Button adding an item to a list of a form (a phone number, a line, a case…), the same everywhere: subtle, small, a
 * « + » and a precise label, on the left under the list.
 * @param {AddItemButtonProps} props Component props.
 * @returns {JSX.Element} Button.
 */
export function AddItemButton({ children, onClick, icon = <PlusIcon aria-hidden />, disabled = false }: AddItemButtonProps) {
  return (
    <ActionButton priority="tertiary" icon={icon} onClick={onClick} disabled={disabled} style={{ alignSelf: 'flex-start' }}>
      {children}
    </ActionButton>
  );
}
