import { Store } from "@tauri-apps/plugin-store"

let store: Store | null = null

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load("octane.json", { defaults: {}, autoSave: true })
  }
  return store
}

export async function storeGet<T>(key: string): Promise<T | undefined> {
  const s = await getStore()
  return await s.get<T>(key)
}

export async function storeSet(key: string, value: unknown): Promise<void> {
  const s = await getStore()
  await s.set(key, value)
}

export async function storeRemove(key: string): Promise<void> {
  const s = await getStore()
  await s.delete(key)
}
