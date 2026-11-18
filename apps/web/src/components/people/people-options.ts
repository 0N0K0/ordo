import { useActiveWorkspace } from '../../features/workspaces/api';

/** Option of a select of people. */
interface PersonChoice {
  value: string;
  label: string;
}

/** Group of options of a select of people. */
export interface PeopleGroup {
  group: string;
  items: PersonChoice[];
}

/**
 * Name of a person in a list of people, the user told apart: « Prénom (moi) ».
 * @param {{ name: string, isMe: boolean }} person Person.
 * @returns {string} Name shown.
 */
export const personName = (person: { name: string; isMe: boolean }): string => (person.isMe ? `${person.name} (moi)` : person.name);

/**
 * Name of the user among people: « Prénom (moi) », « Moi » when the user is not one of them.
 * @param {{ name: string } | null | undefined} me The user as one of the people. Optional.
 * @returns {string} Name shown.
 */
export const meName = (me: { name: string } | null | undefined): string => (me ? `${me.name} (moi)` : 'Moi');

/**
 * Name of the people out of the team or household (decision 15): « Relation(s) » in a pro workspace, « Proche(s) » in a
 * personal one.
 * @param {boolean} perso A personal workspace.
 * @param {boolean} [many] Plural. Optional. Default = false.
 * @returns {string} Name, capitalised.
 */
// eslint-disable-next-line no-restricted-syntax -- the brick the rule points to.
export const relationNoun = (perso: boolean, many = false): string => (perso ? 'Proche' : 'Relation') + (many ? 's' : '');

/**
 * Options of a select of people, grouped: « Contributeurs », then « Relations » in a pro workspace or « Proches » in a
 * personal one; an empty group left out.
 * @param {PersonChoice[]} contributors Contributors (members of the team or household).
 * @param {PersonChoice[]} relations Relations (people out of it).
 * @param {boolean} perso A personal workspace.
 * @returns {PeopleGroup[]} Options.
 */
export function peopleOptions(contributors: PersonChoice[], relations: PersonChoice[], perso: boolean): PeopleGroup[] {
  return [
    { group: 'Contributeurs', items: contributors },
    { group: relationNoun(perso, true), items: relations },
  ].filter((group) => group.items.length > 0);
}

/**
 * The options builder of the people selects (peopleOptions), with the labels of the active workspace.
 * @returns {(contributors: PersonChoice[], relations: PersonChoice[]) => PeopleGroup[]} Builder.
 */
export function usePeopleOptions(): (contributors: PersonChoice[], relations: PersonChoice[]) => PeopleGroup[] {
  const { perso } = useActiveWorkspace();
  return (contributors, relations) => peopleOptions(contributors, relations, perso);
}
