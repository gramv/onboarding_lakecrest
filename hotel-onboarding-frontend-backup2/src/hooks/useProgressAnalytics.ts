import { useState, useEffect, useCallback, useRef } from 'react'
import { EnhancedOnboardingFlowController } from '../controllers/EnhancedOnboardingFlowController'
import { OnboardingStep, OnboardingProgress } from '../types/onboarding'

interface ProgressAnalytics {
  // Overall metrics
  overallProgress: {
    percentage: number
    stepsCompleted: number
    stepsTotal: number
    requiredStepsRemaining: number
    estimatedTimeRemaining: number
    predictedCompletion: Date
  }
  
  // Step-specific metrics
  currentStepProgress: {
    percentage: number
    fieldsCompleted: number
    fieldsTotal: number
    timeSpent: number
    estimatedTimeRemaining: number
    validationStatus: 'valid' | 'invalid' | 'incomplete'
    errors: string[]
  }
  
  // Compliance tracking
  complianceStatus: {
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
  
  // Performance analytics
  analytics: {
    averageTimePerStep: number
    bottlenecks: string[]
    abandonmentRisk: 'low' | 'medium' | 'high'
    completionRate: number
    deviceBreakdown: Record<string, number>
  }
  
  // Navigation helpers
  nextRequiredStep: OnboardingStep | null
  previousStep: OnboardingStep | null
  canSkipCurrent: boolean
}

interface UseProgressAnalyticsOptions {
  steps: OnboardingStep[]
  initialProgress?: OnboardingProgress
  autoSave?: boolean
  saveInterval?: number
  trackingEnabled?: boolean
}

export const useProgressAnalytics = ({
  steps,
  initialProgress,
  autoSave = true,
  saveInterval = 30000, // 30 seconds
  trackingEnabled = true
}: UseProgressAnalyticsOptions) => {
  const controllerRef = useRef<EnhancedOnboardingFlowController>()
  const trackingIntervalRef = useRef<NodeJS.Timeout>()
  const saveIntervalRef = useRef<NodeJS.Timeout>()
  const fieldTrackingRef = useRef<Map<string, number>>(new Map())
  
  const [analytics, setAnalytics] = useState<ProgressAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentStepId, setCurrentStepId] = useState<string>('')
  const [timeOnStep, setTimeOnStep] = useState(0)

  // Initialize controller
  useEffect(() => {
    const controller = new EnhancedOnboardingFlowController(steps, initialProgress)
    
    // Try to load saved progress
    const hasProgress = controller.loadProgress()
    if (hasProgress) {
      console.log('Loaded saved progress from localStorage')
    }
    
    controllerRef.current = controller
    updateAnalytics()
    setIsLoading(false)

    // Set current step
    if (steps.length > 0) {
      const progress = controller['progress'] // Access private member
      setCurrentStepId(steps[progress.currentStepIndex]?.id || steps[0].id)
    }
  }, [steps, initialProgress])

  // Update analytics
  const updateAnalytics = useCallback(() => {
    if (!controllerRef.current) return

    const controller = controllerRef.current
    const overall = controller.getOverallProgress()
    const compliance = controller.getComplianceStatus()
    const detailedAnalytics = controller.getDetailedAnalytics()
    const nextStep = controller.getNextRequiredStep()
    
    // Get current step progress
    let currentProgress = null
    if (currentStepId) {
      try {
        currentProgress = controller.getStepProgress(currentStepId)
      } catch (error) {
        console.error('Error getting step progress:', error)
      }
    }

    // Find previous step
    const currentIndex = steps.findIndex(s => s.id === currentStepId)
    const previousStep = currentIndex > 0 ? steps[currentIndex - 1] : null
    const currentStep = steps[currentIndex]
    const canSkip = currentStep ? !currentStep.required : false

    setAnalytics({
      overallProgress: overall,
      currentStepProgress: currentProgress || {
        percentage: 0,
        fieldsCompleted: 0,
        fieldsTotal: 0,
        timeSpent: 0,
        estimatedTimeRemaining: 0,
        validationStatus: 'incomplete',
        errors: []
      },
      complianceStatus: compliance,
      analytics: detailedAnalytics,
      nextRequiredStep: nextStep,
      previousStep,
      canSkipCurrent: canSkip
    })
  }, [currentStepId, steps])

