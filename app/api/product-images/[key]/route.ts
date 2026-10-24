import {env} from 'cloudflare:workers';
import {imageKeyPattern} from '@/lib/product-images';

export const dynamic = 'force-dynamic';
export async function GET(_request: Request, {params}: {params: Promise<{key: string}>}) {
  const {key} = await params;
  if (!imageKeyPattern.test(key)) return new Response('Photo introuvable.', {status: 404});
  if (!env.BUCKET) return new Response('Stockage indisponible.', {status: 503});
  const object = await env.BUCKET.get('products/' + key);
  if (!object) return new Response('Photo introuvable.', {status: 404});
  const type = key.endsWith('.png') ? 'image/png' : key.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  return new Response(object.body, {headers: {
    'Content-Type': type,
    'Content-Length': String(object.size),
    'Cache-Control': 'public, max-age=31536000, immutable',
    'ETag': object.httpEtag,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  }});
}
