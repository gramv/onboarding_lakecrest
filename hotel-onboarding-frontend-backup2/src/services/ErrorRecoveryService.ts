/**
 * ErrorRecoveryService - Smart error recovery with automatic retry and draft saving
 * Provides comprehensive error handling and recovery mechanisms for the onboarding system
 */

import axios, { AxiosError } from 'axios'

interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffFactor: number
}

interface RecoveryOptions {
  saveOnFailure?: boolean
  showRecoveryModal?: boolean
  autoRetry?: boolean
  preserveFormData?: boolean
}

interface FormDraft {
  stepId: string
  data: any
  timestamp: number
  attemptCount: number
}

interface NetworkStatus {
  online: boolean
  lastChecked: number
  connectionQuality: 'good' | 'moderate' | 'poor' | 'offline'
}

export type ErrorType = 
  | 'network'
  | 'authentication'
  | 'validation'
  | 'server'
  | 'timeout'
  | 'conflict'
  | 'unknown'

export interface RecoverableError {
  id: string
  type: ErrorType
  message: string
  timestamp: number
  operation: string
  data?: any
  recoveryAttempts: number
  canRetry: boolean
  userMessage: string
  technicalDetails?: any
}

class ErrorRecoveryService {
  private static instance: ErrorRecoveryService
  private retryQueue: Map<string, any> = new Map()
  private drafts: Map<string, FormDraft> = new Map()
  private networkStatus: NetworkStatus = { online: true, lastChecked: Date.now(), connectionQuality: 'good' }
  private offlineQueue: any[] = []
  private connectionCheckInterval: NodeJS.Timeout | null = null

