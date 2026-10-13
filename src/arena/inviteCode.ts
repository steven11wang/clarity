// Invite codes are six characters from an alphabet with the look-alikes left
// out (no 0/O, 1/I/L), so a code read aloud or typed from a screenshot works.
export const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const INVITE_CODE_LENGTH = 6

/** Reads a friend's code out of whatever got pasted: the bare code, the code in
 *  any case with spaces or dashes, or the whole invite link (?arena=CODE).
 *  Returns null when nothing in it can be a code. */
export function parseInviteCode(input: string): string | null {
  const text = input.trim()
  if (!text) return null

  const fromLink = /[?&]arena=([A-Za-z0-9]+)/.exec(text)
  const raw = fromLink ? fromLink[1] : text
  const code = raw.toUpperCase().replace(/[\s-]+/g, '')

  if (code.length !== INVITE_CODE_LENGTH) return null
  for (const char of code) if (!INVITE_ALPHABET.includes(char)) return null
  return code
}
