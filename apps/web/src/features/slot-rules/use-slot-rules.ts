import {
  addDays,
  allowedAt,
  DEFAULT_SLOT_KIND,
  effectiveSlotRule,
  foreignSlotKind,
  kindedSlots,
  knownSlotRule,
  nextAllowed,
  ownSlotKind,
  readSlotRule,
  scheduleKinds,
  type SlotRule,
} from '@ordo/shared';
import { useEffect, useMemo, useState } from 'react';
import { scheduleRules, useDefaultScheduleKind, useForeignScheduleKinds, useScheduleTypes, useSubscribedSchedules, useWorkSchedules } from '../calendar/api';
import { localDay } from '../../lib/dates';
import { useActiveWorkspace } from '../workspaces/api';

/** Days ahead the next allowed moment is looked for. */
const LOOKAHEAD_DAYS = 14;

/** Kind of slots a rule can name: of this workspace, or shown from another one. */
export interface SlotKindOption {
  value: string;
  label: string;
  group: string;
}

/** Slot rules of the workspace: kinds to choose from, and whether a rule allows a moment. */
export interface SlotRules {
  /** Kinds a rule can name, grouped by workspace. */
  kinds: SlotKindOption[];
  /** Default rule of the workspace (on its working hours in a professional one, anywhere in a personal one). */
  defaultRule: SlotRule;
  /**
   * Rule that applies to an item: its own, else the default of the workspace, restricted to the kinds with schedules.
   * @param {unknown} value Rule of the item (JSON).
   * @returns {SlotRule} Rule.
   */
  ruleOf: (value: unknown) => SlotRule;
  /**
   * Whether an item can be done at a moment (now by default).
   * @param {unknown} value Rule of the item (JSON).
   * @param {Date} [at] Moment. Optional. Default = now.
   * @returns {boolean} Allowed.
   */
  allowed: (value: unknown, at?: Date) => boolean;
  /**
   * First moment an item can be done from a moment on (within two weeks), null when none.
   * @param {unknown} value Rule of the item (JSON).
   * @param {Date} from Moment.
   * @returns {Date | null} Moment.
   */
  nextAllowedAt: (value: unknown, from: Date) => Date | null;
  /**
   * Slots of a rule, told in words (« sur Travail », « hors de Travail, Sport »); null for « partout ».
   * @param {SlotRule} rule Rule.
   * @returns {string | null} Text.
   */
  describe: (rule: SlotRule) => string | null;
}

/**
 * Local time of a moment, HH:MM.
 * @param {Date} date Moment.
 * @returns {string} Time.
 */
const localTime = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/**
 * Current time, refreshed every minute.
 * @returns {number} Current time in ms.
 */
function useMinute(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/**
 * Slot rules of the current workspace: the kinds of slots (its own and those shown from other workspaces), and
 * whether a task or a routine can be done now or at a moment. Refreshed every minute.
 * @returns {SlotRules} Slot rules.
 */
export function useSlotRules(): SlotRules {
  const { perso } = useActiveWorkspace();
  const { data: own } = useWorkSchedules();
  const { data: types } = useScheduleTypes();
  const { data: defaultKind } = useDefaultScheduleKind();
  const { data: foreignKinds } = useForeignScheduleKinds();
  const { data: foreign } = useSubscribedSchedules();
  const minute = useMinute();
  const today = localDay(new Date(minute));

  return useMemo(() => {
    const ownRules = scheduleRules(own ?? []);
    const shown = (foreign ?? []).map((schedule) => ({ workspaceId: schedule.workspaceId, rule: scheduleRules([schedule])[0] }));
    const slots = kindedSlots(ownRules, shown, addDays(today, -1), addDays(today, LOOKAHEAD_DAYS));
    const known = scheduleKinds(
      ownRules,
      shown.map(({ workspaceId, rule }) => ({ workspaceId, typeId: rule.typeId })),
    );
    const defaultRule = effectiveSlotRule(null, perso);
    const ruleOf = (value: unknown) => knownSlotRule(effectiveSlotRule(readSlotRule(value), perso), known);

    const kinds: SlotKindOption[] = [
      { value: DEFAULT_SLOT_KIND, label: defaultKind?.name ?? 'Travail', group: 'Cet espace' },
      ...(types ?? []).map((type) => ({ value: ownSlotKind(type.id), label: type.name, group: 'Cet espace' })),
      ...(foreignKinds ?? [])
        .filter((kind) => kind.subscribed)
        .map((kind) => ({ value: foreignSlotKind(kind.workspaceId, kind.typeId), label: `${kind.name} (${kind.workspaceName})`, group: kind.workspaceName })),
    ];
    const labelOf = new Map(kinds.map((kind) => [kind.value, kind.label]));

    return {
      kinds,
      defaultRule,
      ruleOf,
      allowed: (value, at = new Date(minute)) => allowedAt(ruleOf(value), slots, localDay(at), localTime(at)),
      nextAllowedAt: (value, from) => {
        const moment = nextAllowed(ruleOf(value), slots, localDay(from), localTime(from));
        if (!moment) return null;
        const [hours, minutes] = moment.time.split(':').map(Number);
        const [year, month, day] = moment.date.split('-').map(Number);
        return new Date(year, month - 1, day, hours, minutes);
      },
      describe: (rule) => {
        if (rule.mode === 'ANY') return null;
        const names = rule.kinds.map((kind) => labelOf.get(kind) ?? 'Plages supprimées').join(', ');
        return rule.mode === 'INSIDE' ? `Sur ${names}` : `Hors de ${names}`;
      },
    };
  }, [own, types, defaultKind, foreignKinds, foreign, perso, minute, today]);
}
