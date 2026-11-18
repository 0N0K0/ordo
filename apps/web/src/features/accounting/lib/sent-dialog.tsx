import { openFormPanel } from '../../../components/panels/panels';
import { ON_ERROR } from '../../../lib/notify';
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

/** Mutations of the tracking of a document (of Ordo or imported), as their hooks give them (only what is used). */
interface TrackingMutations {
  setStatus: { mutate: (variables: { id: string; statusId: string }, options: typeof ON_ERROR) => void };
  markSent: { mutateAsync: (variables: { id: string; date: string; via: SendingChannel; statusId: string }) => Promise<unknown> };
}

/**
 * Sets a tracking status chosen on a document: a "sent" one asks when and how it was sent first.
 * @param {{ id: string, number?: string | null, sentAt?: string | null, sentVia?: string | null }} document Document.
 * @param {{ id: string, category: string }} status Status chosen.
 * @param {TrackingMutations} mutations Mutations of its kind of document.
 * @returns {void}
 */
export function chooseTrackingStatus(
  document: { id: string; number?: string | null; sentAt?: string | null; sentVia?: string | null },
  status: { id: string; category: string },
  { setStatus, markSent }: TrackingMutations,
): void {
  if (status.category !== 'SENT') return setStatus.mutate({ id: document.id, statusId: status.id }, ON_ERROR);
  openSentDialog({
    title: `Envoi de ${document.number ?? 'ce document'}`,
    sentAt: document.sentAt,
    sentVia: document.sentVia,
    onSubmit: ({ date, via }) => markSent.mutateAsync({ id: document.id, date, via, statusId: status.id }),
  });
}
