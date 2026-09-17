import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'

import { AIAssistant } from '@/features/ai'

const aiSearchSchema = z.object({
  task: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/ai/')({
  validateSearch: aiSearchSchema,
  component: AIAssistant,
})
