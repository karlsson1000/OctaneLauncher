import type { ConsoleLog } from "../../../types"

export type UploadState = { loading: boolean; url: string | null; error: string | null }
export const IDLE_UPLOAD: UploadState = { loading: false, url: null, error: null }

const timestamps = new WeakMap<ConsoleLog, string>()

export function getLogTime(log: ConsoleLog): string {
  let time = timestamps.get(log)
  if (!time) {
    time = new Date().toLocaleTimeString()
    timestamps.set(log, time)
  }
  return time
}

export function getLogClass(log: ConsoleLog): string {
  const msg = log.message.toLowerCase()
  if (log.type === "stderr" || msg.includes("error") || msg.includes("failed")) return "text-red-400"
  if (msg.includes("warn")) return "text-yellow-400"
  return "text-[var(--text-primary)]"
}

export function highlightParts(message: string, query: string): { text: string; match: boolean }[] {
  const q = query.trim().toLowerCase()
  if (!q) return [{ text: message, match: false }]
  const lower = message.toLowerCase()
  const parts: { text: string; match: boolean }[] = []
  let i = 0
  while (true) {
    const idx = lower.indexOf(q, i)
    if (idx === -1) {
      if (i < message.length) parts.push({ text: message.slice(i), match: false })
      break
    }
    if (idx > i) parts.push({ text: message.slice(i, idx), match: false })
    parts.push({ text: message.slice(idx, idx + q.length), match: true })
    i = idx + q.length
  }
  return parts
}
