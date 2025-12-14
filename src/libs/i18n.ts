import { getRequestConfig } from 'next-intl/server'

import { AllLocales } from '@/utils/AppConfig'

export default getRequestConfig(async ({ requestLocale }) => {
  // Typically corresponds to `[locale]` segment
  let locale: string

  try {
    const requested = await requestLocale
    locale = (requested && AllLocales.includes(requested)) 
      ? requested 
      : AllLocales[0] // fallback to first locale
  } catch {
    locale = AllLocales[0] // fallback on error
  }

  return {
    locale: locale as any,
    messages: (await import(`../locales/${locale}.json`)).default,
  }
})