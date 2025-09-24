import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  CheckCircle, 
  Circle, 
  AlertCircle, 
  Clock, 
  ChevronRight,
  FileCheck,
  X
} from 'lucide-react'

interface FieldStatus {
  name: string
  label: string
  completed: boolean
  valid: boolean
  required: boolean
  errorMessage?: string
}

interface StepProgressCardProps {
  stepId: string
  stepName: string
  percentage: number
  fieldsCompleted: number
  fieldsTotal: number
  timeSpent: number
  estimatedTimeRemaining: number
  validationStatus: 'valid' | 'invalid' | 'incomplete'
  errors: string[]
  fields?: FieldStatus[]
  onNavigateToField?: (fieldName: string) => void
  onClose?: () => void
  className?: string
}

export const StepProgressCard: React.FC<StepProgressCardProps> = ({
  stepId,
  stepName,
  percentage,
  fieldsCompleted,
  fieldsTotal,
  timeSpent,
  estimatedTimeRemaining,
  validationStatus,
  errors,
  fields = [],
  onNavigateToField,
  onClose,
  className = ''
}) => {
  const [showFieldDetails, setShowFieldDetails] = useState(false)

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (minutes === 0) {
      return `${secs}s`
    }
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`
  }

  const getStatusIcon = () => {
    switch (validationStatus) {
      case 'valid':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'invalid':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <Circle className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusColor = () => {
    switch (validationStatus) {
      case 'valid':
        return 'border-green-500 bg-green-50'
      case 'invalid':
        return 'border-red-500 bg-red-50'
      default:
        return 'border-blue-500 bg-blue-50'
    }
  }

  const incompleteFields = fields.filter(f => !f.completed && f.required)
  const invalidFields = fields.filter(f => !f.valid && f.completed)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`bg-white rounded-lg shadow-lg border-2 ${getStatusColor()} ${className}`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon()}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{stepName}</h3>
              <p className="text-sm text-gray-500">Step Progress</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Overview */}
      <div className="p-4 space-y-4">
        {/* Main Progress Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Overall Completion
            </span>
            <span className="text-sm font-bold text-gray-900">{percentage}%</span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${
                validationStatus === 'valid' ? 'bg-green-500' :
                validationStatus === 'invalid' ? 'bg-red-500' :
                'bg-blue-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <FileCheck className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500">Fields</span>
            </div>
            <p className="text-lg font-bold text-gray-900 mt-1">
              {fieldsCompleted}/{fieldsTotal}
            </p>
            <p className="text-xs text-gray-500">completed</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500">Time</span>
            </div>
            <p className="text-lg font-bold text-gray-900 mt-1">
              {formatTime(timeSpent)}
            </p>
            <p className="text-xs text-gray-500">spent</p>
          </div>
        </div>

        {/* Estimated Time Remaining */}
        {estimatedTimeRemaining > 0 && (
          <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-900">Estimated time to complete:</span>
            </div>
            <span className="text-sm font-bold text-blue-900">
              ~{Math.round(estimatedTimeRemaining)} min
            </span>
          </div>
        )}

        {/* Validation Errors */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900 mb-1">
                  Validation Issues ({errors.length})
                </p>
                <ul className="text-xs text-red-700 space-y-1">
                  {errors.slice(0, 3).map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                  {errors.length > 3 && (
                    <li className="font-medium">...and {errors.length - 3} more</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {(incompleteFields.length > 0 || invalidFields.length > 0) && (
          <div className="space-y-2">
            <button
              onClick={() => setShowFieldDetails(!showFieldDetails)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="text-sm font-medium text-gray-700">
                View Field Details
              </span>
              <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${
                showFieldDetails ? 'rotate-90' : ''
              }`} />
            </button>

            {showFieldDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                {/* Incomplete Required Fields */}
                {incompleteFields.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-yellow-900 mb-2">
                      Incomplete Required Fields ({incompleteFields.length})
                    </p>
                    <div className="space-y-1">
                      {incompleteFields.map((field, index) => (
                        <button
                          key={index}
                          onClick={() => onNavigateToField?.(field.name)}
                          className="w-full text-left flex items-center justify-between p-2 hover:bg-yellow-100 rounded transition-colors"
                        >
                          <span className="text-xs text-yellow-800">{field.label}</span>
                          <ChevronRight className="w-3 h-3 text-yellow-600" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Invalid Fields */}
                {invalidFields.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-red-900 mb-2">
                      Fields with Errors ({invalidFields.length})
                    </p>
                    <div className="space-y-1">
                      {invalidFields.map((field, index) => (
                        <button
                          key={index}
                          onClick={() => onNavigateToField?.(field.name)}
                          className="w-full text-left p-2 hover:bg-red-100 rounded transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-red-800">{field.label}</span>
                            <ChevronRight className="w-3 h-3 text-red-600" />
                          </div>
                          {field.errorMessage && (
                            <p className="text-xs text-red-600 mt-1">{field.errorMessage}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed Fields */}
                {fields.filter(f => f.completed && f.valid).length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-green-900 mb-2">
                      Completed Fields ({fields.filter(f => f.completed && f.valid).length})
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      {fields.filter(f => f.completed && f.valid).map((field, index) => (
                        <div key={index} className="flex items-center space-x-1">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span className="text-xs text-green-800 truncate">
                            {field.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}

        {/* Navigation Helper */}
        {onNavigateToField && incompleteFields.length > 0 && (
          <button
            onClick={() => onNavigateToField(incompleteFields[0].name)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <span>Continue to Next Field</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  )
}