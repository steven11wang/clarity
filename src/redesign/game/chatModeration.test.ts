import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { canUseTypedChat, moderateMessage, validateChatMessage } from './chatModeration.ts'

test('accepts an ordinary study message', () => {
  assert.equal(validateChatMessage('Good luck on your practice!'), null)
  assert.equal(validateChatMessage('Anyone stuck on transitions? The "however" ones get me'), null)
  assert.equal(validateChatMessage('I scored 1450 on practice test 2'), null)
})

test('rejects profanity and sexual language including common obfuscation', () => {
  for (const message of ['what the fuck', 'f.u.c.k', 'f​uck', 'f0ck', 'porn', 'nudes', 'sh1t']) {
    assert.ok(validateChatMessage(message), `expected rejection for ${message}`)
  }
})

test('does not block innocent words containing a blocked substring', () => {
  assert.equal(validateChatMessage('Class assignment: study analysis'), null)
  assert.equal(validateChatMessage('Sussex and Essex are counties'), null)
})

test('rejects insults, slurs and threats aimed at someone', () => {
  for (const message of ['you are so stupid', 'ur dumb', 'kys', 'go die', 'I will kill u', 'nobody likes you', 'what a loser', 'shut up']) {
    assert.equal(moderateMessage(message).ok, false, `expected rejection for ${message}`)
  }
})

test('keeps contact details, usernames and links out', () => {
  for (const message of ['add me on snap', 'my insta is mina.k', 'email me at mina@gmail.com', 'text me 555 123 4567', 'join discord.gg/abc', 'follow @mina_k', 'www.example.com', 'mina (at) gmail (dot) com']) {
    const verdict = moderateMessage(message)
    assert.equal(verdict.ok, false, `expected rejection for ${message}`)
    if (!verdict.ok) assert.equal(verdict.reason, 'contact', message)
  }
})

test('keeps personal questions out', () => {
  for (const message of ['how old are you', 'where do you live?', 'what school do you go to', 'send me a pic', 'want to meet up']) {
    assert.equal(moderateMessage(message).ok, false, `expected rejection for ${message}`)
  }
})

test('a message about self-harm is held back with a pointer to help', () => {
  const verdict = moderateMessage('honestly i want to die after this test')
  assert.equal(verdict.ok, false)
  if (!verdict.ok) {
    assert.equal(verdict.reason, 'care')
    assert.match(verdict.message, /988/)
  }
})

test('rejects blank, overlong and spammy messages', () => {
  assert.ok(validateChatMessage('   '))
  assert.ok(validateChatMessage('a'.repeat(181)))
  assert.ok(validateChatMessage('helloooooooooooo'))
  assert.equal(moderateMessage('good luck', ['good luck']).ok, false)
})

test('typed messages online need a signed-in account', () => {
  assert.equal(canUseTypedChat('online', 'Good luck!'), false)
  assert.equal(canUseTypedChat('online', 'Good luck!', true), true)
  assert.equal(canUseTypedChat('this-device', 'Good luck!'), true)
  assert.equal(canUseTypedChat('this-device', 'porn'), false)
})
