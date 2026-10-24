'use client';

import {ShieldCheck, ArrowLeft} from 'lucide-react';

type Props = {
  user?: {email: string} | null;
  loading?: boolean;
  unavailable?: boolean;
  onRetry?: () => void;
};

export default function AdminAccess({user, loading, unavailable, onRetry}: Props) {
  return <main className="admin-access-page">
    <a href="/" className="admin-access-brand">BILLION SHOP</a>
    <section className="admin-access-card" aria-label="Accès à l’administration">
      <ShieldCheck size={36} aria-hidden="true"/>
      <p className="eyebrow">ESPACE ADMINISTRATEUR</p>
      <h1>{loading ? 'Vérification de l’accès…' : unavailable ? 'Connexion à vérifier.' : 'Accès réservé.'}</h1>
      {loading ? <p role="status">Veuillez patienter pendant la vérification de votre compte.</p>
        : unavailable ? <><p>Votre accès ne peut pas être vérifié pour le moment. Réessayez pour ouvrir le tableau de bord.</p>
          <button type="button" className="button" onClick={onRetry}>RÉESSAYER</button></>
        : user ? <><p>Vous êtes connecté avec un compte client. Ce compte ne dispose pas des droits administrateur.</p>
          <a className="button" href="/account">OUVRIR MON COMPTE CLIENT</a>
          <a className="text-link" href="/signout-with-chatgpt?return_to=%2Fadmin" target="_top">Se déconnecter pour utiliser un compte administrateur</a></>
        : <><p>Connectez-vous avec un compte administrateur autorisé pour gérer la boutique.</p>
          <a className="button" href="/signin-with-chatgpt?return_to=%2Fadmin" target="_top">CONNEXION ADMINISTRATEUR</a>
          <a className="text-link" href="/account">Accéder à mon compte client</a></>}
      <a href="/" className="admin-access-return"><ArrowLeft size={16}/>Retour à la boutique</a>
    </section>
  </main>;
}
