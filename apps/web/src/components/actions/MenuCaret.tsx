import { CaretDownIcon } from '@phosphor-icons/react';

/**
 * Arrow of a button opening a menu or a panel, the same everywhere (the menu target gives the button its
 * `aria-haspopup` and `aria-expanded`).
 * @param {{ size?: number }} props Component props: its size (optional, default = 12; 10 in a badge).
 * @returns {JSX.Element} Arrow.
 */
export function MenuCaret({ size = 12 }: { size?: number }) {
  return <CaretDownIcon aria-hidden size={size} />;
}
