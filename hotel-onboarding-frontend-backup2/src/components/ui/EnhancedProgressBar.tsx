import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Clock, CheckCircle, AlertCircle, FileText } from 'lucide-react'

interface ProgressSegment {
  id: string
  label: string
  percentage: number
  status: 'completed' | 'current' | 'pending' | 'error'
  isRequired: boolean
  isFederalForm: boolean
  estimatedMinutes?: number
  actualMinutes?: number
}

interface EnhancedProgressBarProps {
  segments: ProgressSegment[]
  overallPercentage: number
  estimatedTimeRemaining: number
  currentStepId: string
  showDetails?: boolean
  complianceDeadlines?: {
    i9?: Date
    w4?: Date
  }
  onSegmentClick?: (segmentId: string) => void
  className?: string
}

export const EnhancedProgressBar: React.FC<EnhancedProgressBarProps> = ({
  segments,
  overallPercentage,
  estimatedTimeRemaining,
  currentStepId,
  showDetails = false,
  complianceDeadlines,
  onSegmentClick,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(showDetails)
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null)

  const getSegmentColor = (status: ProgressSegment['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500'
      case 'current':
        return 'bg-blue-500'
      case 'error':
        return 'bg-red-500'
      case 'pending':
      default:
        return 'bg-gray-300'
    }
  }

  const getSegmentIcon = (segment: ProgressSegment) => {
    if (segment.status === 'completed') {
      return <CheckCircle className="w-4 h-4 text-green-600" />
    }
    if (segment.status === 'error') {
      return <AlertCircle className="w-4 h-4 text-red-600" />
    }
    if (segment.isFederalForm) {
      return <FileText className="w-4 h-4 text-blue-600" />
    }
    return null
  }

  const formatTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${Math.round(minutes)} min`
    }
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const calculateSegmentWidth = (segment: ProgressSegment): number => {
    // Each segment gets proportional width based on estimated time
    const totalEstimated = segments.reduce((sum, s) => sum + (s.estimatedMinutes || 5), 0)
    const segmentEstimated = segment.estimatedMinutes || 5
    return (segmentEstimated / totalEstimated) * 100
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Main Progress Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-4">
            <h3 className="text-sm font-semibold text-gray-700">
              Overall Progress: {overallPercentage}%
            </h3>
            {estimatedTimeRemaining > 0 && (
              <div className="flex items-center text-sm text-gray-500">
                <Clock className="w-4 h-4 mr-1" />
                <span>~{formatTime(estimatedTimeRemaining)} remaining</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>

        {/* Segmented Progress Bar */}
        <div className="relative">
          <div className="w-full h-8 bg-gray-100 rounded-full overflow-hidden flex">
            {segments.map((segment, index) => (
              <motion.div
                key={segment.id}
                className={`relative h-full ${getSegmentColor(segment.status)} ${
                  onSegmentClick ? 'cursor-pointer' : ''
                } ${segment.id === currentStepId ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
                style={{ width: `${calculateSegmentWidth(segment)}%` }}
                onMouseEnter={() => setHoveredSegment(segment.id)}
                onMouseLeave={() => setHoveredSegment(null)}
                onClick={() => onSegmentClick?.(segment.id)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                {/* Progress fill within segment */}
                {segment.status === 'current' && segment.percentage < 100 && (
                  <motion.div
                    className="absolute inset-0 bg-blue-600 opacity-60"
                    style={{ width: `${segment.percentage}%` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${segment.percentage}%` }}
                    transition={{ duration: 0.5 }}
                  />
                )}

                {/* Milestone indicator for federal forms */}
                {segment.isFederalForm && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full mb-1">
                    <div className="bg-blue-600 text-white text-xs px-1 py-0.5 rounded">
                      Federal
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Overall progress overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="h-full bg-gradient-to-r from-transparent to-white opacity-20"
              style={{ width: `${100 - overallPercentage}%`, marginLeft: `${overallPercentage}%` }}
            />
          </div>
        </div>

        {/* Hover Tooltip */}
        <AnimatePresence>
          {hoveredSegment && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-10 bg-gray-900 text-white text-xs rounded px-2 py-1 pointer-events-none"
              style={{
                left: '50%',
                transform: 'translateX(-50%)',
                top: '-30px'
              }}
            >
              {segments.find(s => s.id === hoveredSegment)?.label}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compliance Deadlines */}
        {complianceDeadlines && (
          <div className="mt-3 flex space-x-4 text-xs">
            {complianceDeadlines.i9 && (
              <div className="flex items-center text-orange-600">
                <AlertCircle className="w-3 h-3 mr-1" />
                <span>I-9 Due: {complianceDeadlines.i9.toLocaleDateString()}</span>
              </div>
            )}
            {complianceDeadlines.w4 && (
              <div className="flex items-center text-orange-600">
                <AlertCircle className="w-3 h-3 mr-1" />
                <span>W-4 Due: {complianceDeadlines.w4.toLocaleDateString()}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expanded Details View */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 bg-white rounded-lg shadow-sm border border-gray-200 p-4"
          >
            <div className="space-y-2">
              {segments.map(segment => (
                <div
                  key={segment.id}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    segment.id === currentStepId ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
                  } ${onSegmentClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onSegmentClick?.(segment.id)}
                >
                  <div className="flex items-center space-x-3">
                    {getSegmentIcon(segment)}
                    <div>
                      <p className={`text-sm font-medium ${
                        segment.status === 'completed' ? 'text-gray-600' : 'text-gray-900'
                      }`}>
                        {segment.label}
                        {segment.isRequired && (
                          <span className="ml-1 text-xs text-red-500">*</span>
                        )}
                      </p>
                      {segment.status === 'current' && (
                        <p className="text-xs text-gray-500">
                          {segment.percentage}% complete
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    {segment.actualMinutes ? (
                      <span className="text-green-600">
                        ✓ {formatTime(segment.actualMinutes)}
                      </span>
                    ) : segment.estimatedMinutes ? (
                      <span>~{formatTime(segment.estimatedMinutes)}</span>
                    ) : null}

                    {segment.status === 'completed' && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    {segment.status === 'error' && (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="flex flex-wrap gap-4 text-xs">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-1.5" />
                  <span className="text-gray-600">Completed</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-1.5" />
                  <span className="text-gray-600">In Progress</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-gray-300 rounded-full mr-1.5" />
                  <span className="text-gray-600">Pending</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full mr-1.5" />
                  <span className="text-gray-600">Error</span>
                </div>
                <div className="flex items-center">
                  <FileText className="w-3 h-3 text-blue-600 mr-1.5" />
                  <span className="text-gray-600">Federal Form</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}