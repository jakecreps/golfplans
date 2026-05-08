import { Plan } from './types';

const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function planKey(id: string) {
  return `golfplan_${id}`;
}

export function getPlan(id: string): Plan | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(planKey(id));
    if (!raw) return undefined;
    const plan: Plan = JSON.parse(raw);
    // Expire after 24 hours (unless noExpiry is set)
    if (!plan.noExpiry && Date.now() - new Date(plan.createdAt).getTime() > EXPIRY_MS) {
      localStorage.removeItem(planKey(id));
      return undefined;
    }
    return plan;
  } catch {
    return undefined;
  }
}

export function savePlan(plan: Plan): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(planKey(plan.id), JSON.stringify(plan));
}

export function isPlanExpired(plan: Plan): boolean {
  if (plan.noExpiry) return false;
  return Date.now() - new Date(plan.createdAt).getTime() > EXPIRY_MS;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
