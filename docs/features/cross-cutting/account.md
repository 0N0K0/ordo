# Mon compte

Page de réglage du compte de l’utilisateur connecté : identifiant, adresse email, mot de passe. Code web : `apps/web/src/features/account/pages/AccountPage.tsx` (voir [Mon compte, code web](../../web/features/cross-cutting/account.md)) ; les appels passent par `features/auth/api` ([Connexion](auth.md)). Règles : [Espaces et accès](../../business-rules/cross-cutting/workspaces-and-access.md).

## Page

Route `/account` (« Mon compte »), dans l’application (connexion requise). Le compte est commun à tous les espaces.

Rien ne s’affiche tant que l’utilisateur n’est pas chargé.

## Section « Identifiant »

« Utilisable à la place de l’adresse email pour se connecter. »

| Champ                   | Détail                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| « Identifiant »         | requis ; aide « 3 à 32 caractères : lettres, chiffres, « . », « _ » et « - ». » ; mis en minuscules |
| « Mot de passe actuel » | requis                                                                                              |

Bouton « Modifier l’identifiant ». Toast « Identifiant modifié. ». Erreurs : « Mot de passe actuel incorrect. », « Cet identifiant est déjà utilisé. ».

## Section « Adresse email »

« Sert à la connexion et à la réinitialisation du mot de passe. La nouvelle adresse doit être confirmée. »

- « Adresse actuelle : » suivie de l’adresse.
- Changement en attente : encadré « Confirmation en attente » — « Un lien a été envoyé à <nouvelle adresse>. L’adresse sera remplacée une fois le lien ouvert. », bouton « Annuler le changement » (toast « Changement d’adresse annulé. »).
- Formulaire : « Nouvelle adresse email » (requise, format email, 254 caractères) et « Mot de passe actuel », bouton « Changer d’adresse ». Toast « Un lien de confirmation a été envoyé à la nouvelle adresse. ».
- Erreurs : « C'est déjà votre adresse actuelle. », « Cette adresse est déjà utilisée. », « Mot de passe actuel incorrect. ».
- Le lien reçu (valable 24 heures) ouvre la page de confirmation : voir [Connexion](auth.md).

## Section « Mot de passe »

« Les autres sessions ouvertes seront fermées. »

| Champ                    | Détail                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| « Mot de passe actuel »  | requis                                                                                                                                                 |
| « Nouveau mot de passe » | 12 à 128 caractères, avec la jauge de robustesse (voir [Connexion](auth.md#robustesse-du-mot-de-passe)) ; l’identifiant et l’email sont pris en compte |
| « Confirmation »         | doit être identique : « Les mots de passe ne correspondent pas. »                                                                                      |

Bouton « Modifier le mot de passe ». Toast « Mot de passe modifié. Vos autres sessions ont été fermées. ».

Le contrôle du mot de passe actuel (dans les trois formulaires) est limité à 5 essais par 15 minutes : au-delà, « Trop de tentatives. Réessayez dans N min. ».
