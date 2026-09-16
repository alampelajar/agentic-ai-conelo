import { apiFetch } from '@/lib/api'

export type TaskStatus = 'todo' | 'in progress' | 'done' | 'canceled' | 'backlog'
export type TaskLabel = 'bug' | 'feature' | 'documentation'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export type BackendTask = {
  id: number
  title: string
  description: string
  status: TaskStatus
  label: TaskLabel
  priority: TaskPriority
  agent_id?: number | null
  agent?: { id: number; name: string; slug: string } | null
  created_at: string
  updated_at: string
}

async function readJSON(response: Response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error || data?.message || 'Request failed')
  return data
}

export async function getTasks() {
  const response = await apiFetch('/api/tasks')
  const data = await readJSON(response)
  return (data.tasks ?? []) as BackendTask[]
}

export async function createTask(payload: Partial<BackendTask>) {
  const response = await apiFetch('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: payload.title,
      description: payload.description ?? '',
      status: payload.status ?? 'todo',
      label: payload.label ?? 'feature',
      priority: payload.priority ?? 'medium',
      agent_id: payload.agent_id ?? null,
    }),
  })
  const data = await readJSON(response)
  return data.task as BackendTask
}

export async function updateTask(id: string | number, payload: Partial<BackendTask>) {
  const response = await apiFetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  const data = await readJSON(response)
  return data.task as BackendTask
}

export async function deleteTask(id: string | number) {
  const response = await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' })
  return readJSON(response)
}
