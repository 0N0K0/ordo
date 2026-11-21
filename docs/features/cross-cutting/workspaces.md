# Espaces

Ce que l’utilisateur peut faire avec les espaces de travail : en changer, les gérer, choisir leur type (PRO ou PERSO), leur semaine et les notifications qu’ils donnent quand un autre espace est ouvert. Code web : `apps/web/src/features/workspaces/` (voir [Espaces, code web](../../web/features/cross-cutting/workspaces.md)) ; règles : [Règles des espaces](../../business-rules/cross-cutting/workspaces.md).

## Principe

Chaque espace a ses propres projets, tâches, temps, agenda, alarmes, boîtes mail, documents, tableaux de bord, trésorerie et paramètres. Un espace personnel (PERSO) n’a ni facturation, ni clients, ni société.

Chaque fenêtre (onglet) du navigateur montre un espace et le garde à travers les rechargements ; deux fenêtres peuvent montrer deux espaces différents. Une nouvelle fenêtre s’ouvre sur le dernier espace choisi (cookie), un onglet dupliqué sur celui de son onglet d’origine.

## Sélecteur d’espace

Dans la barre du haut : un bouton (téléphone) ou le nom de l’espace en texte avant le titre de la page (à partir de la tablette). Il s’ouvre au survol, ou au clic au toucher ou au clavier.

- Section « Espaces » : chaque espace avec l’icône de son type (mallette = professionnel, maison = personnel), l’espace actuel coché. Choisir un autre espace recharge la fenêtre dans cet espace :
  - sur la même page, en gardant seulement l’onglet (`?tab=`) ;
  - sur la page d’un élément propre à l’espace, sur la page de sa liste : un projet ou un client → l’accueil, un document comptable → « Facturation », une liste d’achats → « Achats ».
- « Gérer les espaces… » ouvre la gestion dans le panneau latéral.

Pendant le chargement de l’espace : « Chargement de l’espace » en plein écran ; en cas d’erreur, un message d’erreur.

## Gestion des espaces

Dans le panneau « Espaces » (sélecteur) et dans « Paramètres › Espaces ». Section « Espaces », puis section « Nouvel espace ».

### Pour chaque espace

- Libellé, badge « Actuel » pour l’espace ouvert.
- Type : bouton segmenté « Pro » / « Perso ». Toasts « Espace passé en personnel. » / « Espace passé en professionnel. ». Le passage en personnel est refusé si l’espace a des clients ou des documents de facturation.
- Menu : « Renommer » (formulaire « Renommer l’espace » dans le panneau latéral, 250 caractères), « Monter » / « Descendre » (ordre du sélecteur), « Ouvrir » (désactivé pour l’espace actuel).
- « Supprimer » : désactivé quand il ne reste qu’un espace (« Le dernier espace ne peut pas être supprimé »). Confirmation « Supprimer l’espace » : « L’espace « X » sera supprimé définitivement avec tout son contenu : projets, tâches, temps, agenda, mails liés, documents, tableaux de bord, trésorerie[, clients et facturation]. Les boîtes mail restent intactes sur leur serveur. ». Toast « Espace supprimé. ». Supprimer l’espace ouvert bascule sur un autre.
- « Quand un autre espace est ouvert (alarmes et rappels sonnent toujours), notifier aussi : » puce « Nouveaux mails » : c’est le seul choix, les alarmes et les rappels étant toujours donnés.
- « Semaine du … au … » : premier et dernier jour (lundi à dimanche). Texte d’aide : « N jours. Vue semaine de l’agenda, « cette semaine »… », ou « 8 jours : les semaines se chevauchent ce jour-là. » quand les deux jours sont les mêmes. Le changement recharge toutes les données.

### Nouvel espace

« Libellé » (250 caractères au plus) et type « Pro » / « Perso » (Perso par défaut), bouton « Ajouter » (désactivé sans libellé). Toast « Espace créé. ». Le nouvel espace est préparé : profil « Moi » de chaque utilisateur, agenda, unités d’achat usuelles, statuts de suivi des documents (PRO).

## Notifications d’un espace fermé

Tant qu’un espace est ouvert, les autres espaces continuent de notifier :

- toujours, leurs alarmes : relues toutes les minutes, vérifiées toutes les 15 secondes ; l’alarme sonne avec le nom de son espace et un lien vers sa tâche, son projet, ou « Ouvrir « X » ». Elle est marquée comme sonnée dans son espace ;
- toujours, les rappels de leurs évènements (de la veille à J+8 ; lien « Voir l’agenda de « X » »), tâches (lien vers la tâche) et routines (lien « Voir les routines de « X » »), relus toutes les 5 minutes ;
- s’ils l’ont choisi, « Nouveaux mails » : relevés toutes les 10 minutes (et à la demande).

Un lien d’une de ces notifications ouvre l’espace concerné dans la fenêtre. Voir [Alarmes](../activities/alarms.md), [Agenda](../activities/calendar.md), [Mails](../resources/mail.md).

## Pages réservées aux espaces PRO

« Facturation » (`/accounting`, `/accounting/:id`, `/accounting/imported/:id`) et la page d’un client (`/clients/:id`) affichent, dans un espace PERSO : « Indisponible dans un espace personnel » — « L’espace « X » est personnel : il n’a ni facturation, ni clients, ni société. », avec retour à l’accueil. Le menu « Facturation », les cartes et chiffres de facturation de l’accueil, les clients et l’onglet « Facturation » des projets sont masqués.

## Changement d’espace depuis d’autres pages

- Un évènement d’un agenda abonné d’un autre espace propose d’ouvrir cet espace sur le jour de l’évènement ([Agenda](../activities/calendar.md)).
- Les notifications de mails d’un autre espace ouvrent cet espace ([Mails](../resources/mail.md)).
