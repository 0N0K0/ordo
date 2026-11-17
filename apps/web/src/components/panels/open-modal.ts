import type { MantineSize } from '@mantine/core';
import { modals } from '@mantine/modals';
import type { ReactNode } from 'react';

let count = 0;

/**
 * Opens a modal (a confirmation, a question: forms go in the side panel), given a function closing it.
 * @param {ReactNode} title Title of the modal.
 * @param {(close: () => void) => ReactNode} render Content, given its closing.
 * @param {{ size?: MantineSize | string, onClose?: () => void }} [options] Width, and what follows its closing (by its content, Escape or a click outside). Optional.
 * @returns {() => void} Closes the modal.
 */
export function openModal(title: ReactNode, render: (close: () => void) => ReactNode, options: { size?: MantineSize | string; onClose?: () => void } = {}): () => void {
  const modalId = `modal-${++count}`;
  const close = () => modals.close(modalId);
  modals.open({ modalId, title, size: options.size, onClose: options.onClose, children: render(close) });
  return close;
}
