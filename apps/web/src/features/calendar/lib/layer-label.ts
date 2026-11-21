/**
 * Label of a layer of the calendar (a calendar, a schedule, a kind of slots) with the workspace it comes from: « Label ·
 * Espace », the same everywhere; the label alone for one of the workspace.
 * @param {string} label Label of the layer.
 * @param {string | null} [workspace] Label of its workspace, for one of another workspace. Optional.
 * @returns {string} « Réunions · Perso ».
 */
export const inWorkspace = (label: string, workspace?: string | null): string => (workspace ? `${label} · ${workspace}` : label);
