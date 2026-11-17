import { idsOfKind, peopleKeys, personKey } from '../../components/people/people-keys';
import { queryClient } from '../../lib/query-client';
import { treasuryKey, useTreasurySettings, type TreasurySettings } from '../treasury/api';
import { useTaskContext } from '../tasks/use-task-context';

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
 * People a task, a routine or an event can be for: the contributors, and the relations without contributor (one with
 * a contributor is that contributor; one already chosen stays offered). Names and grouped options.
 * @param {Beneficiaries} [chosen] Beneficiaries already chosen. Optional.
 * @returns {{ options: object[], names: (value: Beneficiaries) => string[] }} Options and names.
 */
export function useBeneficiaries(chosen: Beneficiaries = { beneficiaryIds: [], beneficiaryRelationIds: [] }) {
  const { context } = useTaskContext();
  const { data } = useTreasurySettings();
  const contributors = context?.contributors ?? [];
  const relations = data?.treasuryRelations ?? [];
  const contributorName = new Map(contributors.map((contributor) => [contributor.id, context?.contributorName(contributor) ?? contributor.name]));
  const relationName = new Map(relations.map((relation) => [relation.id, relation.name]));
  const options = [
    { group: 'Contributeurs', items: contributors.map((contributor) => ({ value: personKey('contributor', contributor.id), label: contributorName.get(contributor.id)! })) },
    {
      group: 'Proches',
      items: relations
        .filter((relation) => !relation.contributorId || chosen.beneficiaryRelationIds.includes(relation.id))
        .map((relation) => ({ value: personKey('relation', relation.id), label: relation.name })),
    },
  ].filter((group) => group.items.length > 0);
  /**
   * Names of beneficiaries, contributors first.
   * @param {Beneficiaries} value Beneficiaries.
   * @returns {string[]} Names.
   */
  const names = (value: Beneficiaries) => [
    ...value.beneficiaryIds.flatMap((id) => (contributorName.has(id) ? [contributorName.get(id)!] : [])),
    ...value.beneficiaryRelationIds.flatMap((id) => (relationName.has(id) ? [relationName.get(id)!] : [])),
  ];
  return { options, names };
}

/**
 * Names of beneficiaries out of a component (sort, export, search): contributors from the task context, relations
 * from the loaded treasury settings.
 * @param {Beneficiaries} value Beneficiaries.
 * @param {{ contributorById: Map<string, { name: string }> } | null} context Task context.
 * @returns {string[]} Names, contributors first.
 */
export function beneficiaryNames(value: Beneficiaries, context: { contributorById: Map<string, { name: string }> } | null): string[] {
  const relations = queryClient.getQueryData<TreasurySettings>([...treasuryKey, 'settings'])?.treasuryRelations ?? [];
  const relationName = new Map(relations.map((relation) => [relation.id, relation.name]));
  return [
    ...value.beneficiaryIds.flatMap((id) => (context?.contributorById.get(id) ? [context.contributorById.get(id)!.name] : [])),
    ...value.beneficiaryRelationIds.flatMap((id) => (relationName.has(id) ? [relationName.get(id)!] : [])),
  ];
}
