import { idsOfKind, peopleKeys, personKey } from '../../../components/people/people-keys';
import { unarchived } from '../../../lib/archive';
import { queryClient } from '../../../lib/query-client';
import { treasurySettingsKey, useTreasurySettings, type TreasurySettings } from '../../treasury/api';
import { useTaskContext } from '../../tasks/hooks/use-task-context';

/** « Bénéficiaires » of a task, a routine or an event: contributors and relations (people out of the team). */
export interface Beneficiaries {
  beneficiaryIds: string[];
  beneficiaryRelationIds: string[];
}

/**
 * Values of a select of beneficiaries: contributors and relations.
 * @param {Beneficiaries} value Beneficiaries.
 * @returns {string[]} Values.
 */
export const beneficiaryKeys = (value: Beneficiaries) => peopleKeys({ contributor: value.beneficiaryIds, relation: value.beneficiaryRelationIds });

/**
 * Beneficiaries of select values.
 * @param {string[]} keys Values.
 * @returns {Beneficiaries} Beneficiaries.
 */
export const beneficiariesOf = (keys: string[]): Beneficiaries => ({ beneficiaryIds: idsOfKind(keys, 'contributor'), beneficiaryRelationIds: idsOfKind(keys, 'relation') });

/**
 * Names of beneficiaries, contributors first (those unknown left out).
 * @param {Beneficiaries} value Beneficiaries.
 * @param {ReadonlyMap<string, string>} contributorName Names of the contributors.
 * @param {ReadonlyMap<string, string>} relationName Names of the relations.
 * @returns {string[]} Names.
 */
function namesOf(value: Beneficiaries, contributorName: ReadonlyMap<string, string>, relationName: ReadonlyMap<string, string>): string[] {
  const known = (names: ReadonlyMap<string, string>) => (id: string) => (names.has(id) ? [names.get(id)!] : []);
  return [...value.beneficiaryIds.flatMap(known(contributorName)), ...value.beneficiaryRelationIds.flatMap(known(relationName))];
}

/**
 * People a task, a routine or an event can be for: the contributors, and the relations without contributor (one with
 * a contributor is that contributor; one already chosen stays offered); the archived ones left out, except those
 * already chosen. Names, grouped options, and the choices of a column filter (all of them, the archived flagged).
 * @param {Beneficiaries} [chosen] Beneficiaries already chosen. Optional.
 * @returns {{ options: object[], names: (value: Beneficiaries) => string[], choices: object[] }} Options, names and filter choices.
 */
export function useBeneficiaries(chosen: Beneficiaries = { beneficiaryIds: [], beneficiaryRelationIds: [] }) {
  const { context } = useTaskContext();
  const { data } = useTreasurySettings();
  const contributors = context?.contributors ?? [];
  const relations = data?.treasuryRelations ?? [];
  const contributorName = new Map(contributors.map((contributor) => [contributor.id, context?.contributorName(contributor) ?? contributor.name]));
  const relationName = new Map(relations.map((relation) => [relation.id, relation.name]));
  const options = [
    {
      group: 'Contributeurs',
      items: unarchived(contributors, chosen.beneficiaryIds).map((contributor) => ({ value: personKey('contributor', contributor.id), label: contributorName.get(contributor.id)! })),
    },
    {
      group: 'Proches',
      items: unarchived(relations, chosen.beneficiaryRelationIds)
        .filter((relation) => !relation.contributorId || chosen.beneficiaryRelationIds.includes(relation.id))
        .map((relation) => ({ value: personKey('relation', relation.id), label: relation.name })),
    },
  ].filter((group) => group.items.length > 0);
  /**
   * Names of beneficiaries, contributors first.
   * @param {Beneficiaries} value Beneficiaries.
   * @returns {string[]} Names.
   */
  const names = (value: Beneficiaries) => namesOf(value, contributorName, relationName);
  // Column filters: archived ones keep their labels, offered only while in the filter.
  const choices = [
    ...contributors.map((contributor) => ({ value: personKey('contributor', contributor.id), label: contributorName.get(contributor.id)!, archived: contributor.archived })),
    ...relations.filter((relation) => !relation.contributorId).map((relation) => ({ value: personKey('relation', relation.id), label: relation.name, archived: relation.archived })),
  ];
  return { options, names, choices };
}

/**
 * Names of beneficiaries out of a component (sort, export, search): contributors from the task context, relations
 * from the loaded treasury settings.
 * @param {Beneficiaries} value Beneficiaries.
 * @param {{ contributorById: Map<string, { name: string }> } | null} context Task context.
 * @returns {string[]} Names, contributors first.
 */
export function beneficiaryNames(value: Beneficiaries, context: { contributorById: Map<string, { name: string }> } | null): string[] {
  const relations = queryClient.getQueryData<TreasurySettings>(treasurySettingsKey)?.treasuryRelations ?? [];
  const contributorName = new Map([...(context?.contributorById ?? new Map<string, { name: string }>())].map(([id, contributor]) => [id, contributor.name]));
  return namesOf(value, contributorName, new Map(relations.map((relation) => [relation.id, relation.name])));
}
