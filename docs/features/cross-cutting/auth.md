# Connexion et mot de passe

Pages hors de l’application : connexion, mot de passe oublié, nouveau mot de passe, confirmation d’une nouvelle adresse email ; et les gardes qui protègent les pages. Code web : `apps/web/src/features/auth/` (voir [Connexion, code web](../../web/features/cross-cutting/auth.md)) ; API : `apps/api/src/services/core/auth.ts`, `apps/api/src/graphql/modules/auth.ts` ; règles : [Espaces et accès](../../business-rules/cross-cutting/workspaces-and-access.md).

## Mise en page

Les pages de connexion sont une carte centrée titrée « Ordo ».

## Accès aux pages

- Toutes les pages de l’application exigent une session : sans session, retour à « Connexion » (`/login`), en mémorisant la page demandée.
- « Connexion » et « Mot de passe oublié » ne sont accessibles que déconnecté : une fois connecté, retour à la page demandée avant la connexion, sinon à l’accueil.
- « Nouveau mot de passe » et « Confirmation de l’adresse email » sont accessibles connecté ou non (elles viennent de liens reçus par email, éventuellement sur un autre appareil).
- Pendant la vérification de la session : « Chargement » en plein écran.
- La déconnexion vide toutes les données en cache, puis renvoie à la connexion.

## « Connexion » (`/login`)

| Champ                            | Détail                                         |
| -------------------------------- | ---------------------------------------------- |
| « Identifiant ou adresse email » | requis (« Champ requis. ») ; mis en minuscules |
| « Mot de passe »                 | requis                                         |

Lien « Mot de passe oublié ? », bouton « Se connecter ». Erreur : « Identifiant ou mot de passe incorrect. ». Essais limités à 5 par 15 minutes (par adresse IP et par identifiant) : au-delà, « Trop de tentatives. Réessayez dans N min. ».

## « Mot de passe oublié » (`/forgot-password`)

« Saisissez votre identifiant ou votre adresse email : vous recevrez un lien pour choisir un nouveau mot de passe. »

- Champ « Identifiant ou adresse email », bouton « Envoyer le lien ».
- Demandes limitées à 3 par heure et par adresse IP (« Trop de tentatives. Réessayez dans N min. »).
- Après envoi, toujours le même message, que le compte existe ou non : « Demande envoyée » — « Si un compte correspond, un email contenant un lien valable 30 minutes vient d’être envoyé. ».
- Lien « Retour à la connexion ».

## « Nouveau mot de passe » (`/reset-password?token=…`)

- Champs « Nouveau mot de passe » (avec la jauge) et « Confirmation », bouton « Enregistrer ».
- Succès : toast « Mot de passe modifié. Vous pouvez vous connecter. », retour à la connexion ; toutes les sessions sont fermées.
- Sans jeton dans l’adresse : « Lien invalide » — « Ce lien de réinitialisation est incomplet. Demandez-en un nouveau. ». Jeton expiré ou déjà utilisé : « Ce lien est invalide ou a expiré. ».
- Lien « Demander un nouveau lien ».

## « Confirmation de l’adresse email » (`/confirm-email?token=…`)

- Le jeton est envoyé une seule fois à l’ouverture ; pendant la vérification, un indicateur « Confirmation en cours ».
- Succès : « Adresse confirmée » — « Votre nouvelle adresse email est enregistrée. ».
- Échec ou jeton absent : « Lien invalide » — le message de l’erreur (ou « Ce lien de confirmation est incomplet. ») suivi de « Relancez le changement d’adresse depuis votre compte. ».
- Lien « Aller à mon compte ».

## Règles de mot de passe

- 12 à 128 caractères : « Au moins 12 caractères. », « 128 caractères maximum. ».
- Robustesse minimale (score zxcvbn de 3 sur 4) contrôlée par l’API.
- La confirmation doit être identique : « Les mots de passe ne correspondent pas. ».

### Robustesse du mot de passe

Sous chaque nouveau mot de passe, une jauge et un libellé : « Très faible », « Faible », « Moyen », « Fort », « Très fort », avec un conseil :

- trop court : « Encore N caractères au minimum. » (le score est alors plafonné à « Faible ») ;
- trop faible : la première suggestion de zxcvbn, sinon « Ajoutez des mots ou des caractères peu courants. ».

L’analyseur (environ 1,3 Mo) est chargé à la demande ; en attendant : « Analyse de la robustesse… ». Sur « Mon compte », l’identifiant et l’adresse email sont refusés comme base du mot de passe.

Voir aussi [Mon compte](account.md).
