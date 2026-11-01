# ordo

Monorepo npm workspaces :

```text
ordo/
├── apps/
│   ├── api/       # API Node + Express + Prisma (PostgreSQL)
│   └── web/       # Front React + Vite + Mantine + TanStack Table
└── packages/
    └── shared/    # Types et schémas zod partagés front/back
```

## Prérequis

- Node 22+ (voir `.nvmrc` — `nvm use`)
- Docker + Docker Compose (base PostgreSQL)

## Installation

Toutes les commandes se lancent depuis la racine du repo.

```bash
# 1. Dépendances (tous les workspaces)
npm install

# 2. Variables d'environnement de l'API
cp apps/api/.env.example apps/api/.env
```

Renseigner `apps/api/.env` :

| Variable         | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`   | URL PostgreSQL (la valeur par défaut correspond au `docker-compose.yml`) |
| `SESSION_SECRET` | Secret de signature des sessions — `openssl rand -base64 48`             |
| `ADMIN_EMAIL`    | Email de l'utilisateur unique                                            |
| `ADMIN_PASSWORD` | Mot de passe de l'utilisateur unique                                     |
| `PORT`           | Port de l'API (défaut `3000`)                                            |

```bash
# 3. Base de données
npm run db:up

# 4. Client Prisma, migrations et utilisateur
cd apps/api
npx prisma generate
npx prisma migrate dev
npx prisma db seed
cd ../..
```

Le seed crée (ou met à jour) l'utilisateur à partir de `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Le relancer après un changement de mot de passe.

## Lancement

```bash
npm run dev
```

- Front : <http://localhost:5173>
- API : <http://localhost:3000> — appelée par le front via le proxy Vite `/api`

## Scripts

| Commande            | Effet                                           |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Lance l'API et le front en parallèle (watch)    |
| `npm run build`     | Build de tous les workspaces                    |
| `npm run typecheck` | Vérification TypeScript de tous les workspaces  |
| `npm run lint`      | Lint de tous les workspaces                     |
| `npm run db:up`     | Démarre PostgreSQL                              |
| `npm run db:down`   | Arrête PostgreSQL (les données sont conservées) |

## Ajouter une dépendance

Toujours depuis la racine, en ciblant le workspace :

```bash
npm i <paquet> -w apps/web
npm i -D <paquet> -w apps/api
```
