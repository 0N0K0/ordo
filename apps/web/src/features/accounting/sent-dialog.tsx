import { closePanel, openPanel } from '../../components/panels/panels';
import type { SendingChannel } from '@ordo/shared';
import { SentForm } from './SentForm';

let modalCount = 0;

/**
 * Asks when and how a document was sent, then saves it.
 * @param {{ title: string, sentAt?: string | null, sentVia?: string | null, onSubmit: (sending: { date: string, via: SendingChannel }) => Promise<unknown> }} options Title, sending already noted, and save.
 * @returns {void}
 */
export function openSentDialog(options: { title: string; sentAt?: string | null; sentVia?: string | null; onSubmit: (sending: { date: string; via: SendingChannel }) => Promise<unknown> }): void {
  const modalId = `document-sent-${++modalCount}`;
  openPanel({
    panelId: modalId,
    title: options.title,
    children: <SentForm sentAt={options.sentAt} sentVia={options.sentVia} onSubmit={options.onSubmit} onDone={() => closePanel(modalId)} />,
  });
}
