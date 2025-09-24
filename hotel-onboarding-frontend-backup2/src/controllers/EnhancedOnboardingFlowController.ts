import { OnboardingStep, OnboardingProgress } from '../types/onboarding'

interface StepMetrics {
  stepId: string
  name: string
  startTime?: Date
  endTime?: Date
  timeSpent: number
  fieldsTotal: number
  fieldsCompleted: number
  validationErrors: string[]
  isRequired: boolean
  isFederalForm: boolean
  complianceDeadline?: Date
  estimatedMinutes: number
}

interface ComplianceStatus {
  i9Section1: {
    required: boolean
    deadline: Date
    completed: boolean
    daysRemaining: number
  }
  i9Section2: {
    required: boolean
    deadline: Date
    completed: boolean
    daysRemaining: number
  }
  w4: {
    required: boolean
    completed: boolean
  }
}

interface SessionData {
  sessionId: string
  startTime: Date
  lastActivity: Date
  totalTimeSpent: number
  abandonmentPoint?: string
  completionPrediction?: Date
  deviceInfo: {
    type: 'mobile' | 'tablet' | 'desktop'
    browser: string
  }
}

export class EnhancedOnboardingFlowController {
  private steps: OnboardingStep[]
  private progress: OnboardingProgress
  private metrics: Map<string, StepMetrics>
  private sessionData: SessionData
  private averageStepTimes: Map<string, number>

  constructor(steps: OnboardingStep[], initialProgress?: OnboardingProgress) {
    this.steps = steps
    this.progress = initialProgress || this.initializeProgress()
    this.metrics = new Map()
    this.sessionData = this.initializeSession()
    this.averageStepTimes = this.loadAverageStepTimes()
    this.initializeMetrics()
  }

  private initializeProgress(): OnboardingProgress {
    return {
      currentStepIndex: 0,
      completedSteps: [],
      stepData: {},
      startedAt: new Date(),
      lastUpdated: new Date()
    }
  }

  private initializeSession(): SessionData {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const deviceType = this.detectDeviceType()
    
    return {
      sessionId,
      startTime: new Date(),
      lastActivity: new Date(),
      totalTimeSpent: 0,
      deviceInfo: {
        type: deviceType,
        browser: navigator.userAgent
      }
    }
  }

