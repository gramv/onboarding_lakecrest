import React, { useState, useEffect } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, MessageCircle } from 'lucide-react'
import { CheckCircle, Briefcase, Calendar, DollarSign, Building } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StepProps } from '../../controllers/OnboardingFlowController'
import { StepContainer } from '@/components/onboarding/StepContainer'
import { StepContentWrapper } from '@/components/onboarding/StepContentWrapper'
import { useAutoSave } from '@/hooks/useAutoSave'

export default function JobDetailsStep({
  currentStep,
  progress,
  markStepComplete,
  saveProgress,
  language = 'en',
  employee,
  property
}: StepProps) {
  
  const [acknowledged, setAcknowledged] = useState(false)
  const [acknowledgedAt, setAcknowledgedAt] = useState<string | null>(null)
  const [isCompleting, setIsCompleting] = useState(false)

  // Form data for auto-save
  const formData = {
    acknowledged,
    acknowledgedAt,
    isCompleting
  }

  // Auto-save hook
  const { saveStatus } = useAutoSave(formData, {
    onSave: async (data) => {
      await saveProgress(currentStep.id, data)
    }
  })

  // Load existing data
  useEffect(() => {
    if (progress.completedSteps.includes(currentStep.id)) {
      setAcknowledged(true)
      setAcknowledgedAt(new Date().toISOString())
    }
  }, [currentStep.id, progress.completedSteps])

  // Auto-mark complete when acknowledged (with proper async handling)
  useEffect(() => {
    const completeStep = async () => {
      if (acknowledged && !progress.completedSteps.includes(currentStep.id) && !isCompleting) {
        console.log('🎯 JobDetailsStep: Auto-completing step...')
        setIsCompleting(true)
        try {
          await markStepComplete(currentStep.id, formData)
          console.log('✅ JobDetailsStep: Step completed successfully')
        } catch (error) {
          console.error('❌ JobDetailsStep: Failed to complete step:', error)
          // Reset acknowledged state on error
          setAcknowledged(false)
          setAcknowledgedAt(null)
        } finally {
          setIsCompleting(false)
        }
      }
    }

    completeStep()
  }, [acknowledged, currentStep.id, formData, markStepComplete, progress.completedSteps, isCompleting])

  const handleAcknowledgment = async (checked: boolean) => {
    console.log('🖱️ JobDetailsStep: Acknowledgment changed:', checked)

    if (checked && !isCompleting) {
      setAcknowledged(checked)
      setAcknowledgedAt(new Date().toISOString())
      // The useEffect above will handle the completion
    } else if (!checked) {
      setAcknowledged(false)
      setAcknowledgedAt(null)
    }
  }

  // Use actual pay rate from employee data, fallback to 0 if not available
  const payRate = employee?.payRate || employee?.hourlyRate || 0

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not specified'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const translations = {
    en: {
      title: 'Review Your Job Offer',
      description: 'Please review the job offer details provided by your manager.',
      completedNotice: 'Job offer accepted successfully! Click Next to continue.',
      propertyInfo: 'Property Information',
      positionInfo: 'Position Details',
      position: 'Job Title',
      department: 'Department',
      employmentDetails: 'Employment Terms',
      startDate: 'Start Date',
      payRate: 'Pay Rate',
      acknowledgment: 'Job Offer Acceptance',
      acknowledgmentText: 'I have reviewed and accept all job details above.',
      acknowledgedOn: 'Acknowledged on'
    },
    es: {
      title: 'Revise Su Oferta de Trabajo',
      description: 'Revise los detalles de la oferta de trabajo proporcionados por su gerente.',
      completedNotice: '¡Oferta de trabajo aceptada exitosamente! Haga clic en Siguiente para continuar.',
      propertyInfo: 'Información de la Propiedad',
      positionInfo: 'Detalles de la Posición',
      position: 'Título del Trabajo',
      department: 'Departamento',
      employmentDetails: 'Términos de Empleo',
      startDate: 'Fecha de Inicio',
      payRate: 'Tarifa de Pago',
      acknowledgment: 'Aceptación de Oferta de Trabajo',
      acknowledgmentText: 'He revisado y acepto todos los detalles del trabajo anteriores.',
      acknowledgedOn: 'Reconocido el'
    }
  }

  const t = translations[language]

  const canAdvance = acknowledged && !isCompleting

  return (
    <StepContainer saveStatus={isCompleting ? 'saving' : saveStatus} canProceed={canAdvance}>
      <StepContentWrapper>
        <div className="space-y-6">
        {/* Step Header */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Briefcase className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
          </div>
          <p className="text-gray-600 max-w-2xl mx-auto">{t.description}</p>
        </div>

        {/* Guidance Banner */}
        <Alert className={acknowledged ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}>
          {acknowledged ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-blue-500" />
          )}
          <AlertDescription className={acknowledged ? 'text-green-800' : 'text-blue-800'}>
            {acknowledged ? t.completedNotice : 'Review the offer details carefully. Accept below to enable the Next button.'}
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Property Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Building className="h-5 w-5 text-blue-600" />
                  <span>{t.propertyInfo}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Hotel Name</p>
                  <p className="font-semibold">{property?.name || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Location</p>
                  <p className="text-sm">{property?.address || 'Not specified'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Position Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Briefcase className="h-5 w-5 text-green-600" />
                  <span>{t.positionInfo}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">{t.position}</p>
                  <p className="font-semibold">{employee?.position || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t.department}</p>
                  <p>{employee?.department || 'Not specified'}</p>
                </div>
                {employee?.employmentType && (
                  <div>
                    <Badge variant="secondary">{employee.employmentType}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Employment Terms */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-orange-600" />
                  <span>{t.employmentDetails}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">{t.startDate}</p>
                  <p className="font-semibold">{formatDate(employee?.startDate || '')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t.payRate}</p>
                  <p className="font-semibold">
                    {payRate ? (
                      <>
                        {formatCurrency(payRate)}
                        <span className="text-sm text-gray-500 ml-1">/ hour</span>
                      </>
                    ) : (
                      'Not specified'
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>

        {/* Job Offer Acceptance - Enhanced Design */}
        <div className="mt-8">
          <div className="max-w-4xl mx-auto">
            <Card className={cn(
              "relative border-2 transition-all duration-300 overflow-hidden",
              acknowledged
                ? "border-green-200 bg-gradient-to-br from-green-50 via-emerald-50 to-green-50 shadow-lg"
                : "border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 hover:border-blue-300 hover:shadow-md"
            )}>
              {/* Decorative background pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-current rounded-full -translate-y-16 translate-x-16" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-current rounded-full translate-y-12 -translate-x-12" />
              </div>

              <CardHeader className="relative pb-4">
                <CardTitle className={cn(
                  "flex items-center space-x-3 text-lg font-semibold transition-colors duration-200",
                  acknowledged ? "text-green-800" : "text-blue-800"
                )}>
                  <div className={cn(
                    "p-2 rounded-full transition-colors duration-200",
                    acknowledged ? "bg-green-100" : "bg-blue-100"
                  )}>
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <span>{t.acknowledgment}</span>
                </CardTitle>
              </CardHeader>

              <CardContent className="relative pt-0">
                <div className={cn(
                  "rounded-xl p-6 border transition-all duration-300",
                  acknowledged
                    ? "border-green-200 bg-white/70 shadow-sm"
                    : "border-blue-200 bg-white/70 hover:bg-white/90"
                )}>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      <Checkbox
                        id="jobOfferAcknowledgment"
                        checked={acknowledged}
                        onCheckedChange={handleAcknowledgment}
                        disabled={isCompleting}
                        className={cn(
                          "transition-all duration-200 scale-110",
                          isCompleting && "opacity-50 cursor-not-allowed",
                          acknowledged
                            ? "border-green-500 data-[state=checked]:bg-green-600"
                            : "border-blue-400 hover:border-blue-500"
                        )}
                      />
                    </div>

                    <div className="flex-1">
                      <label
                        htmlFor="jobOfferAcknowledgment"
                        className={cn(
                          "text-base font-medium leading-relaxed block transition-colors duration-200",
                          isCompleting ? "cursor-wait opacity-75" : "cursor-pointer",
                          acknowledged ? "text-green-800" : "text-blue-800 hover:text-blue-900"
                        )}
                      >
                        {isCompleting ? "Processing acceptance..." : t.acknowledgmentText}
                      </label>

                      {acknowledged && acknowledgedAt && !isCompleting && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-green-700 bg-green-100/50 rounded-lg p-3">
                          <CheckCircle className="h-4 w-4 flex-shrink-0" />
                          <div>
                            <p className="font-medium">Job offer accepted!</p>
                            <p className="text-xs text-green-600 mt-1">
                              {t.acknowledgedOn}: {new Date(acknowledgedAt).toLocaleDateString()} at {new Date(acknowledgedAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      )}

                      {isCompleting && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-blue-700 bg-blue-100/50 rounded-lg p-3">
                          <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                          <div>
                            <p className="font-medium">Saving your acceptance...</p>
                            <p className="text-xs text-blue-600 mt-1">Please wait while we process your job offer acceptance.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {!acknowledged && (
                  <div className="mt-4 text-center">
                    <p className="text-sm text-gray-600 flex items-center justify-center gap-2">
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                      Please review and accept the job offer to continue
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-gray-500" />
            <span>Need help? Contact HR for clarification before accepting.</span>
          </div>
          <a
            href="mailto:hr@hotel.com"
            className="rounded border border-blue-600 px-3 py-1 text-xs text-blue-600 hover:bg-blue-50"
          >
            hr@hotel.com
          </a>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
          Once you continue, you’ll review five short policy sections. We’ll guide you through them one by one.
        </div>
        </div>
      </StepContentWrapper>
    </StepContainer>
  )
}