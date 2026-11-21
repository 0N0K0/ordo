import { COUNTDOWN_RING_TAG, DEFAULT_RING_SETTINGS, isRingtone, repeatedRingAt, snoozeMinutes, type RingSettings, type RingtoneId } from '@ordo/shared';
import { AlarmIcon, ArrowsClockwiseIcon, CakeIcon, CalendarBlankIcon, CalendarStarIcon, CheckSquareIcon, ClockClockwiseIcon, StopCircleIcon, TimerIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { fetchAlarmRings, sendAlarmRing, sendAlarmSnooze, sendAlarmStop, type AlarmRing } from '../api';
import { startRingtone } from './alarm-sound';
import * as fmt from '../../../lib/format';
import { closeToast, notifyAlarm, type NotifyAction } from '../../../lib/notify';
import { parseTaggedKey } from '../../../lib/tagged-key';

/**
 * The ring of the alarms and reminders in the app, one brick for all: an alarm rings for the duration of
 * the settings (its ringtone looped or once), its toast stays with « Arrêter » (stopped for good) and « Répéter dans N
 * min » (snoozed), and it rings again N minutes after its ring ends while the settings repeat it, until stopped. The
 * API keeps the state of each ring (`ringAlarm`, `snoozeAlarmRing`, `stopAlarmRing`, query `alarmRings`): a reload,
 * another tab or another device shows it as it is, and the push notifications follow it. Other tabs of this
 * browser hear of a stop or a snooze at once (`BroadcastChannel`); only one of them sounds a ring (`claim`).
 */

/** Page of the app a link of a ring opens, in the workspace of the ring. */
export interface RingTarget {
  path: string;
  /** Workspace of the page; missing: the one open. */
  workspaceId?: string | null;
}

/** Link of a ring to a page of the app (or another action), with the page it opens when kept by the API. */
export interface RingLink extends NotifyAction {
  /** Page it opens: kept with the ring, so a reload or another tab still offers it. Optional. */
  to?: RingTarget;
}

/** An alarm or a reminder that starts ringing. */
export interface RingEntry {
  /** Key of the occurrence, without the `ordo.alarm.` prefix (one ring per key). */
  key: string;
  /** Instant it was due. */
  dueAt: Date;
  title: string;
  lines: string[];
  actions: RingLink[];
  /** Ringtone; missing: the one of the settings. */
  ringtone?: RingtoneId;
  /** Workspace of the alarm or reminder; missing: the one open. */
  workspaceId?: string | null;
}

/** A ring this tab shows. */
interface ActiveRing {
  entry: RingEntry;
  /** Start of the ring under way (null: silent). */
  ringingSince: number | null;
  /** When it rings again (null: not again). */
  nextAt: number | null;
  /** Stops the ringtone sounding in this tab. */
  silence?: () => void;
  /** Timers: end of the ring, next ring. */
  timers: number[];
  /** Shown again from the API (a reload, another tab or device): its actions are rebuilt from its key (`restore`). */
  restored?: boolean;
}

/** A ring as the API keeps it: its key and its workspace. */
export interface KeptRing {
  key: string;
  workspaceId: string | null;
}

/** What the app gives the ring: its settings, how a page opens, the workspace open, the actions of a ring shown again. */
interface RingContext {
  settings: RingSettings;
  open: (target: RingTarget) => void;
  workspaceId: string | null;
  /**
   * Actions of a ring shown again from the API, rebuilt from its key (« Marquer comme faite », « Ouvrir la fiche »);
   * none when they no longer apply. Optional.
   */
  restore?: (ring: KeptRing) => RingLink[];
}

let context: RingContext = { settings: DEFAULT_RING_SETTINGS, open: () => undefined, workspaceId: null };
const active = new Map<string, ActiveRing>();
/** Gap between the next ring here and the one the API keeps under which they are the same snooze (clocks, latency). */
const SNOOZE_DRIFT_MS = 5_000;
// Rings stopped (here, in another tab or device): never rung again.
const stopped = new Set<string>();

/** Message between the tabs of this browser: a ring stopped or snoozed. */
type RingMessage = { type: 'stop'; key: string } | { type: 'snooze'; key: string; nextAt: number };

const channel: BroadcastChannel | null = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('ordo.alarm');

/**
 * Claims the sound of a ring for this tab: another open tab (of any workspace), or this one before a reload, that
 * already rang it wins. Claims expire after `ttlMs`.
 * @param {string} key Occurrence key.
 * @param {number} [ttlMs] Lifetime of the claim. Optional. Default = 10 minutes.
 * @returns {boolean} True when this tab rings it.
 */
export function claim(key: string, ttlMs = 10 * 60_000): boolean {
  try {
    const expiry = Number(localStorage.getItem(key) ?? 0);
    if (expiry > Date.now()) return false;
    localStorage.setItem(key, String(Date.now() + ttlMs));
    // Expired claims are removed as they are met.
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const stored = localStorage.key(index);
      if (stored?.startsWith('ordo.alarm.') && Number(localStorage.getItem(stored)) < Date.now()) localStorage.removeItem(stored);
    }
  } catch {
    // Storage unavailable: ring anyway.
  }
  return true;
}

