import { getTranslations, setRequestLocale } from 'next-intl/server'

import { CTA } from '@/templates/CTA'
import { DemoBanner } from '@/templates/DemoBanner'
import { FAQ } from '@/templates/FAQ'
import { Features } from '@/templates/Features'
import { Footer } from '@/templates/Footer'
import { Hero } from '@/templates/Hero'
import { Navbar } from '@/templates/Navbar'
import { Pricing } from '@/templates/Pricing'
import { Sponsors } from '@/templates/Sponsors'

export async function generateMetadata(_props: { params: Promise<{ locale: string }> }) {
  await _props.params
  const t = await getTranslations('Index')

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  }
}

const IndexPage = async (props: { params: Promise<{ locale: string }> }) => {
  const { locale } = await props.params
  setRequestLocale(locale)

  return (
    <>
      <DemoBanner />
      <Navbar />
      <Hero />
      <Sponsors />
      <Features />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </>
  )
}

export default IndexPage
