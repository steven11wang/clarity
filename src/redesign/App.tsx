import { useEffect } from 'react'

import { isSupabaseConfigured, supabase } from '../lib/supabase.ts'
import { applyPurchases, fetchLivePurchases, paymentsMode } from './game/payments.ts'
import { updateGame, useGame } from './game/store.ts'
import { go, useRoute } from './router.ts'
import { Arena } from './screens/Arena.tsx'
import { ExamHall } from './screens/ExamHall.tsx'
import { ExamRunner } from './screens/ExamRunner.tsx'
import { FriendMatch } from './screens/FriendMatch.tsx'
import { Founders } from './screens/Founders.tsx'
import { Landing } from './screens/Landing.tsx'
import { Lesson } from './screens/Lesson.tsx'
import { Me } from './screens/Me.tsx'
import { Notebook } from './screens/Notebook.tsx'
import { PathScreen } from './screens/PathScreen.tsx'
import { Play } from './screens/Play.tsx'
import { OAUTH_FLAG, SignIn } from './screens/SignIn.tsx'
import { Shop } from './screens/Shop.tsx'
import { Start } from './screens/Start.tsx'
import { Today } from './screens/Today.tsx'

export function App() {
  const route = useRoute()
  const game = useGame()
  const [head, arg, extra] = route.parts

  // which desk the page sits on: yellow for the front door and sign-in, grid
  // paper for the game, plain paper for test day
  useEffect(() => {
    document.body.dataset.surface = !head ? 'landing' : head === 'exam' ? 'exam' : head === 'signin' || head === 'signup' ? 'landing' : 'game'
  }, [head])

  // a new screen starts at the top, however it was reached
  useEffect(() => {
    if (route.path !== '/') window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [route.path])

  // coming back from Google: Supabase has read the session out of the URL by now
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    let returning = false
    try {
      returning = sessionStorage.getItem(OAUTH_FLAG) === '1'
    } catch {
      /* no session storage, no redirect to finish */
    }
    const apply = (user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined) => {
      if (!user) return
      const named = typeof user.user_metadata?.display_name === 'string' ? (user.user_metadata.display_name as string) : ''
      const fromGoogle = typeof user.user_metadata?.full_name === 'string' ? (user.user_metadata.full_name as string).split(' ')[0] : ''
      updateGame((state) => ({
        ...state,
        account: { kind: 'cloud', userId: user.id, email: user.email ?? undefined },
        name: state.name || named || fromGoogle || (user.email ?? '').split('@')[0],
      }))
    }
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        apply(data.session.user)
        // drops bought on Stripe are recorded server-side; pull any new ones in
        if (paymentsMode() === 'stripe') void fetchLivePurchases().then((rows) => updateGame((state) => applyPurchases(state, rows)))
      }
      if (returning && data.session) {
        try {
          sessionStorage.removeItem(OAUTH_FLAG)
        } catch {
          /* already gone */
        }
        go('/today')
      }
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') updateGame((state) => ({ ...state, account: undefined }))
      else if (session?.user) apply(session.user)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  switch (head) {
    case 'signin':
      return <SignIn />
    case 'signup':
      return <SignIn initialMode="sign-up" />
    case 'start':
    case 'today':
      return game.onboarded ? <Today /> : <Start />
    case 'path':
      return <PathScreen />
    case 'play':
      return <Play target={arg ?? 'first'} />
    case 'notebook':
      return <Notebook />
    case 'arena':
      if (arg === 'match') return <FriendMatch />
      return <Arena joinCode={arg === 'join' ? (extra ?? null) : null} tab={arg === 'ranks' ? 'ranks' : arg === 'hall' ? 'hall' : 'play'} />
    case 'exams':
      return <ExamHall />
    case 'exam':
      return <ExamRunner examId={arg ?? ''} />
    case 'me':
      return <Me />
    case 'founders':
      return <Founders code={route.query.get('code') ?? ''} />
    case 'shop':
      return <Shop packParam={route.query.get('pack')} paid={route.query.get('paid') === '1'} />
    case 'lesson':
      return <Lesson skillSlug={arg ?? ''} />
    default:
      return <Landing />
  }
}
