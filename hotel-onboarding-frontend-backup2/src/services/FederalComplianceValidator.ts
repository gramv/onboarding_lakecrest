/**
 * Federal Compliance Validation Service
 * Handles all federal compliance requirements for I-9, W-4, and other employment forms
 */

import { differenceInBusinessDays, addBusinessDays, isWeekend, format } from 'date-fns'

// Federal SSN prohibited patterns
const PROHIBITED_SSN_PATTERNS = [
  /^000/, // Cannot start with 000
  /^666/, // Cannot start with 666
  /^9[0-9]{2}/, // Cannot start with 900-999
  /00$/, // Cannot end with 00
  /0000$/, // Cannot end with 0000
  /^123456789$/, // Common test SSN
  /^111111111$/, // All same digit
  /^222222222$/,
  /^333333333$/,
  /^444444444$/,
  /^555555555$/,
  /^666666666$/,
  /^777777777$/,
  /^888888888$/,
  /^999999999$/,
]

// Federal holidays (2025)
const FEDERAL_HOLIDAYS_2025 = [
  '2025-01-01', // New Year's Day
  '2025-01-20', // Martin Luther King Jr. Day
  '2025-02-17', // Presidents' Day
  '2025-05-26', // Memorial Day
  '2025-06-19', // Juneteenth
  '2025-07-04', // Independence Day
  '2025-09-01', // Labor Day
  '2025-10-13', // Columbus Day
  '2025-11-11', // Veterans Day
  '2025-11-27', // Thanksgiving Day
  '2025-12-25', // Christmas Day
]

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  info: string[]
}

export interface I9DeadlineInfo {
  section1Deadline: Date
  section2Deadline: Date
  daysUntilSection1: number
  daysUntilSection2: number
  section1Status: 'pending' | 'due-soon' | 'overdue' | 'completed'
  section2Status: 'pending' | 'due-soon' | 'overdue' | 'completed' | 'not-applicable'
}

export interface W4Calculations {
  dependentCredit: number
  otherDependentCredit: number
  totalCredit: number
  explanation: string
}

export class FederalComplianceValidator {
  private language: 'en' | 'es'

  constructor(language: 'en' | 'es' = 'en') {
    this.language = language
  }

  /**
   * Validate SSN format and federal requirements
   */
  validateSSN(ssn: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const info: string[] = []

    if (!ssn) {
      errors.push(
        this.language === 'es' 
          ? 'Se requiere el número de Seguro Social'
          : 'Social Security Number is required'
      )
      return { isValid: false, errors, warnings, info }
    }

    // Remove formatting
    const cleanSSN = ssn.replace(/\D/g, '')

    // Check length
    if (cleanSSN.length !== 9) {
      errors.push(
        this.language === 'es'
          ? 'El SSN debe tener exactamente 9 dígitos'
          : 'SSN must be exactly 9 digits'
      )
    }

    // Check for prohibited patterns
    for (const pattern of PROHIBITED_SSN_PATTERNS) {
      if (pattern.test(cleanSSN)) {
        errors.push(
          this.language === 'es'
            ? 'Este SSN contiene un patrón prohibido por el gobierno federal'
            : 'This SSN contains a pattern prohibited by federal regulations'
        )
        break
      }
    }

    // Area number validation (first 3 digits)
    const areaNumber = parseInt(cleanSSN.substring(0, 3))
    if (areaNumber === 0) {
      errors.push(
        this.language === 'es'
          ? 'El número de área (primeros 3 dígitos) no puede ser 000'
          : 'Area number (first 3 digits) cannot be 000'
      )
    }

    // Group number validation (middle 2 digits)
    const groupNumber = parseInt(cleanSSN.substring(3, 5))
    if (groupNumber === 0) {
      errors.push(
        this.language === 'es'
          ? 'El número de grupo (dígitos del medio) no puede ser 00'
          : 'Group number (middle digits) cannot be 00'
      )
    }

    // Serial number validation (last 4 digits)
    const serialNumber = parseInt(cleanSSN.substring(5, 9))
    if (serialNumber === 0) {
      errors.push(
        this.language === 'es'
          ? 'El número de serie (últimos 4 dígitos) no puede ser 0000'
          : 'Serial number (last 4 digits) cannot be 0000'
      )
    }

    // ITIN warning (starts with 9)
    if (cleanSSN.startsWith('9')) {
      warnings.push(
        this.language === 'es'
          ? 'Los números que comienzan con 9 generalmente son ITIN, no SSN. Verifique su documento.'
          : 'Numbers starting with 9 are typically ITINs, not SSNs. Please verify your document.'
      )
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      info
    }
  }

