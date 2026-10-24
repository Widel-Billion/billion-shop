'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {ImagePlus, LoaderCircle} from 'lucide-react';
import {MAX_IMAGE_BYTES} from '@/lib/product-images';

async function preparePhoto(file: File): Promise<Blob> {
  if (!file.size) throw new Error('Cette photo est vide. Choisissez une autre image.');
  if (file.size > 25 * 1024 * 1024) throw new Error('Choisissez une photo de moins de 25 Mo.');
  const url = URL.createObjectURL(file);
  try {
    const photo = new Image();
    await new Promise<void>((resolve, reject) => {
      photo.onload = () => resolve();
      photo.onerror = () => reject(new Error('Cette photo ne peut pas être lue. Essayez une version JPEG, PNG ou WebP.'));
      photo.src = url;
    });
    if (!photo.naturalWidth || !photo.naturalHeight) throw new Error('Image invalide.');
    const scale = Math.min(1, 2000 / Math.max(photo.naturalWidth, photo.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Impossible de préparer la photo sur cet appareil.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(photo, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      value => value ? resolve(value) : reject(new Error('Impossible de préparer la photo.')),
      'image/jpeg', 0.88
    ));
    if (blob.size > MAX_IMAGE_BYTES) throw new Error('La photo est trop volumineuse. Choisissez une image plus petite.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Props = {
  value: string;
  disabled: boolean;
  onChange: (url: string) => void;
  onBusyChange: (busy: boolean) => void;
};

export default function ProductPhotoInput({value, disabled, onChange, onBusyChange}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const active = useRef(true);
  const id = useId();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; controller.current?.abort(); };
  }, []);

  async function upload(file?: File) {
    if (!file || uploading || disabled) return;
    setUploading(true);
    onBusyChange(true);
    setError('');
    setMessage('Préparation de la photo…');
    const abort = new AbortController();
    controller.current = abort;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const blob = await preparePhoto(file);
      if (!active.current) return;
      setMessage('Importation de la photo…');
      timeout = setTimeout(() => abort.abort(), 90000);
      const data = new FormData();
      data.append('photo', blob, 'photo-produit.jpg');
      const response = await fetch('/api/product-images', {method: 'POST', body: data, signal: abort.signal});
      const result = await response.json().catch(() => ({})) as {url?: string; error?: string};
      if (!response.ok || !result.url) throw new Error(result.error || 'Importation impossible. Vérifiez votre connexion et réessayez.');
      if (!active.current) return;
      onChange(result.url);
      setMessage('Photo prête. Enregistrez le produit pour la publier.');
    } catch (cause) {
      if (active.current) {
        setMessage('');
        setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'Importation interrompue. Vérifiez votre connexion et réessayez.');
      }
    } finally {
      if (timeout) clearTimeout(timeout);
      if (active.current) { setUploading(false); onBusyChange(false); }
    }
  }

  return <fieldset className="product-photo-editor" aria-busy={uploading}>
    <legend>Photo du produit</legend>
    <div className="product-photo-preview">
      {value ? <img src={value} alt="Aperçu de la photo du produit"/> : <span>Aucune photo sélectionnée</span>}
    </div>
    <input ref={input} id={id} type="file" accept="image/*" hidden disabled={disabled || uploading}
      onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void upload(file); }}/>
    <button type="button" className="button photo-choose" disabled={disabled || uploading} aria-controls={id}
      onClick={() => input.current?.click()}>
      {uploading ? <LoaderCircle size={19} className="photo-spinner"/> : <ImagePlus size={19}/>}
      {uploading ? 'IMPORTATION…' : value ? 'CHANGER LA PHOTO' : 'CHOISIR UNE PHOTO'}
    </button>
    <p className="photo-help">Choisissez une photo dans votre galerie ou vos fichiers. Elle sera optimisée automatiquement.</p>
    <p className="photo-feedback" role="status">{message}</p>
    {error && <p className="photo-error" role="alert">{error}</p>}
    <details className="photo-link-option">
      <summary>Utiliser un lien d’image (facultatif)</summary>
      <label>Adresse de l’image<input type="text" inputMode="url" autoCapitalize="none" spellCheck={false}
        disabled={disabled || uploading} value={value} placeholder="https://…"
        onChange={event => { onChange(event.target.value); setMessage(''); setError(''); }}/></label>
    </details>
  </fieldset>;
}