  private detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const width = window.innerWidth
    if (width < 768) return 'mobile'
    if (width < 1024) return 'tablet'
    return 'desktop'
  }

  private loadAverageStepTimes(): Map<string, number> {
    // Load from localStorage or use defaults
    const stored = localStorage.getItem('onboarding_average_times')
    if (stored) {
      return new Map(JSON.parse(stored))
    }

    // Default estimates in minutes
    const defaults = new Map([
      ['personal-info', 5],
      ['job-application', 8],
      ['tax-withholding', 10],
      ['direct-deposit', 5],
      ['emergency-contact', 3],
      ['employment-eligibility', 15],
      ['company-policies', 10],
      ['health-insurance', 12],
      ['uniform-sizes', 2],
      ['property-systems', 5],
      ['training-acknowledgment', 3],
      ['final-agreements', 5]
    ])

    return defaults
  }

  private initializeMetrics(): void {
    this.steps.forEach(step => {
      const isFederalForm = ['tax-withholding', 'employment-eligibility'].includes(step.id)
      const estimatedMinutes = this.averageStepTimes.get(step.id) || 5

      this.metrics.set(step.id, {
        stepId: step.id,
        name: step.title,
        timeSpent: 0,
        fieldsTotal: this.countStepFields(step),
        fieldsCompleted: 0,
        validationErrors: [],
        isRequired: step.required,
        isFederalForm,
        estimatedMinutes
      })
    })
  }

  private countStepFields(step: OnboardingStep): number {
    // Count based on step type - this would be customized per step
    const fieldCounts: Record<string, number> = {
      'personal-info': 12,
      'job-application': 8,
      'tax-withholding': 15,
      'direct-deposit': 6,
      'emergency-contact': 8,
      'employment-eligibility': 20,
      'company-policies': 3,
      'health-insurance': 10,
      'uniform-sizes': 4,
      'property-systems': 5,
      'training-acknowledgment': 2,
      'final-agreements': 4
    }

    return fieldCounts[step.id] || 5
  }

  public getOverallProgress(): {
    percentage: number
    stepsCompleted: number
    stepsTotal: number
    requiredStepsRemaining: number
    estimatedTimeRemaining: number
    predictedCompletion: Date
  } {
    const completed = this.progress.completedSteps.length
    const total = this.steps.length
    const percentage = Math.round((completed / total) * 100)

    const requiredStepsRemaining = this.steps
      .filter(s => s.required && !this.progress.completedSteps.includes(s.id))
      .length

    const estimatedTimeRemaining = this.calculateRemainingTime()
    const predictedCompletion = this.predictCompletionTime()

    return {
      percentage,
      stepsCompleted: completed,
      stepsTotal: total,
      requiredStepsRemaining,
      estimatedTimeRemaining,
      predictedCompletion
    }
  }

  public getStepProgress(stepId: string): {
    percentage: number
    fieldsCompleted: number
    fieldsTotal: number
    timeSpent: number
    estimatedTimeRemaining: number
    validationStatus: 'valid' | 'invalid' | 'incomplete'
    errors: string[]
  } {
    const metrics = this.metrics.get(stepId)
    if (!metrics) {
      throw new Error(`Step ${stepId} not found`)
    }

    const percentage = metrics.fieldsTotal > 0 
      ? Math.round((metrics.fieldsCompleted / metrics.fieldsTotal) * 100)
      : 0

    const estimatedTimeRemaining = Math.max(
      0,
      metrics.estimatedMinutes - (metrics.timeSpent / 60)
    )

    const validationStatus = metrics.validationErrors.length > 0
      ? 'invalid'
      : metrics.fieldsCompleted === metrics.fieldsTotal
      ? 'valid'
      : 'incomplete'

    return {
      percentage,
      fieldsCompleted: metrics.fieldsCompleted,
      fieldsTotal: metrics.fieldsTotal,
      timeSpent: metrics.timeSpent,
      estimatedTimeRemaining,
      validationStatus,
      errors: metrics.validationErrors
    }
  }

  public getComplianceStatus(): ComplianceStatus {
    const hireDate = this.progress.stepData['job-application']?.startDate || new Date()
    const i9Section1Deadline = new Date(hireDate)
    const i9Section2Deadline = new Date(hireDate)
    i9Section2Deadline.setDate(i9Section2Deadline.getDate() + 3)

    const now = new Date()
    const i9Completed = this.progress.completedSteps.includes('employment-eligibility')
    const w4Completed = this.progress.completedSteps.includes('tax-withholding')

    return {
      i9Section1: {
        required: true,
        deadline: i9Section1Deadline,
        completed: i9Completed,
        daysRemaining: Math.max(0, Math.ceil((i9Section1Deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      },
      i9Section2: {
        required: true,
        deadline: i9Section2Deadline,
        completed: false, // Manager completes this
        daysRemaining: Math.max(0, Math.ceil((i9Section2Deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      },
      w4: {
        required: true,
        completed: w4Completed
      }
    }
  }

  public getNextRequiredStep(): OnboardingStep | null {
    for (const step of this.steps) {
      if (step.required && !this.progress.completedSteps.includes(step.id)) {
        return step
      }
    }
    return null
  }

  public updateStepProgress(stepId: string, data: {
    fieldsCompleted?: number
    validationErrors?: string[]
    timeSpent?: number
  }): void {
    const metrics = this.metrics.get(stepId)
    if (!metrics) return

    if (data.fieldsCompleted !== undefined) {
      metrics.fieldsCompleted = data.fieldsCompleted
    }
    if (data.validationErrors !== undefined) {
      metrics.validationErrors = data.validationErrors
    }
    if (data.timeSpent !== undefined) {
      metrics.timeSpent += data.timeSpent
    }

    // Update session data
    this.sessionData.lastActivity = new Date()
    this.sessionData.totalTimeSpent += data.timeSpent || 0

    // Save to localStorage for persistence
    this.saveProgress()
  }

  public markStepComplete(stepId: string): void {
    if (!this.progress.completedSteps.includes(stepId)) {
      this.progress.completedSteps.push(stepId)
      
      const metrics = this.metrics.get(stepId)
      if (metrics) {
        metrics.endTime = new Date()
        metrics.fieldsCompleted = metrics.fieldsTotal
        metrics.validationErrors = []
      }

      this.saveProgress()
      this.updateAverageStepTimes(stepId)
    }
  }

  private updateAverageStepTimes(stepId: string): void {
    const metrics = this.metrics.get(stepId)
    if (!metrics || !metrics.timeSpent) return

    const currentAverage = this.averageStepTimes.get(stepId) || 0
    const newTime = metrics.timeSpent / 60 // Convert to minutes
    
    // Weighted average (give more weight to recent times)
    const updatedAverage = (currentAverage * 0.7 + newTime * 0.3)
    this.averageStepTimes.set(stepId, updatedAverage)

    // Save to localStorage
    localStorage.setItem(
      'onboarding_average_times',
      JSON.stringify(Array.from(this.averageStepTimes.entries()))
    )
  }

  private calculateRemainingTime(): number {
    let totalMinutes = 0

    this.steps.forEach(step => {
      if (!this.progress.completedSteps.includes(step.id)) {
        const metrics = this.metrics.get(step.id)
        if (metrics) {
          const remaining = metrics.estimatedMinutes * 
            (1 - metrics.fieldsCompleted / metrics.fieldsTotal)
          totalMinutes += remaining
        }
      }
    })

    return Math.round(totalMinutes)
  }

  private predictCompletionTime(): Date {
    const remainingMinutes = this.calculateRemainingTime()
    const prediction = new Date()
    prediction.setMinutes(prediction.getMinutes() + remainingMinutes)
    return prediction
  }

  public getDetailedAnalytics(): {
    averageTimePerStep: number
    bottlenecks: string[]
    abandonmentRisk: 'low' | 'medium' | 'high'
    completionRate: number
    deviceBreakdown: Record<string, number>
  } {
    const completedSteps = this.progress.completedSteps.length
    const totalTime = this.sessionData.totalTimeSpent
    const averageTimePerStep = completedSteps > 0 ? totalTime / completedSteps : 0

    // Identify bottlenecks (steps taking 50% longer than average)
    const bottlenecks: string[] = []
    this.metrics.forEach((metrics, stepId) => {
      if (metrics.timeSpent > metrics.estimatedMinutes * 1.5 * 60) {
        bottlenecks.push(stepId)
      }
    })

    // Calculate abandonment risk
    const timeSinceLastActivity = 
      (new Date().getTime() - this.sessionData.lastActivity.getTime()) / 1000
    const abandonmentRisk = 
      timeSinceLastActivity > 1800 ? 'high' :
      timeSinceLastActivity > 600 ? 'medium' : 'low'

    const completionRate = (completedSteps / this.steps.length) * 100

    return {
      averageTimePerStep,
      bottlenecks,
      abandonmentRisk,
      completionRate,
      deviceBreakdown: {
        [this.sessionData.deviceInfo.type]: 100
      }
    }
  }

  public saveProgress(): void {
    const data = {
      progress: this.progress,
      metrics: Array.from(this.metrics.entries()),
      sessionData: this.sessionData
    }

    localStorage.setItem('enhanced_onboarding_progress', JSON.stringify(data))
  }

  public loadProgress(): boolean {
    const stored = localStorage.getItem('enhanced_onboarding_progress')
    if (!stored) return false

    try {
      const data = JSON.parse(stored)
      this.progress = data.progress
      this.metrics = new Map(data.metrics)
      this.sessionData = data.sessionData
      return true
    } catch (error) {
      console.error('Failed to load progress:', error)
      return false
    }
  }

  public exportProgressReport(): string {
    const overall = this.getOverallProgress()
    const compliance = this.getComplianceStatus()
    const analytics = this.getDetailedAnalytics()

    const report = {
      sessionId: this.sessionData.sessionId,
      generatedAt: new Date().toISOString(),
      overall,
      compliance,
      analytics,
      stepDetails: Array.from(this.metrics.values())
    }

    return JSON.stringify(report, null, 2)
  }

  public clearProgress(): void {
    localStorage.removeItem('enhanced_onboarding_progress')
    this.progress = this.initializeProgress()
    this.initializeMetrics()
    this.sessionData = this.initializeSession()
  }
}