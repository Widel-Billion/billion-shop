# Billion Shop

Boutique éditoriale responsive avec catalogue, panier et administration reliés à une base persistante. Cette livraison est une **version de démonstration fonctionnelle**, pas une boutique ouverte aux ventes réelles. Tous les produits et commandes sont des exemples. Aucun paiement réel n’est accepté.

## Architecture livrée

- React 19, TypeScript, routes App Router et Tailwind 4 ; styles de marque dans `app/globals.css`.
- Vinext/Vite et Cloudflare Workers pour le déploiement Sites disponible dans cet environnement.
- Cloudflare D1 (SQLite), migrations Drizzle versionnées, requêtes préparées côté serveur.
- Connexion ChatGPT fournie par Sites, administrateur autorisé par la variable serveur `ADMIN_EMAIL`.
- `/` : boutique et parcours client. `/admin` : interface de gestion séparée ; toutes les mutations sensibles sont autorisées à nouveau côté serveur.
- `/api/shop` : catalogue, réglages, commandes et inscriptions consenties.
- `lib/catalog.ts` : types, catalogue initial, configuration et calcul des totaux.
- `lib/payments.ts` : contrat d’adaptateur pour les futurs paiements ; aucun adaptateur réel configuré.

La préférence Next.js / Supabase / Vercel du cahier des charges n’est pas intégralement réalisée : la version hébergée utilise Sites, D1 et l’identité Sites. Aucun projet Supabase ni déploiement Vercel n’est configuré, aucune politique RLS Supabase n’est prétendue active.

## Installation

Prérequis : Node >= 22.13 et pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
```

Sur une installation pnpm qui bloque les scripts de dépendances, autoriser uniquement les scripts nécessaires des paquets connus (esbuild, sharp, workerd) selon la politique locale. Ne jamais inclure `.dev.vars`, `.env` ou des secrets dans Git.

Pour le développement local, créer `.dev.vars` :

```env
ADMIN_EMAIL=seedy@sites.test
```

Le simulateur d’authentification local du starter connecte ce compte uniquement sur loopback. Il n’est pas embarqué dans la version de production.

Construire puis appliquer les migrations de la base locale, une seule fois et dans l’ordre :

```sh
node scripts/run-framework.mjs build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_slimy_power_man.sql
node scripts/run-framework.mjs dev
```

Ouvrir l’URL locale imprimée (normalement `http://127.0.0.1:5173`). Pour l’administration locale, utiliser `/signin-with-chatgpt?return_to=/admin`. Le catalogue initial est inséré de façon idempotente lors du premier accès au service. Les bases locale et hébergée sont distinctes.

## Parcours disponibles

- Accueil éditorial, univers par catégorie, nouveautés et sélection de pièces signatures.
- Recherche réelle par nom, filtres combinés catégorie/budget/recherche et tris par prix/nom.
- Fiche produit en fenêtre avec description, couleur, taille, quantité, stock et guide de tailles de démonstration.
- Panier persistant sur l’appareil, quantités, suppression, contrôle du stock et favoris persistants.
- Coupon de démonstration `BILLION10` (modifiable), sous-total, remise, livraison et total.
- Commande de test invitée ou connectée ; prix et coupon recalculés côté serveur. Les écritures de stock et de commande sont atomiques dans un batch D1, avec contrainte interdisant le stock négatif.
- Commandes connectées filtrées par identifiant serveur. Commandes invitées visibles dans la session courante uniquement.
- Administration : création/modification/masquage d’un produit, tailles/couleurs, image HTTPS, stock total, prix et remise.
- Administration : recherche de commandes, statuts, notes internes, suivi, historique et export CSV.
- Personnalisation : logo typographique, annonce, campagne principale, textes, couleur accent, catégories, coordonnées, aperçu avant publication.
- Réglages : frais et seuil de livraison, coupon, pourcentage et conversion HTG manuelle (désactivée tant que le taux vaut zéro).
- Newsletter : stockage d’une inscription et de son consentement ; aucun envoi automatique.
- Menus mobiles, grille de produits à deux colonnes, panneaux, navigation clavier, focus dans les fenêtres et réduction des animations.

## Configuration hébergée Sites

Conserver le `project_id` existant dans `.openai/hosting.json`. La liaison D1 `DB` y est déclarée. La publication Sites provisionne la base et applique les migrations. Définir `ADMIN_EMAIL` dans les variables serveur Sites avec l’email du propriétaire autorisé, puis déployer la nouvelle version. Ne jamais remplacer l’autorisation par une condition seulement côté navigateur.

Le site reste privé au propriétaire selon son audience initiale. Une ouverture au public doit être décidée après la fin des intégrations commerciales et des contrôles complémentaires. Les identités reçues via les en-têtes Sites ne sont fiables que derrière la passerelle Sites. Ne pas déployer cette API directement derrière un proxy qui permet aux visiteurs de fournir ces en-têtes.

## Portage Vercel / Supabase

Cette source ne doit pas être envoyée telle quelle sur Vercel : `cloudflare:workers`, D1 et les en-têtes d’identité Sites sont spécifiques à l’hébergement livré. Un portage requiert les travaux suivants avant de pouvoir fonctionner :

