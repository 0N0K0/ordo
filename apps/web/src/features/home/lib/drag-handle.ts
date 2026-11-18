import { createContext } from 'react';
import type { SortableHandle } from '../../../components/actions/use-sortable-item';

/** Drag handle of a home card being sorted (what its DragHandle takes), null outside a sortable grid. */
export type CardDragHandle = SortableHandle;

/** Drag handle of the home card being sorted, null outside a sortable grid. */
export const DragHandleContext = createContext<CardDragHandle | null>(null);
