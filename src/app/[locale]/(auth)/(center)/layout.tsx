import { redirect } from 'next/navigation'

import { auth } from '@/libs/auth'

export default async function CenteredLayout(props: { children: React.ReactNode }) {
  const session = await auth()

  if (session?.user) {
    redirect('/dashboard')
  }

  return <div className='flex min-h-screen items-center justify-center'>{props.children}</div>
}
