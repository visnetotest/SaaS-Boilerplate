'use client'

import { CTA } from '@/templates/CTA'
import { DemoBanner } from '@/templates/DemoBanner'
import { FAQ } from '@/templates/FAQ'
import { Features } from '@/templates/Features'
import { Footer } from '@/templates/Footer'
import { Hero } from '@/templates/Hero'
import { Navbar } from '@/templates/Navbar'
import { Pricing } from '@/templates/Pricing'
import { Sponsors } from '@/templates/Sponsors'

interface IndexPageClientProps {
  locale: string
}

export function IndexPageClient({ locale }: IndexPageClientProps) {
  console.log('IndexPageClient rendering with locale:', locale)

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
