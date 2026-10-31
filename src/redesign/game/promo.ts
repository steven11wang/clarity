// Founding-member codes, for the Governor's School where Clarity was born.
//
// The preview checks a code against SHA-256 hashes, so the code itself isn't
// sitting in the page source. A check in the browser can still be skipped by
// anyone who edits their own save, which is fine for a cosmetic and some drops
// on one device. Online, redemption goes through redeem_founder_code() in
// supabase/migrations/202610300002_founder_codes.sql: one per account, with a
// use cap and an end date the owner sets.

/** SHA-256 of the normalised default code (the owner has it; it isn't written down here). */
const DEFAULT_HASH = '443efc91d3662a20a688c0224ce88af0d365c188c392088234e2e43159fddb1f'

function hashes(): string[] {
  const fromEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_FOUNDER_CODE_SHA256
  return fromEnv ? [fromEnv.toLowerCase(), DEFAULT_HASH] : [DEFAULT_HASH]
}

/** Codes read aloud get typed every which way: case, spaces and dashes don't matter. */
export function normaliseCode(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export async function sha256(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function isFounderCode(text: string, known: string[] = hashes()): Promise<boolean> {
  const code = normaliseCode(text)
  if (code.length < 4 || code.length > 32) return false
  return known.includes(await sha256(code))
}
