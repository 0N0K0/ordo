import { IconAction } from '../../components/actions/IconAction';
import { GearSixIcon } from '@phosphor-icons/react';
import { usePageSettings, useSettingsOpened } from './page-settings';

/**
 * Button of the header opening or closing the settings of the page, always at the same place (before « Ajouter »);
 * on a page without settings, none.
 * @returns {JSX.Element | null} Button.
 */
export function SettingsButton() {
  const { title } = usePageSettings();
  const { opened, setOpened } = useSettingsOpened();
  if (!title) return null;
  return (
    <IconAction label={opened ? `Fermer : ${title}` : title} size="input-xs" variant={opened ? 'filled' : 'light'} aria-label={title} aria-pressed={opened} onClick={() => setOpened(!opened)}>
      <GearSixIcon aria-hidden />
    </IconAction>
  );
}
