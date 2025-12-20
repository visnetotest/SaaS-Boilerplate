import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { IndexPageClient } from './IndexPageClient'

export async function generateMetadata(_props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  await _props.params
  const t = await getTranslations('Index')

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  }
}

export default async function IndexPage(_props: { params: Promise<{ locale: string }> }) {
  const { locale } = await _props.params
  return <IndexPageClient locale={locale} />
}
