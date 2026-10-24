import {env} from 'cloudflare:workers';

export function identity(request: Request) {
  return request.headers.get('oai-authenticated-user-id') || '';
}

export function admin(request: Request) {
  const email = (env as unknown as Record<string, string>).ADMIN_EMAIL;
  return !!identity(request) && !!email && request.headers.get('oai-authenticated-user-email') === email;
}
