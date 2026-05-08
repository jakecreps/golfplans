import { Plan } from './types';

const EXPIRY_MS = 24 * 60 * 60 * 1000;
const BASE = 'https://api.jsonbin.io/v3/b';
const KEY = '$2a$10$ixUufdzLaQe6HMo0.xwUvObGhSIlVlaL/92ellmgl6jbDJB7blr1y';

export function isPlanExpired(plan: Plan): boolean {
  return Date.now() - new Date(plan.createdAt).getTime() > EXPIRY_MS;
}

export async function createPlan(plan: Omit<Plan, 'id'>): Promise<Plan> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': KEY,
      'X-Bin-Private': 'true',
    },
    body: JSON.stringify(plan),
  });
  if (!res.ok) throw new Error('Failed to create plan');
  const data = await res.json();
  const created: Plan = { ...(plan as Plan), id: data.metadata.id };
  // Write the id back into the record so it's self-contained
  await savePlan(created);
  return created;
}

export async function getPlan(id: string): Promise<Plan | undefined> {
  try {
    const res = await fetch(`${BASE}/${id}`, {
      headers: { 'X-Master-Key': KEY },
      cache: 'no-store',
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    const plan: Plan = data.record;
    if (isPlanExpired(plan)) return undefined;
    return plan;
  } catch {
    return undefined;
  }
}

export async function savePlan(plan: Plan): Promise<void> {
  const res = await fetch(`${BASE}/${plan.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': KEY,
    },
    body: JSON.stringify(plan),
  });
  if (!res.ok) throw new Error('Failed to save plan');
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
