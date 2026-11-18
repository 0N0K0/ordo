import { safeFilename } from '@ordo/shared';
import express, { Router } from 'express';
import { calendarIcs } from '../services/calendar/calendar-ics';
import { calendarPdf } from '../services/calendar/calendar-pdf';
import { chartsPdf } from '../services/dashboards/charts-pdf';
import { tablePdf } from '../services/core/table-pdf';
import { downloadRoute, queryText } from './http';

export const exportsRouter: Router = Router();

// PDF of a table the app has formatted (task list of a view…), downloaded.
exportsRouter.post(
  '/table.pdf',
  express.json({ limit: '5mb' }),
  downloadRoute(async (req) => ({ content: await tablePdf(req.body), type: 'application/pdf', filename: `${safeFilename(String(req.body?.title ?? 'export'))}.pdf` }), 'Export PDF impossible.'),
);

// PDF of charts drawn by the app (PNG images), downloaded.
exportsRouter.post(
  '/charts.pdf',
  express.json({ limit: '50mb' }),
  downloadRoute(async (req) => ({ content: await chartsPdf(req.body), type: 'application/pdf', filename: `${safeFilename(String(req.body?.title ?? 'diagrammes'))}.pdf` }), 'Export PDF impossible.'),
);

// iCalendar file of a calendar of the workspace (?calendar=<id>), or of all of them, downloaded.
exportsRouter.get(
  '/calendar.ics',
  downloadRoute(async (req) => {
    const { name, content } = await calendarIcs(queryText(req.query.calendar) || null);
    return { content, type: 'text/calendar; charset=utf-8', filename: `${safeFilename(name)}.ics` };
  }, 'Export ICS impossible.'),
);

// PDF of a calendar view as displayed (its items sent by the app), downloaded.
exportsRouter.post(
  '/calendar.pdf',
  express.json({ limit: '5mb' }),
  downloadRoute(async (req) => ({ content: await calendarPdf(req.body), type: 'application/pdf', filename: `${safeFilename(String(req.body?.title ?? 'agenda'))}.pdf` }), 'Export PDF impossible.'),
);
