import express, { Router } from 'express';
import { GraphQLError } from 'graphql';
import { getSession } from '../auth/session';
import { calendarPdf } from '../services/calendar-pdf';
import { chartsPdf } from '../services/charts-pdf';
import { tablePdf } from '../services/table-pdf';

export const exportsRouter: Router = Router();

// PDF of a table the app has formatted (task list of a view…), downloaded.
exportsRouter.post('/table.pdf', express.json({ limit: '5mb' }), async (req, res) => {
  if (!(await getSession(req, res))) {
    res.sendStatus(401);
    return;
  }
  try {
    const pdf = await tablePdf(req.body);
    const filename = `${String(req.body?.title ?? 'export').replace(/[\\/:*?"<>|]/g, '-')}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(pdf);
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
  if (!(await getSession(req, res))) {
    res.sendStatus(401);
    return;
  }
  try {
    const pdf = await chartsPdf(req.body);
    const filename = `${String(req.body?.title ?? 'diagrammes').replace(/[\\/:*?"<>|]/g, '-')}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(pdf);
  } catch (error) {
    if (error instanceof GraphQLError && error.extensions.code === 'BAD_USER_INPUT') res.status(400).json({ error: error.message });
    else {
      console.error('Export PDF impossible.', error);
      res.sendStatus(500);
    }
  }
});

// PDF of a calendar view as displayed (its items sent by the app), downloaded.
exportsRouter.post('/calendar.pdf', express.json({ limit: '5mb' }), async (req, res) => {
  if (!(await getSession(req, res))) {
    res.sendStatus(401);
    return;
  }
  try {
    const pdf = await calendarPdf(req.body);
    const filename = `${String(req.body?.title ?? 'agenda').replace(/[\\/:*?"<>|]/g, '-')}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(pdf);
  } catch (error) {
    if (error instanceof GraphQLError && error.extensions.code === 'BAD_USER_INPUT') res.status(400).json({ error: error.message });
    else {
      console.error('Export PDF impossible.', error);
      res.sendStatus(500);
    }
  }
});
