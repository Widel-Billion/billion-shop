export interface PaymentProvider {
  id: 'card' | 'moncash' | 'bank-transfer' | 'cash-on-delivery';
  configured: boolean;
  createPayment(orderId: string, amountCents: number, currency: 'USD' | 'HTG'): Promise<{status: 'pending'; redirectUrl?: string}>;
  verifyWebhook?(request: Request): Promise<{orderId: string; status: 'paid' | 'failed'}>;
}
// Ajouter les adaptateurs côté serveur et leurs secrets uniquement après validation du fournisseur.
// Le parcours actuel enregistre uniquement des commandes de démonstration avec paiement en attente.
export const paymentCapabilities = {card:false,moncash:false,bankTransfer:false,cashOnDeliveryTest:true} as const;
