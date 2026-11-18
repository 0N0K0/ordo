import { Router } from 'express';
import { prisma } from '../db';
import { requireSession, sendDownload } from './http';

export const iconsRouter: Router = Router();

// Icons never change: a replaced icon gets a new id, so they can be cached forever.
iconsRouter.get('/:id', async (req, res) => {
  if (!(await requireSession(req, res))) return;

  const icon = await prisma.icon.findUnique({ where: { id: req.params.id } });
  if (!icon) {
    res.sendStatus(404);
    return;
  }

  sendDownload(res, Buffer.from(icon.data), {
    type: icon.mimeType,
    cache: 'private, max-age=31536000, immutable',
    // Defense in depth for SVG: no script, no external resource, even if opened directly.
    securityPolicy: "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  });
});
