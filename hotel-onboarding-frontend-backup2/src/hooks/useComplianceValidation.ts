/**
 * React Hook for Federal Compliance Validation
 * Provides real-time validation with debouncing and state management
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  FederalComplianceValidator, 
  ValidationResult,
  I9DeadlineInfo,
  W4Calculations 
} from '@/services/FederalComplianceValidator'
import { debounce } from 'lodash'

export interface UseComplianceValidationOptions {
  language?: 'en' | 'es'
  debounceMs?: number
  validateOnMount?: boolean
}

export interface ComplianceValidationState {
  // SSN Validation
  ssnValidation: ValidationResult | null
  ssnLoading: boolean
  
  // I-9 Validation
  i9Validation: ValidationResult | null
  i9Deadlines: I9DeadlineInfo | null
  i9Loading: boolean
  
  // W-4 Validation
  w4Validation: ValidationResult | null
  w4Calculations: W4Calculations | null
  w4Loading: boolean
  
  // Age Validation
  ageValidation: ValidationResult | null
  ageLoading: boolean
  
  // Overall status
  hasErrors: boolean
  hasWarnings: boolean
  isValidating: boolean
}

export function useComplianceValidation(
  options: UseComplianceValidationOptions = {}
) {
  const {
    language = 'en',
    debounceMs = 500,
    validateOnMount = false
  } = options

  // Initialize validator
  const validator = useRef(new FederalComplianceValidator(language))

  // Update validator language when it changes
  useEffect(() => {
    validator.current = new FederalComplianceValidator(language)
  }, [language])

  // State management
  const [state, setState] = useState<ComplianceValidationState>({
    ssnValidation: null,
    ssnLoading: false,
    i9Validation: null,
    i9Deadlines: null,
    i9Loading: false,
    w4Validation: null,
    w4Calculations: null,
    w4Loading: false,
    ageValidation: null,
    ageLoading: false,
    hasErrors: false,
    hasWarnings: false,
    isValidating: false
  })

  // Update overall status when individual validations change
  useEffect(() => {
    const hasErrors = !!(
      state.ssnValidation?.errors.length ||
      state.i9Validation?.errors.length ||
      state.w4Validation?.errors.length ||
      state.ageValidation?.errors.length
    )

    const hasWarnings = !!(
      state.ssnValidation?.warnings.length ||
      state.i9Validation?.warnings.length ||
      state.w4Validation?.warnings.length ||
      state.ageValidation?.warnings.length
    )

    const isValidating = !!(
      state.ssnLoading ||
      state.i9Loading ||
      state.w4Loading ||
      state.ageLoading
    )

    setState(prev => ({
      ...prev,
      hasErrors,
      hasWarnings,
      isValidating
    }))
  }, [
    state.ssnValidation,
    state.i9Validation,
    state.w4Validation,
    state.ageValidation,
    state.ssnLoading,
    state.i9Loading,
    state.w4Loading,
    state.ageLoading
  ])

  // SSN Validation
  const validateSSNInternal = useCallback((ssn: string) => {
    setState(prev => ({ ...prev, ssnLoading: true }))
    
    try {
      const result = validator.current.validateSSN(ssn)
      setState(prev => ({
        ...prev,
        ssnValidation: result,
        ssnLoading: false
      }))
      return result
    } catch (error) {
      console.error('SSN validation error:', error)
      setState(prev => ({
        ...prev,
        ssnValidation: {
          isValid: false,
          errors: [language === 'es' ? 'Error al validar SSN' : 'Error validating SSN'],
          warnings: [],
          info: []
        },
        ssnLoading: false
      }))
      return null
    }
  }, [language])

  // Debounced SSN validation
  const validateSSN = useCallback(
    debounce(validateSSNInternal, debounceMs),
    [validateSSNInternal, debounceMs]
  )

  // I-9 Timing Validation
  const validateI9TimingInternal = useCallback((
    hireDate: Date | string,
    section1Date?: Date | string | null,
    section2Date?: Date | string | null
  ) => {
    setState(prev => ({ ...prev, i9Loading: true }))
    
    try {
      const result = validator.current.validateI9Timing(hireDate, section1Date, section2Date)
      const deadlines = validator.current.calculateI9Deadlines(hireDate)
      
      setState(prev => ({
        ...prev,
        i9Validation: result,
        i9Deadlines: deadlines,
        i9Loading: false
      }))
      return { validation: result, deadlines }
    } catch (error) {
      console.error('I-9 validation error:', error)
      setState(prev => ({
        ...prev,
        i9Validation: {
          isValid: false,
          errors: [language === 'es' ? 'Error al validar I-9' : 'Error validating I-9'],
          warnings: [],
          info: []
        },
        i9Loading: false
      }))
      return null
    }
  }, [language])

  // Debounced I-9 validation
  const validateI9Timing = useCallback(
    debounce(validateI9TimingInternal, debounceMs),
    [validateI9TimingInternal, debounceMs]
  )

  // W-4 Form Validation
  const validateW4FormInternal = useCallback((formData: any) => {
    setState(prev => ({ ...prev, w4Loading: true }))
    
    try {
      const result = validator.current.validateW4Form(formData)
      
      // Calculate dependent credits if applicable
      let calculations: W4Calculations | null = null
      if (formData.step3_qualifying_children || formData.step3_other_dependents) {
        calculations = validator.current.calculateW4DependentCredits(
          parseInt(formData.step3_qualifying_children) || 0,
          parseInt(formData.step3_other_dependents) || 0,
          formData.filingStatus
        )
      }
      
      setState(prev => ({
        ...prev,
        w4Validation: result,
        w4Calculations: calculations,
        w4Loading: false
      }))
      return { validation: result, calculations }
    } catch (error) {
      console.error('W-4 validation error:', error)
      setState(prev => ({
        ...prev,
        w4Validation: {
          isValid: false,
          errors: [language === 'es' ? 'Error al validar W-4' : 'Error validating W-4'],
          warnings: [],
          info: []
        },
        w4Loading: false
      }))
      return null
    }
  }, [language])

  // Debounced W-4 validation
  const validateW4Form = useCallback(
    debounce(validateW4FormInternal, debounceMs),
    [validateW4FormInternal, debounceMs]
  )

  // Age Requirements Validation
  const validateAgeInternal = useCallback((
    dateOfBirth: Date | string,
    requiresAlcoholHandling: boolean = false
  ) => {
    setState(prev => ({ ...prev, ageLoading: true }))
    
    try {
      const result = validator.current.validateAgeRequirements(dateOfBirth, requiresAlcoholHandling)
      setState(prev => ({
        ...prev,
        ageValidation: result,
        ageLoading: false
      }))
      return result
    } catch (error) {
      console.error('Age validation error:', error)
      setState(prev => ({
        ...prev,
        ageValidation: {
          isValid: false,
          errors: [language === 'es' ? 'Error al validar edad' : 'Error validating age'],
          warnings: [],
          info: []
        },
        ageLoading: false
      }))
      return null
    }
  }, [language])

  // Debounced age validation
  const validateAge = useCallback(
    debounce(validateAgeInternal, debounceMs),
    [validateAgeInternal, debounceMs]
  )

  // Clear specific validation
  const clearValidation = useCallback((type: 'ssn' | 'i9' | 'w4' | 'age' | 'all') => {
    setState(prev => {
      switch (type) {
        case 'ssn':
          return { ...prev, ssnValidation: null, ssnLoading: false }
        case 'i9':
          return { ...prev, i9Validation: null, i9Deadlines: null, i9Loading: false }
        case 'w4':
          return { ...prev, w4Validation: null, w4Calculations: null, w4Loading: false }
        case 'age':
          return { ...prev, ageValidation: null, ageLoading: false }
        case 'all':
          return {
            ssnValidation: null,
            ssnLoading: false,
            i9Validation: null,
            i9Deadlines: null,
            i9Loading: false,
            w4Validation: null,
            w4Calculations: null,
            w4Loading: false,
            ageValidation: null,
            ageLoading: false,
            hasErrors: false,
            hasWarnings: false,
            isValidating: false
          }
        default:
          return prev
      }
    })
  }, [])

  // Get severity for a specific validation
  const getSeverity = useCallback((
    type: 'ssn' | 'i9' | 'w4' | 'age'
  ): 'error' | 'warning' | 'info' | 'success' | null => {
    let result: ValidationResult | null = null
    
    switch (type) {
      case 'ssn':
        result = state.ssnValidation
        break
      case 'i9':
        result = state.i9Validation
        break
      case 'w4':
        result = state.w4Validation
        break
      case 'age':
        result = state.ageValidation
        break
    }

    if (!result) return null
    return validator.current.getSeverityLevel(result)
  }, [state])

  // Format messages for display
  const formatMessages = useCallback((
    type: 'ssn' | 'i9' | 'w4' | 'age'
  ): string[] => {
    let result: ValidationResult | null = null
    
    switch (type) {
      case 'ssn':
        result = state.ssnValidation
        break
      case 'i9':
        result = state.i9Validation
        break
      case 'w4':
        result = state.w4Validation
        break
      case 'age':
        result = state.ageValidation
        break
    }

    if (!result) return []
    return validator.current.formatMessages(result)
  }, [state])

  // Validate all fields
  const validateAll = useCallback(async (data: {
    ssn?: string
    hireDate?: Date | string
    section1Date?: Date | string | null
    section2Date?: Date | string | null
    w4FormData?: any
    dateOfBirth?: Date | string
    requiresAlcoholHandling?: boolean
  }) => {
    const validations: Promise<any>[] = []

    if (data.ssn) {
      validations.push(Promise.resolve(validateSSNInternal(data.ssn)))
    }

    if (data.hireDate) {
      validations.push(Promise.resolve(validateI9TimingInternal(
        data.hireDate,
        data.section1Date,
        data.section2Date
      )))
    }

    if (data.w4FormData) {
      validations.push(Promise.resolve(validateW4FormInternal(data.w4FormData)))
    }

    if (data.dateOfBirth) {
      validations.push(Promise.resolve(validateAgeInternal(
        data.dateOfBirth,
        data.requiresAlcoholHandling
      )))
    }

    await Promise.all(validations)
    return state
  }, [
    validateSSNInternal,
    validateI9TimingInternal,
    validateW4FormInternal,
    validateAgeInternal,
    state
  ])

  return {
    // State
    ...state,
    
    // Validation functions
    validateSSN,
    validateI9Timing,
    validateW4Form,
    validateAge,
    validateAll,
    
    // Utility functions
    clearValidation,
    getSeverity,
    formatMessages,
    
    // Validator instance (for direct access if needed)
    validator: validator.current
  }
}