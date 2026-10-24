import {env} from 'cloudflare:workers';
import {isAdministrator} from './access-policy';

export function identity(request: Request) {
  return request.headers.get('oai-authenticated-user-id') || '';
}

export function isAdminUser(user: {userId: string; email: string} | null) {
  const email = (env as unknown as Record<string, string>).ADMIN_EMAIL;
  return isAdministrator(user?.userId, user?.email, email);
}

export function admin(request: Request) {
  return isAdminUser({userId: identity(request), email: request.headers.get('oai-authenticated-user-email') || ''});
}
