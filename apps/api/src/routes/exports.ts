import express, { Router } from 'express';
import { calendarIcs } from '../services/calendar/calendar-ics';
import { calendarPdf, typicalWeeksPdf } from '../services/calendar/calendar-pdf';
import { chartsPdf } from '../services/dashboards/charts-pdf';
import { tablePdf } from '../services/core/table-pdf';
import { downloadRoute, queryText, sessionRequired } from './http';

export const exportsRouter: Router = Router();

// PDF of a table the app has formatted (task list of a view…), downloaded.
exportsRouter.post(
  '/table.pdf',
  sessionRequired,
  express.json({ limit: '5mb' }),
  downloadRoute(async (req) => ({ ...(await tablePdf(req.body)), type: 'application/pdf' }), 'Export PDF impossible.'),
);

// PDF of charts drawn by the app (PNG images), downloaded.
exportsRouter.post(
  '/charts.pdf',
  sessionRequired,
  express.json({ limit: '50mb' }),
  downloadRoute(async (req) => ({ ...(await chartsPdf(req.body)), type: 'application/pdf' }), 'Export PDF impossible.'),
);

// iCalendar file of a calendar of the workspace (?calendar=<id>), or of all of them, downloaded.
exportsRouter.get(
  '/calendar.ics',
  downloadRoute(async (req) => ({ ...(await calendarIcs(queryText(req.query.calendar) || null)), type: 'text/calendar; charset=utf-8' }), 'Export ICS impossible.'),
);

// PDF of a calendar view as displayed (its items sent by the app), downloaded.
exportsRouter.post(
  '/calendar.pdf',
  sessionRequired,
  express.json({ limit: '5mb' }),
  downloadRoute(async (req) => ({ ...(await calendarPdf(req.body)), type: 'application/pdf' }), 'Export PDF impossible.'),
);

// PDF of the typical weeks of a period (their créneaux and éphémérides sent by the app), downloaded.
exportsRouter.post(
  '/typical-weeks.pdf',
  sessionRequired,
  express.json({ limit: '5mb' }),
  downloadRoute(async (req) => ({ ...(await typicalWeeksPdf(req.body)), type: 'application/pdf' }), 'Export PDF impossible.'),
);
