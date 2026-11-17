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
