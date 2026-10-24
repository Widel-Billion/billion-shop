import Home from '../page';
import AdminAccess from '@/components/admin-access';
import {getChatGPTUser} from '../chatgpt-auth';
import {isAdminUser} from '@/lib/shop-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminPage() {
  const user = await getChatGPTUser();
  if (!isAdminUser(user)) return <AdminAccess user={user ? {email: user.email} : null}/>;
  return <Home initialView="admin"/>;
}