/**
 * Shows a system notification, when allowed.
 * @param {string} title Title.
 * @param {string | undefined} body Text.
 * @param {string} tag Tag (one notification per tag).
 * @returns {void}
 */
export function systemNotification(title: string, body: string | undefined, tag: string): void {
  if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, tag });
}

/**
 * Gives the ring the settings of the user, how a page opens and the workspace open (`AlarmCenter`).
 * @param {RingContext} next Context.
 * @returns {void}
 */
export function configureRinging(next: RingContext): void {
  context = next;
}

/**
 * Shows again the rings shown from the API, with their actions rebuilt (once what they are rebuilt from is loaded).
 * @returns {void}
 */
export function refreshRestoredRings(): void {
  for (const [key, ring] of active) if (ring.restored) show(key);
}

/**
 * Opens the page of a link of a ring, in its workspace (the way the app gave, `configureRinging`).
 * @param {RingTarget} target Page and workspace.
 * @returns {void}
 */
export function openRingTarget(target: RingTarget): void {
  context.open(target);
}

/** Icons of the rings, by the tag of their key (an alarm has none). */
const RING_ICONS: Record<string, ReactNode> = {
  [COUNTDOWN_RING_TAG]: <TimerIcon />,
  event: <CalendarBlankIcon />,
  task: <CheckSquareIcon />,
  routine: <ArrowsClockwiseIcon />,
  ephemeris: <CalendarStarIcon />,
  birthday: <CakeIcon />,
};

/**
 * Icon of a ring, from the kind its key tells.
 * @param {string} key Key.
 * @returns {ReactNode} Icon.
 */
const ringIcon = (key: string): ReactNode => RING_ICONS[parseTaggedKey(key)?.tag ?? ''] ?? <AlarmIcon />;

/**
 * Clears the timers of a ring and stops its ringtone.
 * @param {ActiveRing} ring Ring.
 * @returns {void}
 */
function quiet(ring: ActiveRing): void {
  ring.timers.forEach((timer) => window.clearTimeout(timer));
  ring.timers = [];
  ring.silence?.();
  ring.silence = undefined;
}

/**
 * Shows the toast of a ring as it is: ringing, waiting for its next ring, or silent.
 * @param {string} key Key.
 * @returns {void}
 */
function show(key: string): void {
  const ring = active.get(key);
  if (!ring) return;
  const { entry, ringingSince, nextAt } = ring;
  const minutes = snoozeMinutes(context.settings);
  const links = ring.restored ? [...(context.restore?.({ key, workspaceId: entry.workspaceId ?? null }) ?? []), ...entry.actions] : entry.actions;
  const waiting = ringingSince === null && nextAt !== null;
  const actions: NotifyAction[] = [
    { label: 'Arrêter', icon: <StopCircleIcon aria-hidden />, onClick: () => stopRing(key) },
    ...(waiting ? [] : [{ label: `Répéter dans ${minutes} min`, icon: <ClockClockwiseIcon aria-hidden />, onClick: () => snoozeRing(key) }]),
    // A link keeps the toast: the alarm still rings until stopped.
    ...links.map((action) => ({ ...action, onClick: () => (action.onClick(), show(key)) })),
  ];
  // eslint-disable-next-line no-restricted-syntax -- startRinging itself.
  notifyAlarm({
    id: `ordo.alarm.${key}`,
    icon: ringIcon(key),
    title: entry.title,
    lines: [...entry.lines, waiting && `Sonne à nouveau à ${fmt.time(new Date(nextAt))}`],
    actions,
    ringing: ringingSince !== null,
  });
}

