import { Router } from 'express';
import { prisma } from '../db';
import { orNotFound } from '../graphql/errors';
import { downloadRoute } from './http';

export const iconsRouter: Router = Router();

// Icons never change: a replaced icon gets a new id, so they can be cached forever.
iconsRouter.get(
  '/:id',
  downloadRoute(async (req) => {
    const icon = await orNotFound(prisma.icon.findUnique({ where: { id: String(req.params.id) } }), 'Icône');
    return {
      content: Buffer.from(icon.data),
      type: icon.mimeType,
      cache: 'private, max-age=31536000, immutable',
      // Defense in depth for SVG: no script, no external resource, even if opened directly.
      securityPolicy: "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    };
  }, 'Icône'),
);
