import { useTranslations } from 'next-intl'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Section } from '@/features/landing/Section'

export const FAQ = () => {
  const t = useTranslations('FAQ')

  return (
    <Section>
      <Accordion type='multiple' className='w-full' key='faq-accordion'>
        <AccordionItem value='item-1' key='item-1'>
          <AccordionTrigger>{t('question')}</AccordionTrigger>
          <AccordionContent>{t('answer')}</AccordionContent>
        </AccordionItem>
        <AccordionItem value='item-2' key='item-2'>
          <AccordionTrigger>{t('question')}</AccordionTrigger>
          <AccordionContent>{t('answer')}</AccordionContent>
        </AccordionItem>
        <AccordionItem value='item-3' key='item-3'>
          <AccordionTrigger>{t('question')}</AccordionTrigger>
          <AccordionContent>{t('answer')}</AccordionContent>
        </AccordionItem>
        <AccordionItem value='item-4' key='item-4'>
          <AccordionTrigger>{t('question')}</AccordionTrigger>
          <AccordionContent>{t('answer')}</AccordionContent>
        </AccordionItem>
        <AccordionItem value='item-5' key='item-5'>
          <AccordionTrigger>{t('question')}</AccordionTrigger>
          <AccordionContent>{t('answer')}</AccordionContent>
        </AccordionItem>
        <AccordionItem value='item-6' key='item-6'>
          <AccordionTrigger>{t('question')}</AccordionTrigger>
          <AccordionContent>{t('answer')}</AccordionContent>
        </AccordionItem>
      </Accordion>
    </Section>
  )
}
