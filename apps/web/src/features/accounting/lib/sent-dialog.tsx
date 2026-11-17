import { openFormPanel } from '../../../components/panels/panels';
import type { SendingChannel } from '@ordo/shared';
import { SentForm } from '../components/SentForm';

/**
 * Asks when and how a document was sent, then saves it.
 * @param {{ title: string, sentAt?: string | null, sentVia?: string | null, onSubmit: (sending: { date: string, via: SendingChannel }) => Promise<unknown> }} options Title, sending already noted, and save.
 * @returns {void}
 */
export function openSentDialog(options: { title: string; sentAt?: string | null; sentVia?: string | null; onSubmit: (sending: { date: string; via: SendingChannel }) => Promise<unknown> }): void {
  openFormPanel(options.title, (close) => <SentForm sentAt={options.sentAt} sentVia={options.sentVia} onSubmit={options.onSubmit} onDone={close} />);
}
