# Mails

Ce que l’utilisateur peut faire avec les mails dans Ordo : boîtes IMAP/SMTP lues en direct, dossiers, drapeaux, état « traité », recherche et dossiers de recherche, rédaction, brouillons, envois programmés, rattachement aux projets. Sources : `apps/web/src/features/mail/**`, et les points d’entrée situés dans d’autres features (projets, accueil, comptabilité, actions rapides).

Les règles appliquées par l’API sont dans [Règles métier des mails](../../business-rules/resources/mail.md) ; le code web est décrit dans [Code web : mails](../../web/features/resources/mail.md).

## Principe

- Les mails ne sont **pas copiés** dans Ordo : chaque liste, chaque mail ouvert est lu en direct sur le serveur IMAP de la boîte. Seuls les mails **rattachés à un projet** sont copiés dans Ordo (avec leurs pièces jointes).
- Les envois passent par le serveur SMTP de la boîte choisie.
- Les drapeaux et l’état « traité » sont écrits sur le serveur (mots-clés IMAP), donc visibles d’un poste à l’autre ; pour un serveur qui refuse les mots-clés, ils sont gardés dans Ordo.
- Les dossiers de recherche et les envois programmés n’existent que dans Ordo.
- Les mails sont relevés toutes les 10 minutes, ou à la demande avec « Relever ».

## PRO et PERSO

La fonctionnalité est identique dans un espace PRO et dans un espace PERSO : la page « Mails », l’onglet « Mails » d’un projet, la carte de l’accueil et les notifications. Chaque espace a ses propres boîtes, drapeaux, dossiers de recherche et envois programmés. Seuls les points d’entrée venant de la facturation (envoi d’un document, relances) n’existent qu’en PRO, puisque la facturation n’y existe qu’en PRO.

## Page « Mails » (`/mail`)

