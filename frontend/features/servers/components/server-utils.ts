export const DEFAULT_PORT = 25565
export const ROW_HEIGHT = 100

export const formatAddress = (address: string, port: number) =>
  port === DEFAULT_PORT ? address : `${address}:${port}`

export const pingColor = (ping: number) =>
  ping < 80 ? "#16a34a" : ping < 200 ? "#eab308" : "#e93636"

export function joinButtonClass(launching: boolean, online: boolean) {
  if (launching) return "bg-red-500/10 text-red-400 cursor-not-allowed"
  if (online) return "bg-[#16a34a] hover:bg-[#15803d] text-[#181a1f]"
  return "bg-[var(--bg-hover-strong)] text-[var(--text-muted)] cursor-not-allowed"
}
