/**
 * ErrorRecoveryModal - Recovery UI component for error handling
 * Displays recovery options and guides users through error resolution
 */

import React, { useState, useEffect } from 'react'
import { useError } from '../../contexts/ErrorContext'
import ErrorRecoveryService from '../../services/ErrorRecoveryService'
import { 
  AlertCircle, 
  RefreshCw, 
  Save, 
  WifiOff, 
  Wifi, 
  Clock, 
  CheckCircle,
  XCircle,
  Download,
  Upload,
  HelpCircle
} from 'lucide-react'

interface ErrorRecoveryModalProps {
  isOpen: boolean
  onClose: () => void
  errorId?: string
  onRetry?: () => Promise<void>
  onSaveDraft?: () => Promise<void>
  customActions?: Array<{
    label: string
    action: () => void
    icon?: React.ReactNode
    variant?: 'primary' | 'secondary' | 'danger'
  }>
}

export const ErrorRecoveryModal: React.FC<ErrorRecoveryModalProps> = ({
  isOpen,
  onClose,
  errorId,
  onRetry,
  onSaveDraft,
  customActions = []
}) => {
  const { getErrorById, removeError } = useError()
  const [isRetrying, setIsRetrying] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [networkStatus, setNetworkStatus] = useState(ErrorRecoveryService.getNetworkStatus())
  const [offlineQueueCount, setOfflineQueueCount] = useState(ErrorRecoveryService.getOfflineQueueCount())
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null)
  const [savedDraft, setSavedDraft] = useState(false)

  const error = errorId ? getErrorById(errorId) : null

  // Update network status
  useEffect(() => {
    const handleNetworkChange = (event: CustomEvent) => {
      setNetworkStatus(ErrorRecoveryService.getNetworkStatus())
    }

    const handleQueueUpdate = (event: CustomEvent) => {
      setOfflineQueueCount(event.detail.count)
    }

    window.addEventListener('network-status-change', handleNetworkChange as EventListener)
    window.addEventListener('offline-queue-updated', handleQueueUpdate as EventListener)

    return () => {
      window.removeEventListener('network-status-change', handleNetworkChange as EventListener)
      window.removeEventListener('offline-queue-updated', handleQueueUpdate as EventListener)
    }
  }, [])

  // Auto-retry countdown for network errors
  useEffect(() => {
    if (!isOpen || error?.type !== 'network' || networkStatus.online) {
      setRetryCountdown(null)
      return
    }

    let countdown = 10
    setRetryCountdown(countdown)

    const interval = setInterval(() => {
      countdown--
      if (countdown <= 0) {
        clearInterval(interval)
        handleRetry()
      } else {
        setRetryCountdown(countdown)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen, error?.type, networkStatus.online])

  const handleRetry = async () => {
    if (isRetrying) return

    setIsRetrying(true)
    setRetryCountdown(null)

    try {
      if (onRetry) {
        await onRetry()
        
        // Success - close modal and remove error
        if (errorId) {
          removeError(errorId)
        }
        onClose()
      }
    } catch (err) {
      console.error('Retry failed:', err)
      // Error will be handled by the parent component
    } finally {
      setIsRetrying(false)
    }
  }

  const handleSaveDraft = async () => {
    if (isSaving) return

    setIsSaving(true)

    try {
      if (onSaveDraft) {
        await onSaveDraft()
        setSavedDraft(true)
        
        // Auto-close after showing success
        setTimeout(() => {
          onClose()
        }, 2000)
      }
    } catch (err) {
      console.error('Failed to save draft:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleContactSupport = () => {
    // Open support email with error details
    const subject = encodeURIComponent(`Onboarding Error: ${error?.title || 'Unknown Error'}`)
    const body = encodeURIComponent(`
Error Details:
--------------
Type: ${error?.type}
Time: ${error ? new Date(error.timestamp).toLocaleString() : 'Unknown'}
Message: ${error?.message}

Please describe what you were doing when this error occurred:


    `.trim())
    
    window.open(`mailto:support@example.com?subject=${subject}&body=${body}`)
  }

  if (!isOpen) return null

  const getNetworkIcon = () => {
    if (!networkStatus.online) return <WifiOff className="w-5 h-5 text-red-500" />
    if (networkStatus.connectionQuality === 'poor') return <Wifi className="w-5 h-5 text-yellow-500" />
    return <Wifi className="w-5 h-5 text-green-500" />
  }

  const getNetworkMessage = () => {
    if (!networkStatus.online) return 'You are currently offline'
    if (networkStatus.connectionQuality === 'poor') return 'Poor connection detected'
    if (networkStatus.connectionQuality === 'moderate') return 'Moderate connection'
    return 'Connection is good'
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          {/* Header */}
          <div className="sm:flex sm:items-start">
            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {error?.title || 'Error Occurred'}
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  {error?.message || 'An unexpected error has occurred. Please choose how to proceed.'}
                </p>
              </div>
            </div>
          </div>

          {/* Network Status */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getNetworkIcon()}
                <span className="text-sm text-gray-600">{getNetworkMessage()}</span>
              </div>
              {offlineQueueCount > 0 && (
                <div className="flex items-center space-x-1 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span>{offlineQueueCount} pending</span>
                </div>
              )}
            </div>
          </div>

          {/* Recovery Options */}
          <div className="mt-5 space-y-3">
            {/* Retry Button */}
            {onRetry && (
              <button
                onClick={handleRetry}
                disabled={isRetrying || !networkStatus.online}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry Now
                    {retryCountdown && ` (${retryCountdown}s)`}
                  </>
                )}
              </button>
            )}

            {/* Save Draft Button */}
            {onSaveDraft && (
              <button
                onClick={handleSaveDraft}
                disabled={isSaving || savedDraft}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savedDraft ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                    Draft Saved
                  </>
                ) : isSaving ? (
                  <>
                    <Save className="w-4 h-4 mr-2 animate-pulse" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Draft & Continue Later
                  </>
                )}
              </button>
            )}

            {/* Custom Actions */}
            {customActions.map((action, index) => (
              <button
                key={index}
                onClick={action.action}
                className={`w-full inline-flex justify-center items-center px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  action.variant === 'primary'
                    ? 'border-transparent text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                    : action.variant === 'danger'
                    ? 'border-transparent text-white bg-red-600 hover:bg-red-700 focus:ring-red-500'
                    : 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-indigo-500'
                }`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}

            {/* Contact Support */}
            <button
              onClick={handleContactSupport}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              Contact Support
            </button>
          </div>

          {/* Additional Information */}
          {error?.type === 'network' && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Upload className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Working Offline
                  </h3>
                  <div className="mt-1 text-sm text-blue-700">
                    <p>Your work is being saved locally. It will automatically sync when your connection is restored.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error?.type === 'authentication' && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Session Expired
                  </h3>
                  <div className="mt-1 text-sm text-yellow-700">
                    <p>Your session has expired for security reasons. Please refresh the page to continue.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Close Button */}
          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
            >
              Close
            </button>
          </div>

          {/* Debug Information (Development Only) */}
          {process.env.NODE_ENV === 'development' && error && (
            <details className="mt-4 text-xs text-gray-500">
              <summary className="cursor-pointer hover:text-gray-700">
                Debug Information
              </summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-32">
                {JSON.stringify({
                  type: error.type,
                  severity: error.severity,
                  timestamp: new Date(error.timestamp).toISOString(),
                  networkStatus,
                  offlineQueueCount
                }, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Connection Status Indicator Component
 */
export const ConnectionStatusIndicator: React.FC = () => {
  const [networkStatus, setNetworkStatus] = useState(ErrorRecoveryService.getNetworkStatus())
  const [offlineQueueCount, setOfflineQueueCount] = useState(ErrorRecoveryService.getOfflineQueueCount())

  useEffect(() => {
    const handleNetworkChange = () => {
      setNetworkStatus(ErrorRecoveryService.getNetworkStatus())
    }

    const handleQueueUpdate = (event: CustomEvent) => {
      setOfflineQueueCount(event.detail.count)
    }

    window.addEventListener('network-status-change', handleNetworkChange as EventListener)
    window.addEventListener('offline-queue-updated', handleQueueUpdate as EventListener)
    window.addEventListener('offline-queue-processed', handleQueueUpdate as EventListener)

    return () => {
      window.removeEventListener('network-status-change', handleNetworkChange as EventListener)
      window.removeEventListener('offline-queue-updated', handleQueueUpdate as EventListener)
      window.removeEventListener('offline-queue-processed', handleQueueUpdate as EventListener)
    }
  }, [])

  if (networkStatus.online && networkStatus.connectionQuality === 'good' && offlineQueueCount === 0) {
    return null // Don't show indicator when everything is fine
  }

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div className="bg-white rounded-lg shadow-lg p-3 flex items-center space-x-3">
        {!networkStatus.online ? (
          <>
            <WifiOff className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-sm font-medium text-gray-900">Working Offline</p>
              {offlineQueueCount > 0 && (
                <p className="text-xs text-gray-500">{offlineQueueCount} items pending sync</p>
              )}
            </div>
          </>
        ) : networkStatus.connectionQuality === 'poor' ? (
          <>
            <Wifi className="w-5 h-5 text-yellow-500" />
            <div>
              <p className="text-sm font-medium text-gray-900">Poor Connection</p>
              <p className="text-xs text-gray-500">Some features may be slow</p>
            </div>
          </>
        ) : offlineQueueCount > 0 ? (
          <>
            <Upload className="w-5 h-5 text-blue-500 animate-pulse" />
            <div>
              <p className="text-sm font-medium text-gray-900">Syncing...</p>
              <p className="text-xs text-gray-500">{offlineQueueCount} items remaining</p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

export default ErrorRecoveryModal