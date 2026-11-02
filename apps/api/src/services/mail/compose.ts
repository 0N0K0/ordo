import { randomUUID } from 'node:crypto';
import { recipientsSchema } from '@ordo/shared';
import { convert } from 'html-to-text';
import MailComposer from 'nodemailer/lib/mail-composer';
import { z } from 'zod';
import { prisma } from '../../db';
import type { MailAccount } from '../../generated/prisma/client';
import { clientError, parseInput } from '../../graphql/errors';
import { fetchParsed, messageAttachment } from './reader';
import { sanitizeMailHtml } from './sanitize';

/** Files of another message to attach again (forward, or files kept from a draft). */
export interface AttachmentsFrom {
  accountId: string;
  folder: string;
  uid: number;
  /** Attachment numbers; omitted: every file that is not an inline image. */
  indexes?: number[] | null;
}

/** Mail fields, for sending or as a draft. */
export interface MailFields {
  to: string[];
  cc?: string[] | null;
  bcc?: string[] | null;
  subject: string;
  /** HTML body, signature and quote included. */
  html: string;
  attachments?: File[] | null;
  attachmentsFrom?: AttachmentsFrom | null;
  /** Message-ID replied to. */
  inReplyTo?: string | null;
  references?: string[] | null;
}

const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

interface InlineImage {
  filename: string;
  content: Buffer;
  cid: string;
}

/**
 * Embeds the images of Ordo (uploaded in the editor or the signature, or quoted from a mail read on the
 * server) in the mail: recipients cannot reach them, so they become inline attachments ("cid:").
 * @param {string} html Sanitized HTML.
 * @returns {Promise<{ html: string, images: InlineImage[] }>} HTML pointing to the inline images.
 */
async function embedLocalImages(html: string): Promise<{ html: string; images: InlineImage[] }> {
  const images = new Map<string, InlineImage>();
  const sources = [...html.matchAll(/src="(\/api\/(?:attachments|mail)\/[^"]+)"/g)].map((match) => match[1]);
  for (const source of new Set(sources)) {
    const url = new URL(source.replace(/&amp;/g, '&'), 'http://ordo.local');
    const stored = /^\/api\/attachments\/([^/]+)/.exec(url.pathname);
    const live = /^\/api\/mail\/([^/]+)\/attachment$/.exec(url.pathname);
    try {
      if (stored) {
        const attachment = await prisma.attachment.findUnique({ where: { id: stored[1] } });
        if (attachment) images.set(source, { filename: attachment.name, content: Buffer.from(attachment.data), cid: `${attachment.id}@ordo` });
      } else if (live) {
        const folder = url.searchParams.get('folder') ?? '';
        const uid = Number(url.searchParams.get('uid'));
        const index = Number(url.searchParams.get('index'));
        const file = await messageAttachment(live[1], folder, uid, index);
        images.set(source, { filename: file.filename, content: file.content, cid: `${live[1]}-${uid}-${index}-${randomUUID()}@ordo` });
      }
    } catch {
      // A missing image is left out.
    }
  }
  let result = html;
  for (const [source, image] of images) result = result.split(`src="${source}"`).join(`src="cid:${image.cid}"`);
  return { html: result, images: [...images.values()] };
}

export interface BuiltMessage {
  /** Message without the Bcc header, to send. */
  raw: Buffer;
  /** Same message with the Bcc header, to keep (sent folder, drafts, projects). */
  copy: Buffer;
  /** Recipients of the SMTP envelope. */
  recipients: string[];
  references: string[];
}

/**
 * Builds a MIME message from an account and mail fields.
 * @param {MailAccount} account Sending account.
 * @param {MailFields} input Mail fields.
 * @param {object} [options] Options. Optional.
 * @param {boolean} [options.draft] Draft: recipients may be missing or incomplete. Optional.
 * @param {Record<string, string>} [options.headers] Extra headers. Optional.
 * @returns {Promise<BuiltMessage>} Message.
 */
export async function buildMessage(
  account: MailAccount,
  input: MailFields,
  options: { draft?: boolean; headers?: Record<string, string> } = {},
): Promise<BuiltMessage> {
  const recipients = options.draft ? z.array(z.string().max(320)).max(100) : recipientsSchema;
  const fields = parseInput(
    z.object({ to: recipients, cc: recipients, bcc: recipients, subject: z.string().trim().max(998, 'Objet trop long.') }),
    { to: input.to, cc: input.cc ?? [], bcc: input.bcc ?? [], subject: input.subject },
  );
  if (!options.draft && fields.to.length + fields.cc.length + fields.bcc.length === 0) {
    throw clientError('BAD_USER_INPUT', 'Ajoutez au moins un destinataire.', { fields: { to: 'Ajoutez au moins un destinataire.' } });
  }

  const files: { filename: string; content: Buffer }[] = await Promise.all(
    (input.attachments ?? []).map(async (file) => ({ filename: file.name, content: Buffer.from(await file.arrayBuffer()) })),
  );
  if (input.attachmentsFrom) {
    const { accountId, folder, uid, indexes } = input.attachmentsFrom;
    const original = await fetchParsed(accountId, folder, uid);
    files.push(
      ...original.attachments
        .filter((attachment, index) => (indexes ? indexes.includes(index) : !attachment.related))
        .map((attachment) => ({ filename: attachment.filename || 'piece-jointe', content: attachment.content })),
    );
  }
  if (files.reduce((sum, file) => sum + file.content.length, 0) > MAX_TOTAL_BYTES) {
    throw clientError('BAD_USER_INPUT', 'Pièces jointes trop lourdes (20 Mo au total maximum).');
  }

  const { html, images } = await embedLocalImages(sanitizeMailHtml(input.html));
  const references = [...new Set([...(input.references ?? []), ...(input.inReplyTo ? [input.inReplyTo] : [])])];
  const domain = account.email.split('@')[1] ?? 'ordo.local';
  const composer = new MailComposer({
    messageId: `<${randomUUID()}@${domain}>`,
    date: new Date(),
    from: { name: account.displayName ?? '', address: account.email },
    to: fields.to,
    cc: fields.cc,
    bcc: fields.bcc,
    subject: fields.subject,
    html,
    text: convert(html, { wordwrap: 100 }),
    attachments: [...files, ...images],
    inReplyTo: input.inReplyTo ? `<${input.inReplyTo}>` : undefined,
    references: references.length ? references.map((id) => `<${id}>`) : undefined,
    headers: options.headers,
  });
  // Sent without the Bcc header; the copy that is kept lists it.
  const raw = await composer.compile().build();
  const copyNode = composer.compile();
  copyNode.keepBcc = true;
  const copy = await copyNode.build();
  return { raw, copy, recipients: [...fields.to, ...fields.cc, ...fields.bcc], references };
}
