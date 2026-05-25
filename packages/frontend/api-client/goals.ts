import { Goal, GoalStatus } from '@/db/types';
import { BASE_URL } from './config';

export interface RemoteGoal {
  id: number;
  title: string;
  description: string | null;
  deadline: string | null;
  created_at: string;
  status: GoalStatus;
}

export async function listGoals(userId: number): Promise<RemoteGoal[]> {
  const res = await fetch(`${BASE_URL}/goals`, {
    headers: { 'X-User-ID': String(userId) },
  });
  if (!res.ok) throw new Error(`Failed to list goals: ${res.status}`);
  return res.json();
}

export async function createGoal(goal: Omit<Goal, 'id' | 'remote_id' | 'synced'>, userId: number): Promise<RemoteGoal> {
  const res = await fetch(`${BASE_URL}/goals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-ID': String(userId) },
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

export async function updateGoal(remoteId: number, data: Partial<Pick<Goal, 'title' | 'description' | 'deadline' | 'status'>>, userId: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/goals/${remoteId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-User-ID': String(userId) },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error(`Failed to update goal: ${res.status}`);
}
