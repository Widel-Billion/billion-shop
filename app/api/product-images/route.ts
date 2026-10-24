import {env} from 'cloudflare:workers';
import {admin} from '@/lib/shop-auth';
import {imageFormat, MAX_IMAGE_BYTES} from '@/lib/product-images';

export const dynamic = 'force-dynamic';
const json = (value: unknown, status: number) => Response.json(value, {status, headers: {'Cache-Control': 'no-store'}});
const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 64 * 1024;

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return json({error: 'Origine non autorisée.'}, 403);
  if (!admin(request)) return json({error: 'Accès administrateur requis.'}, 403);
  if (!env.BUCKET) return json({error: 'Le stockage des photos est temporairement indisponible.'}, 503);
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data'))
    return json({error: 'Sélectionnez une photo à importer.'}, 400);
  if (Number(request.headers.get('content-length')) > MAX_REQUEST_BYTES)
    return json({error: 'La photo doit peser moins de 8 Mo.'}, 413);

  // Bound the body even when the client omits Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return json({error: 'Aucune photo reçue.'}, 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return json({error: 'La photo doit peser moins de 8 Mo.'}, 413);
      }
      chunks.push(value);
    }
    const body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    const data = await new Response(body, {headers: {'Content-Type': request.headers.get('content-type')!}}).formData();
    const file = data.get('photo');
    if (!(file instanceof File) || !file.size) return json({error: 'Sélectionnez une photo non vide.'}, 400);
    if (file.size > MAX_IMAGE_BYTES) return json({error: 'La photo doit peser moins de 8 Mo.'}, 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const format = imageFormat(bytes);
    if (!format || file.type !== format.type)
      return json({error: 'Format non pris en charge. Choisissez une photo JPEG, PNG ou WebP.'}, 415);
    const key = crypto.randomUUID() + '.' + format.extension;
    await env.BUCKET.put('products/' + key, bytes, {httpMetadata: {contentType: format.type}});
    return json({url: '/api/product-images/' + key}, 201);
  } catch {
    return json({error: 'Importation impossible. Réessayez avec une photo JPEG, PNG ou WebP.'}, 400);
  } finally {
    reader.releaseLock();
  }
}
