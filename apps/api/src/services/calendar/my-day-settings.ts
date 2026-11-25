import { myDaySettingsSchema, readMyDaySettings, type MyDaySettings } from '@ordo/shared';
import { prisma } from '../../db';
import { isUniqueConflict, notFound, parseInput } from '../../graphql/errors';
import { currentWorkspaceId } from '../../workspace-context';
import { toJson } from '../core/json';
import { meContributorId } from '../workspaces/workspaces';

/**
 * Settings of the page « Ma journée », one set per user and workspace (`UserWorkspaceSettings.myDay`): the user is the
 * one of the session, the workspace the one of the request; nobody reads or writes the settings of someone else.
 */

/**
 * Refuses a user who is not a member of the current workspace (no « Moi » profile in it): « Espace introuvable. ».
 * @param {string} userId User of the session.
 * @returns {Promise<void>}
 */
async function assertMember(userId: string): Promise<void> {
  if (!(await meContributorId(userId))) throw notFound('Espace');
}

/**
 * Settings of « Ma journée » of a user in the current workspace (the defaults for what was never chosen).
 * @param {string} userId User of the session.
 * @returns {Promise<MyDaySettings>} Settings.
 */
export async function myDaySettingsOf(userId: string): Promise<MyDaySettings> {
  await assertMember(userId);
  const row = await prisma.userWorkspaceSettings.findFirst({ where: { userId }, select: { myDay: true } });
  return readMyDaySettings(row?.myDay ?? null);
}

/**
 * Saves the settings of « Ma journée » of a user in the current workspace, as a whole. Ids of projects or slots are not
 * checked against the workspace: one deleted since stays until the page sends settings read with the ids still known.
 * @param {string} userId User of the session.
 * @param {MyDaySettings} input Settings.
 * @returns {Promise<MyDaySettings>} Settings saved.
 */
export async function updateMyDaySettings(userId: string, input: MyDaySettings): Promise<MyDaySettings> {
  await assertMember(userId);
  const settings = readMyDaySettings(parseInput(myDaySettingsSchema, input));
  const myDay = toJson(settings);
  try {
    await prisma.userWorkspaceSettings.upsert({
      where: { workspaceId_userId: { workspaceId: currentWorkspaceId(), userId } },
      create: { userId, myDay },
      update: { myDay },
    });
  } catch (error) {
    // A first save of another tab created the row meanwhile: this one replaces it.
    if (!isUniqueConflict(error)) throw error;
    await prisma.userWorkspaceSettings.updateMany({ where: { userId }, data: { myDay } });
  }
  return settings;
}
