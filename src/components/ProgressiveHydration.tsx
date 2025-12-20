'use client'

import dynamic from 'next/dynamic'
import React, { lazy, Suspense } from 'react'

interface ProgressiveHydrationWrapperProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Wrapper component for progressive hydration of React 18+ features
 * Implements suspense boundaries and lazy loading for optimal performance
 */
export const ProgressiveHydrationWrapper = ({
  children,
  fallback = <div className='animate-pulse bg-gray-200 h-4 w-20 rounded' />,
}: ProgressiveHydrationWrapperProps) => {
  return <Suspense fallback={fallback}>{children}</Suspense>
}

/**
 * Dynamically loads components with progressive hydration
 * Uses React 18+ streaming and suspense features
 */
export const createProgressiveComponent = <T extends Record<string, any>>(
  importFunc: () => Promise<{ default: React.ComponentType<T> }>,
  options: {
    ssr?: boolean
    fallback?: React.ReactNode
  } = {}
) => {
  const { ssr = true, fallback = <div className='animate-pulse bg-gray-200 h-4 w-20 rounded' /> } =
    options

  const DynamicComponent = dynamic(importFunc, {
    ssr,
    loading: () => fallback,
  })

  return DynamicComponent
}

/**
 * Creates a lazy-loaded component with progressive hydration
 * Optimizes for bundle splitting and loading performance
 */
export const createLazyComponent = (
  importFunc: () => Promise<{ default: React.ComponentType<any> }>,
  fallback?: React.ReactNode
) => {
  const LazyComponent = lazy(importFunc)

  return (props: any) => (
    <Suspense fallback={fallback || <div className='animate-pulse bg-gray-200 h-4 w-20 rounded' />}>
      <LazyComponent {...props} />
    </Suspense>
  )
}

/**
 * Progressive hydration hook for managing component loading states
 * Uses React 18+ concurrent features
 */
export const useProgressiveHydration = (delay = 0) => {
  const [shouldHydrate, setShouldHydrate] = React.useState(false)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShouldHydrate(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay])

  return shouldHydrate
}
