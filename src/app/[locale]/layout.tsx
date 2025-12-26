import '@/styles/global.css'

import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { ThemeProvider } from 'next-themes'

import { DemoBadge } from '@/components/DemoBadge'
import { AllLocales } from '@/utils/AppConfig'

export function generateStaticParams() {
  return AllLocales.map((locale) => ({ locale }))
}

export default async function RootLayout(props: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await props.params
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className='bg-background text-foreground antialiased' suppressHydrationWarning>
        <ThemeProvider attribute='class' defaultTheme='light' enableSystem={false}>
          <NextIntlClientProvider locale={locale} messages={messages as any}>
            {props.children}
            <DemoBadge />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