  /**
   * Calculate I-9 deadlines based on hire date
   */
  calculateI9Deadlines(hireDate: Date | string): I9DeadlineInfo {
    const hire = typeof hireDate === 'string' ? new Date(hireDate) : hireDate
    const today = new Date()
    
    // Section 1 must be completed by first day of work
    const section1Deadline = hire

    // Section 2 must be completed within 3 business days
    const section2Deadline = this.addBusinessDays(hire, 3)

    // Calculate days remaining
    const daysUntilSection1 = this.calculateBusinessDays(today, section1Deadline)
    const daysUntilSection2 = this.calculateBusinessDays(today, section2Deadline)

    // Determine status
    let section1Status: I9DeadlineInfo['section1Status'] = 'pending'
    if (daysUntilSection1 < 0) {
      section1Status = 'overdue'
    } else if (daysUntilSection1 <= 2) {
      section1Status = 'due-soon'
    }

    let section2Status: I9DeadlineInfo['section2Status'] = 'pending'
    if (daysUntilSection2 < 0) {
      section2Status = 'overdue'
    } else if (daysUntilSection2 <= 5) {
      section2Status = 'due-soon'
    }

    return {
      section1Deadline,
      section2Deadline,
      daysUntilSection1,
      daysUntilSection2,
      section1Status,
      section2Status
    }
  }

  /**
   * Validate I-9 form completion timing
   */
  validateI9Timing(
    hireDate: Date | string,
    section1CompletedDate?: Date | string | null,
    section2CompletedDate?: Date | string | null
  ): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const info: string[] = []

    const deadlines = this.calculateI9Deadlines(hireDate)

    // Check Section 1 timing
    if (section1CompletedDate) {
      const completedDate = typeof section1CompletedDate === 'string' 
        ? new Date(section1CompletedDate) 
        : section1CompletedDate

      if (completedDate > deadlines.section1Deadline) {
        errors.push(
          this.language === 'es'
            ? `La Sección 1 del I-9 se completó tarde. Debía completarse antes del ${format(deadlines.section1Deadline, 'MM/dd/yyyy')}`
            : `I-9 Section 1 was completed late. It should have been completed by ${format(deadlines.section1Deadline, 'MM/dd/yyyy')}`
        )
      }
    } else if (deadlines.section1Status === 'overdue') {
      errors.push(
        this.language === 'es'
          ? 'La Sección 1 del I-9 está vencida y debe completarse inmediatamente'
          : 'I-9 Section 1 is overdue and must be completed immediately'
      )
    } else if (deadlines.section1Status === 'due-soon') {
      warnings.push(
        this.language === 'es'
          ? `La Sección 1 del I-9 debe completarse en ${deadlines.daysUntilSection1} día(s) hábil(es)`
          : `I-9 Section 1 must be completed within ${deadlines.daysUntilSection1} business day(s)`
      )
    }

    // Check Section 2 timing
    if (section2CompletedDate) {
      const completedDate = typeof section2CompletedDate === 'string' 
        ? new Date(section2CompletedDate) 
        : section2CompletedDate

      if (completedDate > deadlines.section2Deadline) {
        errors.push(
          this.language === 'es'
            ? `La Sección 2 del I-9 se completó tarde. Debía completarse antes del ${format(deadlines.section2Deadline, 'MM/dd/yyyy')}`
            : `I-9 Section 2 was completed late. It should have been completed by ${format(deadlines.section2Deadline, 'MM/dd/yyyy')}`
        )
      }
    } else if (deadlines.section2Status === 'overdue') {
      errors.push(
        this.language === 'es'
          ? 'La Sección 2 del I-9 está vencida y debe completarse inmediatamente'
          : 'I-9 Section 2 is overdue and must be completed immediately'
      )
    } else if (deadlines.section2Status === 'due-soon') {
      warnings.push(
        this.language === 'es'
          ? `La Sección 2 del I-9 debe completarse en ${deadlines.daysUntilSection2} día(s) hábil(es)`
          : `I-9 Section 2 must be completed within ${deadlines.daysUntilSection2} business day(s)`
      )
    }

