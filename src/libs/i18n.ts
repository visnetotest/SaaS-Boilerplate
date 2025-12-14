import { getRequestConfig } from 'next-intl/server'

import { AllLocales } from '@/utils/AppConfig'

export default getRequestConfig(async ({ requestLocale }) => {
  // Typically corresponds to `[locale]` segment
  let locale = AllLocales[0] // default fallback

  try {
    const requested = await requestLocale
    if (requested && AllLocales.includes(requested)) {
      locale = requested
    }
  } catch {
    // keep default fallback
  }

  return {
    locale,
    messages: (await import(`../locales/${locale}.json`)).default,
  } as any
})
