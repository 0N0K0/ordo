import type { MantineSize } from '@mantine/core';
import { modals } from '@mantine/modals';
import { createElement, type ReactNode } from 'react';
import { InModalContext } from '../dialogs/in-modal';

let count = 0;

/**
 * Opens a modal (a confirmation, a question, a sub-form of a field: forms go in the side panel), given a function
 * closing it. Its buttons (`FormActions`, `DestructiveActions`) go to its footer, always visible (`InModalContext`).
 * @param {ReactNode} title Title of the modal.
 * @param {(close: () => void) => ReactNode} render Content, given its closing.
 * @param {{ size?: MantineSize | string, onClose?: () => void }} [options] Width, and what follows its closing (by its content, Escape or a click outside). Optional.
 * @returns {() => void} Closes the modal.
 */
export function openModal(title: ReactNode, render: (close: () => void) => ReactNode, options: { size?: MantineSize | string; onClose?: () => void } = {}): () => void {
  const modalId = `modal-${++count}`;
  const close = () => modals.close(modalId);
  // eslint-disable-next-line no-restricted-syntax -- openModal itself.
  modals.open({ modalId, title, size: options.size, onClose: options.onClose, children: createElement(InModalContext.Provider, { value: true }, render(close)) });
  return close;
}
