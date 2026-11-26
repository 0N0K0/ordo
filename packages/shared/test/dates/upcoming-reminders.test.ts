import { describe, expect, it } from "vitest";
import {
  upcomingReminders,
  UPCOMING_REMINDER_DAYS,
} from "../../src/dates/upcoming-reminders";
import type { ReminderValue } from "../../src/dates/reminders";

// 09:00 in Paris (UTC+1 in November).
const NOW = new Date("2026-11-26T08:00:00Z");

/**
 * An event occurrence of a series, with hours (Paris).
 * @param {string} eventId Event.
 * @param {string} day Day.
 * @param {string} time Start (HH:MM, Paris).
 * @param {ReminderValue[]} reminders Reminders of the series.
 * @param {boolean} [calledOff] Cancelled. Optional.
 * @returns {object} Occurrence.
 */
const occurrence = (
  eventId: string,
  day: string,
  time: string,
  reminders: ReminderValue[],
  calledOff = false,
) => {
  const start = new Date(`${day}T${time}:00+01:00`);
  return {
    eventId,
    key: `${eventId}|${day}`,
    label: `Évènement ${eventId}`,
    allDay: false,
    startDate: day,
    startTime: time,
    endDate: day,
    start,
    end: new Date(start.getTime() + 3600_000),
    calledOff,
    reminders,
  };
};

/**
 * An open task.
 * @param {string} id Task.
 * @param {object} fields Other fields.
 * @returns {object} Task.
 */
const task = (
  id: string,
  fields: {
    minDate?: string | null;
    deadline?: string | null;
    reminders: ReminderValue[];
    closed?: boolean;
    label?: string;
  },
) => ({
  id,
  label: fields.label ?? `Tâche ${id}`,
  closed: fields.closed ?? false,
  archived: false,
  effectiveMinDate: fields.minDate ?? null,
  effectiveDeadline: fields.deadline ?? null,
  reminders: fields.reminders,
});

/**
 * A routine without hours, with the occurrences its reminders ring for.
 * @param {string} id Routine.
 * @param {string[]} dates Due days of its occurrences (opening the same day).
 * @param {ReminderValue[]} reminders Reminders.
 * @param {boolean} [hasSubRoutines] A parent. Optional.
 * @returns {object} Routine.
 */
const routine = (
  id: string,
  dates: string[],
  reminders: ReminderValue[],
  hasSubRoutines = false,
) => ({
  id,
  label: `Routine ${id}`,
  archived: false,
  estimate: null,
  currentDate: dates[0],
  reminders,
  reminderOccurrences: dates.map((date) => ({
    date,
    day: date,
    slots: [{ slot: 0, fromTime: null, dueTime: null }],
  })),
  slots: [{ index: 0, fromTime: null, dueTime: null }],
  hasSubRoutines,
});

/**
 * Keys and instants of reminders to come.
 * @param {{ key: string, at: Date }[]} list Reminders.
 * @returns {[string, string][]} Keys and ISO instants.
 */
const shown = (list: { key: string; at: Date }[]) =>
  list.map((ring) => [ring.key, ring.at.toISOString()]);

