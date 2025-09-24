/**
 * Business Day Calculator Utilities
 * Handles federal holiday exclusions and business day calculations
 */

import { 
  addDays, 
  isWeekend, 
  format, 
  differenceInDays,
  isBefore,
  isAfter,
  startOfDay
} from 'date-fns'

// Federal holidays for 2025-2026
const FEDERAL_HOLIDAYS = [
  // 2025
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
  
  // 2026
  '2026-01-01', // New Year's Day
  '2026-01-19', // Martin Luther King Jr. Day
  '2026-02-16', // Presidents' Day
  '2026-05-25', // Memorial Day
  '2026-06-19', // Juneteenth
  '2026-07-03', // Independence Day (observed)
  '2026-09-07', // Labor Day
  '2026-10-12', // Columbus Day
  '2026-11-11', // Veterans Day
  '2026-11-26', // Thanksgiving Day
  '2026-12-25', // Christmas Day
]

/**
 * Check if a date is a federal holiday
 */
export function isFederalHoliday(date: Date): boolean {
  const dateStr = format(date, 'yyyy-MM-dd')
  return FEDERAL_HOLIDAYS.includes(dateStr)
}

/**
 * Check if a date is a business day (not weekend or federal holiday)
 */
export function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isFederalHoliday(date)
}

/**
 * Add business days to a date
 */
export function addBusinessDays(startDate: Date, daysToAdd: number): Date {
  let currentDate = new Date(startDate)
  let businessDaysAdded = 0
  
  while (businessDaysAdded < daysToAdd) {
    currentDate = addDays(currentDate, 1)
    if (isBusinessDay(currentDate)) {
      businessDaysAdded++
    }
  }
  
  return currentDate
}

/**
 * Subtract business days from a date
 */
export function subtractBusinessDays(startDate: Date, daysToSubtract: number): Date {
  let currentDate = new Date(startDate)
  let businessDaysSubtracted = 0
  
  while (businessDaysSubtracted < daysToSubtract) {
    currentDate = addDays(currentDate, -1)
    if (isBusinessDay(currentDate)) {
      businessDaysSubtracted++
    }
  }
  
  return currentDate
}

/**
 * Calculate the number of business days between two dates
 */
export function differenceInBusinessDays(startDate: Date, endDate: Date): number {
  const start = startOfDay(startDate)
  const end = startOfDay(endDate)
  
  if (isBefore(end, start)) {
    return -differenceInBusinessDays(end, start)
  }
  
  let businessDays = 0
  let currentDate = new Date(start)
  
  while (isBefore(currentDate, end) || currentDate.getTime() === end.getTime()) {
    if (isBusinessDay(currentDate)) {
      businessDays++
    }
    currentDate = addDays(currentDate, 1)
  }
  
  return businessDays
}

/**
 * Get the next business day from a given date
 */
export function getNextBusinessDay(date: Date): Date {
  let nextDay = addDays(date, 1)
  
  while (!isBusinessDay(nextDay)) {
    nextDay = addDays(nextDay, 1)
  }
  
  return nextDay
}

/**
 * Get the previous business day from a given date
 */
export function getPreviousBusinessDay(date: Date): Date {
  let prevDay = addDays(date, -1)
  
  while (!isBusinessDay(prevDay)) {
    prevDay = addDays(prevDay, -1)
  }
  
  return prevDay
}

/**
 * Calculate I-9 deadlines based on hire date
 */
export interface I9Deadlines {
  hireDate: Date
  section1Deadline: Date
  section2Deadline: Date
  section1BusinessDaysRemaining: number
  section2BusinessDaysRemaining: number
  isSection1Overdue: boolean
  isSection2Overdue: boolean
}

