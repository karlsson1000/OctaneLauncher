import { untrack } from "svelte"

type ToastType = "success" | "error" | "info"

interface Toast {
  id: number
  type: ToastType
  message: string
}

type ProgressStatus = "creating" | "success" | "error"

interface ProgressToast {
  id: string
  title: string
  stage: string
  progress: number
  status: ProgressStatus
}

export const toastStore = $state<{ toasts: Toast[]; progress: ProgressToast[] }>({ toasts: [], progress: [] })

let nextId = 1

export function showToast(type: ToastType, message: string, duration = 10000) {
  untrack(() => {
    const id = nextId++
    toastStore.toasts.push({ id, type, message })
    if (toastStore.toasts.length > 5) toastStore.toasts.shift()
    setTimeout(() => dismissToast(id), duration)
  })
}

export function dismissToast(id: number) {
  untrack(() => {
    const index = toastStore.toasts.findIndex(t => t.id === id)
    if (index !== -1) toastStore.toasts.splice(index, 1)
  })
}

export function upsertProgress(entry: ProgressToast) {
  untrack(() => {
    const existing = toastStore.progress.find(p => p.id === entry.id)
    if (existing) {
      existing.title = entry.title
      existing.stage = entry.stage
      existing.progress = entry.progress
      existing.status = entry.status
    } else {
      toastStore.progress.push(entry)
    }
  })
}

export function dismissProgress(id: string) {
  untrack(() => {
    const index = toastStore.progress.findIndex(p => p.id === id)
    if (index !== -1) toastStore.progress.splice(index, 1)
  })
}
