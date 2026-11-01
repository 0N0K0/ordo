import type { Request, Response } from 'express';

export interface ServerContext {
  req: Request;
  res: Response;
}

export type Context = ServerContext;

/**
 * Builds the GraphQL context for each request.
 * @param {ServerContext} serverContext Express request and response provided by Yoga.
 * @returns {Context} Request context.
 */
export function createContext({ req, res }: ServerContext): Context {
  return { req, res };
}
