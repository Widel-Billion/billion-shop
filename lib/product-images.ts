export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const imageKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;
export const imagePathPattern = /^\/api\/product-images\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export function imageFormat(bytes: Uint8Array) {
  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return {type: 'image/jpeg', extension: 'jpg'};
  if (bytes.length >= 24 && [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)
    && String.fromCharCode(...bytes.slice(12,16)) === 'IHDR')
    return {type: 'image/png', extension: 'png'};
  if (bytes.length >= 16 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP')
    return {type: 'image/webp', extension: 'webp'};
  return null;
}
