/**
 * OfflineQueueService - Manages offline operations and synchronization
 * Queues operations when offline and syncs when connection is restored
 */

import axios from 'axios'

interface QueuedOperation {
  id: string
  type: 'create' | 'update' | 'delete' | 'custom'
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  data?: any
  headers?: Record<string, string>
  timestamp: number
  attempts: number
  maxAttempts: number
  priority: number // Higher priority items sync first
  stepId?: string
  description: string
}

interface SyncResult {
  id: string
  success: boolean
  error?: any
  response?: any
}

interface OfflineQueueConfig {
  maxQueueSize?: number
  maxAttempts?: number
  syncInterval?: number
  autoSync?: boolean
  persistQueue?: boolean
}

class OfflineQueueService {
  private static instance: OfflineQueueService
  private queue: Map<string, QueuedOperation> = new Map()
  private isOnline: boolean = navigator.onLine
  private isSyncing: boolean = false
  private syncInterval: NodeJS.Timeout | null = null
  private config: Required<OfflineQueueConfig>
  private listeners: Set<(queue: QueuedOperation[]) => void> = new Set()

  private defaultConfig: Required<OfflineQueueConfig> = {
    maxQueueSize: 100,
    maxAttempts: 3,
    syncInterval: 30000, // 30 seconds
    autoSync: true,
    persistQueue: true
  }

  private constructor(config?: OfflineQueueConfig) {
    this.config = { ...this.defaultConfig, ...config }
    this.initialize()
  }

  public static getInstance(config?: OfflineQueueConfig): OfflineQueueService {
    if (!OfflineQueueService.instance) {
      OfflineQueueService.instance = new OfflineQueueService(config)
    }
    return OfflineQueueService.instance
  }

  /**
   * Initialize the service
   */
  private initialize() {
    // Load persisted queue
    if (this.config.persistQueue) {
      this.loadQueueFromStorage()
    }

    // Setup network listeners
    window.addEventListener('online', () => this.handleOnline())
    window.addEventListener('offline', () => this.handleOffline())

    // Setup periodic sync if auto-sync is enabled
    if (this.config.autoSync) {
      this.startAutoSync()
    }

    // Initial network check
    this.checkNetworkStatus()
  }

  /**
   * Check current network status
   */
  private async checkNetworkStatus() {
    try {
      // Try to reach the API health endpoint
      await axios.get('/api/health', { timeout: 5000 })
      this.isOnline = true
    } catch {
      this.isOnline = navigator.onLine
    }
  }

  /**
   * Handle coming online
   */
  private async handleOnline() {
    console.log('Network connection restored')
    this.isOnline = true
    
    // Emit event
    window.dispatchEvent(new CustomEvent('offline-queue-online'))
    
    // Start syncing if we have queued items
    if (this.queue.size > 0 && !this.isSyncing) {
      await this.syncQueue()
    }
  }

  /**
   * Handle going offline
   */
  private handleOffline() {
    console.log('Network connection lost')
    this.isOnline = false
    
    // Emit event
    window.dispatchEvent(new CustomEvent('offline-queue-offline'))
  }

