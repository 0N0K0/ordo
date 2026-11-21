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
export const meName = (me: { name: string } | null | undefined): string => (me ? personName({ ...me, isMe: true }) : 'Moi');

/**
 * Name of the people out of the team or household: « Relation(s) » in a pro workspace, « Proche(s) » in a
 * personal one.
 * @param {boolean} perso A personal workspace.
 * @param {boolean} [many] Plural. Optional. Default = false.
 * @returns {string} Name, capitalised.
 */
// eslint-disable-next-line no-restricted-syntax -- the brick the rule points to.
export const relationNoun = (perso: boolean, many = false): string => (perso ? 'Proche' : 'Relation') + (many ? 's' : '');

/** Words of the people out of the team or household, agreed with their noun. */
export interface RelationWords {
  /** « Relation » / « Proche ». */
  noun: string;
  /** « Relations » / « Proches ». */
  many: string;
  /** « la relation » / « le proche ». */
  the: string;
  /** « Nouvelle relation » / « Nouveau proche ». */
  new: string;
  /** « Aucune relation. » / « Aucun proche. » */
  none: string;
  /** The noun is feminine (« relation »): the agreement of the words that go with it. */
  feminine: boolean;
}

/**
 * Words of the people out of the team or household: « relation » in a pro workspace, « proche » in a personal one,
 * with their agreement (« Relation modifiée. », « Proche modifié. »).
 * @param {boolean} perso A personal workspace.
 * @returns {RelationWords} Words.
 */
export function relationWords(perso: boolean): RelationWords {
  const noun = relationNoun(perso);
  return perso
    ? { noun, many: relationNoun(perso, true), the: 'le proche', new: 'Nouveau proche', none: 'Aucun proche.', feminine: false }
    : // eslint-disable-next-line no-restricted-syntax -- the brick the rule points to.
      { noun, many: relationNoun(perso, true), the: 'la relation', new: 'Nouvelle relation', none: 'Aucune relation.', feminine: true };
}

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
