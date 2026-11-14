import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { EditableMultiSelect } from '../../components/data-table/EditableCells';
import { beneficiariesOf, beneficiaryKeys, useBeneficiaries, type Beneficiaries } from './use-beneficiaries';

/** Label of the field, everywhere. */
export const BENEFICIARIES_LABEL = 'Bénéficiaires';

interface BeneficiariesSelectProps {
  value: Beneficiaries;
  onChange: (value: Beneficiaries) => void;
  /** Help under the field. Optional. */
  description?: string;
  disabled?: boolean;
}

/**
 * « Bénéficiaires » field of a form: whom a task, a routine or an event is for (« l’anniversaire est pour mon fils »),
 * contributors and relations.
 * @param {BeneficiariesSelectProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function BeneficiariesSelect({ value, onChange, description = 'Pour qui c’est : contributeurs ou proches.', disabled }: BeneficiariesSelectProps) {
  const { options } = useBeneficiaries(value);
  const keys = beneficiaryKeys(value);
  return (
    <BatchMultiSelect
      label={BENEFICIARIES_LABEL}
      description={description}
      placeholder={keys.length ? undefined : 'Personne en particulier'}
      data={options}
      value={keys}
      onChange={(next) => onChange(beneficiariesOf(next))}
      searchable
      clearable
      disabled={disabled}
    />
  );
}

/**
 * « Bénéficiaires » cell of a table: chosen in place, saved once the list closes.
 * @param {{ value: Beneficiaries, label: string, readOnly?: boolean, onSave: (value: Beneficiaries) => void }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function BeneficiariesCell({ value, label, readOnly = false, onSave }: { value: Beneficiaries; label: string; readOnly?: boolean; onSave: (value: Beneficiaries) => void }) {
  const { options } = useBeneficiaries(value);
  return <EditableMultiSelect label={label} value={beneficiaryKeys(value)} data={options} readOnly={readOnly} onSave={(next) => onSave(beneficiariesOf(next))} />;
}
