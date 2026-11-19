/**
 * The one type cast from a GraphQL input to a service argument, for the shapes GraphQL cannot type as the service does
 * (stored JSON objects, string enums the service narrows, nullable fields the service wants optional). The service validates the value.
 * @param {unknown} value GraphQL input value.
 * @returns {never} The same value, accepted as the service argument.
 */
export function unchecked(value: unknown): never {
  // eslint-disable-next-line no-restricted-syntax -- the one cast.
  return value as never;
}
