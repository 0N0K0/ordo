import { openFormPanel } from '../../../components/panels/panels';
import { ContactPanel } from '../components/ClientPartyForms';

/**
 * Opens the panel of a contact of a client (from the client page, or from the contributor linked to it): its details,
 * read only while it or its client is archived.
 * @param {string} clientId Client of the contact.
 * @param {string} contactId Contact.
 * @param {boolean} readOnly It or its client is archived (the title of the panel).
 * @returns {void}
 */
export function openContactForm(clientId: string, contactId: string, readOnly: boolean): void {
  openFormPanel(readOnly ? 'Contact' : 'Modifier le contact', (close) => <ContactPanel clientId={clientId} contactId={contactId} onDone={close} />);
}