    // Add informational messages
    info.push(
      this.language === 'es'
        ? `Fecha límite Sección 1: ${format(deadlines.section1Deadline, 'MM/dd/yyyy')}`
        : `Section 1 deadline: ${format(deadlines.section1Deadline, 'MM/dd/yyyy')}`
    )
    info.push(
      this.language === 'es'
        ? `Fecha límite Sección 2: ${format(deadlines.section2Deadline, 'MM/dd/yyyy')}`
        : `Section 2 deadline: ${format(deadlines.section2Deadline, 'MM/dd/yyyy')}`
    )

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      info
    }
  }

  /**
   * Calculate W-4 dependent credits according to IRS rules
   */
  calculateW4DependentCredits(
    qualifyingChildren: number,
    otherDependents: number,
    filingStatus: 'single' | 'married_filing_jointly' | 'head_of_household'
  ): W4Calculations {
    // IRS 2025 rates
    const CHILD_TAX_CREDIT = 2000
    const OTHER_DEPENDENT_CREDIT = 500

    const dependentCredit = qualifyingChildren * CHILD_TAX_CREDIT
    const otherDependentCredit = otherDependents * OTHER_DEPENDENT_CREDIT
    const totalCredit = dependentCredit + otherDependentCredit

    let explanation = this.language === 'es'
      ? `Cálculo de créditos según las reglas del IRS 2025:\n`
      : `Credit calculation per IRS 2025 rules:\n`

    if (qualifyingChildren > 0) {
      explanation += this.language === 'es'
        ? `• ${qualifyingChildren} hijo(s) calificado(s) × $${CHILD_TAX_CREDIT} = $${dependentCredit}\n`
        : `• ${qualifyingChildren} qualifying child(ren) × $${CHILD_TAX_CREDIT} = $${dependentCredit}\n`
    }

    if (otherDependents > 0) {
      explanation += this.language === 'es'
        ? `• ${otherDependents} otro(s) dependiente(s) × $${OTHER_DEPENDENT_CREDIT} = $${otherDependentCredit}\n`
        : `• ${otherDependents} other dependent(s) × $${OTHER_DEPENDENT_CREDIT} = $${otherDependentCredit}\n`
    }

    explanation += this.language === 'es'
      ? `• Crédito total: $${totalCredit}`
      : `• Total credit: $${totalCredit}`

    return {
      dependentCredit,
      otherDependentCredit,
      totalCredit,
      explanation
    }
  }

  /**
   * Validate W-4 form data
   */
  validateW4Form(formData: any): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const info: string[] = []

    // Validate filing status
    if (!formData.filingStatus) {
      errors.push(
        this.language === 'es'
          ? 'Se requiere el estado civil para efectos de impuestos'
          : 'Filing status is required'
      )
    }

    // Validate Step 3 calculations if dependents are claimed
    if (formData.step3_qualifying_children || formData.step3_other_dependents) {
      const children = parseInt(formData.step3_qualifying_children) || 0
      const others = parseInt(formData.step3_other_dependents) || 0
      
      const calculations = this.calculateW4DependentCredits(
        children,
        others,
        formData.filingStatus
      )

      // Check if entered amount matches calculation
      const enteredAmount = parseFloat(formData.step3_total_amount) || 0
      if (Math.abs(enteredAmount - calculations.totalCredit) > 1) {
        warnings.push(
          this.language === 'es'
            ? `El monto ingresado ($${enteredAmount}) no coincide con el cálculo ($${calculations.totalCredit})`
            : `Entered amount ($${enteredAmount}) doesn't match calculation ($${calculations.totalCredit})`
        )
      }

      info.push(calculations.explanation)
    }

    // Validate multiple jobs checkbox consistency
    if (formData.step2_multiple_jobs && !formData.step2_option_selected) {
      warnings.push(
        this.language === 'es'
          ? 'Marcó múltiples trabajos pero no seleccionó una opción en el Paso 2'
          : 'Multiple jobs checked but no option selected in Step 2'
      )
    }

    // Validate additional withholding amount
    if (formData.step4c_extra_withholding) {
      const amount = parseFloat(formData.step4c_extra_withholding)
      if (amount < 0) {
        errors.push(
          this.language === 'es'
            ? 'La retención adicional no puede ser negativa'
            : 'Additional withholding cannot be negative'
        )
      }
      if (amount > 5000) {
        warnings.push(
          this.language === 'es'
            ? 'La retención adicional parece inusualmente alta. Verifique el monto.'
            : 'Additional withholding seems unusually high. Please verify the amount.'
        )
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      info
    }
  }

  /**
   * Validate age requirements
   */
  validateAgeRequirements(
    dateOfBirth: Date | string,
    requiresAlcoholHandling: boolean = false
  ): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const info: string[] = []

    const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth
    const today = new Date()
    const age = Math.floor((today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))

    // Employment age requirement (18+)
    if (age < 18) {
      errors.push(
        this.language === 'es'
          ? `Debe tener al menos 18 años para trabajar. Edad actual: ${age}`
          : `Must be at least 18 years old for employment. Current age: ${age}`
      )
    }

    // Alcohol handling requirement (21+)
    if (requiresAlcoholHandling && age < 21) {
      errors.push(
        this.language === 'es'
          ? `Debe tener al menos 21 años para manejar alcohol. Edad actual: ${age}`
          : `Must be at least 21 years old to handle alcohol. Current age: ${age}`
      )
    }

    // Warning for near-retirement age
    if (age >= 65) {
      info.push(
        this.language === 'es'
          ? 'Elegible para beneficios de Medicare'
          : 'Eligible for Medicare benefits'
      )
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      info
    }
  }

  /**
   * Helper: Calculate business days between two dates
   */
  private calculateBusinessDays(startDate: Date, endDate: Date): number {
    let count = 0
    const current = new Date(startDate)
    const end = new Date(endDate)
    const increment = startDate <= endDate ? 1 : -1

    while (current <= end) {
      if (!isWeekend(current) && !this.isFederalHoliday(current)) {
        count += increment
      }
      current.setDate(current.getDate() + 1)
    }

    return startDate <= endDate ? count : -count
  }

  /**
   * Helper: Add business days to a date
   */
  private addBusinessDays(date: Date, days: number): Date {
    let result = new Date(date)
    let daysAdded = 0

    while (daysAdded < days) {
      result.setDate(result.getDate() + 1)
      if (!isWeekend(result) && !this.isFederalHoliday(result)) {
        daysAdded++
      }
    }

    return result
  }

  /**
   * Helper: Check if date is a federal holiday
   */
  private isFederalHoliday(date: Date): boolean {
    const dateStr = format(date, 'yyyy-MM-dd')
    return FEDERAL_HOLIDAYS_2025.includes(dateStr)
  }

  /**
   * Get validation severity level
   */
  getSeverityLevel(result: ValidationResult): 'error' | 'warning' | 'info' | 'success' {
    if (result.errors.length > 0) return 'error'
    if (result.warnings.length > 0) return 'warning'
    if (result.info.length > 0) return 'info'
    return 'success'
  }

  /**
   * Format validation messages for display
   */
  formatMessages(result: ValidationResult): string[] {
    const messages: string[] = []
    
    result.errors.forEach(msg => messages.push(`❌ ${msg}`))
    result.warnings.forEach(msg => messages.push(`⚠️ ${msg}`))
    result.info.forEach(msg => messages.push(`ℹ️ ${msg}`))

    return messages
  }
}

// Export singleton instance
export const federalComplianceValidator = new FederalComplianceValidator()