/**
 * Plans the end of the ring under way and the next ring.
 * @param {string} key Key.
 * @returns {void}
 */
function schedule(key: string): void {
  const ring = active.get(key);
  if (!ring) return;
  ring.timers.forEach((timer) => window.clearTimeout(timer));
  ring.timers = [];
  const now = Date.now();
  if (ring.ringingSince !== null) {
    const end = ring.ringingSince + context.settings.ringMinutes * 60_000;
    ring.timers.push(
      window.setTimeout(() => {
        ring.ringingSince = null;
        ring.silence = undefined;
        show(key);
      }, Math.max(0, end - now)),
    );
  }
  if (ring.nextAt !== null) ring.timers.push(window.setTimeout(() => ringAgain(key), Math.max(0, ring.nextAt - now)));
}

/**
 * Rings now: the ringtone (when this tab has the sound), the toast, the end and the next ring planned.
 * @param {string} key Key.
 * @param {boolean} sound This tab sounds it.
 * @returns {void}
 */
function ringNow(key: string, sound: boolean): void {
  const ring = active.get(key);
  if (!ring) return;
  quiet(ring);
  const now = new Date();
  const { settings } = context;
  ring.ringingSince = now.getTime();
  ring.nextAt = repeatedRingAt(settings, now)?.getTime() ?? null;
  if (sound) {
    // eslint-disable-next-line no-restricted-syntax -- startRinging itself.
    ring.silence = startRingtone(ring.entry.ringtone ?? settings.ringtone, { loop: settings.loop, durationMs: settings.ringMinutes * 60_000 });
    systemNotification(ring.entry.title, ring.entry.lines.join(' · ') || undefined, `ordo.alarm.${key}`);
  }
  show(key);
  schedule(key);
}

/**
 * Records a ring with the API, then follows what it keeps (stopped elsewhere: stops; its next ring).
 * @param {RingEntry} entry Ring.
 * @returns {void}
 */
function record(entry: RingEntry): void {
  const link = entry.actions.find((action) => action.to);
  sendAlarmRing({
    key: entry.key,
    workspaceId: entry.workspaceId ?? link?.to?.workspaceId ?? context.workspaceId,
    title: entry.title,
    lines: entry.lines,
    path: link?.to?.path,
    linkLabel: link?.label,
    ringtone: entry.ringtone,
    dueAt: entry.dueAt.toISOString(),
  })
    .then((kept) => {
      if (kept.stoppedAt) finish(entry.key);
    })
    // Offline: it rings here all the same.
    .catch(() => undefined);
}

/**
 * Rings again (repetition or snooze over): this tab sounds it when it claims it (one tab per ring).
 * @param {string} key Key.
 * @returns {void}
 */
function ringAgain(key: string): void {
  const ring = active.get(key);
  if (!ring || stopped.has(key)) return;
  const sound = claim(`ordo.alarm.${key}:again`, context.settings.ringMinutes * 60_000);
  ringNow(key, sound);
  if (sound) record(ring.entry);
}

/**
 * Starts ringing an alarm or a reminder due (claimed by this tab: it sounds here), unless it rings already or was
 * stopped: the one way everything rings (`ringPlannedReminders`, `ringAlarm`).
 * @param {RingEntry} entry Ring.
 * @returns {void}
 */
export function startRinging(entry: RingEntry): void {
  if (stopped.has(entry.key) || active.has(entry.key)) return;
  active.set(entry.key, { entry, ringingSince: null, nextAt: null, timers: [] });
  ringNow(entry.key, true);
  record(entry);
}

/**
 * Forgets a ring here: no sound, no toast, never again.
 * @param {string} key Key.
 * @returns {void}
 */
function finish(key: string): void {
  stopped.add(key);
  const ring = active.get(key);
  if (ring) quiet(ring);
  active.delete(key);
  closeToast(`ordo.alarm.${key}`);
}

/**
 * « Arrêter »: stopped for good, here, in the other tabs and devices.
 * @param {string} key Key.
 * @returns {void}
 */
