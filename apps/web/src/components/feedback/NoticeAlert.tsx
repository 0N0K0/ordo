import { Alert, type AlertProps } from '@mantine/core';
import type { ReactNode } from 'react';
import { InfoFeedbackIcon, SuccessIcon, WarningFeedbackIcon } from './feedback-icons';

/** Kind of a notice: what went well, what to know (or to set up first), what to watch out for. */
type NoticeKind = 'success' | 'info' | 'warning';

/** Colour and icon of each kind, the same everywhere (errors: ErrorAlert, in red). */
const KINDS: Record<NoticeKind, { color: string; icon: ReactNode }> = {
  success: { color: 'green', icon: <SuccessIcon /> },
  info: { color: 'blue', icon: <InfoFeedbackIcon /> },
  warning: { color: 'orange', icon: <WarningFeedbackIcon /> },
};

/**
 * Notice shown in a page, a panel or a form: a success (green), an information (blue) or a warning (orange), each with its
 * icon. Errors have ErrorAlert.
 * @param {{ kind: NoticeKind } & Omit<AlertProps, 'color' | 'icon'>} props Component props: the kind, then the alert props (title, content, spacing).
 * @returns {JSX.Element} Alert.
 */
export function NoticeAlert({ kind, ...props }: { kind: NoticeKind } & Omit<AlertProps, 'color' | 'icon'>) {
  return <Alert color={KINDS[kind].color} icon={KINDS[kind].icon} {...props} />;
}
