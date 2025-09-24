/**
 * ErrorContext - Global error management with Error Boundary integration
 * Provides centralized error handling, logging, and recovery suggestions
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import axios from 'axios'
import ErrorRecoveryService, { RecoverableError, ErrorType } from '../services/ErrorRecoveryService'

interface ErrorAction {
  label: string
  action: () => void
  variant?: 'default' | 'destructive' | 'outline'
}

interface ErrorInfo {
  id: string
  title: string
  message: string
  type: ErrorType
  severity: 'info' | 'warning' | 'error' | 'critical'
  timestamp: number
  actions?: ErrorAction[]
  details?: any
  autoDismiss?: boolean
  dismissTimeout?: number
}

interface ErrorContextType {
  errors: ErrorInfo[]
  addError: (error: ErrorInfo | Error | string, options?: ErrorOptions) => void
  removeError: (id: string) => void
  clearErrors: () => void
  handleAsyncError: (promise: Promise<any>, operation: string, options?: ErrorOptions) => Promise<any>
  logError: (error: any, context?: string) => void
  getErrorById: (id: string) => ErrorInfo | undefined
  hasErrors: boolean
  criticalError: ErrorInfo | null
  isRecovering: boolean
  lastRecoveryAttempt: number | null
}

interface ErrorOptions {
  title?: string
  type?: ErrorType
  severity?: 'info' | 'warning' | 'error' | 'critical'
  actions?: ErrorAction[]
  autoDismiss?: boolean
  dismissTimeout?: number
  saveOnFailure?: boolean
  autoRetry?: boolean
  showRecoveryModal?: boolean
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined)

export const useError = () => {
  const context = useContext(ErrorContext)
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider')
  }
  return context
}

interface ErrorProviderProps {
  children: ReactNode
  onCriticalError?: (error: ErrorInfo) => void
  logToBackend?: boolean
  maxErrors?: number
}

export const ErrorProvider: React.FC<ErrorProviderProps> = ({ 
  children, 
  onCriticalError,
  logToBackend = true,
  maxErrors = 10
}) => {
  const [errors, setErrors] = useState<ErrorInfo[]>([])
  const [criticalError, setCriticalError] = useState<ErrorInfo | null>(null)
  const [isRecovering, setIsRecovering] = useState(false)
  const [lastRecoveryAttempt, setLastRecoveryAttempt] = useState<number | null>(null)

  // Setup error event listeners
  useEffect(() => {
    // Listen for unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason)
      addError(event.reason, {
        title: 'Unexpected Error',
        severity: 'error',
        autoDismiss: false
      })
      event.preventDefault()
    }

    // Listen for general errors
    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error)
      addError(event.error || event.message, {
        title: 'System Error',
        severity: 'critical',
        autoDismiss: false
      })
      event.preventDefault()
    }

    // Listen for recovery events from ErrorRecoveryService
    const handleRecoverySuccess = (event: CustomEvent) => {
      console.log('Recovery successful:', event.detail)
      setIsRecovering(false)
      
      // Remove the recovered error
      if (event.detail.errorId) {
        removeError(event.detail.errorId)
      }
      
      // Add success notification
      addError({
        id: `recovery-success-${Date.now()}`,
        title: 'Recovery Successful',
        message: 'The operation has been completed successfully.',
        type: 'network',
        severity: 'info',
        timestamp: Date.now(),
        autoDismiss: true,
        dismissTimeout: 3000
      })
    }

    const handleRecoveryFailed = (event: CustomEvent) => {
      console.error('Recovery failed:', event.detail)
      setIsRecovering(false)
      setLastRecoveryAttempt(Date.now())
    }

    const handleNetworkStatusChange = (event: CustomEvent) => {
      const { online, quality } = event.detail
      
      if (online && quality === 'good') {
        // Clear network-related errors when connection is good
        setErrors(prev => prev.filter(e => e.type !== 'network'))
      } else if (!online) {
        // Add offline notification
        addError({
          id: 'network-offline',
          title: 'Working Offline',
          message: 'You are currently offline. Your work will be saved locally and synced when connection is restored.',
          type: 'network',
          severity: 'warning',
          timestamp: Date.now(),
          autoDismiss: false
        })
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleError)
    window.addEventListener('recovery-success', handleRecoverySuccess as EventListener)
    window.addEventListener('recovery-failed', handleRecoveryFailed as EventListener)
    window.addEventListener('network-status-change', handleNetworkStatusChange as EventListener)

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleError)
      window.removeEventListener('recovery-success', handleRecoverySuccess as EventListener)
      window.removeEventListener('recovery-failed', handleRecoveryFailed as EventListener)
      window.removeEventListener('network-status-change', handleNetworkStatusChange as EventListener)
    }
  }, [])

  /**
   * Add an error to the context
   */
  const addError = useCallback((
    error: ErrorInfo | Error | string,
    options: ErrorOptions = {}
  ) => {
    let errorInfo: ErrorInfo

    if (typeof error === 'string') {
      // String error
      errorInfo = {
        id: `error-${Date.now()}-${Math.random()}`,
        title: options.title || 'Error',
        message: error,
        type: options.type || 'unknown',
        severity: options.severity || 'error',
        timestamp: Date.now(),
        actions: options.actions,
        autoDismiss: options.autoDismiss ?? (options.severity === 'info'),
        dismissTimeout: options.dismissTimeout || 5000
      }
    } else if (error instanceof Error) {
      // Error object
      errorInfo = {
        id: `error-${Date.now()}-${Math.random()}`,
        title: options.title || error.name || 'Error',
        message: error.message,
        type: options.type || ErrorRecoveryService.determineErrorType?.(error) || 'unknown',
        severity: options.severity || 'error',
        timestamp: Date.now(),
        actions: options.actions,
        details: error.stack,
        autoDismiss: options.autoDismiss ?? false,
        dismissTimeout: options.dismissTimeout || 5000
      }
    } else {
      // ErrorInfo object
      errorInfo = error
    }

    // Handle critical errors
    if (errorInfo.severity === 'critical') {
      setCriticalError(errorInfo)
      if (onCriticalError) {
        onCriticalError(errorInfo)
      }
    }

    // Add to errors list
    setErrors(prev => {
      // Prevent duplicate errors
      if (prev.some(e => e.message === errorInfo.message && 
          Math.abs(e.timestamp - errorInfo.timestamp) < 1000)) {
        return prev
      }

      // Limit number of errors
      const newErrors = [errorInfo, ...prev]
      if (newErrors.length > maxErrors) {
        newErrors.splice(maxErrors)
      }
      return newErrors
    })

    // Log to backend if enabled
    if (logToBackend) {
      logErrorToBackend(errorInfo)
    }

    // Auto-dismiss if configured
    if (errorInfo.autoDismiss) {
      setTimeout(() => {
        removeError(errorInfo.id)
      }, errorInfo.dismissTimeout)
    }

    // Handle recovery options
    if (options.autoRetry || options.saveOnFailure) {
      setIsRecovering(true)
      ErrorRecoveryService.handleError(
        error,
        errorInfo.title,
        undefined,
        {
          autoRetry: options.autoRetry,
          saveOnFailure: options.saveOnFailure,
          showRecoveryModal: options.showRecoveryModal
        }
      )
    }
  }, [logToBackend, maxErrors, onCriticalError])

  /**
   * Remove an error by ID
   */
  const removeError = useCallback((id: string) => {
    setErrors(prev => prev.filter(e => e.id !== id))
    
    // Clear critical error if it's being removed
    if (criticalError?.id === id) {
      setCriticalError(null)
    }
  }, [criticalError])

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setErrors([])
    setCriticalError(null)
  }, [])

  /**
   * Handle async operations with error handling
   */
  const handleAsyncError = useCallback(async (
    promise: Promise<any>,
    operation: string,
    options: ErrorOptions = {}
  ): Promise<any> => {
    try {
      const result = await promise
      return result
    } catch (error) {
      const recoverableError = await ErrorRecoveryService.handleError(
        error,
        operation,
        undefined,
        {
          autoRetry: options.autoRetry,
          saveOnFailure: options.saveOnFailure,
          showRecoveryModal: options.showRecoveryModal
        }
      )

      addError(error as Error, {
        title: operation,
        ...options,
        actions: options.actions || [
          {
            label: 'Retry',
            action: () => handleAsyncError(promise, operation, options),
            variant: 'default'
          },
          {
            label: 'Dismiss',
            action: () => removeError(recoverableError.id),
            variant: 'outline'
          }
        ]
      })

      throw error
    }
  }, [addError, removeError])

  /**
   * Log error to console and optionally to backend
   */
  const logError = useCallback((error: any, context?: string) => {
    console.error(`Error${context ? ` in ${context}` : ''}:`, error)
    
    if (logToBackend) {
      logErrorToBackend({
        id: `log-${Date.now()}`,
        title: context || 'Error Log',
        message: error?.message || String(error),
        type: 'unknown',
        severity: 'error',
        timestamp: Date.now(),
        details: error
      })
    }
  }, [logToBackend])

  /**
   * Log error to backend
   */
  const logErrorToBackend = async (errorInfo: ErrorInfo) => {
    try {
      // Only log if we have a valid auth token
      const token = sessionStorage.getItem('onboarding_token') || 
                   localStorage.getItem('auth_token')
      
      if (!token) return

      await axios.post('/api/errors/log', {
        ...errorInfo,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date(errorInfo.timestamp).toISOString()
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
    } catch (logError) {
      // Silently fail - we don't want logging errors to cause more errors
      console.warn('Failed to log error to backend:', logError)
    }
  }

  /**
   * Get error by ID
   */
  const getErrorById = useCallback((id: string): ErrorInfo | undefined => {
    return errors.find(e => e.id === id)
  }, [errors])

  const value: ErrorContextType = {
    errors,
    addError,
    removeError,
    clearErrors,
    handleAsyncError,
    logError,
    getErrorById,
    hasErrors: errors.length > 0,
    criticalError,
    isRecovering,
    lastRecoveryAttempt
  }

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  )
}

/**
 * Error Boundary component that integrates with ErrorContext
 */
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundaryWithContext extends React.Component<
  { children: ReactNode; fallback?: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
    
    // Emit a custom event that the ErrorProvider will catch
    window.dispatchEvent(new CustomEvent('error-boundary-catch', {
      detail: { error, errorInfo }
    }))
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="mt-4 text-center text-xl font-semibold text-gray-900">
              Something went wrong
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              We encountered an unexpected error. Your work has been saved.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                Refresh Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Try Again
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-xs text-gray-500">
                <summary className="cursor-pointer hover:text-gray-700">
                  Error Details
                </summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorContext