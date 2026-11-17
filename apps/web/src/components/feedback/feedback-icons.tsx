import { CheckCircleIcon, InfoIcon, WarningCircleIcon } from '@phosphor-icons/react';

// One icon per feedback type, shared by alerts and toasts.

/**
 * Success feedback icon.
 * @returns {JSX.Element} Icon.
 */
export function SuccessIcon() {
  return <CheckCircleIcon aria-hidden />;
}

/**
 * Error feedback icon.
 * @returns {JSX.Element} Icon.
 */
export function ErrorIcon() {
  return <WarningCircleIcon aria-hidden />;
}

/**
 * Information feedback icon.
 * @returns {JSX.Element} Icon.
 */
export function InfoFeedbackIcon() {
  return <InfoIcon aria-hidden />;
}
