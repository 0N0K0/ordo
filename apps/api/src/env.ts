import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  /** Public URL of the front, used to build links sent by email. */
  APP_URL: z.url(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_SECURE: z.stringbool().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().min(1),
  /** Key encrypting the passwords of the mail accounts: 32 random bytes in base64 (openssl rand -base64 32). */
  MAIL_ENCRYPTION_KEY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z
      .string()
      .refine((value) => Buffer.from(value, 'base64').length === 32, 'Doit faire 32 octets encodés en base64.')
      .optional(),
  ),
  /** GitHub GraphQL endpoint (tests point it to a fake server). */
  GITHUB_GRAPHQL_URL: z.url().default('https://api.github.com/graphql'),
  /** Photon geocoder (OpenStreetMap addresses and places), without trailing slash. */
  PHOTON_URL: z.url().default('https://photon.komoot.io'),
  /** OSRM routing servers, one per mode (`{profile}`: car, bike or foot), without trailing slash. */
  ROUTING_URL: z.string().default('https://routing.openstreetmap.de/routed-{profile}'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
