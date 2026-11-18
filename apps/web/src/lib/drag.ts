import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

/**
 * Swallows the click fired by releasing the pointer at the end of a drag (it would open, sort or select what is under
 * the pointer).
 * @returns {void}
 */
export function suppressClickAfterDrop(): void {
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 100);
}

/** Pixels the pointer moves before a drag starts: a click stays a click (on a tab, a handle…). */
const DRAG_DISTANCE = 5;

/**
 * Sensors of a drag and drop, the same everywhere: the pointer, after a few pixels; and the keyboard when asked (moving
 * in a sortable list, or plainly).
 * @param {'sortable' | 'plain' | false} [keyboard] Keyboard sensor: for a sortable list, plain, or none. Optional. Default = none.
 * @returns {ReturnType<typeof useSensors>} Sensors, for a DndContext.
 */
export function useDragSensors(keyboard: 'sortable' | 'plain' | false = false) {
  const pointer = useSensor(PointerSensor, { activationConstraint: { distance: DRAG_DISTANCE } });
  const keys = useSensor(KeyboardSensor, keyboard === 'sortable' ? { coordinateGetter: sortableKeyboardCoordinates } : {});
  const pointerOnly = useSensors(pointer);
  const withKeys = useSensors(pointer, keys);
  return keyboard ? withKeys : pointerOnly;
}