  /**
   * Start auto-sync interval
   */
  private startAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }

    this.syncInterval = setInterval(() => {
      if (this.isOnline && this.queue.size > 0 && !this.isSyncing) {
        this.syncQueue()
      }
    }, this.config.syncInterval)
  }

  /**
   * Stop auto-sync interval
   */
  private stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  /**
   * Add an operation to the queue
   */
  public enqueue(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'attempts'>): string {
    // Check queue size limit
    if (this.queue.size >= this.config.maxQueueSize) {
      // Remove oldest low-priority item
      const sortedQueue = Array.from(this.queue.values())
        .sort((a, b) => a.priority - b.priority || a.timestamp - b.timestamp)
      
      if (sortedQueue.length > 0 && sortedQueue[0].priority <= operation.priority) {
        this.queue.delete(sortedQueue[0].id)
      } else {
        throw new Error('Offline queue is full')
      }
    }

    const id = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const queuedOperation: QueuedOperation = {
      ...operation,
      id,
      timestamp: Date.now(),
      attempts: 0,
      maxAttempts: operation.maxAttempts || this.config.maxAttempts
    }

    this.queue.set(id, queuedOperation)
    
    // Save to storage
    if (this.config.persistQueue) {
      this.saveQueueToStorage()
    }

    // Notify listeners
    this.notifyListeners()

    // Emit event
    window.dispatchEvent(new CustomEvent('offline-queue-enqueue', { 
      detail: { operation: queuedOperation, queueSize: this.queue.size }
    }))

    // Try to sync immediately if online
    if (this.isOnline && !this.isSyncing) {
      this.syncQueue()
    }

    return id
  }

  /**
   * Remove an operation from the queue
   */
  public dequeue(id: string): boolean {
    const deleted = this.queue.delete(id)
    
    if (deleted) {
      // Save to storage
      if (this.config.persistQueue) {
        this.saveQueueToStorage()
      }

      // Notify listeners
      this.notifyListeners()

      // Emit event
      window.dispatchEvent(new CustomEvent('offline-queue-dequeue', { 
        detail: { id, queueSize: this.queue.size }
      }))
    }

    return deleted
  }

  /**
   * Get all queued operations
   */
  public getQueue(): QueuedOperation[] {
    return Array.from(this.queue.values())
      .sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp)
  }

  /**
   * Get queue size
   */
  public getQueueSize(): number {
    return this.queue.size
  }

  /**
   * Clear the entire queue
   */
  public clearQueue() {
    this.queue.clear()
    
    // Clear storage
    if (this.config.persistQueue) {
      localStorage.removeItem('offline_queue')
    }

    // Notify listeners
    this.notifyListeners()

    // Emit event
    window.dispatchEvent(new CustomEvent('offline-queue-cleared'))
  }

  /**
   * Sync queued operations
   */
  public async syncQueue(): Promise<SyncResult[]> {
    if (this.isSyncing || !this.isOnline) {
      return []
    }

    this.isSyncing = true
    const results: SyncResult[] = []
    const queue = this.getQueue()

    console.log(`Starting sync of ${queue.length} queued operations`)

    // Emit sync start event
    window.dispatchEvent(new CustomEvent('offline-queue-sync-start', { 
      detail: { count: queue.length }
    }))

    for (const operation of queue) {
      try {
        const response = await this.executeOperation(operation)
        
        results.push({
          id: operation.id,
          success: true,
          response: response.data
        })

        // Remove successful operation from queue
        this.dequeue(operation.id)
      } catch (error) {
        operation.attempts++
        
        if (operation.attempts >= operation.maxAttempts) {
          // Max attempts reached, remove from queue
          this.dequeue(operation.id)
          
          results.push({
            id: operation.id,
            success: false,
            error
          })

          // Emit failure event
          window.dispatchEvent(new CustomEvent('offline-queue-operation-failed', { 
            detail: { operation, error }
          }))
        } else {
          // Update attempt count
          this.queue.set(operation.id, operation)
          
          results.push({
            id: operation.id,
            success: false,
            error
          })
        }
      }
    }

    // Save updated queue
    if (this.config.persistQueue) {
      this.saveQueueToStorage()
    }

    this.isSyncing = false

    // Emit sync complete event
    window.dispatchEvent(new CustomEvent('offline-queue-sync-complete', { 
      detail: { 
        results,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        remaining: this.queue.size
      }
    }))

    return results
  }

  /**
   * Execute a queued operation
   */
  private async executeOperation(operation: QueuedOperation): Promise<any> {
    const token = sessionStorage.getItem('onboarding_token') || 
                 localStorage.getItem('auth_token')

    const headers = {
      ...operation.headers,
      'Authorization': token ? `Bearer ${token}` : '',
      'X-Offline-Queue': 'true',
      'X-Original-Timestamp': operation.timestamp.toString()
    }

    const config = {
      headers,
      timeout: 30000 // 30 second timeout
    }

    switch (operation.method) {
      case 'GET':
        return axios.get(operation.endpoint, config)
      case 'POST':
        return axios.post(operation.endpoint, operation.data, config)
      case 'PUT':
        return axios.put(operation.endpoint, operation.data, config)
      case 'PATCH':
        return axios.patch(operation.endpoint, operation.data, config)
      case 'DELETE':
        return axios.delete(operation.endpoint, config)
      default:
        throw new Error(`Unsupported method: ${operation.method}`)
    }
  }

  /**
   * Save queue to localStorage
   */
  private saveQueueToStorage() {
    try {
      const queueArray = Array.from(this.queue.values())
      localStorage.setItem('offline_queue', JSON.stringify(queueArray))
    } catch (error) {
      console.error('Failed to save offline queue to storage:', error)
    }
  }

  /**
   * Load queue from localStorage
   */
  private loadQueueFromStorage() {
    try {
      const stored = localStorage.getItem('offline_queue')
      if (stored) {
        const queueArray = JSON.parse(stored) as QueuedOperation[]
        queueArray.forEach(op => {
          this.queue.set(op.id, op)
        })
        console.log(`Loaded ${queueArray.length} operations from offline queue`)
      }
    } catch (error) {
      console.error('Failed to load offline queue from storage:', error)
    }
  }

  /**
   * Subscribe to queue changes
   */
  public subscribe(listener: (queue: QueuedOperation[]) => void): () => void {
    this.listeners.add(listener)
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Notify all listeners of queue changes
   */
  private notifyListeners() {
    const queue = this.getQueue()
    this.listeners.forEach(listener => listener(queue))
  }

  /**
   * Get sync status
   */
  public getSyncStatus(): {
    isOnline: boolean
    isSyncing: boolean
    queueSize: number
    oldestOperation: QueuedOperation | null
  } {
    const queue = this.getQueue()
    const oldestOperation = queue.length > 0 
      ? queue[queue.length - 1] 
      : null

    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      queueSize: this.queue.size,
      oldestOperation
    }
  }

  /**
   * Force a sync attempt
   */
  public async forceSync(): Promise<SyncResult[]> {
    // Temporarily mark as online to attempt sync
    const wasOnline = this.isOnline
    this.isOnline = true
    
    try {
      return await this.syncQueue()
    } finally {
      this.isOnline = wasOnline
    }
  }

  /**
   * Destroy the service
   */
  public destroy() {
    this.stopAutoSync()
    window.removeEventListener('online', () => this.handleOnline())
    window.removeEventListener('offline', () => this.handleOffline())
    this.listeners.clear()
  }
}

// Helper function to queue form saves
export const queueFormSave = (
  stepId: string,
  data: any,
  priority: number = 5
): string => {
  const service = OfflineQueueService.getInstance()
  
  return service.enqueue({
    type: 'update',
    endpoint: `/api/onboarding/steps/${stepId}/save`,
    method: 'POST',
    data,
    priority,
    stepId,
    description: `Save ${stepId} form data`,
    maxAttempts: 5
  })
}

// Helper function to queue document uploads
export const queueDocumentUpload = (
  documentType: string,
  fileData: any,
  priority: number = 3
): string => {
  const service = OfflineQueueService.getInstance()
  
  return service.enqueue({
    type: 'create',
    endpoint: `/api/documents/upload`,
    method: 'POST',
    data: { type: documentType, file: fileData },
    priority,
    description: `Upload ${documentType} document`,
    maxAttempts: 3
  })
}

export default OfflineQueueService.getInstance()