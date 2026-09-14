import { useEffect, useRef, useState } from 'react'
import {
  Check,
  Download,
  FileArchive,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { Main } from '@/components/layout/main'
import { PageLoading } from '@/components/layout/page-loading'
import {
  AgentSelector,
  type Agent,
  type AgentModel,
} from './components/agent-selector'
import {
  useAgentTasks,
  type AgentTask,
} from './components/agent-tasks-provider'

const API_URL = 'http://localhost:8080'

const MAX_FILE_SIZE = 10 * 1024 * 1024

const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]

// ============================================================
// TYPES
// ============================================================

type GeneratedFile = {
  id: number
  name: string
  size: number
  blobUrl: string
}

type Message = {
  id: number
  role: 'user' | 'agent'
  content: string
  file?: GeneratedFile

  // Informasi model yang digunakan
  model?: string
  modelId?: number
  provider?: string
}

type ChatHistoryItem = {
  role: 'user' | 'assistant'
  content: string
}

type ChatResult = {
  message: string
  model: string
  modelId: number
  provider: string
  agentId: number
}

type WorkflowStep = 'goal' | 'planning' | 'coding' | 'testing' | 'done'

const workflowSteps: WorkflowStep[] = [
  'goal',
  'planning',
  'coding',
  'testing',
  'done',
]

const workflowLabels: Record<WorkflowStep, string> = {
  goal: 'Understand',
  planning: 'Planning',
  coding: 'Working',
  testing: 'Testing',
  done: 'Completed',
}

// ============================================================
// HELPERS
// ============================================================

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

// ============================================================
// COMPONENT
// ============================================================

