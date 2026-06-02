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

export async function listGoals(): Promise<RemoteGoal[]> {
  const res = await apiFetch('/goals');
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
