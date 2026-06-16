import { Goal, GoalStatus } from '@/db/types';
import { apiFetch } from './client';

export interface RemoteGoal {
  id: number;
  title: string;
  description: string | null;
  deadline: string | null;
  created_at: string;
  status: GoalStatus;
}

export async function listGoals(limit = 100, offset = 0): Promise<RemoteGoal[]> {
  const res = await apiFetch(`/goals?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error(`Failed to list goals: ${res.status}`);
  return res.json();
}

export async function createGoal(goal: Omit<Goal, 'id' | 'remote_id' | 'synced'>): Promise<RemoteGoal> {
  const res = await apiFetch('/goals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title:       goal.title,
      description: goal.description,
      deadline:    goal.deadline,
      status:      goal.status,
      created_at:  goal.created_at,
    }),
  });

  if (!res.ok) throw new Error(`Failed to create goal: ${res.status}`);
  return res.json();
}

export async function updateGoal(remoteId: number, data: Partial<Pick<Goal, 'title' | 'description' | 'deadline' | 'status'>>): Promise<void> {
  const res = await apiFetch(`/goals/${remoteId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error(`Failed to update goal: ${res.status}`);
}

export async function deleteGoal(remoteId: number): Promise<void> {
  const res = await apiFetch(`/goals/${remoteId}`, { method: 'DELETE' });

  // 404 means the goal is already gone on the backend — treat as success.
  if (!res.ok && res.status !== 404) throw new Error(`Failed to delete goal: ${res.status}`);
}
