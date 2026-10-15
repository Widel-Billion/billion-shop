# Vérifications de Billion Shop

## Résultats locaux

- TypeScript : réussi.
- Compilation Vinext de production : réussie.
- Migration D1 locale : appliquée avec succès.
- Accueil local : HTTP 200 et rendu mobile inspecté dans le navigateur intégré.
- Fiche produit : ouverture et ajout au panier confirmés dans l’interface.
- Le script `scripts/verify-shop.mjs` a validé :
  - rejet de l’écriture produit sans autorisation ;
  - rejet d’une origine étrangère ;
  - création d’un produit et lecture immédiate dans le catalogue public ;
  - rejet d’une variante inexistante et d’un coupon invalide ;
  - commande avec taille M, couleur Noir et quantité 2 ;
  - recalcul du coupon, sous-total, livraison et total ;
  - paiement maintenu en attente ;
  - décrément du stock, commande visible dans l’administration ;
  - rejet du dépassement de stock sans décrément supplémentaire ;
  - changement de statut avec historique ;
  - absence d’accès anonyme aux commandes ;
  - modification de l’accueil et restauration des réglages ;
  - consentement newsletter obligatoire ;
  - masquage d’un produit dans le catalogue public.

## Portée

Ces tests de service ne remplacent pas une recette commerciale complète. Le navigateur a confirmé l’ouverture de la fiche et l’ajout au panier ; un parcours graphique complet jusqu’à la commande et l’édition administrative n’est pas encore entièrement vérifié. Le test de commande complet a été effectué par HTTP sur la base locale. Les paiements réels, emails et hébergements Supabase/Vercel ne sont pas intégrés et ne sont donc pas testés. Les fonctions manquantes et procédures de portage sont décrites dans le README.

Le test de dépassement de stock cumulé sur deux variantes a aussi confirmé le rollback atomique de la transaction D1.
