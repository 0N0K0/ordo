import express, { Router } from 'express';
import { GraphQLError } from 'graphql';
import { calendarIcs } from '../services/calendar/calendar-ics';
import { calendarPdf } from '../services/calendar/calendar-pdf';
import { chartsPdf } from '../services/dashboards/charts-pdf';
import { tablePdf } from '../services/core/table-pdf';
import { queryText, requireSession, safeFilename, sendDownload } from './http';

export const exportsRouter: Router = Router();

// PDF of a table the app has formatted (task list of a view…), downloaded.
exportsRouter.post('/table.pdf', express.json({ limit: '5mb' }), async (req, res) => {
  if (!(await requireSession(req, res))) return;
  try {
    const pdf = await tablePdf(req.body);
    const filename = `${safeFilename(String(req.body?.title ?? 'export'))}.pdf`;
    sendDownload(res, pdf, { type: 'application/pdf', filename });
  } catch (error) {
    if (error instanceof GraphQLError && error.extensions.code === 'BAD_USER_INPUT') res.status(400).json({ error: error.message });
    else {
      console.error('Export PDF impossible.', error);
      res.sendStatus(500);
    }
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
    if (error instanceof GraphQLError && error.extensions.code === 'BAD_USER_INPUT') res.status(400).json({ error: error.message });
    else {
      console.error('Export PDF impossible.', error);
      res.sendStatus(500);
    }
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
    if (error instanceof GraphQLError && error.extensions.code === 'NOT_FOUND') res.sendStatus(404);
    else {
      console.error('Export ICS impossible.', error);
      res.sendStatus(500);
    }
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
    if (error instanceof GraphQLError && error.extensions.code === 'BAD_USER_INPUT') res.status(400).json({ error: error.message });
    else {
      console.error('Export PDF impossible.', error);
      res.sendStatus(500);
    }
  }
});
