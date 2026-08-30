// Dev-only harness for eyeballing the plans gate without holding a signed-in
// account that has no subscription. Not part of the production build.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { User } from '@supabase/supabase-js'

import { PaywallPage } from './auth/PaywallPage.tsx'

const user = {
  id: '00000000-0000-4000-8000-000000000000',
  email: 'steven11stop@gmail.com',
} as unknown as User

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PaywallPage
      user={user}
      subscription={null}
      onRecheck={async () => false}
      onSignOut={() => {}}
    />
  </StrictMode>,
)
