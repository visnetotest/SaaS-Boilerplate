'use client'

import { startTransition, useEffect, useState } from 'react'

interface StreamingSSRProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  priority?: 'high' | 'low' | 'auto'
}

/**
 * Streaming SSR wrapper using React 18+ concurrent features
 * Implements progressive rendering with proper loading states
 */
export const StreamingSSR = ({
  children,
  fallback = <div className='animate-pulse bg-gray-200 rounded' />,
  priority = 'auto',
}: StreamingSSRProps) => {
  const [isVisible, setIsVisible] = useState(priority === 'high')

  useEffect(() => {
    if (priority === 'high') return

    // Use startTransition for lower priority content
    if (priority === 'low') {
      startTransition(() => {
        setTimeout(() => setIsVisible(true), 100)
      })
    } else {
      startTransition(() => {
        setIsVisible(true)
      })
    }
  }, [priority])

  return isVisible ? <>{children}</> : <>{fallback}</>
}

/**
 * Skeleton loader for streaming SSR content
 * Provides consistent loading experience across the application
 */
export const SkeletonLoader = ({
  type = 'text',
  className = '',
}: {
  type?: 'text' | 'avatar' | 'card' | 'list'
  className?: string
}) => {
  const skeletons = {
    text: (
      <div className={`space-y-2 ${className}`}>
        <div className='h-4 bg-gray-200 rounded w-3/4 animate-pulse' />
        <div className='h-4 bg-gray-200 rounded w-1/2 animate-pulse' />
      </div>
    ),
    avatar: (
      <div className={`flex items-center space-x-4 ${className}`}>
        <div className='h-12 w-12 bg-gray-200 rounded-full animate-pulse' />
        <div className='space-y-2'>
          <div className='h-4 bg-gray-200 rounded w-20 animate-pulse' />
          <div className='h-4 bg-gray-200 rounded w-16 animate-pulse' />
        </div>
      </div>
    ),
    card: (
      <div className={`border rounded-lg p-4 space-y-4 ${className}`}>
        <div className='h-6 bg-gray-200 rounded w-1/3 animate-pulse' />
        <div className='space-y-2'>
          <div className='h-4 bg-gray-200 rounded animate-pulse' />
          <div className='h-4 bg-gray-200 rounded w-5/6 animate-pulse' />
        </div>
      </div>
    ),
    list: (
      <div className={`space-y-4 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className='flex items-center space-x-4'>
            <div className='h-10 w-10 bg-gray-200 rounded animate-pulse' />
            <div className='flex-1 space-y-2'>
              <div className='h-4 bg-gray-200 rounded w-3/4 animate-pulse' />
              <div className='h-4 bg-gray-200 rounded w-1/2 animate-pulse' />
            </div>
          </div>
        ))}
      </div>
    ),
  }

  return skeletons[type]
}
