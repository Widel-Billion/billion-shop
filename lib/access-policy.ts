import type {Order} from './catalog';

export function isAdministrator(userId: string | null | undefined, email: string | null | undefined, adminEmail: string | null | undefined) {
  return !!userId?.trim() && !!email?.trim() && !!adminEmail?.trim()
    && email.trim().toLowerCase() === adminEmail.trim().toLowerCase();
}

export function accountOrders(orders: Order[], localOrders: Order[], userId: string | null) {
  const visible = userId ? orders.filter(order => order.owner === userId)
    : localOrders.filter(order => order.owner?.startsWith('guest-'));
  return visible.filter((order, index) => visible.findIndex(candidate => candidate.id === order.id) === index);
}
