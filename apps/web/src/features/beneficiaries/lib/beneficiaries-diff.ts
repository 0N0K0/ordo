import { applyDiff } from '../../../components/data-table/selection/bulk-edit';
import type { Beneficiaries } from '../hooks/use-beneficiaries';

/**
 * Beneficiaries of a row of a selection once a cell is changed: those added in the cell added to it, those removed removed.
 * @param {Beneficiaries} target Row changed (one of the selection).
 * @param {Beneficiaries} before Beneficiaries of the row whose cell was changed.
 * @param {Beneficiaries} after Beneficiaries chosen in the cell.
 * @returns {Beneficiaries} Beneficiaries of the row.
 */
export function beneficiariesDiff(target: Beneficiaries, before: Beneficiaries, after: Beneficiaries): Beneficiaries {
  return {
    beneficiaryIds: applyDiff(target.beneficiaryIds, before.beneficiaryIds, after.beneficiaryIds),
    // eslint-disable-next-line no-restricted-syntax -- beneficiariesDiff itself.
    beneficiaryRelationIds: applyDiff(target.beneficiaryRelationIds, before.beneficiaryRelationIds, after.beneficiaryRelationIds),
  };
}
