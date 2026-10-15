# Vérifications de Billion Shop

## Automatisées — réussies en local

`node scripts/verify-shop.mjs` :

- Initialisation des variantes en conservant le total disponible existant.
- Produit créé puis immédiatement visible dans le catalogue public.
- Autorisation administrateur et origine des écritures vérifiées.
- Stock total recalculé à partir des variantes, sans confiance dans le total client.
- Variantes inexistantes et variantes épuisées refusées même si le produit a du stock dans un autre coloris.
- Dépassement cumulé sur une même variante : rollback atomique des quantités et de l’historique.
- Commande de test avec taille, couleur et quantité exactes, prix et coupon serveur, paiement en attente.
- Deux commandes simultanées pour la dernière unité : une seule réussit.
- Édition administrative obsolète refusée après une vente.
- Transitions de commande contrôlées et historique conservé.
- Cycle complet préparation, expédition, livraison et retour : réintégration unique.
- Annulation : stock réintégré une fois ; second enregistrement sans double réintégration.
- Variante retirée : réintégration conservée dans le stock retiré et réactivation avec quantité préservée.
- Données commandes, mouvements et variantes retirées non exposées anonymement.
- Personnalisation de l’accueil, restauration des paramètres, consentement newsletter et masquage d’un produit.

`node scripts/verify-filters.mjs` :

- Taille, couleur et disponibilité vérifiées sur une même variante.
- Catégorie, budget et recherche combinables.
- Tri par prix, nouveautés, promotions, favoris et masquage des produits non publiés.

TypeScript et compilation de production vérifiés séparément.

## Portée

Le script API cible uniquement le serveur local sur 127.0.0.1:5173 et crée des données QA locales. Le parcours graphique initial d’ouverture de fiche et d’ajout au panier a été vérifié ; les contrôles de largeur précédents n’ont montré aucun débordement à 375 et 1265 px utiles. Les nouveaux filtres ont été testés dans l’interface avec M + Noir + En stock : trois pièces correspondantes. L’écran Stocks, l’éditeur de quantités et le passage temporaire d’une variante à zéro ont été vérifiés : total recalculé, rupture visible et mouvement enregistré. La quantité de démonstration a été restaurée ensuite. Cette recette locale ne remplace pas une recette commerciale complète ni un test des nouveaux parcours après publication.

Les paiements réels, emails et hébergements Supabase/Vercel ne sont pas intégrés et ne sont donc pas testés. Voir le README pour les fonctions restantes.
