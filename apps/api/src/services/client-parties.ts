import { clientContactSchema, clientDetailsSchema, clientServiceSchema, type ClientContactInput, type ClientDetailsInput, type ClientServiceInput } from '@ordo/shared';
import { prisma } from '../db';
import { Prisma, type Client, type ClientContact, type ClientService } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';

/**
 * Updates the billing details of a client (kind, address, identifiers, contact information).
 * @param {string} id Client id.
 * @param {ClientDetailsInput} input Details.
 * @returns {Promise<Client>} Client.
 */
export async function updateClientDetails(id: string, input: ClientDetailsInput): Promise<Client> {
  if (!(await prisma.client.findUnique({ where: { id } }))) throw notFound('Client');
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
  if (!(await prisma.client.findUnique({ where: { id: clientId } }))) throw notFound('Client');
  const data = parseInput(clientServiceSchema, input);
  const { _max } = await prisma.clientService.aggregate({ where: { clientId }, _max: { position: true } });
  return prisma.clientService.create({
    data: { ...data, address: data.address ?? Prisma.DbNull, clientId, position: (_max.position ?? -1) + 1 },
  });
}

/**
 * Updates a service.
 * @param {string} id Service id.
 * @param {ClientServiceInput} input Service.
 * @returns {Promise<ClientService>} Service.
 */
export async function updateClientService(id: string, input: ClientServiceInput): Promise<ClientService> {
  if (!(await prisma.clientService.findUnique({ where: { id } }))) throw notFound('Service');
  const data = parseInput(clientServiceSchema, input);
  return prisma.clientService.update({ where: { id }, data: { ...data, address: data.address ?? Prisma.DbNull } });
}

/**
 * Deletes a service (its contacts stay, attached to the client).
 * @param {string} id Service id.
 * @returns {Promise<void>}
 */
export async function deleteClientService(id: string): Promise<void> {
  if (!(await prisma.clientService.findUnique({ where: { id } }))) throw notFound('Service');
  await prisma.clientService.delete({ where: { id } });
}

/**
 * Adds a contact to a client (possibly in one of its services).
 * @param {string} clientId Client.
 * @param {ClientContactInput} input Contact.
 * @returns {Promise<ClientContact>} Contact.
 */
export async function createClientContact(clientId: string, input: ClientContactInput): Promise<ClientContact> {
  if (!(await prisma.client.findUnique({ where: { id: clientId } }))) throw notFound('Client');
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
  const contact = await prisma.clientContact.findUnique({ where: { id } });
  if (!contact) throw notFound('Contact');
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
  if (!(await prisma.clientContact.findUnique({ where: { id } }))) throw notFound('Contact');
  await prisma.clientContact.delete({ where: { id } });
}
