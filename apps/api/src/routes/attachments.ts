import { Router } from 'express';
import { prisma } from '../db';
import { fileSecurityPolicy, INLINE_TYPES, isPdf } from '../services/core/attachments';
import { downloadRoute, IMMUTABLE_CACHE, shownInPlace } from './http';
import { findOrNotFound } from '../services/core/lookup';

export const attachmentsRouter: Router = Router();

// The file name in the URL is only for readability: the id identifies the file. Attachments never change.
// The disposition changes with ?download: it is part of the URL, so the immutable cache stays right.
attachmentsRouter.get(
  '/:id{/:name}',
  downloadRoute(async (req) => {
    const attachment = await findOrNotFound(prisma.attachment, String(req.params.id), 'Pièce jointe');
    // Images and PDFs are shown in place (in the viewer of the app); ?download=1 always downloads.
    const pdf = attachment.mimeType === 'application/pdf' && isPdf(attachment.data);
    const inline = shownInPlace(req, INLINE_TYPES.includes(attachment.mimeType) || pdf);
    return {
      content: Buffer.from(attachment.data),
      type: attachment.mimeType,
      filename: attachment.filename,
      inline,
      cache: IMMUTABLE_CACHE,
      securityPolicy: fileSecurityPolicy(inline && pdf),
    };
  }, 'Pièce jointe impossible.'),
);
