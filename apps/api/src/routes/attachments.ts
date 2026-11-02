import { Router } from 'express';
import { getSession } from '../auth/session';
import { prisma } from '../db';
import { INLINE_TYPES } from '../services/attachments';

export const attachmentsRouter: Router = Router();

// The file name in the URL is only for readability: the id identifies the file. Attachments never change.
attachmentsRouter.get('/:id{/:name}', async (req, res) => {
  if (!(await getSession(req, res))) {
    res.sendStatus(401);
    return;
  }

  const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id } });
  if (!attachment) {
    res.sendStatus(404);
    return;
  }

  const inline = INLINE_TYPES.includes(attachment.mimeType);
  res.set({
    'Content-Type': attachment.mimeType,
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
    'Cache-Control': 'private, max-age=31536000, immutable',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(Buffer.from(attachment.data));
});
