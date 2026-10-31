// The Study Hall's message checks. Every typed message is checked twice: by
// the sender before it leaves, and by every receiver when it arrives, so a
// tampered client still can't put a blocked message on anyone's screen.
//
// It catches what a word list can: swearing and sexual language, slurs,
// insults aimed at someone, threats, contact details and links (the usual first
// step in moving a minor off-platform), personal questions, and spam. It is not
// a substitute for human review: reports go to the feedback table (see hall.ts)
// and a production launch needs a moderation service on top.
//
// Messages about hurting oneself are never broadcast; the writer gets a private
// note pointing to real help instead.

export type Verdict =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'long' | 'harm' | 'contact' | 'personal' | 'spam'; message: string }
  | { ok: false; reason: 'care'; message: string }

export const MAX_LENGTH = 180

const PROFANITY = [
  'fuck', 'fock', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'cock', 'pussy', 'cunt', 'porn', 'porno',
  'nude', 'nudes', 'naked', 'sex', 'sexy', 'rape', 'rapist', 'slut', 'whore', 'horny', 'boobs', 'penis', 'vagina',
]
const SLURS = ['nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded', 'tranny', 'chink', 'spic', 'kike', 'wetback', 'gook']
const INSULTS = ['idiot', 'loser', 'moron', 'dumbass', 'kys', 'stfu']

const wordPattern = (word: string) => new RegExp(`(?:^|[^a-z])${word.split('').join('[^a-z]*')}(?:s|ed|ing)?(?=$|[^a-z])`, 'i')
const HARM_WORDS = [...PROFANITY, ...SLURS, ...INSULTS].map(wordPattern)

const HARM_PHRASES = [
  /\b(you|u|ur|youre|you are|your)\s*(are|r)?\s*(so\s+|such\s+an?\s+)?(stupid|dumb|ugly|fat|trash|worthless|pathetic|annoying|gross)\b/i,
  /\b(kill|hurt|beat|find)\s+(yo)?u\b/i,
  /\bgo\s+(die|kill\s+your\s*self)\b/i,
  /\bkill\s+your\s*self\b/i,
  /\bnobody\s+likes\s+you\b/i,
  /\bshut\s+up\b/i,
]

const CARE = [
  /\bkill(ing)?\s+my\s*self\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bsuicid/i,
  /\bself[\s-]*harm/i,
  /\bcut(ting)?\s+my\s*self\b/i,
  /\bend\s+(it\s+all|my\s+life)\b/i,
  /\bhurt(ing)?\s+my\s*self\b/i,
]

const CONTACT = [
  /[a-z0-9._%+-]+\s*(@|\(at\)|\[at\])\s*[a-z0-9.-]+\s*(\.|\(dot\)|\[dot\])\s*[a-z]{2,}/i, // email
  /(\+?\d[\s().-]*){7,}/, // phone-length digit runs
  /\bhttps?:\/\//i,
  /\bwww\./i,
  /\b[a-z0-9-]+\.(com|net|org|gg|io|me|ly|co|app|xyz|tv|cn)\b/i,
  /(^|\s)@[a-z0-9_.]{2,}/i, // @handles
  /\b(snap(chat)?|insta(gram)?|ig|discord|whats\s*app|telegram|wechat|weixin|qq|kik|tiktok|line\s+id|facebook|fb|twitter|x\.com|roblox|steam)\b/i,
  /\b(dm|text|message|call|add|follow)\s+me\b/i,
  /\bmy\s+(number|phone|email|address|insta|snap|discord|handle|username)\b/i,
]

const PERSONAL = [
  /\bhow\s+old\s+(are|r)\s+(you|u)\b/i,
  /\bwhere\s+(do\s+)?(you|u)\s+live\b/i,
  /\bwhat\s+(school|city|town|state)\b/i,
  /\b(send|show)\s+(me\s+)?(a\s+)?(pic|pics|picture|photo|selfie)/i,
  /\b(are|r)\s+(you|u)\s+(single|alone)\b/i,
  /\bmeet\s+(up|me|irl)\b/i,
  /\bwhat('?s|\s+is)\s+your\s+(real\s+)?name\b/i,
]

const CARE_NOTE =
  'That sounds really hard, and it matters. This message wasn’t posted. Please talk to someone you trust today — in the US you can call or text 988 any time; anywhere else, findahelpline.com lists free, confidential lines.'

/** Undo the usual disguises: zero-width characters, accents, 1337-speak. */
function normalise(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[̀-ͯ​-‏⁠﻿]/g, '')
    .replace(/[013457@$!]/g, (char) => ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' })[char] ?? char)
}

export function moderateMessage(text: string, recent: string[] = []): Verdict {
  const value = text.trim()
  if (!value) return { ok: false, reason: 'empty', message: 'Write a message first.' }
  if (value.length > MAX_LENGTH) return { ok: false, reason: 'long', message: `Keep messages to ${MAX_LENGTH} characters or fewer.` }

  // contact details are checked on the raw text (digits and @ matter there)
  if (CARE.some((pattern) => pattern.test(value) || pattern.test(normalise(value)))) return { ok: false, reason: 'care', message: CARE_NOTE }
  if (CONTACT.some((pattern) => pattern.test(value))) {
    return { ok: false, reason: 'contact', message: 'For everyone’s safety, contact details, usernames and links can’t be shared in the hall.' }
  }

  const plain = normalise(value)
  if (HARM_WORDS.some((pattern) => pattern.test(plain)) || HARM_PHRASES.some((pattern) => pattern.test(plain))) {
    return { ok: false, reason: 'harm', message: 'Keep it kind: no swearing, insults, slurs, threats or sexual language.' }
  }
  if (PERSONAL.some((pattern) => pattern.test(plain))) {
    return { ok: false, reason: 'personal', message: 'Keep personal questions (age, school, where you live, photos) out of the hall.' }
  }

  const squashed = plain.replace(/\s+/g, ' ')
  if (/(.)\1{7,}/.test(squashed) || (value.length > 12 && value === value.toUpperCase() && /[A-Z]{8,}/.test(value))) {
    return { ok: false, reason: 'spam', message: 'That looks like spam. Try a normal sentence.' }
  }
  if (recent.slice(-3).some((previous) => normalise(previous).replace(/\s+/g, ' ') === squashed)) {
    return { ok: false, reason: 'spam', message: 'You just sent that. Say something new.' }
  }
  return { ok: true }
}

/** Short form for callers that only need the reason a message can't go. */
export function validateChatMessage(text: string): string | null {
  const verdict = moderateMessage(text)
  return verdict.ok ? null : verdict.message
}

/**
 * Typed messages need a signed-in account when the hall is online (so a report
 * can name who sent what); on a local preview, tabs on one computer can chat.
 */
export function canUseTypedChat(mode: string, text: string, signedIn = false): boolean {
  return (mode === 'this-device' || signedIn) && validateChatMessage(text) === null
}