  // Track time on current step
  useEffect(() => {
    if (!trackingEnabled || !currentStepId) return

    const startTime = Date.now()
    
    trackingIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      setTimeOnStep(elapsed)
      
      // Update controller with time spent
      if (controllerRef.current) {
        controllerRef.current.updateStepProgress(currentStepId, {
          timeSpent: 1 // Add 1 second
        })
        updateAnalytics()
      }
    }, 1000)

    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current)
      }
    }
  }, [currentStepId, trackingEnabled, updateAnalytics])

  // Auto-save progress
  useEffect(() => {
    if (!autoSave || !controllerRef.current) return

    saveIntervalRef.current = setInterval(() => {
      controllerRef.current?.saveProgress()
      console.log('Auto-saved progress')
    }, saveInterval)

    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current)
      }
    }
  }, [autoSave, saveInterval])

  // Track field interactions
  const trackFieldInteraction = useCallback((fieldName: string) => {
    if (!trackingEnabled) return

    const interactions = fieldTrackingRef.current.get(fieldName) || 0
    fieldTrackingRef.current.set(fieldName, interactions + 1)

    // Identify potential problem fields (interacted with more than 3 times)
    if (interactions > 3) {
      console.warn(`Field "${fieldName}" has been interacted with ${interactions} times - potential usability issue`)
    }
  }, [trackingEnabled])

  // Update step progress
  const updateStepProgress = useCallback((stepId: string, data: {
    fieldsCompleted?: number
    validationErrors?: string[]
    fieldData?: Record<string, any>
  }) => {
    if (!controllerRef.current) return

    controllerRef.current.updateStepProgress(stepId, data)
    updateAnalytics()

    if (autoSave) {
      controllerRef.current.saveProgress()
    }
  }, [autoSave, updateAnalytics])

  // Mark step as complete
  const markStepComplete = useCallback((stepId: string) => {
    if (!controllerRef.current) return

    controllerRef.current.markStepComplete(stepId)
    updateAnalytics()

    // Move to next step
    const currentIndex = steps.findIndex(s => s.id === stepId)
    if (currentIndex < steps.length - 1) {
      setCurrentStepId(steps[currentIndex + 1].id)
      setTimeOnStep(0)
    }

    if (autoSave) {
      controllerRef.current.saveProgress()
    }
  }, [steps, autoSave, updateAnalytics])

  // Navigate to step
  const navigateToStep = useCallback((stepId: string) => {
    setCurrentStepId(stepId)
    setTimeOnStep(0)
    updateAnalytics()
  }, [updateAnalytics])

  // Get bottleneck analysis
  const getBottleneckAnalysis = useCallback(() => {
    if (!analytics) return null

    const { bottlenecks } = analytics.analytics
    
    return {
      hasBottlenecks: bottlenecks.length > 0,
      bottleneckSteps: bottlenecks.map(stepId => {
        const step = steps.find(s => s.id === stepId)
        return {
          stepId,
          stepName: step?.title || stepId,
          recommendation: getBottleneckRecommendation(stepId)
        }
      })
    }
  }, [analytics, steps])

  // Get bottleneck recommendations
  const getBottleneckRecommendation = (stepId: string): string => {
    const recommendations: Record<string, string> = {
      'tax-withholding': 'Consider pre-filling known information or simplifying the form',
      'employment-eligibility': 'Break down into smaller sections or provide better guidance',
      'health-insurance': 'Simplify plan comparisons or provide a recommendation engine',
      'job-application': 'Reduce the number of required fields or allow resume upload'
    }

    return recommendations[stepId] || 'Review this step for potential simplification'
  }

  // Predict abandonment
  const predictAbandonment = useCallback(() => {
    if (!analytics) return null

    const { abandonmentRisk } = analytics.analytics
    const riskFactors: string[] = []

    // Check various risk factors
    if (timeOnStep > 600) { // More than 10 minutes on current step
      riskFactors.push('Extended time on current step')
    }

    if (analytics.currentStepProgress.errors.length > 2) {
      riskFactors.push('Multiple validation errors')
    }

    if (analytics.overallProgress.estimatedTimeRemaining > 60) {
      riskFactors.push('Long estimated completion time')
    }

    const fieldInteractions = Array.from(fieldTrackingRef.current.values())
    if (fieldInteractions.some(count => count > 5)) {
      riskFactors.push('Repeated field interactions suggesting confusion')
    }

    return {
      risk: abandonmentRisk,
      factors: riskFactors,
      recommendation: getAbandonmentRecommendation(abandonmentRisk, riskFactors)
    }
  }, [analytics, timeOnStep])

  // Get abandonment recommendations
  const getAbandonmentRecommendation = (
    risk: 'low' | 'medium' | 'high',
    factors: string[]
  ): string => {
    if (risk === 'high') {
      if (factors.includes('Multiple validation errors')) {
        return 'Provide clearer error messages and field-level help'
      }
      if (factors.includes('Extended time on current step')) {
        return 'Offer assistance or allow saving progress for later'
      }
      return 'Consider offering live chat support or a help guide'
    }
    
    if (risk === 'medium') {
      return 'Monitor closely and ensure save progress functionality is visible'
    }
    
    return 'User is progressing well - no intervention needed'
  }

  // Export progress report
  const exportProgressReport = useCallback((): string => {
    if (!controllerRef.current) return ''
    
    return controllerRef.current.exportProgressReport()
  }, [])

  // Clear all progress
  const clearProgress = useCallback(() => {
    if (!controllerRef.current) return
    
    controllerRef.current.clearProgress()
    fieldTrackingRef.current.clear()
    setTimeOnStep(0)
    setCurrentStepId(steps[0]?.id || '')
    updateAnalytics()
  }, [steps, updateAnalytics])

  // Get time estimates
  const getTimeEstimates = useCallback(() => {
    if (!analytics) return null

    const { estimatedTimeRemaining, predictedCompletion } = analytics.overallProgress
    
    return {
      totalEstimated: estimatedTimeRemaining,
      perStep: steps.map(step => {
        const controller = controllerRef.current
        if (!controller) return { stepId: step.id, minutes: 0 }
        
        const metrics = controller['metrics'].get(step.id)
        return {
          stepId: step.id,
          stepName: step.title,
          estimatedMinutes: metrics?.estimatedMinutes || 5,
          actualMinutes: metrics?.timeSpent ? metrics.timeSpent / 60 : undefined
        }
      }),
      predictedCompletion,
      confidence: calculateTimeEstimateConfidence()
    }
  }, [analytics, steps])

  // Calculate confidence in time estimates
  const calculateTimeEstimateConfidence = (): 'low' | 'medium' | 'high' => {
    if (!analytics) return 'low'
    
    const completionRate = analytics.overallProgress.stepsCompleted / analytics.overallProgress.stepsTotal
    
    if (completionRate > 0.5) return 'high'
    if (completionRate > 0.2) return 'medium'
    return 'low'
  }

  return {
    // Core analytics
    analytics,
    isLoading,
    
    // Current state
    currentStepId,
    timeOnStep,
    
    // Actions
    updateStepProgress,
    markStepComplete,
    navigateToStep,
    trackFieldInteraction,
    clearProgress,
    
    // Analysis functions
    getBottleneckAnalysis,
    predictAbandonment,
    getTimeEstimates,
    exportProgressReport,
    
    // Utilities
    saveProgress: () => controllerRef.current?.saveProgress(),
    loadProgress: () => controllerRef.current?.loadProgress() || false
  }
}