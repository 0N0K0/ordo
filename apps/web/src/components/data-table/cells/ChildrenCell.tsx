import { Group } from '@mantine/core';
import { PlusIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { IconAction } from '../../actions/IconAction';
import { stopClick } from './cell-field';
import { StackedValues } from './StackedValues';

/** Button adding a child to the element of the row: « Ajouter une sous-tâche » to « Courses ». */
interface AddChild {
  /** Action (« Ajouter une sous-tâche »). */
  label: string;
  /** Name of the element of the row, for the screen readers. */
  name: string;
  onClick: () => void;
}

/**
 * Cell of the children of a row (sub-tasks, sub-routines): them one under the other, then the « + » adding one (none
 * when the row is read only).
 * @param {{ children: ReactNode, add?: AddChild | false }} props The children (one element each), and the button adding one (optional).
 * @returns {JSX.Element} Cell.
 */
export function ChildrenCell({ children, add }: { children: ReactNode; add?: AddChild | false }) {
  return (
    <Group gap={4} wrap="nowrap" align="flex-start" onClick={stopClick} style={{ minWidth: 0 }}>
      <StackedValues>{children}</StackedValues>
      {add && (
        <IconAction label={add.label} size="sm" item={add.name} onClick={add.onClick} style={{ flex: 'none' }}>
          <PlusIcon aria-hidden />
        </IconAction>
      )}
    </Group>
  );
}
