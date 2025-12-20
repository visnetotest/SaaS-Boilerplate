'use client'

import React, { useCallback, useState } from 'react'

// Step types with simplified properties
interface StepItem {
  type: string
  name: string
  icon: string
  color: string
}

interface StepLibraryCategory {
  name: string
  icon: string
  steps: StepItem[]
}

// Step library data
const STEP_LIBRARY: StepLibraryCategory[] = [
  {
    name: 'Data Collection',
    icon: '📝',
    steps: [
      { type: 'data-entry', name: 'Text Input', icon: '📝', color: '#3B82F6' },
      { type: 'data-entry', name: 'Form Builder', icon: '📋', color: '#3B82F6' },
      { type: 'data-entry', name: 'File Upload', icon: '📁', color: '#3B82F6' },
      { type: 'data-entry', name: 'Digital Signature', icon: '✍️', color: '#3B82F6' },
    ],
  },
  {
    name: 'Processing',
    icon: '⚙️',
    steps: [
      { type: 'decision', name: 'Condition Check', icon: '🔀', color: '#F59E0B' },
      { type: 'decision', name: 'Data Filter', icon: '🔍', color: '#F59E0B' },
      { type: 'decision', name: 'Data Transform', icon: '🔄', color: '#F59E0B' },
      { type: 'decision', name: 'For Each Loop', icon: '🔁', color: '#F59E0B' },
      { type: 'decision', name: 'Parallel Branch', icon: '⚡', color: '#F59E0B' },
    ],
  },
  {
    name: 'Integration',
    icon: '🔗',
    steps: [
      { type: 'integration', name: 'API Call', icon: '🌐', color: '#8B5CF6' },
      { type: 'integration', name: 'Webhook', icon: '🪝', color: '#8B5CF6' },
      { type: 'integration', name: 'Database Query', icon: '🗄️', color: '#8B5CF6' },
      { type: 'integration', name: 'Send Email', icon: '📧', color: '#8B5CF6' },
      { type: 'integration', name: 'Calendar Event', icon: '📅', color: '#8B5CF6' },
      { type: 'integration', name: 'Slack Message', icon: '💬', color: '#8B5CF6' },
    ],
  },
  {
    name: 'Communication',
    icon: '📢',
    steps: [
      { type: 'notification', name: 'Send Notification', icon: '📢', color: '#06B6D4' },
      { type: 'notification', name: 'Send SMS', icon: '📱', color: '#06B6D4' },
      { type: 'notification', name: 'In-App Message', icon: '💬', color: '#06B6D4' },
      { type: 'notification', name: 'Push Notification', icon: '🔔', color: '#06B6D4' },
    ],
  },
  {
    name: 'Approval',
    icon: '✅',
    steps: [
      { type: 'approval', name: 'Single Approval', icon: '👤', color: '#EF4444' },
      { type: 'approval', name: 'Multi Approval', icon: '👥', color: '#EF4444' },
      { type: 'approval', name: 'Conditional Approval', icon: '🤔', color: '#EF4444' },
    ],
  },
  {
    name: 'Documents',
    icon: '📄',
    steps: [
      { type: 'document-gen', name: 'Generate PDF', icon: '📑', color: '#10B981' },
      { type: 'document-gen', name: 'Generate Word', icon: '📝', color: '#10B981' },
      { type: 'document-gen', name: 'Merge Documents', icon: '🔀', color: '#10B981' },
      { type: 'document-gen', name: 'Apply Template', icon: '📋', color: '#10B981' },
      { type: 'document-gen', name: 'Digital Signature', icon: '✍️', color: '#10B981' },
    ],
  },
  {
    name: 'Advanced',
    icon: '🚀',
    steps: [
      { type: 'decision', name: 'Sub-Workflow', icon: '📊', color: '#6366F1' },
      { type: 'decision', name: 'Error Handler', icon: '⚠️', color: '#6366F1' },
      { type: 'decision', name: 'Timeout Control', icon: '⏰', color: '#6366F1' },
      { type: 'decision', name: 'Retry Logic', icon: '🔄', color: '#6366F1' },
      { type: 'integration', name: 'Custom Script', icon: '⚡', color: '#8B5CF6' },
    ],
  },
]

/**
 * Drag and Drop Step Library Component
 */
export default function StepLibrary({
  onStepSelect,
}: {
  onStepSelect: (stepType: string) => void
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  // Filter steps based on search and category
  const filteredSteps = STEP_LIBRARY.filter((category) => {
    if (selectedCategory !== 'All' && category.name !== selectedCategory) {
      return false
    }
    return true
  }).flatMap((category) =>
    category.steps.filter(
      (step) =>
        step.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        step.type.toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, step: StepItem) => {
    const dragData = {
      type: step.type,
      name: step.name,
      icon: step.icon,
      color: step.color,
    }

    e.dataTransfer.setData('text/plain', JSON.stringify(dragData))
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    // Cleanup if needed
  }, [])

  return (
    <div className='w-80 bg-white border-l border-gray-200 flex flex-col h-full'>
      {/* Search bar */}
      <div className='p-4 border-b border-gray-200'>
        <div className='relative'>
          <input
            type='text'
            placeholder='Search steps...'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className='w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
          />
          <div className='absolute inset-y-0 right-0 flex items-center pr-3'>
            <div className='w-5 h-5 text-gray-400'>🔍</div>
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className='border-b border-gray-200'>
        <div className='flex space-x-1 p-2 overflow-x-auto'>
          <button
            key='all'
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
              selectedCategory === 'All'
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
            }`}
            onClick={() => setSelectedCategory('All')}
          >
            All
          </button>

          {STEP_LIBRARY.map((category) => (
            <button
              key={category.name}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap flex items-center space-x-2 ${
                selectedCategory === category.name
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
              }`}
              onClick={() => setSelectedCategory(category.name)}
            >
              <span>{category.icon}</span>
              <span>{category.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Step list */}
      <div className='flex-1 overflow-y-auto p-4'>
        <div className='grid grid-cols-1 gap-3'>
          {filteredSteps.map((step, index) => (
            <div
              key={`${step.type}-${index}`}
              draggable
              onDragStart={(e) => handleDragStart(e, step)}
              className='bg-white border border-gray-200 rounded-lg p-4 cursor-move hover:shadow-md transition-shadow hover:border-blue-300'
              onClick={() => onStepSelect(step.type)}
            >
              <div className='flex items-start space-x-3'>
                <div
                  className='w-10 h-10 rounded-lg flex items-center justify-center text-white text-xl flex-shrink-0'
                  style={{ backgroundColor: step.color }}
                >
                  {step.icon}
                </div>
                <div className='flex-1 min-w-0'>
                  <h4 className='text-sm font-medium text-gray-900'>{step.name}</h4>
                  <p className='text-xs text-gray-500 mt-1'>{step.type}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
