'use client'

import { AsyncButton } from './AsyncButton'
import { LocaleSwitcher } from './LocaleSwitcher'
import { ProgressiveHydrationWrapper } from './ProgressiveHydration'
import { StreamingSSR } from './StreamingSSR'
import { ToggleMenuButton } from './ToggleMenuButton'

/**
 * Optimized LocaleSwitcher with progressive hydration
 * Only hydrates when user interaction is likely
 */
export const OptimizedLocaleSwitcher = () => {
  return (
    <ProgressiveHydrationWrapper
      fallback={<div className='p-2 animate-pulse bg-gray-200 rounded-lg w-10 h-10' />}
    >
      <LocaleSwitcher />
    </ProgressiveHydrationWrapper>
  )
}

/**
 * Optimized ToggleMenuButton with progressive hydration
 * Defers hydration until interaction is needed
 */
export const OptimizedToggleMenuButton = ({ onClickAction }: { onClickAction?: () => void }) => {
  return (
    <ProgressiveHydrationWrapper
      fallback={<div className='p-2 animate-pulse bg-gray-200 rounded-lg w-10 h-10' />}
    >
      <ToggleMenuButton onClick={onClickAction} />
    </ProgressiveHydrationWrapper>
  )
}

/**
 * Optimized AsyncButton with streaming SSR
 * Provides immediate visual feedback with progressive hydration
 */
export const OptimizedAsyncButton = ({
  children,
  action,
  className = '',
  disabled = false,
}: {
  children: React.ReactNode
  action: () => Promise<void> | void
  className?: string
  disabled?: boolean
}) => {
  return (
    <StreamingSSR
      priority='auto'
      fallback={
        <button
          className={`relative ${className} bg-gray-200 animate-pulse rounded`}
          disabled={true}
        >
          <span className='opacity-0'>{children}</span>
        </button>
      }
    >
      <AsyncButton onClick={action} className={className} disabled={disabled}>
        {children}
      </AsyncButton>
    </StreamingSSR>
  )
}