export function stopRing(key: string): void {
  finish(key);
  channel?.postMessage({ type: 'stop', key } satisfies RingMessage);
  sendAlarmStop(key).catch(() => undefined);
}

/**
 * Silent until a moment, then rings again.
 * @param {string} key Key.
 * @param {number} nextAt Next ring.
 * @returns {void}
 */
function wait(key: string, nextAt: number): void {
  const ring = active.get(key);
  if (!ring) return;
  quiet(ring);
  ring.ringingSince = null;
  ring.nextAt = nextAt;
  show(key);
  schedule(key);
}

/**
 * « Répéter dans N min »: silent now, rings again after the minutes of the settings, here and in the other tabs.
 * @param {string} key Key.
 * @returns {void}
 */
export function snoozeRing(key: string): void {
  const nextAt = Date.now() + snoozeMinutes(context.settings) * 60_000;
  wait(key, nextAt);
  channel?.postMessage({ type: 'snooze', key, nextAt } satisfies RingMessage);
  sendAlarmSnooze(key).catch(() => undefined);
}

channel?.addEventListener('message', (event: MessageEvent<RingMessage>) => {
  if (event.data.type === 'stop') finish(event.data.key);
  else wait(event.data.key, event.data.nextAt);
});

/**
 * Takes the rings the API keeps (after a reload, from another tab or device): a stopped one stops here; one snoozed
 * elsewhere (silent, its next ring later than here) waits here too; one not shown here is shown as it is
 * (ringing without sound, waiting, or silent), with the link it was kept with and its actions rebuilt from its key.
 * @param {AlarmRing[]} rings Rings of the last hours.
 * @returns {void}
 */
export function followRings(rings: AlarmRing[]): void {
  for (const ring of rings) {
    if (ring.stoppedAt) {
      if (!stopped.has(ring.key)) finish(ring.key);
      continue;
    }
    const shown = active.get(ring.key);
    if (shown) {
      // Snoozed in another tab, device or notification: silent until its next ring (a row read before a ring of this
      // tab is recorded has its next ring past: left alone).
      const nextAt = ring.nextAt ? new Date(ring.nextAt).getTime() : null;
      if (!ring.ringingSince && nextAt !== null && nextAt > Date.now() && (shown.ringingSince !== null || shown.nextAt === null || Math.abs(shown.nextAt - nextAt) > SNOOZE_DRIFT_MS))
        wait(ring.key, nextAt);
      continue;
    }
    if (stopped.has(ring.key)) continue;
    const target = ring.path ? { path: ring.path, workspaceId: ring.workspaceId } : null;
    const ringingSince = ring.ringingSince ? new Date(ring.ringingSince).getTime() : null;
    active.set(ring.key, {
      entry: {
        key: ring.key,
        dueAt: new Date(ring.dueAt),
        title: ring.title,
        lines: ring.lines,
        actions: target ? [{ label: ring.linkLabel ?? 'Ouvrir', to: target, onClick: () => context.open(target) }] : [],
        ...(isRingtone(ring.ringtone) && { ringtone: ring.ringtone }),
        workspaceId: ring.workspaceId,
      },
      ringingSince: ringingSince !== null && ringingSince + context.settings.ringMinutes * 60_000 > Date.now() ? ringingSince : null,
      nextAt: ring.nextAt ? new Date(ring.nextAt).getTime() : null,
      timers: [],
      restored: true,
    });
    show(ring.key);
    schedule(ring.key);
  }
}

/**
 * Loads the rings the API keeps and follows them (`followRings`).
 * @returns {Promise<void>} Done (a failure is ignored: the next check retries).
 */
export async function loadRings(): Promise<void> {
  followRings(await fetchAlarmRings().catch(() => []));
}

/**
 * A ring the server pushed while this tab is visible (the service worker then shows no notification): its
 * state loaded from the API, then it rings here as any other (its ringtone, looped as set; one tab sounds it).
 * @param {string} key Key of the ring.
 * @returns {Promise<void>} Done.
 */
export async function ringPushed(key: string): Promise<void> {
  await loadRings();
  if (!active.has(key) || stopped.has(key)) return;
  ringNow(key, claim(`ordo.alarm.${key}:again`, context.settings.ringMinutes * 60_000));
}
