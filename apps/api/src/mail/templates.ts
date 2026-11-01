import type { Mail } from './mailer';

const SIGNATURE = '\n\n— Ordo';

/**
 * Password reset link email.
 * @param {string} to Recipient address.
 * @param {string} url Reset link.
 * @param {number} ttlMinutes Link validity in minutes.
 * @returns {Mail} Email to send.
 */
export function passwordResetMail(to: string, url: string, ttlMinutes: number): Mail {
  return {
    to,
    subject: 'Réinitialisation de votre mot de passe',
    text:
      `Une réinitialisation du mot de passe a été demandée pour votre compte.\n\n` +
      `Pour choisir un nouveau mot de passe, ouvrez ce lien (valable ${ttlMinutes} minutes) :\n${url}\n\n` +
      `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.` +
      SIGNATURE,
  };
}

/**
 * Email change confirmation, sent to the new address.
 * @param {string} to New address.
 * @param {string} url Confirmation link.
 * @param {number} ttlHours Link validity in hours.
 * @returns {Mail} Email to send.
 */
export function emailChangeMail(to: string, url: string, ttlHours: number): Mail {
  return {
    to,
    subject: 'Confirmez votre nouvelle adresse email',
    text:
      `Pour utiliser cette adresse sur votre compte Ordo, ouvrez ce lien (valable ${ttlHours} heures) :\n${url}\n\n` +
      `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.` +
      SIGNATURE,
  };
}

/**
 * Notice sent to the previous address once the email has changed.
 * @param {string} to Previous address.
 * @param {string} newEmail New address.
 * @returns {Mail} Email to send.
 */
export function emailChangedNoticeMail(to: string, newEmail: string): Mail {
  return {
    to,
    subject: 'Votre adresse email a été modifiée',
    text:
      `L'adresse email de votre compte Ordo est désormais ${newEmail}.\n\n` +
      `Si vous n'êtes pas à l'origine de ce changement, réinitialisez votre mot de passe sans attendre.` +
      SIGNATURE,
  };
}

/**
 * Notice sent after a password change or reset.
 * @param {string} to Account address.
 * @returns {Mail} Email to send.
 */
export function passwordChangedNoticeMail(to: string): Mail {
  return {
    to,
    subject: 'Votre mot de passe a été modifié',
    text:
      `Le mot de passe de votre compte Ordo vient d'être modifié. Toutes les sessions ouvertes ont été fermées.\n\n` +
      `Si vous n'êtes pas à l'origine de ce changement, réinitialisez votre mot de passe sans attendre.` +
      SIGNATURE,
  };
}
