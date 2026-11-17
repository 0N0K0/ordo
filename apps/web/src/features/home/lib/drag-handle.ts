import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { createContext } from 'react';

/** Drag handle of a home card being sorted: attributes and listeners of dnd-kit, null outside a sortable grid. */
export const DragHandleContext = createContext<{ attributes: DraggableAttributes; listeners: DraggableSyntheticListeners } | null>(null);
