# ordo

Monorepo npm workspaces :

```text
ordo/
├── apps/
│   ├── api/       # API GraphQL : Express + Yoga + Pothos + Prisma (PostgreSQL)
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

| Variable       | Description                                                              |
| -------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL` | URL PostgreSQL (la valeur par défaut correspond au `docker-compose.yml`) |
| `PORT`         | Port de l'API (défaut `3000`)                                            |
| `APP_URL`      | URL publique du front, utilisée dans les liens envoyés par email         |
| `SMTP_*`       | Serveur SMTP (en dev : Mailpit, valeurs par défaut de `.env.example`)    |
| `MAIL_FROM`    | Expéditeur des emails                                                    |
| `MAIL_ENCRYPTION_KEY` | Chiffre les mots de passe des boîtes mail : `openssl rand -base64 32` (requise pour configurer une boîte) |

```bash
# 3. Base de données et serveur mail de dev
npm run db:up

# 4. Client Prisma et migrations
cd apps/api
npx prisma generate
npx prisma migrate dev
cd ../..

# 5. Création du compte (identifiant, email, mot de passe saisis dans le terminal)
npm run user:create
```

`user:create` crée le compte administrateur, une seule fois : il reçoit les espaces existants, et c'est le seul à avoir des espaces professionnels. Les autres comptes se créent depuis **Paramètres › Comptes** : la personne reçoit par email un lien pour choisir son mot de passe, et n'a que des espaces personnels, que les autres ne voient pas. Identifiant, email et mot de passe se modifient ensuite depuis la page **Mon compte**, et un mot de passe oublié se réinitialise depuis l'écran de connexion.

## Lancement

```bash
npm run dev
```

- Front : <http://localhost:5173>
- API GraphQL : <http://localhost:3000/api/graphql> — GraphiQL en dev, appelée par le front via le proxy Vite `/api`
- Emails de dev (Mailpit) : <http://localhost:8025>

## Données de démonstration

```bash
npm run db:seed
```

Charge des fixtures : clients, projets et sous-projets, contributeurs, jalons, tâches avec sous-tâches, dépendances et commentaires, temps passés (chronos terminés des six dernières semaines, liés à 0 à 3 tâches), catégories d’agenda hiérarchiques et évènements autour de la semaine en cours (ponctuels, sur plusieurs jours, récurrents avec pause, occurrence déplacée et occurrence annulée). Les données sont générées par des factories ([fishery](https://github.com/thoughtbot/fishery) + [Faker](https://fakerjs.dev), en français) dans `apps/api/prisma/fixtures/factories.ts`. Le scénario de chargement est dans `apps/api/prisma/seed.ts`.

- **Purge** : après confirmation, la commande supprime les clients, projets, tâches, libellés, contributeurs, temps et évènements d’agenda avant de charger les fixtures. Le compte et son profil « Moi » sont conservés : créez le compte avant, pour avoir des tâches qui vous sont assignées.
- **Documents comptables** : la commande refuse de s’exécuter dès qu’un document comptable définitif existe (ce sont des pièces à conserver).
- **Alarmes** : il n'y a pas de fixtures d'alarmes. Les alarmes existantes sont conservées, mais perdent leur lien vers un projet ou une tâche, puisque ceux-ci sont supprimés.
- **Reproductible** : les mêmes données sont générées à chaque lancement.
- **Sans confirmation** : `npm run db:seed -- --force`.
- **Pas en production** : la commande refuse de s'exécuter quand `NODE_ENV=production`.
- **Après une remise à zéro** : `npx prisma migrate reset` (dans `apps/api`) recharge aussi les fixtures.

## GraphQL

Le schéma est écrit en TypeScript avec Pothos (`apps/api/src/graphql`). Après une modification du schéma ou des requêtes du front :

```bash
npm run codegen
```

Cette commande régénère `apps/api/schema.graphql` puis les types du front (`apps/web/src/graphql`).

## Déploiement

Staging (`main`) et production (`prod`) sur o2switch, déployés par GitHub Actions : installation d'un environnement, secrets et variables GitHub, dépannage dans [docs/deployment.md](docs/deployment.md).

## Scripts

| Commande              | Effet                                            |
| --------------------- | ------------------------------------------------ |
| `npm run dev`         | Lance l'API et le front en parallèle (watch)     |
| `npm run build`       | Build de tous les workspaces                     |
| `npm run typecheck`   | Vérification TypeScript de tous les workspaces   |
| `npm run lint`        | Lint de tous les workspaces                      |
| `npm run db:up`       | Démarre PostgreSQL et Mailpit                    |
| `npm run db:down`     | Arrête PostgreSQL (les données sont conservées)  |
| `npm run codegen`     | Régénère le schéma GraphQL et les types du front |
| `npm run user:create` | Crée le compte administrateur                    |
| `npm run db:seed`     | Remplace les données par des fixtures            |

## Ajouter une dépendance

Toujours depuis la racine, en ciblant le workspace :

```bash
npm i <paquet> -w apps/web
npm i -D <paquet> -w apps/api
```
