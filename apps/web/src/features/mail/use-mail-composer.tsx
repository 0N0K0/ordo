import { closePanel, openPanel } from '../../components/panels/panels';
import type { ComposeOptions } from './compose-options';
import { MailComposer } from './MailComposer';

let modalCount = 0;

/**
 * Opens the mail writing form in the side panel; closing it asks whether to keep the draft.
 * @returns {(options?: ComposeOptions) => void} Opener.
 */
export function useMailComposer() {
  return (options: ComposeOptions = {}) => {
    const modalId = `mail-composer-${++modalCount}`;
    openPanel({
      panelId: modalId,
      title: options.draft ? 'Brouillon' : options.forwarding ? 'Transférer' : options.inReplyTo ? 'Répondre' : 'Nouveau mail',
      size: 'lg',
      // Closing goes through the form, which asks whether to keep the draft.
      locked: true,
      children: <MailComposer options={options} onDone={() => closePanel(modalId)} />,
    });
  };
}
