import express, { Router } from 'express';
import { calendarIcs } from '../services/calendar/calendar-ics';
import { calendarPdf } from '../services/calendar/calendar-pdf';
import { chartsPdf } from '../services/dashboards/charts-pdf';
import { tablePdf } from '../services/core/table-pdf';
import { queryText, requireSession, safeFilename, sendDownload, sendServiceError } from './http';

export const exportsRouter: Router = Router();

// PDF of a table the app has formatted (task list of a view…), downloaded.
exportsRouter.post('/table.pdf', express.json({ limit: '5mb' }), async (req, res) => {
  if (!(await requireSession(req, res))) return;
  try {
    const pdf = await tablePdf(req.body);
    const filename = `${safeFilename(String(req.body?.title ?? 'export'))}.pdf`;
    sendDownload(res, pdf, { type: 'application/pdf', filename });
  } catch (error) {
    sendServiceError(res, error, 'Export PDF impossible.');
  }
});

// PDF of charts drawn by the app (PNG images), downloaded.
exportsRouter.post('/charts.pdf', express.json({ limit: '50mb' }), async (req, res) => {
  if (!(await requireSession(req, res))) return;
  try {
    const pdf = await chartsPdf(req.body);
    const filename = `${safeFilename(String(req.body?.title ?? 'diagrammes'))}.pdf`;
    sendDownload(res, pdf, { type: 'application/pdf', filename });
  } catch (error) {
    sendServiceError(res, error, 'Export PDF impossible.');
  }
});

// iCalendar file of a calendar of the workspace (?calendar=<id>), or of all of them, downloaded.
exportsRouter.get('/calendar.ics', async (req, res) => {
  if (!(await requireSession(req, res))) return;
  try {
    const calendarId = queryText(req.query.calendar) || null;
    const { name, content } = await calendarIcs(calendarId);
    const filename = `${safeFilename(name)}.ics`;
    sendDownload(res, content, { type: 'text/calendar; charset=utf-8', filename });
  } catch (error) {
    sendServiceError(res, error, 'Export ICS impossible.');
  }
});

// PDF of a calendar view as displayed (its items sent by the app), downloaded.
exportsRouter.post('/calendar.pdf', express.json({ limit: '5mb' }), async (req, res) => {
  if (!(await requireSession(req, res))) return;
  try {
    const pdf = await calendarPdf(req.body);
    const filename = `${safeFilename(String(req.body?.title ?? 'agenda'))}.pdf`;
    sendDownload(res, pdf, { type: 'application/pdf', filename });
  } catch (error) {
    sendServiceError(res, error, 'Export PDF impossible.');
  }
});
