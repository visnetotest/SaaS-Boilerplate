// =============================================================================
// ADMIN ERROR BOUNDARY
// =============================================================================

import { AlertTriangle, Bug, RefreshCw } from 'lucide-react'
import { Component, ErrorInfo, ReactNode, useCallback } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showRetry?: boolean
  title?: string
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
  errorId?: string
}

export class AdminErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Admin Panel Error:', error, errorInfo)

    // Generate error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    this.setState({
      hasError: true,
      error,
      errorInfo,
      errorId,
    })

    // Report to error tracking service
    this.reportError(error, errorInfo, errorId)

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  private async reportError(error: Error, errorInfo: ErrorInfo, errorId: string): Promise<void> {
    try {
      const errorData = {
        id: errorId,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
          cause: error.cause,
        },
        errorInfo: {
          componentStack: errorInfo.componentStack,
        },
        context: {
          timestamp: new Date().toISOString(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
          url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
          adminPanel: true,
          userId: this.getCurrentUserId(),
          tenantId: this.getCurrentTenantId(),
        },
      }

      await fetch('/api/admin/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Error-ID': errorId,
        },
        body: JSON.stringify(errorData),
      })
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError)
    }
  }

  private getCurrentUserId(): string | null {
    // Try to get current user ID from localStorage or session
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('currentUserId')
      }

      // You can also try to get it from a cookie or context
      return (
        document.cookie
          .split(';')
          .find((cookie) => cookie.trim().startsWith('userId='))
          ?.split('=')[1] || null
      )
    } catch {
      return null
    }
  }

  private getCurrentTenantId(): string | null {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('currentTenantId')
      }

      // Try to get from cookie
      return (
        document.cookie
          .split(';')
          .find((cookie) => cookie.trim().startsWith('tenantId='))
          ?.split('=')[1] || null
      )
    } catch {
      return null
    }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
    window.location.reload()
  }

  private handleDismiss = (): void => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render() {
    if (this.state.hasError) {
      const title = this.props.title || 'Something went wrong'

      return (
        this.props.fallback || (
          <div className='min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4'>
            <Card className='w-full max-w-md border-red-200 bg-red-50'>
              <CardHeader className='text-center'>
                <CardTitle className='flex items-center gap-2 text-red-600'>
                  <AlertTriangle className='h-5 w-5' />
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='text-center'>
                  <Bug className='mx-auto h-12 w-12 text-red-400 mb-4' />
                </div>

                <div className='space-y-2 text-sm text-gray-600'>
                  <p>
                    An error occurred in the admin panel. Our team has been automatically notified
                    with error ID:{' '}
                    <span className='font-mono bg-red-100 px-1 py-0.5 rounded'>
                      {this.state.errorId}
                    </span>
                    .
                  </p>

                  {this.state.error && (
                    <div className='mt-3 p-3 bg-red-100 rounded text-left'>
                      <p className='font-medium text-red-800'>Error Details:</p>
                      <p className='text-red-700 break-all font-mono text-xs'>
                        {this.state.error.message}
                      </p>
                    </div>
                  )}

                  <div className='bg-blue-50 border border-blue-200 rounded p-3 mt-4'>
                    <p className='text-sm text-blue-800'>
                      <strong>What to do:</strong>
                    </p>
                    <ul className='list-disc list-inside space-y-1 text-sm text-blue-700 mt-2'>
                      <li>Try refreshing the page to see if the issue resolves itself</li>
                      <li>If the problem persists, contact your system administrator</li>
                      <li>Note the error ID above for faster support</li>
                    </ul>
                  </div>
                </div>

                <div className='flex gap-2 pt-4'>
                  {this.props.showRetry !== false && (
                    <Button onClick={this.handleRetry} className='flex-1'>
                      <RefreshCw className='h-4 w-4 mr-2' />
                      Reload Page
                    </Button>
                  )}

                  <Button variant='outline' onClick={this.handleDismiss} className='flex-1'>
                    Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      )
    }

    return this.props.children
  }
}

// Hook for handling errors in admin components
export function useAdminErrorHandler() {
  const handleError = useCallback((error: Error, context: string) => {
    console.error(`Admin Error [${context}]:`, error)

    // Report to error tracking service
    const errorId = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    fetch('/api/admin/errors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Error-ID': errorId,
      },
      body: JSON.stringify({
        id: errorId,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        context: {
          timestamp: new Date().toISOString(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
          url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
          adminPanel: true,
          userId: 'current', // Would get from auth context
          tenantId: 'current', // Would get from auth context
          componentContext: context,
        },
      }),
    }).catch((reportingError) => {
      console.error('Failed to report error:', reportingError)
    })
  }, [])

  return { handleError }
}
