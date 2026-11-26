import { countOf } from '../../../lib/text';

/**
 * Label of a layer of the calendar (a calendar, a schedule, a kind of slots) with the workspace it comes from: « Label ·
 * Espace », the same everywhere; the label alone for one of the workspace.
 * @param {string} label Label of the layer.
 * @param {string | null} [workspace] Label of its workspace, for one of another workspace. Optional.
 * @returns {string} « Réunions · Perso ».
 */
export const inWorkspace = (label: string, workspace?: string | null): string => (workspace ? `${label} · ${workspace}` : label);

/** A layer that can be shown or left out (a calendar, a schedule), in its colour. */
export interface LayerChoice {
  id: string;
  label: string;
  color: string;
}

/**
 * Calendars that can be shown: those of the workspace, then those of other workspaces it subscribes to (« Label ·
 * Espace »).
 * @param {readonly { id: string, label: string, color: string }[]} own Calendars of the workspace shown in the list.
 * @param {readonly { calendarId: string, label: string, color: string, workspace: { label: string } }[]} subscriptions Calendars of other workspaces subscribed to.
 * @returns {LayerChoice[]} Choices.
 */
export function calendarChoices(
  own: readonly { id: string; label: string; color: string }[],
  subscriptions: readonly { calendarId: string; label: string; color: string; workspace: { label: string } }[],
): LayerChoice[] {
  return [
    ...own.map((calendar) => ({ id: calendar.id, label: calendar.label, color: calendar.color })),
    ...subscriptions.map((subscription) => ({ id: subscription.calendarId, label: inWorkspace(subscription.label, subscription.workspace.label), color: subscription.color })),
  ];
}

/**
 * Créneaux and éphémérides that can be shown or left out, as `scheduleSources` gives them (of the workspace, then of
 * the workspaces it subscribes to); the working hours, without colour, in green.
 * @param {readonly { schedule: { id: string }, label: string, color: string | null }[]} sources Schedules.
 * @returns {LayerChoice[]} Choices.
 */
export const scheduleChoices = (sources: readonly { schedule: { id: string }; label: string; color: string | null }[]): LayerChoice[] =>
  sources.map(({ schedule, label, color }) => ({ id: schedule.id, label, color: color ?? 'green' }));

/**
 * Risk of archiving a calendar or a kind of schedules other workspaces subscribe to (for its destructive
 * confirmation): their subscriptions are removed for good, restoring it does not bring them back.
 * @param {number} subscriberCount Number of other workspaces subscribed to it.
 * @param {string} what What is archived, after « à » (« ce calendrier », « ce type »).
 * @returns {string | null} Risk; nothing without subscriber (archived at once).
 */
export function subscribersArchiveRisk(subscriberCount: number, what: string): string | null {
  if (!subscriberCount) return null;
  const one = subscriberCount === 1;
  return `${countOf(subscriberCount, 'autre espace', 'autres espaces')} ${one ? 'est abonné' : 'sont abonnés'} à ${what}. Archivé, il ne s’y affichera plus : ${
    one ? 'son abonnement sera supprimé' : 'leurs abonnements seront supprimés'
  } définitivement, et ne ${one ? 'sera pas rendu' : 'seront pas rendus'} si vous le restaurez.`;
}