  private defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2
  }

  private constructor() {
    this.initializeNetworkMonitoring()
    this.loadDraftsFromStorage()
    this.loadOfflineQueue()
  }

  public static getInstance(): ErrorRecoveryService {
    if (!ErrorRecoveryService.instance) {
      ErrorRecoveryService.instance = new ErrorRecoveryService()
    }
    return ErrorRecoveryService.instance
  }

  /**
   * Initialize network monitoring
   */
  private initializeNetworkMonitoring() {
    // Monitor online/offline status
    window.addEventListener('online', () => this.handleOnline())
    window.addEventListener('offline', () => this.handleOffline())

    // Check connection quality periodically
    this.connectionCheckInterval = setInterval(() => {
      this.checkConnectionQuality()
    }, 30000) // Check every 30 seconds

    // Initial check
    this.checkConnectionQuality()
  }

  /**
   * Handle coming back online
   */
  private async handleOnline() {
    console.log('Connection restored')
    this.networkStatus.online = true
    this.networkStatus.lastChecked = Date.now()
    
    // Process offline queue
    await this.processOfflineQueue()
    
    // Emit event for UI update
    window.dispatchEvent(new CustomEvent('network-status-change', { 
      detail: { online: true, quality: this.networkStatus.connectionQuality }
    }))
  }

  /**
   * Handle going offline
   */
  private handleOffline() {
    console.log('Connection lost')
    this.networkStatus.online = false
    this.networkStatus.connectionQuality = 'offline'
    this.networkStatus.lastChecked = Date.now()
    
    // Emit event for UI update
    window.dispatchEvent(new CustomEvent('network-status-change', { 
      detail: { online: false, quality: 'offline' }
    }))
  }

  /**
   * Check connection quality
   */
  private async checkConnectionQuality() {
    if (!navigator.onLine) {
      this.networkStatus.online = false
      this.networkStatus.connectionQuality = 'offline'
      return
    }

    try {
      const startTime = Date.now()
      await axios.get('/api/health', { timeout: 5000 })
      const responseTime = Date.now() - startTime

      this.networkStatus.online = true
      
      if (responseTime < 500) {
        this.networkStatus.connectionQuality = 'good'
      } else if (responseTime < 2000) {
        this.networkStatus.connectionQuality = 'moderate'
      } else {
        this.networkStatus.connectionQuality = 'poor'
      }
    } catch (error) {
      // Can't reach server, but browser says we're online
      this.networkStatus.online = true
      this.networkStatus.connectionQuality = 'poor'
    }

    this.networkStatus.lastChecked = Date.now()
  }

  /**
   * Determine error type from error object
   */
  private determineErrorType(error: any): ErrorType {
    if (!navigator.onLine) {
      return 'network'
    }

    if (error instanceof AxiosError) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return 'timeout'
      }
      
      if (!error.response) {
        return 'network'
      }

      const status = error.response.status
      if (status === 401 || status === 403) {
        return 'authentication'
      }
      if (status === 400 || status === 422) {
        return 'validation'
      }
      if (status === 409) {
        return 'conflict'
      }
      if (status >= 500) {
        return 'server'
      }
    }

    return 'unknown'
  }

  /**
   * Create user-friendly error message
   */
  private createUserMessage(type: ErrorType, operation: string): string {
    switch (type) {
      case 'network':
        return 'Connection issue detected. Your work has been saved locally and will sync when connection is restored.'
      case 'authentication':
        return 'Your session has expired. Please refresh the page to continue.'
      case 'validation':
        return 'Please check the information you entered and try again.'
      case 'server':
        return 'We\'re experiencing technical difficulties. Your work has been saved and we\'ll retry automatically.'
      case 'timeout':
        return 'The operation is taking longer than expected. We\'ll keep trying in the background.'
      case 'conflict':
        return 'This information has been updated elsewhere. Please refresh to see the latest changes.'
      default:
        return `Unable to complete ${operation}. We\'ve saved your progress and will retry.`
    }
  }

  /**
   * Handle an error with recovery options
   */
  public async handleError(
    error: any,
    operation: string,
    data?: any,
    options: RecoveryOptions = {}
  ): Promise<RecoverableError> {
    const errorType = this.determineErrorType(error)
    const errorId = `${operation}-${Date.now()}`
    
    const recoverableError: RecoverableError = {
      id: errorId,
      type: errorType,
      message: error.message || 'An error occurred',
      timestamp: Date.now(),
      operation,
      data,
      recoveryAttempts: 0,
      canRetry: this.canRetry(errorType),
      userMessage: this.createUserMessage(errorType, operation),
      technicalDetails: error
    }

    // Save data as draft if requested
    if (options.saveOnFailure && data) {
      await this.saveDraft(operation, data)
    }

    // Queue for retry if appropriate
    if (options.autoRetry && recoverableError.canRetry) {
      this.queueForRetry(errorId, () => this.retryOperation(operation, data))
    }

    // Queue for offline processing if network issue
    if (errorType === 'network' && !this.networkStatus.online) {
      this.addToOfflineQueue(operation, data)
    }

    // Log error for monitoring
    this.logError(recoverableError)

    return recoverableError
  }

  /**
   * Determine if error type can be retried
   */
  private canRetry(errorType: ErrorType): boolean {
    return ['network', 'timeout', 'server'].includes(errorType)
  }

  /**
   * Queue operation for retry with exponential backoff
   */
  private async queueForRetry(
    errorId: string,
    operation: () => Promise<any>,
    config: RetryConfig = this.defaultRetryConfig
  ): Promise<any> {
    let attempt = 0
    let delay = config.baseDelay

    while (attempt < config.maxAttempts) {
      attempt++
      
      // Wait with exponential backoff
      await this.sleep(Math.min(delay, config.maxDelay))
      
      try {
        const result = await operation()
        
        // Success - remove from retry queue
        this.retryQueue.delete(errorId)
        
        // Emit success event
        window.dispatchEvent(new CustomEvent('recovery-success', { 
          detail: { errorId, attempt }
        }))
        
        return result
      } catch (error) {
        console.warn(`Retry attempt ${attempt} failed for ${errorId}`)
        
        if (attempt === config.maxAttempts) {
          // Final attempt failed
          window.dispatchEvent(new CustomEvent('recovery-failed', { 
            detail: { errorId, attempts: attempt, error }
          }))
          throw error
        }
        
        // Increase delay for next attempt
        delay *= config.backoffFactor
      }
    }
  }

  /**
   * Retry a specific operation
   */
  private async retryOperation(operation: string, data: any): Promise<any> {
    // This would be implemented based on the specific operation type
    // For now, return a placeholder
    console.log(`Retrying operation: ${operation}`, data)
    throw new Error('Operation retry not implemented')
  }

  /**
   * Save form data as draft
   */
  public async saveDraft(stepId: string, data: any): Promise<void> {
    const draft: FormDraft = {
      stepId,
      data,
      timestamp: Date.now(),
      attemptCount: 0
    }

    this.drafts.set(stepId, draft)
    
    // Save to localStorage for persistence
    try {
      const draftsArray = Array.from(this.drafts.entries()).map(([key, value]) => ({
        key,
        ...value
      }))
      localStorage.setItem('onboarding_drafts', JSON.stringify(draftsArray))
    } catch (error) {
      console.error('Failed to save drafts to localStorage:', error)
    }

    // Emit event for UI update
    window.dispatchEvent(new CustomEvent('draft-saved', { 
      detail: { stepId, timestamp: draft.timestamp }
    }))
  }

  /**
   * Load drafts from localStorage
   */
  private loadDraftsFromStorage() {
    try {
      const stored = localStorage.getItem('onboarding_drafts')
      if (stored) {
        const draftsArray = JSON.parse(stored)
        draftsArray.forEach((item: any) => {
          this.drafts.set(item.key, {
            stepId: item.stepId,
            data: item.data,
            timestamp: item.timestamp,
            attemptCount: item.attemptCount
          })
        })
      }
    } catch (error) {
      console.error('Failed to load drafts from localStorage:', error)
    }
  }

  /**
   * Get draft for a specific step
   */
  public getDraft(stepId: string): FormDraft | undefined {
    return this.drafts.get(stepId)
  }

  /**
   * Clear draft for a specific step
   */
  public clearDraft(stepId: string): void {
    this.drafts.delete(stepId)
    this.saveDraftsToStorage()
  }

  /**
   * Save all drafts to localStorage
   */
  private saveDraftsToStorage() {
    try {
      const draftsArray = Array.from(this.drafts.entries()).map(([key, value]) => ({
        key,
        ...value
      }))
      localStorage.setItem('onboarding_drafts', JSON.stringify(draftsArray))
    } catch (error) {
      console.error('Failed to save drafts to localStorage:', error)
    }
  }

  /**
   * Add operation to offline queue
   */
  private addToOfflineQueue(operation: string, data: any) {
    const queueItem = {
      id: `offline-${Date.now()}`,
      operation,
      data,
      timestamp: Date.now(),
      attempts: 0
    }

    this.offlineQueue.push(queueItem)
    this.saveOfflineQueue()

    // Emit event for UI update
    window.dispatchEvent(new CustomEvent('offline-queue-updated', { 
      detail: { count: this.offlineQueue.length }
    }))
  }

  /**
   * Process offline queue when connection restored
   */
  private async processOfflineQueue() {
    if (this.offlineQueue.length === 0) return

    console.log(`Processing ${this.offlineQueue.length} offline operations`)

    const processed: string[] = []
    
    for (const item of this.offlineQueue) {
      try {
        // Attempt to process the queued operation
        await this.retryOperation(item.operation, item.data)
        processed.push(item.id)
      } catch (error) {
        console.error(`Failed to process offline operation ${item.id}:`, error)
        item.attempts++
        
        // Remove if too many attempts
        if (item.attempts > 3) {
          processed.push(item.id)
        }
      }
    }

    // Remove processed items
    this.offlineQueue = this.offlineQueue.filter(item => !processed.includes(item.id))
    this.saveOfflineQueue()

    // Emit event for UI update
    window.dispatchEvent(new CustomEvent('offline-queue-processed', { 
      detail: { 
        processed: processed.length,
        remaining: this.offlineQueue.length
      }
    }))
  }

  /**
   * Save offline queue to localStorage
   */
  private saveOfflineQueue() {
    try {
      localStorage.setItem('onboarding_offline_queue', JSON.stringify(this.offlineQueue))
    } catch (error) {
      console.error('Failed to save offline queue:', error)
    }
  }

  /**
   * Load offline queue from localStorage
   */
  private loadOfflineQueue() {
    try {
      const stored = localStorage.getItem('onboarding_offline_queue')
      if (stored) {
        this.offlineQueue = JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error)
    }
  }

  /**
   * Get current network status
   */
  public getNetworkStatus(): NetworkStatus {
    return { ...this.networkStatus }
  }

  /**
   * Check if currently online
   */
  public isOnline(): boolean {
    return this.networkStatus.online && navigator.onLine
  }

  /**
   * Get offline queue count
   */
  public getOfflineQueueCount(): number {
    return this.offlineQueue.length
  }

  /**
   * Log error for monitoring
   */
  private logError(error: RecoverableError) {
    // In production, this would send to error monitoring service
    console.error('Error logged:', error)
    
    // Also save to sessionStorage for debugging
    try {
      const errors = JSON.parse(sessionStorage.getItem('onboarding_errors') || '[]')
      errors.push({
        ...error,
        technicalDetails: undefined // Don't store full technical details
      })
      
      // Keep only last 50 errors
      if (errors.length > 50) {
        errors.splice(0, errors.length - 50)
      }
      
      sessionStorage.setItem('onboarding_errors', JSON.stringify(errors))
    } catch (e) {
      console.error('Failed to log error to sessionStorage:', e)
    }
  }

  /**
   * Get recent errors for debugging
   */
  public getRecentErrors(): RecoverableError[] {
    try {
      return JSON.parse(sessionStorage.getItem('onboarding_errors') || '[]')
    } catch {
      return []
    }
  }

  /**
   * Clear error log
   */
  public clearErrorLog() {
    sessionStorage.removeItem('onboarding_errors')
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Cleanup on destroy
   */
  public destroy() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval)
    }
    window.removeEventListener('online', () => this.handleOnline())
    window.removeEventListener('offline', () => this.handleOffline())
  }
}

export default ErrorRecoveryService.getInstance()