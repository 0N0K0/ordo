# Mon compte

Page de réglage du compte de l’utilisateur connecté : identifiant, adresse email, mot de passe, sonnerie des alarmes. Code web : `apps/web/src/features/account/pages/AccountPage.tsx` (voir [Mon compte, code web](../../web/features/cross-cutting/account.md)) ; les appels passent par `features/auth/api` ([Connexion](auth.md)). Règles : [Espaces et accès](../../business-rules/cross-cutting/workspaces-and-access.md).

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

## Section « Sonnerie des alarmes »

« Alarmes et rappels de tous les espaces. Chaque rappel peut choisir sa propre sonnerie. » Réglages de l’utilisateur, valables dans tous les espaces, enregistrés champ par champ (les nombres en les quittant, le reste dès qu’il change ; « Enregistrement… » / « Enregistré » en haut, sans bouton). Règles : [Alarmes](../../business-rules/activities/alarms.md#réglages-userringsettings).

| Champ                    | Détail                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| « Durée de la sonnerie » | 1 à 30 min (défaut 1) : combien de temps une alarme sonne si on ne l’arrête pas            |
| « Répéter toutes les »   | 0 à 60 min (défaut 5) ; aide « Jusqu’à « Arrêter » ; 0 : pas de répétition. »               |
| « En boucle »            | interrupteur (défaut oui) ; aide « La sonnerie se répète pendant toute sa durée ; sinon elle sonne une fois. » |
| « Sonnerie »             | Carillon (défaut), Bip, Marimba, Cloche, Réveil, Harpe ; « Écouter » (au début du champ) la joue |
| « Sonner hors de l’app » | interrupteur (défaut non) : notifications push sur les appareils ajoutés, app fermée (ci-dessous) |

### Sonner hors de l’app

Aide : « Notifications push sur les appareils ajoutés, app fermée : le son et la vibration du système à chaque envoi, renvoyé à chaque répétition jusqu’à « Arrêter ». Désactiver retire cet appareil ; les autres restent listés mais ne reçoivent plus rien. »

- **Activer** : le navigateur demande l’autorisation des notifications, puis cet appareil est ajouté. Refus : « Les notifications sont refusées pour Ordo : autorisez-les dans les réglages du site de ce navigateur. » ; sans service worker (développement) : « Les notifications push demandent le service worker de l’app (l’app installée ou servie en production). » ; navigateur sans push : « Ce navigateur ne reçoit pas de notifications push. ». L’interrupteur ne s’active qu’une fois l’appareil ajouté.
- **Désactiver** : cet appareil est retiré ; le réglage étant celui de l’utilisateur, le serveur n’envoie plus rien à **aucun** appareil, les autres restent listés (ils reçoivent à nouveau dès que c’est réactivé).
- **Appareils** (réglage activé) : un par ligne, « Chrome · Android » (badge « Cet appareil »), « Ajouté le 20 nov. 2026 · dernier envoi le … » ou « aucun envoi encore » ; « Tester » (toast « Notification envoyée à « X ». », sinon « « X » n’a pas reçu la notification (un appareil expiré est retiré). ») et « Retirer » (confirmation « Retirer l’appareil » : « « X » ne recevra plus les sonneries hors de l’app. Il pourra être ajouté à nouveau depuis cet appareil. », toast « Appareil retiré. »). Aucun : « Aucun appareil ne reçoit les sonneries hors de l’app. ». Cet appareil absent de la liste : « Recevoir sur cet appareil ».
- Serveur sans clés VAPID : l’interrupteur est désactivé (sauf pour l’éteindre) et l’encart dit « Les notifications push ne sont pas configurées sur ce serveur (clés VAPID manquantes) : les alarmes sonnent seulement app ouverte. ».

Règles : [Alarmes, hors de l’app](../../business-rules/activities/alarms.md#hors-de-lapp-notifications-push).

Le contrôle du mot de passe actuel (dans les trois formulaires) est limité à 5 essais par 15 minutes : au-delà, « Trop de tentatives. Réessayez dans N min. ».
