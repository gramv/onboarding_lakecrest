/**
 * OnboardingFlowPortalEnhanced - Enhanced version with progress tracking
 * Implements the candidate onboarding flow with detailed analytics
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, RefreshCw, BarChart2, Clock, Info } from 'lucide-react'
import { scrollToTop, scrollToErrorContainer } from '@/utils/scrollHelpers'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SyncIndicator, SyncBadge } from '@/components/ui/sync-indicator'
import { useSyncStatus } from '@/hooks/useSyncStatus'

// Import the new infrastructure
import { OnboardingFlowController, StepProps } from '../controllers/OnboardingFlowController'
import { ProgressBar } from '../components/navigation/ProgressBar'
import { NavigationButtons } from '../components/navigation/NavigationButtons'

// Import enhanced progress tracking
import { EnhancedProgressBar } from '../components/ui/EnhancedProgressBar'
import { StepProgressCard } from '../components/ui/StepProgressCard'
import { ProgressDashboard } from '../components/navigation/ProgressDashboard'
import { useProgressAnalytics } from '../hooks/useProgressAnalytics'

// Import new shadcn UI components
import { StepIndicator, Step } from '@/components/ui/step-indicator'
import { Breadcrumb, createBreadcrumbItems } from '@/components/ui/breadcrumb'
import { ValidationSummary, ValidationMessage } from '@/components/ui/validation-summary'

// Import step components
import WelcomeStep from './onboarding/WelcomeStep'
import PersonalInfoStep from './onboarding/PersonalInfoStep'
import JobDetailsStep from './onboarding/JobDetailsStep'
import CompanyPoliciesStep from './onboarding/CompanyPoliciesStep'
import I9Section1Step from './onboarding/I9Section1Step'
import I9CompleteStep from './onboarding/I9CompleteStep'
import I9SupplementsStep from './onboarding/I9SupplementsStep'
import W4FormStep from './onboarding/W4FormStep'
import DirectDepositStep from './onboarding/DirectDepositStep'
import TraffickingAwarenessStep from './onboarding/TraffickingAwarenessStep'
import WeaponsPolicyStep from './onboarding/WeaponsPolicyStep'
import HealthInsuranceStep from './onboarding/HealthInsuranceStep'
import DocumentUploadStep from './onboarding/DocumentUploadStep'
import FinalReviewStep from './onboarding/FinalReviewStep'

interface OnboardingFlowPortalProps {
  testMode?: boolean
}

export default function OnboardingFlowPortalEnhanced({ testMode = false }: OnboardingFlowPortalProps) {
  const [searchParams] = useSearchParams()
  const [flowController] = useState(() => new OnboardingFlowController())
  
  // State management
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<any>(null)
  const [currentStep, setCurrentStep] = useState<any>(null)
  const [progress, setProgress] = useState<any>(null)
  const [language, setLanguage] = useState<'en' | 'es'>('en')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [saveStatus, setSaveStatus] = useState<any>({ saving: false, lastSaved: null, error: null })
  const [showProgressDashboard, setShowProgressDashboard] = useState(false)
  const [showStepProgress, setShowStepProgress] = useState(false)
  const [useEnhancedProgress, setUseEnhancedProgress] = useState(true)

  const token = searchParams.get('token') || (testMode ? 'demo-token' : null)
  
  // Sync status hook
  const { syncStatus, lastSyncTime, syncError, startSync, syncSuccess, syncError: reportSyncError, syncOffline, isOnline } = useSyncStatus()
  
  // Progress analytics hook
  const {
    analytics,
    currentStepId,
    timeOnStep,
    updateStepProgress: updateAnalyticsProgress,
    markStepComplete: markStepCompleteAnalytics,
    navigateToStep,
    trackFieldInteraction,
    clearProgress: clearAnalyticsProgress,
    getBottleneckAnalysis,
    predictAbandonment,
    getTimeEstimates,
    exportProgressReport,
    saveProgress: saveAnalyticsProgress
  } = useProgressAnalytics({
    steps: flowController.steps.map(s => ({
      id: s.id,
      title: s.name,
      description: s.description || '',
      required: s.required,
      governmentRequired: s.governmentRequired || false,
      estimatedMinutes: s.estimatedMinutes || 5,
      order: s.order
    })),
    initialProgress: progress,
    autoSave: true,
    trackingEnabled: true
  })

  // Initialize session
  useEffect(() => {
    const initializeSession = async () => {
      if (!token) {
        setError('No onboarding token provided')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        
        // Clear old session data when using a new token
        const lastToken = sessionStorage.getItem('current_onboarding_token')
        if (lastToken && lastToken !== token) {
          // Clear all onboarding-related sessionStorage
          const keysToRemove: string[] = []
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i)
            if (key && (key.includes('onboarding_') || key.includes('personal_info') || key.includes('company_policies') || key.includes('document_upload'))) {
              keysToRemove.push(key)
            }
          }
          keysToRemove.forEach(key => sessionStorage.removeItem(key))
        }
        sessionStorage.setItem('current_onboarding_token', token)
        
        const sessionData = await flowController.initializeOnboarding(token)
        setSession(sessionData)
        setCurrentStep(flowController.getCurrentStep())
        setProgress(flowController.getProgress())
        
        // Load saved data from cloud first, then merge with local
        if (sessionData.savedFormData && Object.keys(sessionData.savedFormData).length > 0) {
          console.log('Loading saved form data from cloud:', sessionData.savedFormData)
          
          // Load cloud data and save to sessionStorage
          Object.entries(sessionData.savedFormData).forEach(([stepId, formData]) => {
            if (formData && Object.keys(formData).length > 0) {
              console.log(`Setting cloud data for step ${stepId}:`, formData)
              flowController.setStepData(stepId, formData)
              // Save to sessionStorage for offline access
              sessionStorage.setItem(`onboarding_${stepId}_data`, JSON.stringify(formData))
            }
          })
        } else {
          // No cloud data, check local storage
          console.log('No cloud data found, checking local storage')
          flowController.steps.forEach(step => {
            const savedData = sessionStorage.getItem(`onboarding_${step.id}_data`)
            if (savedData) {
              try {
                const parsed = JSON.parse(savedData)
                console.log(`Loading local data for step ${step.id}:`, parsed)
                flowController.setStepData(step.id, parsed)
              } catch (e) {
                console.error(`Failed to parse saved data for step ${step.id}:`, e)
              }
            }
          })
        }
        
        setError(null)
      } catch (err) {
        console.error('Failed to initialize onboarding:', err)
        setError(err instanceof Error ? err.message : 'Failed to load onboarding session')
      } finally {
        setLoading(false)
      }
    }

    initializeSession()
  }, [token, flowController])

  // Auto-save management
  useEffect(() => {
    if (!session || !currentStep) return

    const updateSaveStatus = () => {
      const status = flowController.getSaveStatus()
      setSaveStatus(status)
    }

    const interval = setInterval(updateSaveStatus, 5000) // Reduced frequency from 1s to 5s
    return () => clearInterval(interval)
  }, [session, currentStep, flowController])

  // Step navigation handlers
  const handleNextStep = useCallback(async () => {
    try {
      setValidationErrors([])
      
      // Get current form data from session storage for personal-info step
      let currentStepData = flowController.getStepData(currentStep.id)
      
      // Special handling for personal-info, w4-form and direct-deposit steps to get data from session storage
      if (currentStep.id === 'personal-info' || currentStep.id === 'w4-form' || currentStep.id === 'direct-deposit') {
        const savedData = sessionStorage.getItem(`onboarding_${currentStep.id}_data`)
        if (savedData) {
          try {
            currentStepData = JSON.parse(savedData)
            // Update controller with latest data
            flowController.setStepData(currentStep.id, currentStepData)
          } catch (e) {
            console.error('Failed to parse saved data:', e)
          }
        }
      }
      
      console.log('Validating step data:', currentStepData)
      
      // Validate current step before proceeding
      const validation = await flowController.validateCurrentStep()
      
      if (!validation.valid) {
        console.log('Validation failed:', validation)
        setValidationErrors(validation.errors)
        // Scroll to error container to show validation errors
        scrollToErrorContainer()
        return
      }
      
      // Mark step as complete and move to next
      await flowController.markStepComplete(currentStep.id, currentStepData)
      flowController.goToNextStep()
      
      // Update analytics
      markStepCompleteAnalytics(currentStep.id)
      
      // Update state
      setCurrentStep(flowController.getCurrentStep())
      setProgress(flowController.getProgress())
      
      // Scroll to top after successful navigation
      scrollToTop()
      
    } catch (err) {
      console.error('Failed to proceed to next step:', err)
      setValidationErrors([err instanceof Error ? err.message : 'Failed to proceed'])
      // Scroll to error container to show error
      scrollToErrorContainer()
    }
  }, [currentStep, flowController, markStepCompleteAnalytics])

  const handlePreviousStep = useCallback(() => {
    flowController.goToPreviousStep()
    setCurrentStep(flowController.getCurrentStep())
    setProgress(flowController.getProgress())
    
    // Scroll to top after navigation
    scrollToTop()
  }, [flowController])

  const handleSaveProgress = useCallback(async (stepId: string, data?: any) => {
    if (!currentStep) return

    try {
      // Update controller's step data
      if (data) {
        flowController.setStepData(stepId, data)
        // Also save to sessionStorage immediately
        sessionStorage.setItem(`onboarding_${stepId}_data`, JSON.stringify(data))
        
        // Update analytics progress
        const fieldsCompleted = Object.keys(data || {}).filter(key => data[key]).length
        const fieldsTotal = Object.keys(data || {}).length
        updateAnalyticsProgress(stepId, {
          fieldsCompleted,
          fieldData: data
        })
      }
      
      // Start sync indicator
      startSync()
      
      // Save to backend
      await flowController.saveProgress(stepId, data)
      console.log(`Progress saved for step ${stepId}`)
      
      // Mark sync as successful
      syncSuccess()
    } catch (err) {
      console.error('Failed to save progress:', err)
      // Report sync error
      reportSyncError(err instanceof Error ? err.message : 'Failed to save progress')
      
      // If offline, mark as saved locally
      if (!isOnline) {
        syncOffline()
      }
    }
  }, [currentStep, flowController, startSync, syncSuccess, reportSyncError, isOnline, syncOffline, updateAnalyticsProgress])

  const handleStepComplete = useCallback(async (stepId: string, data?: any) => {
    try {
      await flowController.markStepComplete(stepId, data)
      setProgress(flowController.getProgress())
    } catch (err) {
      console.error('Failed to mark step complete:', err)
    }
  }, [flowController])

  // Language change handler
  const handleLanguageChange = useCallback((newLanguage: 'en' | 'es') => {
    setLanguage(newLanguage)
    // Save language preference
    if (currentStep) {
      handleSaveProgress(currentStep.id, { language_preference: newLanguage })
    }
  }, [currentStep, handleSaveProgress])

  // Get step props for component rendering
  const getStepProps = useCallback((): StepProps => {
    if (!session || !currentStep || !progress) {
      throw new Error('Session not properly initialized')
    }

    return {
      currentStep: {
        id: currentStep.id,
        name: currentStep.name,
        order: currentStep.order,
        required: currentStep.required
      },
      progress: {
        completedSteps: progress.completedSteps,
        currentStepIndex: progress.currentStepIndex,
        totalSteps: progress.totalSteps,
        percentComplete: progress.percentComplete
      },
      markStepComplete: handleStepComplete,
      saveProgress: handleSaveProgress,
      goToNextStep: handleNextStep,
      goToPreviousStep: handlePreviousStep,
      language,
      employee: session.employee,
      property: session.property,
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt
    }
  }, [session, currentStep, progress, language, handleStepComplete, handleSaveProgress, handleNextStep, handlePreviousStep])

  // Prepare enhanced progress data
  const progressSegments = useMemo(() => {
    if (!flowController.steps || !progress) return []
    
    return flowController.steps.map(step => ({
      id: step.id,
      label: step.name,
      percentage: progress.completedSteps.includes(step.id) ? 100 : 
                  currentStep?.id === step.id ? (analytics?.currentStepProgress?.percentage || 0) : 0,
      status: progress.completedSteps.includes(step.id) ? 'completed' as const :
              currentStep?.id === step.id ? 'current' as const :
              validationErrors.length > 0 && currentStep?.id === step.id ? 'error' as const :
              'pending' as const,
      isRequired: step.required,
      isFederalForm: step.governmentRequired || false,
      estimatedMinutes: step.estimatedMinutes,
      actualMinutes: analytics?.analytics?.averageTimePerStep
    }))
  }, [flowController.steps, progress, currentStep, analytics, validationErrors])
  
  // Prepare dashboard data
  const dashboardStepStatuses = useMemo(() => {
    if (!flowController.steps || !progress) return []
    
    return flowController.steps.map(step => ({
      id: step.id,
      title: step.name,
      status: progress.completedSteps.includes(step.id) ? 'completed' as const :
              currentStep?.id === step.id ? 'current' as const :
              validationErrors.length > 0 && currentStep?.id === step.id ? 'error' as const :
              'pending' as const,
      percentage: progress.completedSteps.includes(step.id) ? 100 :
                  currentStep?.id === step.id ? (analytics?.currentStepProgress?.percentage || 0) : 0,
      timeSpent: currentStep?.id === step.id ? timeOnStep : undefined,
      estimatedTime: step.estimatedMinutes,
      required: step.required,
      isFederalForm: step.governmentRequired || false,
      hasUnsavedChanges: saveStatus.saving && currentStep?.id === step.id,
      errors: currentStep?.id === step.id ? validationErrors : []
    }))
  }, [flowController.steps, progress, currentStep, analytics, validationErrors, timeOnStep, saveStatus])
  
  // Prepare compliance deadlines
  const complianceDeadlines = useMemo(() => {
    if (!analytics?.complianceStatus) return []
    
    const deadlines = []
    
    if (analytics.complianceStatus.i9Section1.required) {
      deadlines.push({
        form: 'I-9 Section 1',
        deadline: analytics.complianceStatus.i9Section1.deadline,
        status: analytics.complianceStatus.i9Section1.completed ? 'completed' as const :
                analytics.complianceStatus.i9Section1.daysRemaining < 0 ? 'overdue' as const :
                'pending' as const,
        daysRemaining: analytics.complianceStatus.i9Section1.daysRemaining
      })
    }
    
    if (analytics.complianceStatus.w4.required) {
      deadlines.push({
        form: 'W-4 Tax Withholding',
        deadline: new Date(),
        status: analytics.complianceStatus.w4.completed ? 'completed' as const : 'pending' as const,
        daysRemaining: 0
      })
    }
    
    return deadlines
  }, [analytics])

  // Render step content
  const renderStepContent = () => {
    if (!currentStep) return null

    const stepProps = getStepProps()

    switch (currentStep.id) {
      case 'welcome':
        return <WelcomeStep {...stepProps} />
      case 'personal-info':
        return <PersonalInfoStep {...stepProps} />
      case 'job-details':
        return <JobDetailsStep {...stepProps} />
      case 'company-policies':
        return <CompanyPoliciesStep {...stepProps} />
      case 'i9-section1':
        return <I9Section1Step {...stepProps} />
      case 'i9-complete':
        return <I9CompleteStep {...stepProps} />
      case 'i9-supplements':
        return <I9SupplementsStep {...stepProps} />
      case 'w4-form':
        return <W4FormStep {...stepProps} />
      case 'direct-deposit':
        return <DirectDepositStep {...stepProps} />
      case 'trafficking-awareness':
        return <TraffickingAwarenessStep {...stepProps} />
      case 'weapons-policy':
        return <WeaponsPolicyStep {...stepProps} />
      case 'health-insurance':
        return <HealthInsuranceStep {...stepProps} />
      case 'document-upload':
        return <DocumentUploadStep {...stepProps} />
      case 'final-review':
        return <FinalReviewStep {...stepProps} />
      default:
        return (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold text-heading-secondary text-gray-900 mb-2">
              Step Not Implemented
            </h3>
            <p className="text-gray-600">
              The step "{currentStep.name}" is not yet implemented.
            </p>
          </div>
        )
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      flowController.destroy()
      saveAnalyticsProgress()
    }
  }, [flowController, saveAnalyticsProgress])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-gray-600">Loading onboarding session...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-heading-primary text-gray-900 mb-2">Onboarding Error</h2>
            <p className="text-gray-600 mb-6">{error || 'Unable to load onboarding session'}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  const federalSteps = flowController.steps.filter(step => step.governmentRequired)
  const completedFederalSteps = federalSteps.filter(step => 
    progress?.completedSteps?.includes(step.id)
  ).length

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-heading-primary text-gray-900">Employee Onboarding</h1>
              <span className="ml-4 text-sm text-gray-500">
                {session.property.name}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              {/* Progress Dashboard Button */}
              <button
                onClick={() => setShowProgressDashboard(true)}
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                title="View Progress Dashboard"
              >
                <BarChart2 className="w-4 h-4" />
                <span className="hidden md:inline">Dashboard</span>
              </button>
              
              {/* Step Progress Toggle */}
              <button
                onClick={() => setShowStepProgress(!showStepProgress)}
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                title="Toggle Step Progress"
              >
                <Info className="w-4 h-4" />
                <span className="hidden md:inline">Step Info</span>
              </button>
              
              {/* Time Estimate */}
              {analytics?.overallProgress?.estimatedTimeRemaining && (
                <div className="hidden md:flex items-center text-sm text-gray-600">
                  <Clock className="w-4 h-4 mr-1" />
                  <span>~{Math.round(analytics.overallProgress.estimatedTimeRemaining)} min remaining</span>
                </div>
              )}
              
              {/* Sync Status Indicator - Full on desktop */}
              <div className="hidden md:block">
                <SyncIndicator
                  status={syncStatus}
                  lastSyncTime={lastSyncTime}
                  error={syncError}
                  showDetails={true}
                  className="text-sm"
                />
              </div>
              
              {/* Sync Status Badge - Mobile */}
              <div className="block md:hidden">
                <SyncBadge
                  status={syncStatus}
                  className="w-8 h-8"
                />
              </div>
              
              {/* Language Toggle */}
              <button
                onClick={() => handleLanguageChange(language === 'en' ? 'es' : 'en')}
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <span>{language === 'en' ? 'Español' : 'English'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Breadcrumb Navigation */}
      {currentStep && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <Breadcrumb 
              items={createBreadcrumbItems(['Home', 'Onboarding', currentStep.name])} 
              className="text-sm"
            />
          </div>
        </div>
      )}

      {/* Progress Bar - Enhanced or Standard */}
      {progress && (
        useEnhancedProgress ? (
          <div className="bg-gray-50 py-4">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <EnhancedProgressBar
                segments={progressSegments}
                overallPercentage={progress.percentComplete}
                estimatedTimeRemaining={analytics?.overallProgress?.estimatedTimeRemaining || 0}
                currentStepId={currentStep?.id || ''}
                showDetails={false}
                complianceDeadlines={{
                  i9: analytics?.complianceStatus?.i9Section1?.deadline,
                  w4: analytics?.complianceStatus?.w4?.required ? new Date() : undefined
                }}
                onSegmentClick={(stepId) => {
                  const stepIndex = flowController.steps.findIndex(s => s.id === stepId)
                  if (stepIndex >= 0 && stepIndex <= progress.currentStepIndex) {
                    navigateToStep(stepId)
                  }
                }}
              />
            </div>
          </div>
        ) : (
          <ProgressBar
            steps={flowController.steps}
            currentStep={progress.currentStepIndex}
            completedSteps={progress.completedSteps}
            percentComplete={progress.percentComplete}
            estimatedTimeRemaining={flowController.steps
              .slice(progress.currentStepIndex)
              .reduce((total, step) => total + step.estimatedMinutes, 0)}
            federalStepsCompleted={completedFederalSteps}
            totalFederalSteps={federalSteps.length}
          />
        )
      )}

      {/* Main Content */}
      <main className="flex-1 py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          
          {/* Step Progress Card */}
          {showStepProgress && currentStep && analytics?.currentStepProgress && (
            <StepProgressCard
              stepId={currentStep.id}
              stepName={currentStep.name}
              percentage={analytics.currentStepProgress.percentage}
              fieldsCompleted={analytics.currentStepProgress.fieldsCompleted}
              fieldsTotal={analytics.currentStepProgress.fieldsTotal}
              timeSpent={timeOnStep}
              estimatedTimeRemaining={analytics.currentStepProgress.estimatedTimeRemaining}
              validationStatus={analytics.currentStepProgress.validationStatus}
              errors={analytics.currentStepProgress.errors}
              onClose={() => setShowStepProgress(false)}
              className="mb-4"
            />
          )}

          {/* Step Content */}
          <Card className="card-transition fade-in">
            <CardContent className="pt-6">
              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div id="error-container" className="mb-6">
                  <ValidationSummary
                    messages={validationErrors.map((error) => ({
                      message: error,
                      type: 'error'
                    } as ValidationMessage))}
                    title="Please fix the following issues"
                    showIcon={true}
                    className="transition-all duration-300"
                  />
                </div>
              )}

              {/* Step Content */}
              <ErrorBoundary>
                {renderStepContent()}
              </ErrorBoundary>

              {/* Navigation */}
              {progress && (
                <NavigationButtons
                  showPrevious={progress.currentStepIndex > 0}
                  showNext={progress.currentStepIndex < progress.totalSteps - 1}
                  showSave={false} // Auto-save handles this
                  nextButtonText={
                    progress.currentStepIndex === progress.totalSteps - 1 
                      ? 'Submit' 
                      : 'Next'
                  }
                  onPrevious={handlePreviousStep}
                  onNext={handleNextStep}
                  saving={saveStatus.saving}
                  hasErrors={validationErrors.length > 0}
                  language={language}
                />
              )}
            </CardContent>
          </Card>

        </div>
      </main>
      
      {/* Progress Dashboard Modal */}
      <ProgressDashboard
        steps={flowController.steps}
        stepStatuses={dashboardStepStatuses}
        overallProgress={progress?.percentComplete || 0}
        complianceDeadlines={complianceDeadlines}
        abandonmentRisk={analytics?.analytics?.abandonmentRisk}
        bottlenecks={analytics?.analytics?.bottlenecks}
        onNavigateToStep={(stepId) => {
          const stepIndex = flowController.steps.findIndex(s => s.id === stepId)
          if (stepIndex >= 0) {
            navigateToStep(stepId)
            setShowProgressDashboard(false)
          }
        }}
        onExportReport={() => {
          const report = exportProgressReport()
          const blob = new Blob([report], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `onboarding-progress-${new Date().toISOString()}.json`
          a.click()
          URL.revokeObjectURL(url)
        }}
        onSaveProgress={() => saveAnalyticsProgress()}
        onClearProgress={() => {
          clearAnalyticsProgress()
          window.location.reload()
        }}
        isOpen={showProgressDashboard}
        onClose={() => setShowProgressDashboard(false)}
      />
    </div>
  )
}