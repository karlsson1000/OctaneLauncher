export type Groups = Record<string, string[]>

export const DEFAULT_GROUP = "__ungrouped__"

export function buildInstanceToGroup(groups: Groups): Map<string, string> {
  const map = new Map<string, string>()
  for (const [group, names] of Object.entries(groups)) {
    for (const name of names) map.set(name, group)
  }
  return map
}

export function withoutInstance(source: Groups, instanceName: string): Groups {
  const next: Groups = {}
  for (const [group, names] of Object.entries(source)) {
    next[group] = names.filter(n => n !== instanceName)
  }
  return next
}
