import nodemailer from 'nodemailer';
import { env } from '../env';

const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
});

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends a plain-text email.
 * @param {Mail} mail Recipient, subject and body.
 * @returns {Promise<void>} Resolves once the SMTP server accepted the message.
 */
export async function sendMail({ to, subject, text }: Mail): Promise<void> {
  await transport.sendMail({ from: env.MAIL_FROM, to, subject, text });
}