export function calculateI9Deadlines(hireDate: Date | string): I9Deadlines {
  const hire = typeof hireDate === 'string' ? new Date(hireDate) : hireDate
  const today = startOfDay(new Date())
  
  // Section 1 must be completed by first day of work (hire date)
  const section1Deadline = startOfDay(hire)
  
  // Section 2 must be completed within 3 business days of hire
  const section2Deadline = addBusinessDays(hire, 3)
  
  // Calculate remaining business days
  const section1BusinessDaysRemaining = isBefore(today, section1Deadline) 
    ? differenceInBusinessDays(today, section1Deadline) - 1 // Don't count today
    : 0
  
  const section2BusinessDaysRemaining = isBefore(today, section2Deadline)
    ? differenceInBusinessDays(today, section2Deadline) - 1 // Don't count today
    : 0
  
  return {
    hireDate: hire,
    section1Deadline,
    section2Deadline,
    section1BusinessDaysRemaining: Math.max(0, section1BusinessDaysRemaining),
    section2BusinessDaysRemaining: Math.max(0, section2BusinessDaysRemaining),
    isSection1Overdue: isAfter(today, section1Deadline),
    isSection2Overdue: isAfter(today, section2Deadline)
  }
}

/**
 * Format deadline with business days remaining
 */
export function formatDeadline(
  deadline: Date, 
  businessDaysRemaining: number,
  language: 'en' | 'es' = 'en'
): string {
  const dateStr = format(deadline, 'MMM dd, yyyy')
  
  if (businessDaysRemaining === 0) {
    return language === 'es' 
      ? `${dateStr} (Vence hoy)`
      : `${dateStr} (Due today)`
  } else if (businessDaysRemaining === 1) {
    return language === 'es'
      ? `${dateStr} (1 día hábil restante)`
      : `${dateStr} (1 business day remaining)`
  } else {
    return language === 'es'
      ? `${dateStr} (${businessDaysRemaining} días hábiles restantes)`
      : `${dateStr} (${businessDaysRemaining} business days remaining)`
  }
}

/**
 * Get list of upcoming federal holidays
 */
export function getUpcomingHolidays(fromDate: Date = new Date(), count: number = 5): Array<{
  date: Date
  name: string
}> {
  const holidays: Array<{ date: Date; name: string }> = [
    { date: new Date('2025-01-01'), name: "New Year's Day" },
    { date: new Date('2025-01-20'), name: "Martin Luther King Jr. Day" },
    { date: new Date('2025-02-17'), name: "Presidents' Day" },
    { date: new Date('2025-05-26'), name: "Memorial Day" },
    { date: new Date('2025-06-19'), name: "Juneteenth" },
    { date: new Date('2025-07-04'), name: "Independence Day" },
    { date: new Date('2025-09-01'), name: "Labor Day" },
    { date: new Date('2025-10-13'), name: "Columbus Day" },
    { date: new Date('2025-11-11'), name: "Veterans Day" },
    { date: new Date('2025-11-27'), name: "Thanksgiving Day" },
    { date: new Date('2025-12-25'), name: "Christmas Day" },
  ]
  
  return holidays
    .filter(h => isAfter(h.date, fromDate))
    .slice(0, count)
}

/**
 * Calculate working days in a month
 */
export function getWorkingDaysInMonth(year: number, month: number): number {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  
  let workingDays = 0
  let currentDate = new Date(firstDay)
  
  while (currentDate <= lastDay) {
    if (isBusinessDay(currentDate)) {
      workingDays++
    }
    currentDate = addDays(currentDate, 1)
  }
  
  return workingDays
}

/**
 * Check if a deadline is approaching (within specified business days)
 */
export function isDeadlineApproaching(
  deadline: Date, 
  withinDays: number = 3
): boolean {
  const today = new Date()
  const daysRemaining = differenceInBusinessDays(today, deadline)
  return daysRemaining >= 0 && daysRemaining <= withinDays
}

/**
 * Format business day difference as human-readable string
 */
export function formatBusinessDayDifference(
  days: number,
  language: 'en' | 'es' = 'en'
): string {
  if (days === 0) {
    return language === 'es' ? 'Hoy' : 'Today'
  } else if (days === 1) {
    return language === 'es' ? 'Mañana' : 'Tomorrow'
  } else if (days === -1) {
    return language === 'es' ? 'Ayer' : 'Yesterday'
  } else if (days > 0) {
    return language === 'es' 
      ? `En ${days} días hábiles`
      : `In ${days} business days`
  } else {
    return language === 'es'
      ? `Hace ${Math.abs(days)} días hábiles`
      : `${Math.abs(days)} business days ago`
  }
}