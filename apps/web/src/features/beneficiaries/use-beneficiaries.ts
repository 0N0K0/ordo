import { queryClient } from '../../lib/query-client';
import { treasuryKey, useTreasurySettings, type TreasurySettings } from '../treasury/api';
import { useTaskContext } from '../tasks/use-task-context';

/** « Bénéficiaires » of a task, a routine or an event: contributors and relations (people out of the team). */
export interface Beneficiaries {
  beneficiaryIds: string[];
  beneficiaryRelationIds: string[];
}

/**
 * Values of a select of beneficiaries: « c:<contributor> » and « r:<relation> ».
 * @param {Beneficiaries} value Beneficiaries.
 * @returns {string[]} Values.
 */
export const beneficiaryKeys = (value: Beneficiaries) => [...value.beneficiaryIds.map((id) => `c:${id}`), ...value.beneficiaryRelationIds.map((id) => `r:${id}`)];

/**
 * Beneficiaries of select values.
 * @param {string[]} keys Values « c:<id> » / « r:<id> ».
 * @returns {Beneficiaries} Beneficiaries.
 */
export const beneficiariesOf = (keys: string[]): Beneficiaries => ({
  beneficiaryIds: keys.filter((key) => key.startsWith('c:')).map((key) => key.slice(2)),
  beneficiaryRelationIds: keys.filter((key) => key.startsWith('r:')).map((key) => key.slice(2)),
});

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
    { group: 'Contributeurs', items: contributors.map((contributor) => ({ value: `c:${contributor.id}`, label: contributorName.get(contributor.id)! })) },
    {
      group: 'Proches',
      items: relations.filter((relation) => !relation.contributorId || chosen.beneficiaryRelationIds.includes(relation.id)).map((relation) => ({ value: `r:${relation.id}`, label: relation.name })),
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
