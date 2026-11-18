import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react';

/**
 * Password visibility toggle icon, sized by Mantine's `--psi-icon-size`.
 * @param {object} props Component props.
 * @param {boolean} props.reveal Whether the password is currently visible.
 * @returns {JSX.Element} Eye icon.
 */
export function VisibilityToggleIcon({ reveal }: { reveal: boolean }) {
  const Icon = reveal ? EyeSlashIcon : EyeIcon;
  return <Icon style={{ width: 'var(--psi-icon-size)', height: 'var(--psi-icon-size)' }} aria-hidden />;
}
