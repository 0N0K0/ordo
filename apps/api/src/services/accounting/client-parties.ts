import { clientContactSchema, clientDetailsSchema, clientServiceSchema, type ClientContactInput, type ClientDetailsInput, type ClientServiceInput } from '@ordo/shared';
import { prisma } from '../../db';
import { nextPositionIn } from '../core/ordering';
import { Prisma, type Client, type ClientContact, type ClientService } from '../../generated/prisma/client';
import { fieldError, parseInput } from '../../graphql/errors';
import { deleteOrNotFound, findOrNotFound } from '../core/lookup';
import { assertActive, assertNotArchived, findActive } from '../core/archive';

/**
 * Updates the billing details of a client (not an archived one; kind, address, identifiers, contact information).
 * @param {string} id Client id.
 * @param {ClientDetailsInput} input Details.
 * @returns {Promise<Client>} Client.
 */
export async function updateClientDetails(id: string, input: ClientDetailsInput): Promise<Client> {
  await assertActive(prisma.client, id, 'Client');
  const data = parseInput(clientDetailsSchema, input);
  const individual = data.kind === 'INDIVIDUAL';
  return prisma.client.update({
    where: { id },
    data: {
      ...data,
      address: data.address ?? Prisma.DbNull,
      // An individual has no company identifiers.
      ...(individual ? { vatNumber: null, siren: null, siret: null, activityCode: null } : { firstName: null, lastName: null }),
    },
  });
}

/**
 * Checks that a service belongs to a client (BAD_USER_INPUT under `serviceId`). Nothing is checked when no service is given.
 * @param {string | null} serviceId Service.
 * @param {string} clientId Client.
 * @returns {Promise<void>}
 */
export async function assertService(serviceId: string | null, clientId: string): Promise<void> {
  if (!serviceId) return;
  const service = await prisma.clientService.findUnique({ where: { id: serviceId }, select: { clientId: true } });
  // eslint-disable-next-line no-restricted-syntax -- assertService itself.
  if (service?.clientId !== clientId) throw fieldError('serviceId', 'Ce service n’appartient pas au client.');
}

/**
 * Adds a service to a client (not an archived one).
 * @param {string} clientId Client.
 * @param {ClientServiceInput} input Service.
 * @returns {Promise<ClientService>} Service.
 */
export async function createClientService(clientId: string, input: ClientServiceInput): Promise<ClientService> {
  await assertActive(prisma.client, clientId, 'Client');
  const data = parseInput(clientServiceSchema, input);
  const position = await nextPositionIn('clientService', { clientId });
  return prisma.clientService.create({
    data: { ...data, address: data.address ?? Prisma.DbNull, clientId, position },
  });
}

/**
 * Updates a service (not one of an archived client).
 * @param {string} id Service id.
 * @param {ClientServiceInput} input Service.
 * @returns {Promise<ClientService>} Service.
 */
export async function updateClientService(id: string, input: ClientServiceInput): Promise<ClientService> {
  const service = await findOrNotFound(prisma.clientService, id, 'Service');
  await assertNotArchived('client', service.clientId);
  const data = parseInput(clientServiceSchema, input);
  return prisma.clientService.update({ where: { id }, data: { ...data, address: data.address ?? Prisma.DbNull } });
}

/**
 * Deletes a service (not one of an archived client; its contacts stay, attached to the client).
 * @param {string} id Service id.
 * @returns {Promise<void>}
 */
export async function deleteClientService(id: string): Promise<void> {
  await assertNotArchived('client', (await findOrNotFound(prisma.clientService, id, 'Service')).clientId);
  await deleteOrNotFound(prisma.clientService, id, 'Service');
}

/**
 * Adds a contact to a client (not an archived one; possibly in one of its services).
 * @param {string} clientId Client.
 * @param {ClientContactInput} input Contact.
 * @returns {Promise<ClientContact>} Contact.
 */
export async function createClientContact(clientId: string, input: ClientContactInput): Promise<ClientContact> {
  await assertActive(prisma.client, clientId, 'Client');
  const data = parseInput(clientContactSchema, input);
  await assertService(data.serviceId, clientId);
  return prisma.clientContact.create({ data: { ...data, clientId } });
}

/**
 * Updates a contact (not an archived one, nor one of an archived client).
 * @param {string} id Contact id.
 * @param {ClientContactInput} input Contact.
 * @returns {Promise<ClientContact>} Contact.
 */
export async function updateClientContact(id: string, input: ClientContactInput): Promise<ClientContact> {
  const contact = await findActive(prisma.clientContact, id, 'Contact');
  await assertNotArchived('client', contact.clientId);
  const data = parseInput(clientContactSchema, input);
  await assertService(data.serviceId, contact.clientId);
  return prisma.clientContact.update({ where: { id }, data });
}

/**
 * Deletes a contact, even an archived one, but not one of an archived client.
 * @param {string} id Contact id.
 * @returns {Promise<void>}
 */
export async function deleteClientContact(id: string): Promise<void> {
  await assertNotArchived('client', (await findOrNotFound(prisma.clientContact, id, 'Contact')).clientId);
  await deleteOrNotFound(prisma.clientContact, id, 'Contact');
}
