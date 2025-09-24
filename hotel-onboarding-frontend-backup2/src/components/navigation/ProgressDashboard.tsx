import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckCircle, 
  Circle, 
  AlertCircle, 
  Clock, 
  Download,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  FileText,
  Calendar,
  ChevronRight,
  X,
  Save,
  Trash2
} from 'lucide-react'
import { OnboardingStep } from '../../types/onboarding'

interface StepStatus {
  id: string
  title: string
  status: 'completed' | 'current' | 'pending' | 'error'
  percentage: number
  timeSpent?: number
  estimatedTime?: number
  required: boolean
  isFederalForm: boolean
  hasUnsavedChanges?: boolean
  errors?: string[]
}

interface ComplianceDeadline {
  form: string
  deadline: Date
  status: 'pending' | 'completed' | 'overdue'
  daysRemaining: number
}

interface ProgressDashboardProps {
  steps: OnboardingStep[]
  stepStatuses: StepStatus[]
  overallProgress: number
  complianceDeadlines: ComplianceDeadline[]
  abandonmentRisk?: 'low' | 'medium' | 'high'
  bottlenecks?: string[]
  onNavigateToStep: (stepId: string) => void
  onExportReport: () => void
  onSaveProgress: () => void
  onClearProgress: () => void
  isOpen: boolean
  onClose: () => void
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({
  steps,
  stepStatuses,
  overallProgress,
  complianceDeadlines,
  abandonmentRisk = 'low',
  bottlenecks = [],
  onNavigateToStep,
  onExportReport,
  onSaveProgress,
  onClearProgress,
  isOpen,
  onClose
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'required' | 'federal'>('all')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const getFilteredStatuses = () => {
    switch (selectedCategory) {
      case 'required':
        return stepStatuses.filter(s => s.required)
      case 'federal':
        return stepStatuses.filter(s => s.isFederalForm)
      default:
        return stepStatuses
    }
  }

  const getStatusIcon = (status: StepStatus['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'current':
        return <Circle className="w-5 h-5 text-blue-500" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <Circle className="w-5 h-5 text-gray-300" />
    }
  }

  const getStatusColor = (status: StepStatus['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'current':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      default:
        return 'text-green-600 bg-green-50 border-green-200'
    }
  }

  const formatTime = (minutes?: number): string => {
    if (!minutes) return '--'
    if (minutes < 60) return `${Math.round(minutes)}m`
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const completedSteps = stepStatuses.filter(s => s.status === 'completed').length
  const totalSteps = stepStatuses.length
  const unsavedSteps = stepStatuses.filter(s => s.hasUnsavedChanges).length

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Progress Dashboard</h2>
                <p className="text-blue-100 mt-1">
                  Track your onboarding journey and compliance status
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  <span className="text-2xl font-bold text-gray-900">
                    {overallProgress}%
                  </span>
                </div>
                <p className="text-sm text-gray-600">Overall Progress</p>
                <p className="text-xs text-gray-500 mt-1">
                  {completedSteps} of {totalSteps} steps
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-5 h-5 text-purple-500" />
                  <span className="text-2xl font-bold text-gray-900">
                    {formatTime(stepStatuses.reduce((sum, s) => sum + (s.timeSpent || 0), 0))}
                  </span>
                </div>
                <p className="text-sm text-gray-600">Time Spent</p>
                <p className="text-xs text-gray-500 mt-1">
                  Est. {formatTime(stepStatuses.reduce((sum, s) => sum + (s.estimatedTime || 0), 0))} total
                </p>
              </div>

              <div className={`border rounded-lg p-4 ${getRiskColor(abandonmentRisk)}`}>
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-lg font-bold capitalize">
                    {abandonmentRisk}
                  </span>
                </div>
                <p className="text-sm font-medium">Abandonment Risk</p>
                {bottlenecks.length > 0 && (
                  <p className="text-xs mt-1">
                    {bottlenecks.length} bottleneck{bottlenecks.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <Save className="w-5 h-5 text-green-500" />
                  <span className="text-2xl font-bold text-gray-900">
                    {unsavedSteps}
                  </span>
                </div>
                <p className="text-sm text-gray-600">Unsaved Changes</p>
                <button
                  onClick={onSaveProgress}
                  className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                >
                  Save now
                </button>
              </div>
            </div>

            {/* Compliance Deadlines */}
            {complianceDeadlines.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <div className="flex items-center mb-3">
                  <Calendar className="w-5 h-5 text-orange-600 mr-2" />
                  <h3 className="text-lg font-semibold text-orange-900">
                    Compliance Deadlines
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {complianceDeadlines.map((deadline, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        deadline.status === 'overdue' 
                          ? 'bg-red-100 border border-red-300'
                          : deadline.status === 'completed'
                          ? 'bg-green-100 border border-green-300'
                          : 'bg-yellow-100 border border-yellow-300'
                      }`}
                    >
                      <div>
                        <p className="font-medium text-sm">{deadline.form}</p>
                        <p className="text-xs text-gray-600">
                          {deadline.deadline.toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        {deadline.status === 'completed' ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : deadline.status === 'overdue' ? (
                          <div className="text-red-600">
                            <AlertCircle className="w-5 h-5" />
                            <span className="text-xs">Overdue</span>
                          </div>
                        ) : (
                          <span className="text-sm font-medium">
                            {deadline.daysRemaining}d left
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Category Filters */}
            <div className="flex space-x-2 mb-4">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Steps ({stepStatuses.length})
              </button>
              <button
                onClick={() => setSelectedCategory('required')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === 'required'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Required ({stepStatuses.filter(s => s.required).length})
              </button>
              <button
                onClick={() => setSelectedCategory('federal')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === 'federal'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Federal Forms ({stepStatuses.filter(s => s.isFederalForm).length})
              </button>
            </div>

            {/* Steps Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {getFilteredStatuses().map(step => (
                <motion.div
                  key={step.id}
                  whileHover={{ scale: 1.01 }}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    getStatusColor(step.status)
                  } ${bottlenecks.includes(step.id) ? 'ring-2 ring-orange-400' : ''}`}
                  onClick={() => onNavigateToStep(step.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {getStatusIcon(step.status)}
                      <div className="flex-1">
                        <div className="flex items-center">
                          <h4 className="font-medium text-sm">{step.title}</h4>
                          {step.required && (
                            <span className="ml-1 text-red-500 text-xs">*</span>
                          )}
                          {step.isFederalForm && (
                            <FileText className="ml-2 w-3 h-3 text-blue-600" />
                          )}
                          {step.hasUnsavedChanges && (
                            <div className="ml-2 w-2 h-2 bg-orange-500 rounded-full" />
                          )}
                        </div>
                        
                        {/* Progress bar for current/incomplete steps */}
                        {step.status !== 'completed' && step.percentage > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                              <span>{step.percentage}% complete</span>
                              {step.estimatedTime && (
                                <span>~{formatTime(step.estimatedTime)} left</span>
                              )}
                            </div>
                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all"
                                style={{ width: `${step.percentage}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Time spent for completed steps */}
                        {step.status === 'completed' && step.timeSpent && (
                          <p className="text-xs text-gray-600 mt-1">
                            Completed in {formatTime(step.timeSpent)}
                          </p>
                        )}

                        {/* Errors */}
                        {step.errors && step.errors.length > 0 && (
                          <div className="mt-2 text-xs text-red-600">
                            {step.errors.length} error{step.errors.length > 1 ? 's' : ''}
                          </div>
                        )}

                        {/* Bottleneck indicator */}
                        {bottlenecks.includes(step.id) && (
                          <div className="mt-2 text-xs text-orange-600 flex items-center">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Potential bottleneck
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex space-x-2">
                <button
                  onClick={onExportReport}
                  className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Report
                </button>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center px-4 py-2 bg-white border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear Progress
                </button>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close Dashboard
              </button>
            </div>
          </div>

          {/* Clear Confirmation Modal */}
          <AnimatePresence>
            {showClearConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.9 }}
                  className="bg-white rounded-lg p-6 max-w-md"
                >
                  <h3 className="text-lg font-semibold mb-3">Clear All Progress?</h3>
                  <p className="text-gray-600 mb-4">
                    This will permanently delete all your onboarding progress. This action cannot be undone.
                  </p>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        onClearProgress()
                        setShowClearConfirm(false)
                        onClose()
                      }}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Clear Progress
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}