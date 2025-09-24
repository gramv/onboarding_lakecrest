/**
 * Compliance Alert Component
 * Displays federal compliance warnings with appropriate severity and styling
 */

import React, { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  CheckCircle,
  X,
  ExternalLink 
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type ComplianceSeverity = 'error' | 'warning' | 'info' | 'success'

export interface ComplianceAlertProps {
  severity: ComplianceSeverity
  title?: string
  messages: string | string[]
  dismissible?: boolean
  onDismiss?: () => void
  persistent?: boolean
  regulationLink?: {
    text: string
    url: string
  }
  className?: string
  language?: 'en' | 'es'
}

const severityConfig = {
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
    iconColor: 'text-red-600',
    buttonColor: 'hover:bg-red-100'
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-800',
    iconColor: 'text-amber-600',
    buttonColor: 'hover:bg-amber-100'
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    iconColor: 'text-blue-600',
    buttonColor: 'hover:bg-blue-100'
  },
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800',
    iconColor: 'text-green-600',
    buttonColor: 'hover:bg-green-100'
  }
}

const defaultTitles = {
  en: {
    error: 'Compliance Error',
    warning: 'Compliance Warning',
    info: 'Compliance Information',
    success: 'Compliance Verified'
  },
  es: {
    error: 'Error de Cumplimiento',
    warning: 'Advertencia de Cumplimiento',
    info: 'Información de Cumplimiento',
    success: 'Cumplimiento Verificado'
  }
}

export const ComplianceAlert: React.FC<ComplianceAlertProps> = ({
  severity,
  title,
  messages,
  dismissible = false,
  onDismiss,
  persistent = false,
  regulationLink,
  className,
  language = 'en'
}) => {
  const [isVisible, setIsVisible] = useState(true)
  
  const config = severityConfig[severity]
  const Icon = config.icon
  const defaultTitle = defaultTitles[language][severity]
  
  const messageArray = Array.isArray(messages) ? messages : [messages]

  const handleDismiss = () => {
    if (!persistent) {
      setIsVisible(false)
      onDismiss?.()
    }
  }

  if (!isVisible) return null

  return (
    <Alert 
      className={cn(
        config.bgColor,
        config.borderColor,
        'relative',
        className
      )}
    >
      <div className="flex items-start">
        <Icon className={cn('h-5 w-5 mt-0.5', config.iconColor)} />
        
        <div className="flex-1 ml-3">
          {(title || defaultTitle) && (
            <AlertTitle className={cn('font-semibold mb-1', config.textColor)}>
              {title || defaultTitle}
            </AlertTitle>
          )}
          
          <AlertDescription className={config.textColor}>
            {messageArray.length === 1 ? (
              <p>{messageArray[0]}</p>
            ) : (
              <ul className="list-disc list-inside space-y-1">
                {messageArray.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            )}
            
            {regulationLink && (
              <a
                href={regulationLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-flex items-center mt-2 text-sm font-medium underline',
                  config.textColor,
                  'hover:no-underline'
                )}
              >
                {regulationLink.text}
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            )}
          </AlertDescription>
        </div>
        
        {dismissible && !persistent && (
          <button
            onClick={handleDismiss}
            className={cn(
              'ml-3 p-1 rounded-md transition-colors',
              config.buttonColor
            )}
            aria-label={language === 'es' ? 'Cerrar alerta' : 'Dismiss alert'}
          >
            <X className={cn('h-4 w-4', config.iconColor)} />
          </button>
        )}
      </div>
    </Alert>
  )
}

// Compound component for multiple alerts
export interface ComplianceAlertGroupProps {
  alerts: Array<{
    id: string
    severity: ComplianceSeverity
    title?: string
    messages: string | string[]
    dismissible?: boolean
    regulationLink?: {
      text: string
      url: string
    }
  }>
  onDismiss?: (id: string) => void
  className?: string
  language?: 'en' | 'es'
}

export const ComplianceAlertGroup: React.FC<ComplianceAlertGroupProps> = ({
  alerts,
  onDismiss,
  className,
  language = 'en'
}) => {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set(prev).add(id))
    onDismiss?.(id)
  }

  const visibleAlerts = alerts.filter(alert => !dismissedIds.has(alert.id))

  if (visibleAlerts.length === 0) return null

  return (
    <div className={cn('space-y-3', className)}>
      {visibleAlerts.map(alert => (
        <ComplianceAlert
          key={alert.id}
          severity={alert.severity}
          title={alert.title}
          messages={alert.messages}
          dismissible={alert.dismissible}
          onDismiss={() => handleDismiss(alert.id)}
          regulationLink={alert.regulationLink}
          language={language}
        />
      ))}
    </div>
  )
}

export default ComplianceAlert