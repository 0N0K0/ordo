import { Alert, type AlertProps } from '@mantine/core';
import { ErrorIcon } from './feedback-icons';

/**
 * Error shown in a page or a panel (what failed to load, a broken link): the same red alert everywhere.
 * @param {Omit<AlertProps, 'color' | 'icon'>} props Alert props (title, content, spacing).
 * @returns {JSX.Element} Alert.
 */
export function ErrorAlert(props: Omit<AlertProps, 'color' | 'icon'>) {
  // eslint-disable-next-line no-restricted-syntax -- the one red alert.
  return <Alert color="red" icon={<ErrorIcon />} {...props} />;
}
