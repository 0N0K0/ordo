import { Router } from 'express';
import { getSession } from '../auth/session';
import { prisma } from '../db';

export const iconsRouter: Router = Router();

// Icons never change: a replaced icon gets a new id, so they can be cached forever.
iconsRouter.get('/:id', async (req, res) => {
  if (!(await getSession(req, res))) {
    res.sendStatus(401);
    return;
  }

  const icon = await prisma.icon.findUnique({ where: { id: req.params.id } });
  if (!icon) {
    res.sendStatus(404);
    return;
  }

  res.set({
    'Content-Type': icon.mimeType,
    'Cache-Control': 'private, max-age=31536000, immutable',
    // Defense in depth for SVG: no script, no external resource, even if opened directly.
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(Buffer.from(icon.data));
});
