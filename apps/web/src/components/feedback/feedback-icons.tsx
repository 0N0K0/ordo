import { CheckCircleIcon, InfoIcon, WarningCircleIcon, WarningIcon } from '@phosphor-icons/react';

// One icon per feedback type, shared by alerts and toasts (their colours: feedback-colors).

/**
 * Success feedback icon.
 * @returns {JSX.Element} Icon.
 */
export function SuccessFeedbackIcon() {
  return <CheckCircleIcon aria-hidden />;
}

/**
 * Error feedback icon.
 * @returns {JSX.Element} Icon.
 */
export function ErrorFeedbackIcon() {
  return <WarningCircleIcon aria-hidden />;
}

/**
 * Information feedback icon.
 * @returns {JSX.Element} Icon.
 */
export function InfoFeedbackIcon() {
  return <InfoIcon aria-hidden />;
}

/**
 * Warning feedback icon.
 * @returns {JSX.Element} Icon.
 */
export function WarningFeedbackIcon() {
  return <WarningIcon aria-hidden />;
}
