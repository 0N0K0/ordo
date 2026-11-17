import { openFormPanel } from '../../../components/panels/panels';
import type { ComposeOptions } from '../lib/compose-options';
import { MailComposer } from '../components/MailComposer';

/**
 * Opens the mail writing form in the side panel; closing it asks whether to keep the draft.
 * @returns {(options?: ComposeOptions) => void} Opener.
 */
export function useMailComposer() {
  return (options: ComposeOptions = {}) => {
    // Closing goes through the form, which asks whether to keep the draft.
    openFormPanel(options.draft ? 'Brouillon' : options.forwarding ? 'Transférer' : options.inReplyTo ? 'Répondre' : 'Nouveau mail', (close) => <MailComposer options={options} onDone={close} />, {
      size: 'lg',
      locked: true,
    });
  };
}
