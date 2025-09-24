import { useState, useEffect, useCallback, useRef } from 'react'
import { SaveStatus } from '@/components/onboarding/AutoSaveIndicator'
import ErrorRecoveryService from '../services/ErrorRecoveryService'

interface UseAutoSaveOptions {
  onSave: (data: any) => Promise<void>
  delay?: number // milliseconds
  enabled?: boolean
  maxRetries?: number
  retryDelay?: number
  onConflict?: (localData: any, serverData: any) => any
  offlineSupport?: boolean
  validateBeforeSave?: (data: any) => boolean | Promise<boolean>
}

interface UseAutoSaveReturn {
  saveStatus: SaveStatus
  lastSaved: Date | null
  saveError: string | null
  triggerSave: () => void
  retryCount: number
  isOffline: boolean
  hasPendingChanges: boolean
  conflictResolution: 'pending' | 'resolved' | null
}

/**
 * Enhanced hook for handling auto-save functionality with retry, conflict resolution, and offline support
 */
export const useAutoSave = (
  data: any,
  options: UseAutoSaveOptions
): UseAutoSaveReturn => {
  const { 
    onSave, 
    delay = 2000, 
    enabled = true,
    maxRetries = 3,
    retryDelay = 1000,
    onConflict,
    offlineSupport = true,
    validateBeforeSave
  } = options
  
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [hasPendingChanges, setHasPendingChanges] = useState(false)
  const [conflictResolution, setConflictResolution] = useState<'pending' | 'resolved' | null>(null)
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)
  const lastDataRef = useRef<string>('')
  const lastSavedDataRef = useRef<string>('')
  const saveQueueRef = useRef<any[]>([])

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      // Process queued saves when coming back online
      if (saveQueueRef.current.length > 0 && isMountedRef.current) {
        const latestData = saveQueueRef.current[saveQueueRef.current.length - 1]
        saveQueueRef.current = []
        performSave(latestData, 0)
      }
    }

    const handleOffline = () => {
      setIsOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [])

  const performSave = useCallback(async (dataToSave: any = data, attemptNumber: number = 0) => {
    if (!enabled || !isMountedRef.current) return

    // Validate data before saving if validator provided
    if (validateBeforeSave) {
      try {
        const isValid = await validateBeforeSave(dataToSave)
        if (!isValid) {
          console.warn('Data validation failed, skipping save')
          return
        }
      } catch (error) {
        console.error('Validation error:', error)
        return
      }
    }

    // Handle offline mode
    if (isOffline && offlineSupport) {
      saveQueueRef.current.push(dataToSave)
      await ErrorRecoveryService.saveDraft('autosave', dataToSave)
      setSaveStatus('saved')
      setHasPendingChanges(true)
      
      // Show offline save indicator
      window.dispatchEvent(new CustomEvent('autosave-offline', { 
        detail: { data: dataToSave, timestamp: Date.now() }
      }))
      return
    }

    try {
      setSaveStatus('saving')
      setSaveError(null)
      setRetryCount(attemptNumber)
      
      await onSave(dataToSave)
      
      if (isMountedRef.current) {
        setSaveStatus('saved')
        setLastSaved(new Date())
        setHasPendingChanges(false)
        setRetryCount(0)
        lastSavedDataRef.current = JSON.stringify(dataToSave)
        
        // Clear any saved drafts on successful save
        ErrorRecoveryService.clearDraft('autosave')
        
        // Reset to idle after 3 seconds
        setTimeout(() => {
          if (isMountedRef.current && saveStatus === 'saved') {
            setSaveStatus('idle')
          }
        }, 3000)
      }
    } catch (error: any) {
      if (!isMountedRef.current) return

      // Determine error type for proper handling
      const isNetworkError = !navigator.onLine || error?.code === 'ECONNABORTED'
      const isConflictError = error?.response?.status === 409
      const isRetryableError = error?.response?.status >= 500 || isNetworkError
      
      // Handle conflict errors
      if (isConflictError && onConflict) {
        setConflictResolution('pending')
        setSaveStatus('error')
        setSaveError('Version conflict detected')
        
        try {
          // Get server version and resolve conflict
          const serverData = error.response.data.current
          const resolvedData = await onConflict(dataToSave, serverData)
          
          if (resolvedData && isMountedRef.current) {
            setConflictResolution('resolved')
            // Retry with resolved data
            await performSave(resolvedData, 0)
          }
        } catch (conflictError) {
          console.error('Conflict resolution failed:', conflictError)
          setConflictResolution(null)
        }
        return
      }

      // Handle retryable errors
      if (attemptNumber < maxRetries && isRetryableError) {
        const nextAttempt = attemptNumber + 1
        const backoffDelay = retryDelay * Math.pow(2, attemptNumber) // Exponential backoff
        
        console.log(`Retrying save (attempt ${nextAttempt}/${maxRetries}) after ${backoffDelay}ms`)
        
        retryTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            performSave(dataToSave, nextAttempt)
          }
        }, backoffDelay)
        
        setSaveStatus('error')
        setSaveError(`Retrying... (${nextAttempt}/${maxRetries})`)
      } else {
        // Max retries reached or non-retryable error
        setSaveStatus('error')
        setSaveError(error instanceof Error ? error.message : 'Failed to save')
        setHasPendingChanges(true)
        
        // Save as draft for recovery
        if (offlineSupport) {
          await ErrorRecoveryService.saveDraft('autosave', dataToSave)
        }
        
        // Handle error with recovery service
        await ErrorRecoveryService.handleError(error, 'autosave', dataToSave, {
          saveOnFailure: true,
          autoRetry: false // We handle retry ourselves
        })
        
        // Reset to idle after 5 seconds for errors
        setTimeout(() => {
          if (isMountedRef.current && saveStatus === 'error') {
            setSaveStatus('idle')
          }
        }, 5000)
      }
    }
  }, [data, enabled, onSave, saveStatus, validateBeforeSave, onConflict, isOffline, offlineSupport, maxRetries, retryDelay])

  // Trigger save manually
  const triggerSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
    }
    performSave(data, 0)
  }, [performSave, data])

  // Auto-save on data change with debouncing
  useEffect(() => {
    if (!enabled) return

    const dataString = JSON.stringify(data)
    
    // Skip if data hasn't changed
    if (dataString === lastDataRef.current) {
      return
    }
    
    lastDataRef.current = dataString
    setHasPendingChanges(dataString !== lastSavedDataRef.current)

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      performSave(data, 0)
    }, delay)

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [data, delay, enabled, performSave])

  return {
    saveStatus,
    lastSaved,
    saveError,
    triggerSave,
    retryCount,
    isOffline,
    hasPendingChanges,
    conflictResolution
  }
}

export default useAutoSave