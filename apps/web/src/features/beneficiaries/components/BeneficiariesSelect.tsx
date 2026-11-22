import { PeopleSelect } from '../../../components/people/PeopleSelect';
import { relationNoun } from '../../../components/people/people-options';
import { useActiveWorkspace } from '../../workspaces/api';
import { EditableMultiSelect } from '../../../components/data-table/cells/EditableCells';
import type { Contributor } from '../../tasks/api';
import { beneficiariesOf, beneficiaryKeys, useBeneficiaries, type Beneficiaries } from '../hooks/use-beneficiaries';

/** Label of the field, everywhere. */
const BENEFICIARIES_LABEL = 'Bénéficiaires';

interface BeneficiariesSelectProps {
  value: Beneficiaries;
  onChange: (value: Beneficiaries) => void;
  /** Label. Optional. Default = « Bénéficiaires ». */
  label?: string;
  /** Help under the field. Optional. Default = « Pour qui c’est : contributeurs ou relations » (« proches » in a personal workspace). */
  description?: string;
  /** Shown without anyone. Optional. Default = « Personne en particulier ». */
  placeholder?: string;
  /** Contributors offered (those of a project). Optional. Default = all of them. */
  contributors?: readonly Contributor[];
  disabled?: boolean;
}

/**
 * « Bénéficiaires » field of a form: whom a task, a routine or an event is for (« l’anniversaire est pour mon fils »),
 * contributors (with their avatar and handle, as the assignees) and relations, grouped. With another label, the same field chooses other people of both kinds (the
 * « Assignés » of an event).
 * @param {BeneficiariesSelectProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function BeneficiariesSelect({ value, onChange, label = BENEFICIARIES_LABEL, description, placeholder = 'Personne en particulier', contributors, disabled }: BeneficiariesSelectProps) {
  const { options, renderOption } = useBeneficiaries(value, contributors);
  const { perso } = useActiveWorkspace();
  return (
    <PeopleSelect
      label={label}
      description={description ?? `Pour qui c’est : contributeurs ou ${relationNoun(perso, true).toLowerCase()}.`}
      placeholder={placeholder}
      data={options}
      renderOption={renderOption}
      value={beneficiaryKeys(value)}
      onChange={(next) => onChange(beneficiariesOf(next))}
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
  const { options, renderOption } = useBeneficiaries(value);
  return <EditableMultiSelect label={label} value={beneficiaryKeys(value)} data={options} renderOption={renderOption} readOnly={readOnly} onSave={(next) => onSave(beneficiariesOf(next))} />;
}
