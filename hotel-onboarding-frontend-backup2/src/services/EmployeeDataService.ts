import { secureStorage } from './SecureStorageService'
import apiService from './apiService'

export interface PersonalInfo {
  firstName?: string
  lastName?: string
  middleInitial?: string
  ssn?: string
  phone?: string
  email?: string
}

export class EmployeeDataService {
  private static instance: EmployeeDataService
  private cache = new Map<string, any>()
  private cacheTTLms = 5 * 60 * 1000
  private timestamps = new Map<string, number>()

  static getInstance(): EmployeeDataService {
    if (!this.instance) this.instance = new EmployeeDataService()
    return this.instance
  }

  private isFresh(key: string): boolean {
    const ts = this.timestamps.get(key)
    return !!ts && Date.now() - ts < this.cacheTTLms
  }

  async getPersonalInfo(): Promise<PersonalInfo | null> {
    const key = 'personalInfo'
    if (this.cache.has(key) && this.isFresh(key)) {
      return this.cache.get(key)
    }

    // Try secure session storage
    const stored = await secureStorage.secureRetrieve<any>('onboarding_personal-info_data')
    const fromStorage = stored?.personalInfo || stored || null
    if (fromStorage) {
      this.cache.set(key, fromStorage)
      this.timestamps.set(key, Date.now())
      return fromStorage
    }

    // Fallback API call if available (requires an endpoint)
    try {
      // Example endpoint; adjust if backend exposes personal info route
      const employees = await apiService.getEmployees()
      // We don't have a specific personal info endpoint here; return null
      return null
    } catch {
      return null
    }
  }

  async getEmployeeName(): Promise<string> {
    const info = await this.getPersonalInfo()
    const first = info?.firstName || ''
    const last = info?.lastName || ''
    return `${first} ${last}`.trim()
  }
}

export const employeeDataService = EmployeeDataService.getInstance()

