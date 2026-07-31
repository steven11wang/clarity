const env = (import.meta as ImportMeta & {
  env?: Record<string, string | undefined>
}).env ?? {}

const base = (env.BASE_URL ?? '/').replace(/\/$/, '')

export function assetPath(path: string): string {
  return `${base}/${path.replace(/^\//, '')}`
}