describe("upcomingReminders", () => {
  it("looks 30 days ahead", () => {
    expect(UPCOMING_REMINDER_DAYS).toBe(30);
  });

  it("an event: the reminders of its next occurrence only", () => {
    const series = [
      occurrence("e", "2026-11-27", "10:00", [
        { before: 15, at: null },
        { before: 60, at: null },
      ]),
      occurrence("e", "2026-12-04", "10:00", [
        { before: 15, at: null },
        { before: 60, at: null },
      ]),
    ];
    expect(
      shown(
        upcomingReminders(
          { occurrences: series, tasks: [], routines: [] },
          NOW,
        ),
      ),
    ).toEqual([
      ["event:e|2026-11-27:before:60", "2026-11-27T08:00:00.000Z"],
      ["event:e|2026-11-27:before:15", "2026-11-27T08:45:00.000Z"],
    ]);
  });

  it("an occurrence whose reminders have all rung, or cancelled, gives way to the next one", () => {
    const series = [
      occurrence("e", "2026-11-26", "09:10", [{ before: 15, at: null }]),
      occurrence("e", "2026-11-27", "09:10", [{ before: 15, at: null }], true),
      occurrence("e", "2026-11-28", "09:10", [{ before: 15, at: null }]),
    ];
    expect(
      shown(
        upcomingReminders(
          { occurrences: series, tasks: [], routines: [] },
          NOW,
        ),
      ),
    ).toEqual([["event:e|2026-11-28:before:15", "2026-11-28T07:55:00.000Z"]]);
  });

  it("within the next 30 days only", () => {
    const inside = occurrence("a", "2027-01-10", "10:00", [
      { before: null, at: "09:00", days: 30 },
    ]);
    const outside = occurrence("b", "2027-01-30", "10:00", [
      { before: null, at: "09:00", days: 30 },
    ]);
    expect(
      shown(
        upcomingReminders(
          { occurrences: [inside, outside], tasks: [], routines: [] },
          NOW,
        ),
      ),
    ).toEqual([
      ["event:a|2027-01-10:days:30:09:00", "2026-12-11T08:00:00.000Z"],
    ]);
  });

  it("a task: its reminders to come from today to its « Échéance », those passed and of closed tasks left out", () => {
    const open = task("t", {
      minDate: "2026-11-25",
      deadline: "2026-11-28",
      reminders: [
        { before: null, at: "08:00" },
        { before: null, at: "18:00", days: 2 },
      ],
    });
    const closed = task("c", {
      deadline: "2026-11-28",
      reminders: [{ before: null, at: "08:00" }],
      closed: true,
    });
    expect(
      shown(
        upcomingReminders(
          { occurrences: [], tasks: [open, closed], routines: [] },
          NOW,
        ),
      ),
    ).toEqual([
      ["task:t:2026-11-28:days:2:18:00", "2026-11-26T17:00:00.000Z"],
      ["task:t:2026-11-27:at:08:00", "2026-11-27T07:00:00.000Z"],
      ["task:t:2026-11-28:at:08:00", "2026-11-28T07:00:00.000Z"],
    ]);
  });

  it("only the reminders of the item itself: a sub-task going by the dates of its parent has none of its reminders", () => {
    const parent = task("p", {
      deadline: "2026-11-27",
      reminders: [{ before: null, at: "08:00" }],
    });
    const child = task("s", { deadline: "2026-11-27", reminders: [] });
    expect(
      upcomingReminders(
        { occurrences: [], tasks: [parent, child], routines: [] },
        NOW,
      ).map((ring) => ring.item.id),
    ).toEqual(["p"]);
  });

  it("a routine: its next occurrence only; a parent routine rings nothing, its sub-routines their own", () => {
    const daily = routine(
      "r",
      ["2026-11-26", "2026-11-27"],
      [{ before: null, at: "18:00" }],
    );
    const parent = routine(
      "p",
      ["2026-11-26"],
      [{ before: null, at: "12:00" }],
      true,
    );
    const sub = routine("s", ["2026-11-27"], [{ before: null, at: "07:00" }]);
    const list = upcomingReminders(
      { occurrences: [], tasks: [], routines: [daily, parent, sub] },
      NOW,
    );
    expect(shown(list)).toEqual([
      ["routine:r|2026-11-26:at:18:00", "2026-11-26T17:00:00.000Z"],
      ["routine:s|2026-11-27:at:07:00", "2026-11-27T06:00:00.000Z"],
    ]);
    expect(
      list.map((ring) =>
        ring.kind === "routine" ? [ring.occurrenceDate, ring.due?.day] : null,
      ),
    ).toEqual([
      ["2026-11-26", "2026-11-26"],
      ["2026-11-27", "2026-11-27"],
    ]);
  });

  it("a routine: its next occurrence by due day (one moved later and kept apart comes after)", () => {
    const moved = {
      ...routine("r", [], [{ before: null, at: "18:00" }]),
      reminderOccurrences: [
        {
          date: "2026-11-26",
          dueDate: "2026-11-30",
          day: "2026-11-30",
          slots: [{ slot: 0, fromTime: null, dueTime: null }],
        },
        {
          date: "2026-11-28",
          day: "2026-11-28",
          slots: [{ slot: 0, fromTime: null, dueTime: null }],
        },
      ],
    };
    const list = upcomingReminders(
      { occurrences: [], tasks: [], routines: [moved] },
      NOW,
    );
    expect(shown(list)).toEqual([
      ["routine:r|2026-11-28:at:18:00", "2026-11-28T17:00:00.000Z"],
    ]);
  });

  it("a reminder of a routine moved to the next free moment is listed at that moment", () => {
    const daily = routine("r", ["2026-11-26"], [{ before: null, at: "18:00" }]);
    const later = new Date("2026-11-26T19:30:00Z");
    expect(
      shown(
        upcomingReminders(
          {
            occurrences: [],
            tasks: [],
            routines: [daily],
            deferRoutine: () => later,
          },
          NOW,
        ),
      ),
    ).toEqual([["routine:r|2026-11-26:at:18:00", later.toISOString()]]);
  });

  it("sorted by ring time across events, tasks and routines, then by title", () => {
    const list = upcomingReminders(
      {
        occurrences: [
          occurrence("e", "2026-11-27", "10:00", [{ before: 0, at: null }]),
        ],
        tasks: [
          task("t", {
            deadline: "2026-11-27",
            reminders: [{ before: null, at: "10:00" }],
            label: "A",
          }),
          task("u", {
            deadline: "2026-11-26",
            reminders: [{ before: null, at: "20:00" }],
          }),
        ],
        routines: [
          routine("r", ["2026-11-26"], [{ before: null, at: "12:00" }]),
        ],
      },
      NOW,
    );
    expect(list.map((ring) => [ring.kind, ring.title])).toEqual([
      ["routine", "Routine r"],
      ["task", "Tâche u"],
      ["task", "A"],
      ["event", "Évènement e"],
    ]);
    expect(list.map((ring) => ring.due)).toEqual([
      { day: "2026-11-26", time: null },
      { day: "2026-11-26", time: null },
      { day: "2026-11-27", time: null },
      { day: "2026-11-27", time: "10:00" },
    ]);
  });
});
