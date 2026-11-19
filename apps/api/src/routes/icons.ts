import { Router } from 'express';
import { prisma } from '../db';
import { downloadRoute, IMMUTABLE_CACHE } from './http';
import { findOrNotFound } from '../services/core/lookup';

export const iconsRouter: Router = Router();

// Icons never change: a replaced icon gets a new id, so they can be cached forever.
iconsRouter.get(
  '/:id',
  downloadRoute(async (req) => {
    const icon = await findOrNotFound(prisma.icon, String(req.params.id), 'Icône');
    return {
      content: Buffer.from(icon.data),
      type: icon.mimeType,
      cache: IMMUTABLE_CACHE,
      // Defense in depth for SVG: no script, no external resource, even if opened directly.
      securityPolicy: "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    };
  }, 'Icône impossible.'),
);
