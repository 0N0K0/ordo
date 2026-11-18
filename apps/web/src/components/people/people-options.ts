import { useActiveWorkspace } from '../../features/workspaces/api';

/** Option of a select of people. */
export interface PersonChoice {
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
    { group: perso ? 'Proches' : 'Relations', items: relations },
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
