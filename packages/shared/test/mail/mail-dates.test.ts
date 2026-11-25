import { describe, expect, it } from 'vitest';
import { compareMailDates, dateHeader, EMPTY_MAIL_SEARCH, mailSearchSchema, mailTime, searchKeepsOldest } from '../../src/mail/mail';

describe('mailTime', () => {
  const sent = '2026-11-20T10:00:00Z';
  const received = '2026-11-25T08:00:00Z';

  it('takes the Date header first', () => {
    expect(mailTime(new Date(sent), new Date(received))).toBe(Date.parse(sent));
    expect(mailTime('Fri, 20 Nov 2026 10:00:00 +0000', received)).toBe(Date.parse(sent));
  });

  it('falls back to the received date without a valid header', () => {
    expect(mailTime(undefined, new Date(received))).toBe(Date.parse(received));
    expect(mailTime('not a date', received)).toBe(Date.parse(received));
  });

  it('is 0 without any date', () => {
    expect(mailTime(null, 'nope')).toBe(0);
  });
});

describe('dateHeader', () => {
  it('reads the value, case-insensitive, folded lines joined', () => {
    expect(dateHeader('Date: Fri, 20 Nov 2026\r\n 10:00:00 +0000\r\n\r\n')).toBe('Fri, 20 Nov 2026 10:00:00 +0000');
    expect(dateHeader('DATE:Fri, 20 Nov 2026 10:00:00 +0000\r\n')).toBe('Fri, 20 Nov 2026 10:00:00 +0000');
  });

  it('is null without the header', () => {
    expect(dateHeader('')).toBeNull();
    expect(dateHeader(undefined)).toBeNull();
    expect(dateHeader('Subject: hello\r\n')).toBeNull();
  });
});

describe('compareMailDates', () => {
  // A mail moved into the folder later (high UID) but sent earlier, and two mails of the same second.
  const mails = [
    { uid: 1, time: 2000 },
    { uid: 9, time: 1000 },
    { uid: 3, time: 3000 },
    { uid: 4, time: 3000 },
  ];

  it('sorts latest first, highest UID first between equals', () => {
    expect([...mails].sort((a, b) => compareMailDates(a, b)).map((mail) => mail.uid)).toEqual([4, 3, 1, 9]);
  });

  it('sorts oldest first as the exact reverse', () => {
    expect([...mails].sort((a, b) => compareMailDates(a, b, true)).map((mail) => mail.uid)).toEqual([9, 1, 3, 4]);
  });
});

describe('mailSearchSchema', () => {
  it('keeps the project of a search folder', () => {
    expect(mailSearchSchema.parse({ ...EMPTY_MAIL_SEARCH, label: 'Projet', projectId: 'p1' }).projectId).toBe('p1');
    expect(mailSearchSchema.parse({ ...EMPTY_MAIL_SEARCH, label: 'Tous' }).projectId).toBeNull();
  });
});

describe('searchKeepsOldest', () => {
  it('keeps the oldest mails only sorted oldest first by date', () => {
    expect(searchKeepsOldest({ by: 'date', ascending: true })).toBe(true);
    expect(searchKeepsOldest({ by: 'date', ascending: false })).toBe(false);
    expect(searchKeepsOldest({ by: 'subject', ascending: true })).toBe(false);
    expect(searchKeepsOldest({ by: 'correspondent', ascending: false })).toBe(false);
  });
});
