import { modals } from '@mantine/modals';
import type { ComposeOptions } from './compose-options';
import { MailComposer } from './MailComposer';

let modalCount = 0;

/**
 * Opens the mail writing form in a modal; closing it asks whether to keep the draft.
 * @returns {(options?: ComposeOptions) => void} Opener.
 */
export function useMailComposer() {
  return (options: ComposeOptions = {}) => {
    const modalId = `mail-composer-${++modalCount}`;
    modals.open({
      modalId,
      title: options.draft ? 'Brouillon' : options.forwarding ? 'Transférer' : options.inReplyTo ? 'Répondre' : 'Nouveau mail',
      size: 'xl',
      // Closing goes through the form, which asks whether to keep the draft.
      closeOnClickOutside: false,
      closeOnEscape: false,
      withCloseButton: false,
      children: <MailComposer options={options} onDone={() => modals.close(modalId)} />,
    });
  };
}