export function AIAssistant() {
  const { addTasks } = useAgentTasks()

  const accessToken = useAuthStore((state) => state.auth.accessToken)

  // ============================================================
  // STATE
  // ============================================================

  const [loading, setLoading] = useState(true)

  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)

  const [selectedModel, setSelectedModel] = useState<AgentModel | null>(null)

  const [message, setMessage] = useState('')

  const [messages, setMessages] = useState<Message[]>([])

  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const [running, setRunning] = useState(false)

  const [currentStep, setCurrentStep] = useState<WorkflowStep | null>(null)

  const [progress, setProgress] = useState(0)

  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)

  const [taskTitle, setTaskTitle] = useState('')

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const generatedUrlsRef = useRef<Set<string>>(new Set())

  // ============================================================
  // PAGE LOADING
  // ============================================================

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  // ============================================================
  // CLEANUP GENERATED URL
  // ============================================================

  useEffect(() => {
    return () => {
      generatedUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url)
      })
    }
  }, [])

  // ============================================================
  // CLEAR GENERATED URL
  // ============================================================

  const clearGeneratedUrls = () => {
    generatedUrlsRef.current.forEach((url) => {
      URL.revokeObjectURL(url)
    })

    generatedUrlsRef.current.clear()
  }

  // ============================================================
  // ADD AGENT MESSAGE
  // ============================================================

  const addAgentMessage = (
    content: string,
    options?: {
      file?: GeneratedFile
      model?: string
      modelId?: number
      provider?: string
    }
  ) => {
    setMessages((current) => [
      ...current,
      {
        id: Date.now() + Math.random(),

        role: 'agent',

        content,

        file: options?.file,

        model: options?.model,

        modelId: options?.modelId,

        provider: options?.provider,
      },
    ])
  }

  // ============================================================
  // NEW CHAT
  // ============================================================

  const handleNewChat = () => {
    if (running) {
      return
    }

    clearGeneratedUrls()

    setMessages([])
    setMessage('')
    setSelectedFiles([])

    setCurrentStep(null)
    setProgress(0)

    setCurrentTaskId(null)
    setTaskTitle('')
  }

  // ============================================================
  // SELECT FILES
  // ============================================================

  const handleSelectFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])

    const valid: File[] = []

    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        continue
      }

      if (file.size > MAX_FILE_SIZE) {
        continue
      }

      valid.push(file)
    }

    setSelectedFiles((current) => [...current, ...valid])

    event.target.value = ''
  }

  // ============================================================
  // REMOVE FILE
  // ============================================================

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((current) => current.filter((_, i) => i !== index))
  }

  // ============================================================
  // AI PLANNER
  // ============================================================

  const planAgent = async (
    text: string,
    history: ChatHistoryItem[],
    hasImage: boolean
  ) => {
    const response = await fetch(`${API_URL}/api/agent/plan`, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',

        ...(accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
            }
          : {}),
      },

      body: JSON.stringify({
        message: text,
        history,
        has_image: hasImage,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(
        data?.error || data?.message || 'Gagal menentukan task AI.'
      )
    }

    return data
  }

  // ============================================================
  // CHAT
  // ============================================================

  const sendChat = async (
    text: string,
    files: File[],
    history: ChatHistoryItem[],
    agentId: number,
    modelId?: number
  ): Promise<ChatResult> => {
    const formData = new FormData()

    // ----------------------------------------------------------
    // MESSAGE
    // ----------------------------------------------------------

    formData.append('message', text)

    // ----------------------------------------------------------
    // HISTORY
    // ----------------------------------------------------------

    formData.append('history', JSON.stringify(history))

    // ----------------------------------------------------------
    // AGENT ID
    // ----------------------------------------------------------

    formData.append('agent_id', String(agentId))

    // ----------------------------------------------------------
    // MODEL ID
    // ----------------------------------------------------------

    if (modelId && modelId > 0) {
      formData.append('model_id', String(modelId))
    }

    // ----------------------------------------------------------
    // IMAGES
    // ----------------------------------------------------------

    files.forEach((file) => {
      formData.append('images', file)
    })

    // ----------------------------------------------------------
    // HEADERS
    // ----------------------------------------------------------

    const headers: HeadersInit = {}

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    // ----------------------------------------------------------
    // REQUEST
    // ----------------------------------------------------------

    console.log('[CHAT REQUEST]', {
      agentId,
      modelId,
      message: text,
    })

    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers,
      body: formData,
    })

    // ----------------------------------------------------------
    // RESPONSE JSON
    // ----------------------------------------------------------

    const data = await response.json()

    // ----------------------------------------------------------
    // ERROR
    // ----------------------------------------------------------

    if (!response.ok) {
      throw new Error(
        data?.error || data?.message || 'Gagal mendapatkan jawaban AI.'
      )
    }

    // ----------------------------------------------------------
    // VALIDATE MESSAGE
    // ----------------------------------------------------------

    if (!data?.message) {
      throw new Error('AI mengembalikan jawaban kosong.')
    }

    // ----------------------------------------------------------
    // NORMALIZE RESULT
    // ----------------------------------------------------------

    const result: ChatResult = {
      message: String(data.message),

      model: String(data.model || selectedModel?.model_id || 'unknown'),

      modelId: Number(data.model_id || modelId || 0),

      provider: String(
        data.provider || selectedModel?.provider?.name || 'Unknown Provider'
      ),

      agentId: Number(data.agent_id || agentId),
    }

    // ----------------------------------------------------------
    // DEBUG
    // ----------------------------------------------------------

    console.log('[CHAT RESPONSE]', result)

    return result
  }

  // ============================================================
  // GENERATOR WEBSITE
  // ============================================================

  const sendGenerator = async (text: string, agent: Agent, files: File[]) => {
    const taskId = `TASK-${String(Date.now()).slice(-5)}`

    setCurrentTaskId(taskId)

    setTaskTitle(text)

    // --------------------------------------------------------
    // GOAL
    // --------------------------------------------------------

    setCurrentStep('goal')
    setProgress(20)

    const formData = new FormData()

    formData.append('prompt', text)

    // --------------------------------------------------------
    // AGENT
    // --------------------------------------------------------

    formData.append('agent_id', String(agent.id))

    // --------------------------------------------------------
    // MODEL
    // --------------------------------------------------------

    if (selectedModel?.id) {
      formData.append('model_id', String(selectedModel.id))
    }

    // --------------------------------------------------------
    // IMAGES
    // --------------------------------------------------------

    files.forEach((file) => {
      formData.append('images', file)
    })

    const headers: HeadersInit = {}

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    // --------------------------------------------------------
    // PLANNING
    // --------------------------------------------------------

    setCurrentStep('planning')

    setProgress(35)

    const response = await fetch(`${API_URL}/api/generator/landing-page`, {
      method: 'POST',
      headers,
      body: formData,
    })

    if (!response.ok) {
      let errorMessage = 'Generator gagal.'

      try {
        const error = await response.json()

        errorMessage = error?.error || error?.message || errorMessage
      } catch {}

      throw new Error(errorMessage)
    }

    // --------------------------------------------------------
    // CODING
    // --------------------------------------------------------

    setCurrentStep('coding')

    setProgress(70)

    const blob = await response.blob()

    if (blob.size === 0) {
      throw new Error('File ZIP kosong.')
    }

    // --------------------------------------------------------
    // TESTING
    // --------------------------------------------------------

    setCurrentStep('testing')

    setProgress(90)

    const blobUrl = URL.createObjectURL(blob)

    generatedUrlsRef.current.add(blobUrl)

    const generatedFile: GeneratedFile = {
      id: Date.now(),

      name: 'landing-page.zip',

      size: blob.size,

      blobUrl,
    }

    // --------------------------------------------------------
    // DONE
    // --------------------------------------------------------

    setCurrentStep('done')
    setProgress(100)

    const completedTask: AgentTask = {
      id: taskId,
      title: text,
      status: 'done',
      label: 'feature',
      priority: 'medium',
      description: text,
    }

    addTasks([completedTask])

    return generatedFile
  }

  // ============================================================
  // SEND MESSAGE
  // ============================================================

  const handleSend = async () => {
    const text = message.trim()

    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (!text || !selectedAgent || !selectedModel || running) {
      return
    }

    const files = [...selectedFiles]

    // --------------------------------------------------------
    // HISTORY BEFORE CURRENT MESSAGE
    // --------------------------------------------------------

    const history: ChatHistoryItem[] = messages.map((item) => ({
      role: item.role === 'user' ? 'user' : 'assistant',

      content: item.content,
    }))

    // --------------------------------------------------------
    // SHOW USER MESSAGE
    // --------------------------------------------------------

    setMessages((current) => [
      ...current,
      {
        id: Date.now(),

        role: 'user',

        content: text,
      },
    ])

    setMessage('')
    setSelectedFiles([])

    setRunning(true)

    try {
      // ======================================================
      // PLAN
      // ======================================================

      const plan = await planAgent(text, history, files.length > 0)

      console.log('[AGENT PLAN]', plan)

      // ======================================================
      // GENERATOR
      // ======================================================

      if (plan.intent === 'generator') {
        const generated = await sendGenerator(text, selectedAgent, files)

        addAgentMessage(
          'Website berhasil dibuat. Kamu bisa mengunduh file ZIP di bawah ini.',
          {
            file: generated,
          }
        )
      }

      // ======================================================
      // NORMAL CHAT
      // ======================================================
      else {
        const result = await sendChat(
          text,
          files,
          history,
          selectedAgent.id,
          selectedModel.id
        )

        addAgentMessage(result.message, {
          model: result.model,

          modelId: result.modelId,

          provider: result.provider,
        })
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Terjadi kesalahan.'

      addAgentMessage(`Maaf, terjadi kesalahan.\n\n${errorMessage}`)
    } finally {
      setRunning(false)

      setTimeout(() => {
        setCurrentStep(null)
        setProgress(0)
      }, 1000)
    }
  }

  // ============================================================
  // WORKFLOW INDEX
  // ============================================================

  const currentStepIndex =
    currentStep === null ? -1 : workflowSteps.indexOf(currentStep)

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return <PageLoading />
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <Main className='flex min-h-0 flex-1 flex-col overflow-hidden p-0'>
      <div className='flex min-h-0 flex-1 flex-col'>
        {/* ======================================================
            HEADER
        ====================================================== */}

        <header className='shrink-0 border-b bg-background'>
          <div className='mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6'>
            <div className='flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary'>
              <Sparkles className='size-4' />
            </div>

            <div className='flex-1'>
              <AgentSelector
                selectedAgent={selectedAgent}
                onSelect={setSelectedAgent}
                selectedModel={selectedModel}
                onModelSelect={setSelectedModel}
              />
            </div>

            <button
              type='button'
              onClick={handleNewChat}
              disabled={running}
              className='flex h-9 items-center gap-2 rounded-lg border px-3 text-sm hover:bg-muted disabled:opacity-50'
            >
              <Plus className='size-4' />

              <span className='hidden sm:inline'>New Chat</span>
            </button>
          </div>
        </header>

        {/* ======================================================
            WORKFLOW PROGRESS
        ====================================================== */}

        {currentStep && (
          <div className='shrink-0 border-b bg-muted/30'>
            <div className='mx-auto w-full max-w-4xl px-4 py-3'>
              <div className='mb-2 flex justify-between text-xs'>
                <span>{currentTaskId}</span>

                <span>{progress}%</span>
              </div>

              <div className='mb-3 h-1.5 overflow-hidden rounded-full bg-muted'>
                <div
                  className='h-full rounded-full bg-primary transition-all'
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>

              <div className='flex justify-between'>
                {workflowSteps.map((step, index) => {
                  const done = index < currentStepIndex

                  const active = index === currentStepIndex

                  return (
                    <div key={step} className='flex items-center gap-2'>
                      <div
                        className={`flex size-7 items-center justify-center rounded-full border text-xs ${
                          done || active
                            ? 'border-primary bg-primary text-primary-foreground'
                            : ''
                        }`}
                      >
                        {done ? <Check className='size-3' /> : index + 1}
                      </div>

                      <span className='hidden text-xs sm:block'>
                        {workflowLabels[step]}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================
            CHAT AREA
        ====================================================== */}

        <div className='min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6'>
          <div className='mx-auto flex w-full max-w-4xl flex-col'>
            {messages.length === 0 ? (
              <div className='flex min-h-[55vh] flex-col items-center justify-center text-center'>
                <div className='mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary'>
                  <Sparkles className='size-7' />
                </div>

                <h1 className='text-2xl font-semibold'>
                  Apa yang ingin kamu tanyakan?
                </h1>

                <p className='mt-2 max-w-lg text-sm text-muted-foreground'>
                  Chat dengan AI, tanyakan apa saja, upload gambar untuk
                  dianalisis, atau minta AI membuat landing page.
                </p>

                {selectedAgent && selectedModel && (
                  <div className='mt-4 rounded-lg border bg-muted/30 px-4 py-2 text-xs text-muted-foreground'>
                    {selectedAgent.name}
                    {' · '}
                    {selectedModel.name}
                    {' · '}
                    {selectedModel.provider?.name}
                  </div>
                )}
              </div>
            ) : (
              <div className='flex flex-col gap-5'>
                {messages.map((item) => (
                  <div
                    key={item.id}
                    className={`flex gap-3 ${
                      item.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {/* AI ICON */}

                    {item.role === 'agent' && (
                      <div className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                        <Sparkles className='size-4' />
                      </div>
                    )}

                    <div className='max-w-[80%]'>
                      <div
                        className={`rounded-xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap ${
                          item.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'border bg-muted/40'
                        }`}
                      >
                        {item.content}

                        {/* ====================================
                              GENERATED ZIP
                          ==================================== */}

                        {item.file && (
                          <div className='mt-4 flex items-center gap-3 rounded-lg border bg-background p-3'>
                            <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                              <FileArchive className='size-5' />
                            </div>

                            <div className='min-w-0 flex-1'>
                              <p className='truncate font-medium text-foreground'>
                                {item.file.name}
                              </p>

                              <p className='text-xs text-muted-foreground'>
                                {formatFileSize(item.file.size)}
                              </p>
                            </div>

                            <a
                              href={item.file.blobUrl}
                              download={item.file.name}
                              className='flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground'
                            >
                              <Download className='size-4' />
                              Download
                            </a>
                          </div>
                        )}

                        {/* ====================================
                              MODEL INFO
                          ==================================== */}

                        {item.role === 'agent' && item.model && (
                          <div className='mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground'>
                            <span>Model:</span>

                            <span className='font-medium text-foreground'>
                              {item.model}
                            </span>

                            {item.provider && (
                              <>
                                <span>·</span>

                                <span>{item.provider}</span>
                              </>
                            )}

                            {item.modelId && item.modelId > 0 && (
                              <>
                                <span>·</span>

                                <span>ID {item.modelId}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* USER ICON */}

                    {item.role === 'user' && (
                      <div className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted'>
                        <User className='size-4' />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ======================================================
            INPUT
        ====================================================== */}

        <div className='shrink-0 border-t bg-background px-4 py-4 sm:px-6'>
          <div className='mx-auto w-full max-w-4xl'>
            {/* ==================================================
                SELECTED FILES
            ================================================== */}

            {selectedFiles.length > 0 && (
              <div className='mb-3 flex flex-wrap gap-2'>
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className='flex items-center gap-2 rounded-lg border px-3 py-2 text-xs'
                  >
                    <FileArchive className='size-4 text-primary' />

                    <span className='max-w-[150px] truncate'>{file.name}</span>

                    <button
                      onClick={() => handleRemoveFile(index)}
                      type='button'
                    >
                      <X className='size-3' />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ==================================================
                TEXTAREA
            ================================================== */}

            <div className='rounded-xl border bg-background'>
              <textarea
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()

                    handleSend()
                  }
                }}
                disabled={!selectedAgent || !selectedModel || running}
                placeholder={
                  !selectedAgent
                    ? 'Pilih Virtual Employee terlebih dahulu...'
                    : !selectedModel
                      ? 'Pilih model terlebih dahulu...'
                      : running
                        ? 'AI sedang memproses...'
                        : `Tulis pesan untuk ${selectedModel.name}...`
                }
                className='min-h-[80px] w-full resize-none border-0 bg-transparent px-4 py-3 text-sm outline-none'
              />

              <div className='flex items-center justify-between px-3 pb-3'>
                {/* FILE INPUT */}

                <input
                  ref={fileInputRef}
                  type='file'
                  accept='image/png,image/jpeg,image/jpg,image/webp,image/gif'
                  multiple
                  onChange={handleSelectFiles}
                  className='hidden'
                />

                <button
                  type='button'
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!selectedAgent || !selectedModel || running}
                  className='flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40'
                >
                  <Paperclip className='size-4' />
                </button>

                {/* SEND */}

                <button
                  type='button'
                  onClick={handleSend}
                  disabled={
                    !selectedAgent ||
                    !selectedModel ||
                    !message.trim() ||
                    running
                  }
                  className='flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40'
                >
                  <Send className='size-4' />
                </button>
              </div>
            </div>

            {/* ==================================================
                STATUS
            ================================================== */}

            <div className='mt-2 text-center text-xs text-muted-foreground'>
              {running && selectedAgent
                ? `${selectedAgent.name} sedang berpikir${
                    selectedModel ? ` dengan ${selectedModel.name}` : ''
                  }...`
                : selectedAgent && selectedModel
                  ? `${selectedAgent.name} · ${selectedModel.name} siap digunakan`
                  : selectedAgent
                    ? `${selectedAgent.name} · Pilih model`
                    : 'Pilih Virtual Employee'}
            </div>
          </div>
        </div>
      </div>
    </Main>
  )
}

export default AIAssistant
