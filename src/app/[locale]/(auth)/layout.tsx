import { SessionProvider } from 'next-auth/react'

export default async function AuthLayout(props: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  return <SessionProvider>{props.children}</SessionProvider>
}
