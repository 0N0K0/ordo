import { createContext } from 'react';
import type { SortableHandle } from '../../../components/dnd/use-sortable-item';

/** Drag handle of the home card being sorted (what its DragHandle takes), null outside a sortable grid. */
export const DragHandleContext = createContext<SortableHandle | null>(null);
