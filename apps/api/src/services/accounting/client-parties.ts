import { clientContactSchema, clientDetailsSchema, clientServiceSchema, type ClientContactInput, type ClientDetailsInput, type ClientServiceInput } from '@ordo/shared';
import { prisma } from '../../db';
import { nextPositionIn } from '../core/ordering';
import { Prisma, type Client, type ClientContact, type ClientService } from '../../generated/prisma/client';
import { clientError, orNotFound, parseInput } from '../../graphql/errors';
import { assertExists } from '../core/lookup';

/**
 * Updates the billing details of a client (kind, address, identifiers, contact information).
 * @param {string} id Client id.
 * @param {ClientDetailsInput} input Details.
 * @returns {Promise<Client>} Client.
 */
export async function updateClientDetails(id: string, input: ClientDetailsInput): Promise<Client> {
  await assertExists(prisma.client, id, 'Client');
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
 * Checks that a service belongs to a client.
 * @param {string | null} serviceId Service.
 * @param {string} clientId Client.
 * @returns {Promise<void>}
 */
async function assertService(serviceId: string | null, clientId: string): Promise<void> {
  if (!serviceId) return;
  const service = await prisma.clientService.findUnique({ where: { id: serviceId }, select: { clientId: true } });
  if (!service || service.clientId !== clientId) throw clientError('BAD_USER_INPUT', 'Ce service n’appartient pas au client.');
}

/**
 * Adds a service to a client.
 * @param {string} clientId Client.
 * @param {ClientServiceInput} input Service.
 * @returns {Promise<ClientService>} Service.
 */
export async function createClientService(clientId: string, input: ClientServiceInput): Promise<ClientService> {
  await assertExists(prisma.client, clientId, 'Client');
  const data = parseInput(clientServiceSchema, input);
  const position = await nextPositionIn('clientService', { clientId });
  return prisma.clientService.create({
    data: { ...data, address: data.address ?? Prisma.DbNull, clientId, position },
  });
}

/**
 * Updates a service.
 * @param {string} id Service id.
 * @param {ClientServiceInput} input Service.
 * @returns {Promise<ClientService>} Service.
 */
export async function updateClientService(id: string, input: ClientServiceInput): Promise<ClientService> {
  await assertExists(prisma.clientService, id, 'Service');
  const data = parseInput(clientServiceSchema, input);
  return prisma.clientService.update({ where: { id }, data: { ...data, address: data.address ?? Prisma.DbNull } });
}

/**
 * Deletes a service (its contacts stay, attached to the client).
 * @param {string} id Service id.
 * @returns {Promise<void>}
 */
export async function deleteClientService(id: string): Promise<void> {
  await assertExists(prisma.clientService, id, 'Service');
  await prisma.clientService.delete({ where: { id } });
}

/**
 * Adds a contact to a client (possibly in one of its services).
 * @param {string} clientId Client.
 * @param {ClientContactInput} input Contact.
 * @returns {Promise<ClientContact>} Contact.
 */
export async function createClientContact(clientId: string, input: ClientContactInput): Promise<ClientContact> {
  await assertExists(prisma.client, clientId, 'Client');
  const data = parseInput(clientContactSchema, input);
  await assertService(data.serviceId, clientId);
  return prisma.clientContact.create({ data: { ...data, clientId } });
}

/**
 * Updates a contact.
 * @param {string} id Contact id.
 * @param {ClientContactInput} input Contact.
 * @returns {Promise<ClientContact>} Contact.
 */
export async function updateClientContact(id: string, input: ClientContactInput): Promise<ClientContact> {
  const contact = await orNotFound(prisma.clientContact.findUnique({ where: { id } }), 'Contact');
  const data = parseInput(clientContactSchema, input);
  await assertService(data.serviceId, contact.clientId);
  return prisma.clientContact.update({ where: { id }, data });
}

/**
 * Deletes a contact.
 * @param {string} id Contact id.
 * @returns {Promise<void>}
 */
export async function deleteClientContact(id: string): Promise<void> {
  await assertExists(prisma.clientContact, id, 'Contact');
  await prisma.clientContact.delete({ where: { id } });
}