1. Créer un projet Next.js App Router TypeScript standard, y porter les composants et styles ; retirer le worker et les plugins Vite.
2. Créer un projet Supabase, des tables relationnelles produits, variantes, stocks, commandes, lignes, profils, rôles et configuration ; convertir la migration SQLite, qui n’est pas compatible PostgreSQL.
3. Remplacer les appels D1 par un adaptateur serveur Supabase et une fonction PostgreSQL transactionnelle pour réserver le stock et créer les commandes. Ne pas faire deux appels séparés pour ces écritures.
4. Remplacer l’identité Sites par Supabase Auth vérifiée côté serveur ; gérer inscription, vérification d’email et réinitialisation. Activer RLS pour toutes les tables exposées, avec lecture des seules commandes appartenant à `auth.uid()` et rôle administrateur vérifié côté serveur.
5. Créer un bucket médias avec politiques dédiées et liens publics ou signés selon le contenu. Garder `SUPABASE_SERVICE_ROLE_KEY` uniquement côté serveur. Configurer l’URL du projet, la clé publique et les secrets dans Vercel ; ne pas ajouter la clé service aux variables `NEXT_PUBLIC_*`.
6. Configurer les URL de redirection d’authentification, appliquer les migrations, déployer une préproduction Vercel, puis rejouer tous les tests avant d’ouvrir les ventes.

Ces étapes sont une procédure de portage restante, pas une intégration déjà livrée.

## Paiements et notifications à intégrer

Les montants de référence sont en USD. HTG n’est qu’un affichage avec taux manuel ; aucun taux de marché n’est inventé. Toutes les commandes actuelles sont des tests avec paiement en attente. Le statut de commande ne marque jamais un paiement comme encaissé.

Pour chaque fournisseur, implémenter le contrat `PaymentProvider` côté serveur, configurer ses secrets de test, créer une session à partir du montant serveur, vérifier signature et fraîcheur des webhooks, rendre les événements idempotents et rapprocher montant/devise/référence avant de passer le paiement à `paid`. Ne pas considérer une redirection navigateur comme une preuve de paiement. MonCash nécessite un compte marchand et les accès officiels correspondants. Le virement nécessite une procédure de rapprochement explicite. Aucun de ces services n’a été connecté ou vérifié ici.

Pour les emails, choisir un fournisseur transactionnel, vérifier le domaine expéditeur et ses DNS, enregistrer les secrets côté serveur et ajouter une file d’envoi avec reprise. Implémenter confirmations, changements de statut, désabonnement signé et gestion des rebonds. L’inscription newsletter actuelle n’envoie aucun message.

## Limites à traiter avant exploitation commerciale

- Stock partagé par produit : les tailles/couleurs sont enregistrées exactement, mais les quantités par variante, mouvements, réservations et réapprovisionnement après annulation ne sont pas encore implémentés.
- Fiche en fenêtre : pas encore de page SEO individuelle, galerie multi-images, zoom, vidéo, swipe ni partage produit.
- Connexion email/mot de passe, vérification d’email, reset, profil, carnet d’adresses, retours et synchronisation des favoris entre appareils restent à créer.
- Un seul administrateur ; pas de rôles multiples, journal d’activité global, module clients, modération d’avis, retours/remboursements ou factures PDF.
- Un seul coupon en pourcentage : pas de dates, limites d’usage, ciblage, remise fixe ou minimum d’achat.
- La configuration de campagne est limitée aux champs visibles : pas de constructeur de sections, ordre des blocs, import de médias, carrousel/vidéo, menus personnalisables ou édition complète des pages légales/footer.
- Pas de calcul de taxes, de zones de livraison, transporteurs, achat réel, remboursement, rapprochement bancaire ni automatisation d’emails.
- La liste « pièces signatures » est une sélection éditoriale, pas des ventes prétendument réelles. Aucun faux avis n’est affiché.
- Pas de filtres taille/couleur/marque/disponibilité, pagination, historique de consultation ou statistiques de vente par période.
- Le catalogue est chargé côté client après l’accueil : le SEO de catalogue et le sitemap produits restent à ajouter. Ne pas indexer la démonstration privée.
- Ajouter avant ouverture publique : quotas et protection contre l’abus, idempotence des commandes, limites de taille des requêtes, validation métier plus fine, tests de concurrence et paiement, sauvegardes/restauration, politique de conservation et suppression des données.
- Les photos Unsplash sont des illustrations de démonstration, pas une certification des articles livrés. Remplacer les photos et vérifier les droits liés à la marque, aux produits et aux personnes pour le catalogue réel.

## Vérifications

```sh
node node_modules/typescript/bin/tsc --noEmit
node scripts/verify-shop.mjs
node scripts/run-framework.mjs build
```

Le script d’intégration cible uniquement le serveur local sur 127.0.0.1:5173. Il crée un produit QA, une commande et une inscription de test dans la base locale, masque le produit à la fin et restaure les réglages. Il ne doit pas être utilisé avec des données commerciales. Voir `TESTS.md` pour les résultats et les limites de vérification.