Entrée « Mails » du menu latéral, groupe « Ressources ». L’entrée affiche deux compteurs (voir [Compteurs](#compteurs-et-notifications)).

### En-tête

- Titre « Mails ».
- « Relever » (bouton secondaire, info-bulle « Relever les mails maintenant (sinon toutes les 10 minutes) ») : recharge dossiers, listes et compteurs, et annonce les nouveaux mails. Il tourne tant qu’un chargement de mails est en cours.
- « Nouveau mail » : ouvre la rédaction depuis la boîte affichée.
- Le bouton des paramètres de la page ouvre le panneau « Paramètres des mails » (boîtes mail et drapeaux, voir [Paramètres](#paramètres-des-mails)). L’ancienne adresse `?accounts=1` ouvre aussi ce panneau.

### Sans boîte

- Aucune boîte : état vide « Aucune boîte mail configurée : ajoutez-en une. », suivi directement du gestionnaire des boîtes mail.
- Toutes les boîtes archivées : « Toutes les boîtes mail sont archivées : restaurez-en une, ou ajoutez-en une. », suivi du gestionnaire.

### Disposition en trois colonnes

1. **Navigation** (à gauche) : « Envois programmés », « Dossiers de recherche », puis chaque boîte active et l’arbre de ses dossiers.
2. **Liste** (au centre) : les mails du dossier, du dossier de recherche, de la recherche avancée ou les envois programmés.
3. **Lecture** (à droite) : le mail ouvert, ou « Sélectionnez un mail pour le lire. ».

Sur écran étroit, les colonnes s’empilent.

### Paramètres d’URL

Toute la sélection est gardée dans l’URL (lien partageable, retour arrière) :

| Paramètre        | Rôle                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `account`        | Boîte affichée ; une boîte archivée ou inconnue est remplacée par la première boîte active. |
| `folder`         | Chemin du dossier ; `INBOX` par défaut.                                                     |
| `uid`            | Mail ouvert.                                                                                |
| `page`           | Page de la liste (à partir de 1, absent = 1).                                               |
| `sort`           | Ordre (`date-desc` par défaut, non écrit).                                                  |
| `state`          | `todo` ou `done` ; absent = « Tous ».                                                       |
| `view=scheduled` | Affiche les envois programmés.                                                              |
| `search`         | Id du dossier de recherche affiché.                                                         |
| `q`              | Texte de la recherche rapide.                                                               |
| `adv`            | Critères de la recherche avancée appliquée (JSON).                                          |
| `advanced=1`     | Panneau de la recherche avancée déplié.                                                     |
| `settings=1`     | Panneau des paramètres ouvert.                                                              |

Le lien vers un mail (`mailPath`) est `/mail?account=…&folder=…&uid=…`.

### Navigation : boîtes et dossiers

Chaque boîte active est une entrée dépliable portant son libellé et, dessous, « Nom \<adresse\> ». Sous elle, ses dossiers en arbre :

- Dossiers spéciaux d’abord, dans l’ordre Réception, Brouillons, Envoyés, Archives, Indésirables, Corbeille, puis les autres par chemin. La boîte de réception s’appelle « Réception ».
- Icône propre à chaque dossier spécial (réception, envoyés, brouillons, corbeille, indésirables, archives), icône de dossier sinon.
- Un dossier ayant des sous-dossiers a un bouton plier / déplier ; l’état plié est retenu dans le navigateur, par boîte.
- Deux badges à droite : nombre de mails « à traiter » (orange clair, absent pour Envoyés, Brouillons, Archives, Indésirables, Corbeille) et nombre de « non lus » (plein). Info-bulles « N à traiter », « N non lus ».
- Clic, Entrée ou Espace : ouvre le dossier (retour page 1, mail fermé).
- Menu « … » du dossier : « Nouveau sous-dossier », « Déplacer vers… », « Renommer », « Supprimer ». Les trois derniers sont désactivés sur la réception et les dossiers spéciaux.
- En bas de chaque boîte : « Nouveau dossier » (au premier niveau).
- Une boîte injoignable affiche son erreur à la place de ses dossiers ; les autres boîtes restent utilisables.

Formulaires (fenêtre de libellé) :

- « Nouveau dossier » / « Nouveau sous-dossier » : champ « Nom », bouton « Créer », toast « Dossier créé. ».
- « Renommer le dossier » : champ « Nom », bouton « Renommer », toast « Dossier renommé. » ; le dossier affiché suit son nouveau chemin.
- « Déplacer vers… » (panneau latéral « Déplacer « X » ») : texte « Le dossier, ses sous-dossiers et leurs mails changent de place. », puis « Premier niveau » et la liste des dossiers possibles (pas lui-même ni ses sous-dossiers). Toasts « « X » rangé dans « Y ». » ou « « X » placé au premier niveau. ».
- « Supprimer le dossier » : confirmation destructive « Le dossier « X », ses sous-dossiers et tous leurs mails seront supprimés définitivement du serveur. », toast « Dossier supprimé. ». Si le dossier affiché était dedans, retour à la réception.

### Glisser-déposer

- Des mails de la liste vers un dossier de la **même boîte** (autre que le leur) : ils y sont déplacés. Si des mails sont cochés et qu’on glisse l’un d’eux, toute la sélection part ; sinon le seul mail glissé. Toast « Mail déplacé dans « X ». » ou « N mails déplacés dans « X ». ».
- Un dossier (pas un dossier spécial) vers un autre dossier de sa boîte (pas lui-même, pas un de ses sous-dossiers, pas son parent actuel) : il devient son sous-dossier. Vers l’entrée de la boîte : il passe au premier niveau.
- La cible survolée est surlignée ; l’élément glissé est à demi-opacité ; une étiquette suit le pointeur (« N mails » ou le nom du dossier).

### Liste des mails d’un dossier

En-tête de la liste :

- Recherche rapide « Rechercher (objet, expéditeur, texte) » (cherche dans l’objet, l’expéditeur, les destinataires et le corps), appliquée 400 ms après la frappe ; bouton « Recherche avancée » à côté.
- Case « Tout sélectionner sur la page » (cochée, partielle ou vide).
- Sans sélection : tri et filtre « traité ».
  - Tri : « Plus récents » (défaut), « Plus anciens », « Expéditeur (A → Z) », « Expéditeur (Z → A) », « Objet (A → Z) », « Objet (Z → A) », « Plus lourds », « Plus légers ».
  - Filtre : « Tous » / « À traiter » / « Traités ».
- Avec sélection : la barre d’actions de la sélection (voir plus bas).

Chaque ligne :

- Case à cocher ; coche verte « Traité » si le mail est traité ; correspondant ; drapeaux (icône drapeau à la couleur du drapeau, info-bulle libellé) ; trombone si pièces jointes ; date ; objet (« (sans objet) » si vide).
- Correspondant : l’expéditeur, ou « À : destinataire » quand le mail vient d’une des adresses de l’utilisateur (quel que soit le dossier).
- Date : heure si aujourd’hui, jour court si cette année, date complète sinon.
- En gras tant que non lu ; atténué une fois traité ; surligné quand ouvert ou coché.
- Clic ou Entrée : ouvre le mail.

50 mails par page, pagination sous la liste s’il y a plusieurs pages. Pendant le chargement d’une autre page, l’ancienne reste affichée en grisé. La sélection est oubliée quand on change de dossier, de page, de filtre ou de recherche.

États :

- Chargement : squelette de liste.
- Erreur (serveur injoignable…) : alerte avec le message de l’API.
- Vide : « Aucun mail ne correspond à la recherche. », « Aucun mail à traiter. », « Aucun mail traité. » ou « Aucun mail dans ce dossier. ».

### Actions sur la sélection

Barre affichée dès qu’un mail est coché (dans un dossier comme dans une recherche) :

- « N sélectionné(s) ».
- Interrupteur « Traité » (info-bulle « Marquer comme traité » / « Marquer comme à traiter ») : coché si tous les mails cochés sont traités.
- Menu « Drapeaux » (reste ouvert) : chaque drapeau non archivé, coché s’il est sur tous les mails cochés ; cliquer l’ajoute ou le retire ; « Gérer les drapeaux… » ouvre les paramètres. Un drapeau archivé déjà posé reste listé pour pouvoir être retiré.
- « Signaler comme spam » (orange) : déplace dans le dossier des indésirables ; toast « Mail signalé comme spam. » / « Mails signalés comme spam. ». Quand tous les mails sont déjà dans les indésirables, le bouton devient « Pas un spam » (retour en réception), toast « Mail remis en réception. » / « Mails remis en réception. ».
- « Déplacer vers… » : menu des dossiers de la boîte (indentés) ; seulement si tous les mails sont d’une même boîte, et pas dans l’onglet mails d’un projet.
- « Marquer comme lu », « Marquer comme non lu ».
- « Supprimer » : confirmation « N mail(s) sera placé / seront placés dans la corbeille de leur boîte (supprimé(s) définitivement s’ils y sont déjà). Leurs copies rattachées à des projets sont conservées. », toast « Mail supprimé. » / « Mails supprimés. ».
- « Désélectionner ».

Quand des mails quittent le dossier (spam, déplacement, suppression), la sélection est vidée et le mail ouvert se ferme s’il en faisait partie.

### Lecture d’un mail

Ouvrir un mail le marque comme lu (listes et compteurs se rafraîchissent).

En-tête :

- Objet ; avatar et adresses de l’expéditeur ; « À : … » (ou « — »), « · Cc : … » ; date et heure.
- Ligne de badges : « Traité » (vert), les drapeaux posés, et un badge par projet auquel le mail est rattaché (lien vers l’onglet mails du projet).
- Actions à droite : les actions d’organisation (Traité, Drapeaux, spam, Déplacer vers…, comme pour la sélection), « Marquer comme non lu », « Supprimer » (confirmation « Le mail sera placé dans la corbeille de la boîte (supprimé définitivement s’il y est déjà). Ses copies rattachées à des projets sont conservées. », toast « Mail supprimé. »).

Boutons sous l’en-tête :

- « Répondre », « Répondre à tous », « Transférer » (voir [Rédaction](#rédaction)).
- « Rattacher à un projet » : fenêtre avec le choix du projet et « Rattacher » (désactivé si le mail y est déjà rattaché). Toast « Mail rattaché au projet : les réponses suivantes le seront aussi. ».

Contenu :

- Pièces jointes (hors images intégrées) sous forme de badges : un PDF ou une image s’ouvre dans la visionneuse de l’app, un autre fichier se télécharge.
- Corps HTML dans un cadre isolé (aucun script ne s’exécute, les liens s’ouvrent dans un nouvel onglet), à la hauteur de son contenu. Les polices distantes sont toujours bloquées, les images distantes aussi par défaut : bandeau « Images distantes bloquées (elles peuvent signaler l’ouverture du mail). » et bouton « Afficher les images ». Un mail texte s’affiche en texte ; un mail vide affiche « Ce mail est vide. ».
- Commentaires du mail (fil de commentaires de l’app, attaché au Message-ID du mail), voir [Commentaires](../cross-cutting/comments.md).

États : squelette pendant le chargement ; « Mail introuvable. » ou le message d’erreur de l’API.

### Brouillons

Un mail du dossier Brouillons s’ouvre en lecture, sans les actions d’organisation, avec :

- « Reprendre le brouillon » : rouvre la rédaction avec ses destinataires, objet, corps, signature, citation, fichiers, projet et fil de discussion. La prochaine sauvegarde remplace ce brouillon. Échec : « Brouillon illisible. ».
- « Supprimer le brouillon » : confirmation « Le brouillon « X » sera supprimé définitivement de la boîte. », toast « Brouillon supprimé. ».

## Rédaction

Panneau latéral (large, verrouillé : il ne se ferme que par ses propres boutons), titré « Nouveau mail », « Répondre », « Transférer » ou « Brouillon ». Ouvert depuis :

- « Nouveau mail » de la page Mails (boîte affichée) ou de l’onglet mails d’un projet (mail rattaché au projet) ;
- l’action rapide « Mail » (sur une page de projet : rattaché à ce projet) ;
- « Répondre », « Répondre à tous », « Transférer », « Reprendre le brouillon » ;
- l’envoi d’un document de facturation ou d’une relance (voir [Comptabilité](../finances/accounting.md)).

Sans boîte active : « Configurez d’abord une boîte mail dans les paramètres (onglet « Mails »). » et un bouton « Fermer ».

### Champs

| Champ                                    | Détail                                                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « De »                                   | Boîte d’envoi (« Nom \<adresse\> ») parmi les boîtes non archivées ; par défaut celle donnée, sinon la première.                                        |
| « À »                                    | Adresses en étiquettes, séparées par virgule, point-virgule ou espace ; doublons retirés ; adresse invalide signalée « Adresse invalide : … ».          |
| « Cc / Cci »                             | Bouton qui déplie les champs « Cc » et « Cci » (déjà dépliés s’ils sont remplis).                                                                       |
| « Objet »                                | Texte libre.                                                                                                                                            |
| Corps                                    | Éditeur riche : gras, italique, souligné, barré, effacer la mise en forme, titres H2/H3, citation, listes, lien, alignement, image, annuler / rétablir. |
| « Ajouter la signature »                 | Case affichée si la boîte a une signature (cochée par défaut, sauf brouillon repris sans signature) ; aperçu de la signature dessous.                   |
| « Message cité » / « Message transféré » | Section repliable montrant le mail cité ou transféré, ajouté sous la signature.                                                                         |
| Fichiers                                 | « Joindre des fichiers » (plusieurs) ; chaque fichier est un badge retirable, y compris les fichiers repris du mail transféré ou du brouillon.          |

Images du corps : envoyées par le bouton, glissées ou collées ; redimensionnables par les coins (proportions gardées). Elles sont intégrées au mail envoyé. Échec d’envoi d’une image : « Image non envoyée. ».

Le focus va sur « À » s’il est vide, sinon au début du corps.

### Réponse et transfert

- « Répondre » : à l’adresse de réponse (Reply-To) du mail, sinon à son expéditeur ; objet préfixé « Re : » (sans le doubler si l’objet commence déjà par Re/Ré/Aw) ; citation « Le \<date\>, \<expéditeur\> a écrit : » suivie du mail en citation.
- « Répondre à tous » : en plus, en Cc, les destinataires et copies du mail, sans les adresses de l’utilisateur ni celles déjà en « À ».
- « Transférer » : sans destinataire ; objet préfixé « Tr : » (sans doubler Tr/Fw/Fwd) ; en-tête « ---------- Message transféré ---------- » avec De, Date, Objet, À ; les pièces jointes du mail (hors images intégrées) sont reprises.
- Réponse et transfert gardent la boîte du mail d’origine et le fil de discussion (In-Reply-To, References). Depuis l’onglet mails d’un projet, ils sont rattachés à ce projet.

### Brouillon automatique

- 4 secondes après chaque modification, le brouillon est enregistré dans le dossier Brouillons de la boîte (créé s’il n’existe pas), en remplaçant la version précédente. Il est lisible depuis n’importe quel logiciel de mail.
- Indicateur en haut : « Enregistrement du brouillon… », « Brouillon enregistré à HH:MM », ou en rouge « Brouillon non enregistré : nouvel essai à la prochaine modification. ».
- Quitter la page avec des modifications non enregistrées demande confirmation au navigateur.

### Fermer

« Fermer » (en haut ou en bas) ou Échap (sauf si une liste déroulante est ouverte) :

- rien d’écrit et pas de brouillon : fermeture directe ;
- sinon fenêtre « Fermer le mail » : « Enregistrez le brouillon pour reprendre ce mail plus tard (dossier Brouillons de la boîte), ou supprimez-le : il sera alors perdu définitivement. » avec « Supprimer le brouillon » (toast « Brouillon supprimé. »), « Enregistrer le brouillon » (toast « Brouillon enregistré. ») et « Continuer la rédaction ».

### Envoyer

- « Envoyer » : désactivé sans boîte, sans destinataire ou avec une adresse invalide. Attend la sauvegarde en cours, envoie, puis supprime le brouillon. Toast « Mail envoyé. », ou « Mail envoyé et rattaché au projet. » quand il a été rattaché à un projet (projet d’origine ou projets de la conversation).
- Le mail est enregistré dans « Envoyés » si la boîte le demande.

### Programmer

« Programmer » (mêmes conditions que « Envoyer ») ouvre « Envoyer plus tard » :

- « Cet après-midi » (14 h, proposé seulement avant 13 h), « Demain matin » (8 h), « \<Premier jour de la semaine\> matin » (8 h, le prochain premier jour de semaine de l’espace, ex. « Lundi matin ») ; l’heure exacte est affichée à droite.
- « Date et heure » libres (à partir d’aujourd’hui, le jour et l’heure dans un seul sélecteur), puis « Programmer l’envoi ».

Toast « Envoi programmé le \<date courte et heure\>. ». Le mail est construit tout de suite (fichiers compris) et son brouillon est supprimé.

## Envois programmés

Entrée « Envois programmés » de la navigation, avec un badge du nombre d’envois en attente ou en échec (rouge s’il y a un échec, bleu sinon).

Liste (par heure d’envoi) : objet, « À : … · adresse de la boîte », badge « Échec », « Envoi en cours » ou la date et heure prévue, et le message d’erreur le cas échéant. Actions (sauf pendant l’envoi) :

- « Envoyer maintenant » : toast « Mail envoyé. ».
- « Annuler l’envoi (retour aux brouillons) » : le mail repart dans les brouillons de sa boîte ; toast « Envoi annulé : le mail est dans les brouillons. ».

Vide : « Aucun envoi programmé. Programmez un mail depuis sa fenêtre de rédaction (« Programmer »). ».

Côté serveur, les envois partent toutes les 30 secondes environ (voir [Tâches de fond](../../business-rules/cross-cutting/background-jobs.md)). La liste se rafraîchit chaque minute.

## Recherche

### Recherche avancée

Bouton « Recherche avancée » à côté de la recherche rapide. Panneau :

- Où : « Ce dossier », « Toute la boîte » (tous les dossiers sauf corbeille, indésirables, brouillons, envoyés), « Toutes les boîtes ».
- « De », « À » (nom ou adresse), « Objet », « Corps », « Reçu » (période de réception, un seul champ, chaque bout facultatif).
- « Drapeaux (l’un d’eux) » (« Peu importe » sans choix).
- « Tous » / « À traiter » / « Traités », « Non lus », « Avec pièce jointe ».
- Note : « Les 200 mails les plus récents de chaque dossier sont examinés. ».
- « Enregistrer en dossier de recherche », « Effacer », « Rechercher ».

Les résultats remplacent la liste, avec l’en-tête « Recherche avancée », « Modifier » / « Masquer les critères » et « Quitter ». Chaque résultat porte un badge « Boîte · Dossier » (le nom de la boîte seulement s’il y a plusieurs boîtes). Les résultats sont triés du plus récent au plus ancien. Vide : « Aucun mail ne répond à la recherche. ».

### Dossiers de recherche

Section « Dossiers de recherche » de la navigation : chaque dossier (clic, Entrée ou Espace pour l’ouvrir), menu « Modifier » / « Supprimer », et « Nouveau dossier de recherche ».

Formulaire (panneau latéral « Nouveau dossier de recherche » / « Modifier le dossier de recherche ») :

- Texte : « Un dossier de recherche rassemble les mails qui répondent à ses critères, dans une ou plusieurs boîtes. Il n’existe que dans Ordo : rien n’est créé sur le serveur. »
- « Libellé » (requis ; « À traiter » par défaut pour un nouveau, « Recherche » pour une recherche avancée enregistrée).
- « Boîtes » (« Toutes les boîtes » sans choix).
- « Dossiers » : « Réception », « Tous (hors corbeille, spam, brouillons, envoyés) », et « Dossier \<chemin\> » quand il vient d’une recherche « Ce dossier ».
- « Mails » : « À traiter » (défaut), « Traités », « Tous ».
- « Drapeaux » (« Les mails ayant l’un de ces drapeaux. »), « Non lus seulement », « Texte » (« Dans l’objet, les adresses ou le corps. »).
- « Critères avancés » : « De », « À », « Objet », « Corps », « Reçu » (période en un seul champ, chaque bout facultatif), « Avec pièce jointe ».
- Nouveau dossier : bouton « Créer », toast « Dossier de recherche créé. » (le nouveau dossier s’ouvre). Dossier existant : enregistré champ par champ (chaque choix dès qu’il change, les textes en les quittant ; « Enregistrement… » / « Enregistré », sans bouton).

Suppression : confirmation « Le dossier de recherche « X » sera supprimé définitivement. Les mails qu’il montre ne sont pas touchés. », toast « Dossier de recherche supprimé. ».

La liste d’un dossier de recherche fonctionne comme celle d’une recherche avancée (badge boîte / dossier, sélection, actions) ; vide : « Aucun mail ne répond aux critères de ce dossier. ». Ouvrir un mail affiche sa boîte et son dossier dans l’URL.

## Onglet « Mails » d’un projet

Onglet « Mails » de la page projet (`/projects/:id?tab=mail`), dans les espaces PRO et PERSO. Description : « Mails rattachés au projet depuis la page Mails, envoyés depuis ce projet, ou faisant suite à une conversation rattachée. »

- Actions « Relever » et « Nouveau mail » (désactivé sans boîte active ; le mail écrit est rattaché au projet).
- Liste des mails du projet **lus en direct dans les boîtes** : tous les dossiers sauf corbeille, indésirables et brouillons (les envoyés compris), retrouvés par leur Message-ID. Un mail rattaché mais supprimé de la boîte n’y apparaît plus.
- Recherche rapide « Rechercher dans les mails du projet » et recherche avancée (paramètres d’URL préfixés `mailQ`, `mailAdv`, `mailAdvanced`) ; « Enregistrer en dossier de recherche » crée un dossier limité au projet (toast « Dossier de recherche créé (page Mails). »).
- Tri sans les tailles (« Plus récents » … « Objet (Z → A) »), filtre « Tous / À traiter / Traités » (masqué pendant une recherche avancée, qui a le sien).
- Sélection et actions comme dans la page Mails, sans « Déplacer vers… ». « Gérer les drapeaux… » mène aux paramètres de la page Mails.
- Lecteur à droite : comme dans la page Mails, sans déplacement ; « Rattacher à un projet » y est remplacé par « Détacher du projet » (confirmation « La copie du mail conservée dans le projet sera supprimée, avec ses pièces jointes. Le mail reste dans la boîte mail. », toast « Mail détaché du projet. ») ; les réponses et transferts sont rattachés au projet ; les commentaires sont rattachés au projet.
- États vides : « Aucun mail du projet dans les boîtes. », « Aucun mail à traiter. », « Aucun mail traité. », « Aucun mail du projet ne répond à la recherche. ».

Un mail entre dans un projet :

- quand on le rattache depuis la page Mails ;
- quand il est envoyé depuis le projet (« Nouveau mail » de l’onglet, action rapide sur la page du projet, réponse ou transfert depuis l’onglet) ;
- quand il répond à un mail déjà rattaché (envoyé depuis Ordo, ou reçu / envoyé ailleurs : suivi automatique des conversations toutes les 5 minutes).

## Paramètres des mails

Panneau des paramètres de la page Mails (« Paramètres des mails »), aussi accessible par `/mail?settings=1` ; les mêmes boîtes et drapeaux (ceux de l’espace) sont aussi dans les paramètres d’un projet, depuis son onglet « Mails ».

### « Boîtes mail »

Description : « Lues en direct sur le serveur (IMAP) et utilisées pour l’envoi (SMTP). Seuls les mails rattachés à un projet sont copiés dans Ordo. »

- « Afficher les archivées », « Ajouter ».
- Chaque boîte : libellé, badge « Archivée », « Nom \<adresse\> » et « · signature » si elle en a une.
- Actions : « Signature », « Modifier » (pas sur une boîte archivée), « Archiver » / « Restaurer », « Retirer ».
- « Ajouter » (« Nouvelle boîte mail »), « Modifier » (« Modifier — X ») et « Signature » (« Signature — X ») s’ouvrent dans le panneau latéral, large.
- « Retirer la boîte mail » : confirmation « \<adresse\> ne sera plus lue ni utilisée par Ordo, et ses réglages (mots de passe, signature) seront supprimés. Les mails restent sur le serveur, et ceux rattachés à des projets restent dans Ordo. », bouton « Retirer », toast « Boîte mail retirée. ».
- Vide : « Aucune boîte mail configurée. ».

Une boîte archivée n’est plus lue ni surveillée, disparaît de la page Mails, de la rédaction, des compteurs et des recherches « toutes boîtes », ses envois programmés attendent sa restauration. Voir [Archivage](../../business-rules/cross-cutting/archiving.md).

### Formulaire d’une boîte (fenêtre « Nouvelle boîte mail » / « Modifier — X »)

| Champ                                              | Détail                                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| « Libellé dans Ordo »                              | Requis, ex. « Pro, Perso… ».                                                                                        |
| « Hébergeur »                                      | Facultatif, « préremplit les serveurs » : Gmail, Outlook / Microsoft 365, OVHcloud, Infomaniak, Gandi, IONOS.       |
| « Adresse email »                                  | Requise ; pour une nouvelle boîte, recopiée dans l’identifiant IMAP tant que celui-ci est vide ou égal à l’adresse. |
| « Nom d’expéditeur »                               | Facultatif (« Prénom Nom »).                                                                                        |
| « Réception (IMAP) »                               | « Serveur », « Port » (993 par défaut), « SSL/TLS » (activé), « Identifiant », « Mot de passe ».                    |
| « Envoi (SMTP) »                                   | « Serveur », « Port » (465 par défaut), « SSL/TLS » (« Désactivé : STARTTLS (port 587) »).                          |
| « Mêmes identifiants que pour la réception »       | Cochée par défaut (ou si les identifiants sont égaux) ; décochée, montre identifiant et mot de passe SMTP.          |
| « Enregistrer les mails envoyés dans « Envoyés » » | Activé par défaut ; « À désactiver pour Gmail et Outlook, qui le font déjà. ».                                      |

- Mot de passe : « Pour Gmail ou Outlook : un mot de passe d’application. » ; en modification, vide = inchangé (« Inchangé (à ressaisir si le serveur change) »).
- « Tester la connexion » : se connecte aux deux serveurs ; succès : « Connexion réussie à la réception et à l’envoi. ».
- Nouvelle boîte : bouton « Ajouter », toast « Boîte mail ajoutée. ». Boîte existante : enregistrée champ par champ, « Enregistrement… » / « Enregistré » en haut, sans bouton : libellé, adresse et nom d’expéditeur en les quittant, « Enregistrer les mails envoyés » dès qu’il change ; la connexion (serveurs, ports, chiffrement, identifiants, mots de passe, « Mêmes identifiants », hébergeur choisi) ensemble, en quittant l’un de ses champs (un interrupteur : dès qu’il change), une fois le mot de passe ressaisi quand un serveur a changé : d’ici là, l’erreur « Saisissez à nouveau le mot de passe : le serveur, le port, l’identifiant ou le chiffrement a changé. » reste sous le mot de passe (celui de la réception avec « Mêmes identifiants ») et rien de la connexion n’est enregistré.

### Signature (fenêtre « Signature — X »)

Texte « Ajoutée aux nouveaux mails de \<adresse\>. Le bouton « `</>` » de la barre d’outils permet de coller ou de modifier le code HTML ; les images envoyées depuis l’éditeur sont intégrées aux mails. », éditeur riche avec édition du code HTML, enregistré en quittant l’éditeur (« Enregistrement… » / « Enregistré » en haut, sans bouton ; erreur « Signature trop longue. » dessous). Une signature vide est retirée.

### « Drapeaux »

Liste de paramètres standard (ajout, modification du libellé, de la couleur et de l’image, archivage, suppression, réordonnancement par glisser-déposer), voir [Paramètres](../cross-cutting/settings.md). Description : « Les drapeaux sont posés sur les mails côté serveur (mots-clés IMAP), ou gardés dans Ordo quand le serveur ne les accepte pas. ». Suppression : « Le drapeau « X » sera supprimé définitivement et retiré des mails qui l’ont. ».

## Compteurs et notifications

- **Menu latéral** : sur « Mails », badge orange « N à traiter » (mails non traités de toutes les boîtes, hors brouillons, envoyés, archives, indésirables, corbeille) et badge « N non lus » (réceptions). Rien sans boîte active.
- **Accueil** : chiffre « Mails non lus » (« Boîte de réception », ou « Aucune boîte configurée ») et carte « Mails non lus » listant les non-lus des réceptions, du plus récent au plus ancien. Voir [Accueil](../cross-cutting/home.md).
- **Nouveaux mails** : toutes les 10 minutes et à chaque « Relever », les nouveaux non-lus des réceptions sont annoncés par un carillon, une notification système et un toast avec « Lire le mail » (au-delà de 3 : un seul toast « N nouveaux mails » avec « Ouvrir la boîte de réception »). Le premier relevé n’annonce rien. Un mail n’est annoncé qu’une fois, même avec plusieurs onglets ouverts.
- **Autres espaces** : si un autre espace a choisi d’être notifié pour les mails, ses nouveaux mails sont annoncés aussi (« Espace « X » »), et le lien ouvre cet espace. Voir [Espaces](../cross-cutting/workspaces.md).
