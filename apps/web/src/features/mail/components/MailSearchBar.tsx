import { Group, TextInput } from '@mantine/core';
import { MagnifyingGlassIcon, SlidersHorizontalIcon } from '@phosphor-icons/react';
import { IconAction } from '../../../components/actions/IconAction';

interface MailSearchBarProps {
  /** Text searched. */
  value: string;
  onChange: (text: string) => void;
  /** Where it searches, for the screen readers (« Rechercher dans le dossier »). */
  label: string;
  /** The advanced search is unfolded. */
  advancedOpen: boolean;
  /** Unfolds or folds the advanced search. */
  onToggleAdvanced: () => void;
}

/**
 * Search of a list of mails, the same everywhere: its text, then the button of the advanced search.
 * @param {MailSearchBarProps} props Component props.
 * @returns {JSX.Element} Bar.
 */
export function MailSearchBar({ value, onChange, label, advancedOpen, onToggleAdvanced }: MailSearchBarProps) {
  return (
    <Group gap={4} wrap="nowrap">
      <TextInput
        size="xs"
        style={{ flex: 1 }}
        placeholder="Rechercher (objet, expéditeur, texte)"
        aria-label={label}
        leftSection={<MagnifyingGlassIcon aria-hidden />}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <IconAction label="Recherche avancée" expanded={advancedOpen} onClick={onToggleAdvanced}>
        <SlidersHorizontalIcon aria-hidden />
      </IconAction>
    </Group>
  );
}
