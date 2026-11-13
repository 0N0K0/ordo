# Déploiement (o2switch)

Ordo tourne sur un hébergement mutualisé o2switch (cPanel + Phusion Passenger). Une seule app Node par environnement sert l'API (`/api/*`) et le front (`apps/web/dist`, toutes les autres routes).

| Branche | Environnement GitHub |
| ------- | -------------------- |
| `main`  | `staging`            |
| `prod`  | `production`         |

Chaque environnement a son propre dossier, sa propre app Node, sa propre base et son propre `.env`. Ils ne partagent rien.

Flux : PR vers `main` → CI → merge → déploiement staging. PR `main` → `prod` → CI → merge → déploiement production (avec sauvegarde de la base).

## Contraintes de l'hébergement

- **PostgreSQL 9.6** : les migrations ne doivent utiliser aucune fonctionnalité de PostgreSQL 10+ (`gen_random_uuid()`, `EXECUTE FUNCTION` dans les triggers, colonnes `GENERATED`/`IDENTITY`, index `INCLUDE`, procédures, `NULLS NOT DISTINCT`, `jsonb_path_*`…). La CI applique les migrations sur un PostgreSQL 9.6 et bloque sinon.
- **glibc ancienne** : une dépendance avec module natif doit fournir un binaire compatible (d'où `@node-rs/argon2` plutôt que `argon2`).
- **npm de cPanel inutilisable** : le `npm` de l'environnement Node de cPanel (`~/nodevenv/…`) installe dans son propre dossier et ignore les workspaces. On utilise le vrai npm : `/opt/alt/alt-nodejs24/root/usr/bin`. Ne jamais cliquer sur « Run NPM Install » dans cPanel.
- **npm 11.19+** bloque les scripts d'installation des dépendances non listées dans `allowScripts` (`package.json` racine). Une nouvelle dépendance qui en a besoin doit y être ajoutée.
- **Mise en veille** : Passenger endort l'app sans visite ; les tâches de fond (envois programmés, relances, factures récurrentes, synchro GitHub) s'arrêtent alors. Voir [Garder l'app éveillée](#garder-lapp-éveillée).

## 1. Préparer cPanel (par environnement)

1. **Sous-domaine** et son **certificat SSL** (Let's Encrypt / AutoSSL). La **racine du document** du sous-domaine doit pointer vers `<dossier>/apps/web/dist` (le build du front) : Apache y sert directement les fichiers statiques, le reste passe à l'app Node. cPanel écrit dans ce dossier le `.htaccess` qui active Passenger ; le build de Vite vidant `dist`, `scripts/deploy.sh` le sauvegarde et le remet après chaque build.
2. **Base PostgreSQL** + utilisateur associé avec tous les privilèges (« Bases de données PostgreSQL »).
3. **Adresse mail** dédiée aux envois (« Comptes de messagerie »), par ex. `ordo@onoko.dev`.
4. **Accès SSH** : ajouter ta clé et autoriser ton IP (pare-feu SSH o2switch).

## 2. Installation initiale sur le serveur (par environnement)

À faire une fois, à la main, en SSH. Les déploiements suivants sont automatiques.

### 2.1 Récupérer le code

Le dossier doit être un clone git sur la branche de l'environnement (`main` pour le staging, `prod` pour la production). Remplacer `<dossier>` et `<branche>`.

Si le dossier n'existe pas encore :

```bash
git clone -b <branche> <url-du-repo> ~/<dossier>
```

Si cPanel l'a déjà créé (avec `.htaccess`, `public/`…), `git clone` refuse un dossier non vide ; cloner en place :

```bash
cd ~/<dossier>
git init -b <branche>
git remote add origin <url-du-repo>
git fetch origin <branche>
git checkout -f -b <branche> --track origin/<branche>
```

Si le dépôt est privé, ajouter une deploy key GitHub (lecture seule) pour le serveur.

### 2.2 Créer l'app Node (cPanel → « Setup Node.js App » → « Create »)

| Champ                    | Valeur                   |
| ------------------------ | ------------------------ |
| Node.js version          | 24                       |
| Application mode         | Production               |
| Application root         | `<dossier>`              |
| Application URL          | le sous-domaine          |
| Application startup file | `apps/api/passenger.cjs` |

cPanel ajoute `.htaccess`, `tmp/` et `public/` : les laisser (non suivis par git). Si cPanel a modifié `package.json` ou `package-lock.json`, les restaurer : `git checkout -- package.json package-lock.json`.

### 2.3 Utiliser le vrai npm

```bash
cd ~/<dossier>
rm node_modules                                   # lien créé par cPanel (sans slash final)
export PATH=/opt/alt/alt-nodejs24/root/usr/bin:$PATH
which npm                                         # doit afficher /opt/alt/…
```

L'`export` ne vaut que pour la session SSH en cours.

### 2.4 Le `.env`

```bash
nano apps/api/.env
ln -s apps/api/.env .env        # OBLIGATOIRE : l'API lit le .env de la racine, Prisma celui de apps/api
ls -la .env                     # .env -> apps/api/.env
```

```dotenv
NODE_ENV="production"
DATABASE_URL="postgresql://USER:PASS@localhost:5432/DBNAME"
APP_URL="https://<sous-domaine>"
SMTP_HOST="<serveur>.o2switch.net"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="ordo@onoko.dev"
SMTP_PASS="…"
MAIL_FROM="Ordo <ordo@onoko.dev>"
MAIL_ENCRYPTION_KEY="…"
```

- `MAIL_ENCRYPTION_KEY` : générer avec `openssl rand -base64 32`, **une clé différente par environnement**, à conserver en lieu sûr (sans elle, les mots de passe des boîtes mail enregistrées dans Ordo sont perdus).
- Encoder le mot de passe de la base pour une URL s'il contient `@`, `:` ou `/`.
- Variables optionnelles : `GITHUB_GRAPHQL_URL`, `PHOTON_URL`, `ROUTING_URL` (voir `apps/api/src/env.ts`).

### 2.5 Installer, builder, migrer

```bash
bash scripts/deploy.sh
```

Le script fait : `npm ci` (avec les dépendances de dev, nécessaires au build), `prisma generate`, build API + front, `prisma migrate deploy`, redémarrage. Vérifier que `npm ci` n'affiche aucun avertissement `install-scripts`.

### 2.6 Tester, créer le compte, démarrer

```bash
NODE_ENV=production PORT=3999 node apps/api/passenger.cjs   # "API ready…", puis Ctrl+C
npm run user:create
touch tmp/restart.txt
```

### 2.7 Vérifier

- La page de connexion s'affiche ; recharger une URL profonde (`/accounting`) fonctionne.
- Connexion au compte, cartes (tuiles OpenStreetMap), aperçus PDF, envoi d'un mail de test.
- Production : `which pg_dump` doit répondre (sauvegarde avant migration).

## 3. Configuration GitHub

### 3.1 Clé SSH de la CI

Une paire dédiée, jamais ta clé personnelle :

```bash
ssh-keygen -t ed25519 -C "github-actions-ordo" -f ~/.ssh/ordo_deploy -N ""
```

- `~/.ssh/ordo_deploy.pub` (clé publique) → cPanel « Accès SSH » → « Gérer les clés SSH » → « Importer une clé » (champ clé publique seulement), puis **« Autoriser »**.
- `~/.ssh/ordo_deploy` (clé privée) → secret `SSH_PRIVATE_KEY`, contenu complet du fichier, lignes `-----BEGIN OPENSSH PRIVATE KEY-----` et `-----END OPENSSH PRIVATE KEY-----` comprises.

Si cPanel refuse ed25519 : `ssh-keygen -t rsa -b 4096 …`. Test : `ssh -i ~/.ssh/ordo_deploy kono7602@<serveur>.o2switch.net 'echo ok'`.

### 3.2 Jeton API cPanel

cPanel → « Gestion des jetons API » → créer un jeton. Le workflow s'en sert pour ajouter puis retirer l'IP du runner dans le pare-feu SSH (`SshWhitelist`).

### 3.3 Secrets du dépôt

Settings → Secrets and variables → Actions → **Repository secrets** (communs aux deux environnements) :

| Secret             | Valeur                   |
| ------------------ | ------------------------ |
| `CPANEL_HOST`      | `<serveur>.o2switch.net` |
| `CPANEL_USERNAME`  | `kono7602`               |
| `CPANEL_API_TOKEN` | le jeton du 3.2          |
| `SSH_PRIVATE_KEY`  | la clé privée du 3.1     |

### 3.4 Environnements et variables

Settings → Environments → créer **`staging`** et **`production`** (noms exacts). Dans chacun, **Environment variables** (pas des secrets : le workflow lit `vars.*`) :

| Variable  | `staging`                           | `production`                     |
| --------- | ----------------------------------- | -------------------------------- |
| `APP_DIR` | chemin absolu du dossier de staging | chemin absolu du dossier de prod |
| `APP_URL` | url du serveur de staging           | url du serveur de prod           |

`APP_DIR` : chemin absolu, obtenu avec `pwd` dans le dossier sur le serveur.

Recommandé pour `production` : **Required reviewers** (chaque déploiement attend ta validation) et **Deployment branches** limité à `prod`.

### 3.5 Protection des branches

Settings → Branches (ou Rulesets) pour `main` et `prod` : PR obligatoire, check **CI / Typecheck, lint, migrations, build** requis.

## 4. Workflows

### CI — `.github/workflows/ci.yml`

Sur chaque PR vers `main` ou `prod`, avec Node 24 et un service PostgreSQL 9.6 : `npm ci`, `prisma generate`, typecheck, lint, `migrate deploy` sur 9.6, `migrate diff --exit-code` (les migrations doivent mener exactement au schéma), build.

### Déploiement — `.github/workflows/deploy.yml`

Sur merge d'une PR dans `main` (staging) ou `prod` (production), ou à la main : Actions → Deploy → **Run workflow** → environnement.

1. Ajoute l'IP du runner au pare-feu SSH o2switch.
2. En SSH, dans `APP_DIR` : vérifie que le clone est sur la bonne branche, `git pull --ff-only`, puis `scripts/deploy.sh` (`BACKUP=1` en production ; `FIXTURES=1` pour un merge sur `main` qui modifie `apps/api/prisma/seed.ts` ou `apps/api/prisma/fixtures/`, comparés à ce que le serveur avait avant le pull).
3. Vérifie que `APP_URL` répond.
4. Retire l'IP du pare-feu, même en cas d'échec.

Un seul déploiement à la fois par environnement.

### Script serveur — `scripts/deploy.sh`

Ordre : vérification du lien `.env` → `npm ci` → `prisma generate` → build → sauvegarde (si `BACKUP=1`) → `migrate deploy` → redémarrage → fixtures (si `FIXTURES=1`). Le build passe avant les migrations : un build cassé ne touche pas la base.

**Fixtures (staging uniquement).** Avec `FIXTURES=1`, le script recharge les données de démo (`prisma db seed -- --force`) : le premier espace pro et le premier espace perso sont vidés puis remplis. Il refuse si la branche n'est pas `main` ou si `BACKUP=1` (production). Le `.env` de staging ayant `NODE_ENV=production`, le seed n'accepte de tourner que si `ALLOW_FIXTURES=staging`, que seul ce script pose. Sans GreenMail sur le serveur, la boîte mail de démo est sautée (avertissement). Un déploiement manuel (Run workflow) ne charge jamais les fixtures ; pour les recharger à la main : `FIXTURES=1 bash scripts/deploy.sh` sur le serveur de staging.

Déploiement manuel :

```bash
cd ~/<dossier>
git pull --ff-only origin <branche>
bash scripts/deploy.sh            # BACKUP=1 bash scripts/deploy.sh en production
```

## 5. Sauvegardes

En production, chaque déploiement sauvegarde la base dans `~/backups/<dossier>/AAAAMMJJ-HHMMSS.dump` (format `pg_dump -Fc`) ; les 10 dernières sont gardées. Programmer en plus une sauvegarde régulière dans cPanel.

Restaurer (**écrase la base** ; arrêter l'app avant) :

```bash
pg_restore -d "postgresql://USER:PASS@localhost:5432/DBNAME" --clean --if-exists --single-transaction ~/backups/<dossier>/<fichier>.dump
```

Pour vérifier une sauvegarde sans risque, la restaurer dans une base vide créée pour l'occasion.

## Garder l'app éveillée

cPanel → « Tâches Cron », pour la production :

```text
*/5 * * * * curl -fsS https://ordo.onoko.dev/ > /dev/null
```

## Dépannage

| Symptôme                                                          | Cause                                                                                        | Solution                                                                                                         |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm ci` : « audited 4 packages », `node_modules` vide            | npm de cPanel                                                                                | `export PATH=/opt/alt/alt-nodejs24/root/usr/bin:$PATH` (2.3)                                                     |
| `npm ci` : « package.json and package-lock.json … in sync »       | lockfile réécrit par le npm de cPanel                                                        | `git checkout -- package-lock.json package.json`                                                                 |
| `npm warn install-scripts …`                                      | npm 11.19+ bloque les scripts                                                                | ajouter le paquet à `allowScripts` (`package.json` racine)                                                       |
| npx propose d'installer `prisma@8…`                               | Prisma du projet non installé                                                                | répondre `n`, refaire `npm ci` ; utiliser `npx --no-install`                                                     |
| `GLIBC_2.xx not found`                                            | binaire natif trop récent pour le serveur                                                    | dépendance alternative avec binaire compatible                                                                   |
| `gen_random_uuid() n'existe pas` / erreur sur `EXECUTE FUNCTION`  | migration PostgreSQL 10+                                                                     | réécrire la migration pour 9.6 ; base à moitié migrée : la supprimer et la recréer dans cPanel                   |
| « Web application could not be started »                          | erreur au démarrage                                                                          | lancer `NODE_ENV=production PORT=3999 node apps/api/passenger.cjs` pour la voir ; logs : `stderr.log` du dossier |
| Le front s'affiche mais `/api` répond 404, ou la connexion échoue | `.htaccess` de Passenger absent de `apps/web/dist` (build lancé hors de `scripts/deploy.sh`) | cPanel « Setup Node.js App » → éditer l'app → « Save » pour le réécrire, puis `touch tmp/restart.txt`            |
| `Invalid environment variables`                                   | lien `.env` manquant à la racine                                                             | `ln -s apps/api/.env .env`                                                                                       |
| CI : « not a git repository »                                     | `APP_DIR` vide (créée en secret, mauvais environnement) ou dossier non cloné                 | 3.4 ; 2.1                                                                                                        |
| CI : « The server checkout is not on … »                          | clone sur la mauvaise branche                                                                | `git switch <branche>` dans le dossier                                                                           |
