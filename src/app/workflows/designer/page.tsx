'use client'

import { WorkflowDesigner } from '@/components/workflow/WorkflowDesigner'

/**
 * Workflow Designer Page
 */
export default function WorkflowDesignerPage() {
  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='bg-white shadow'>
        <div className='max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8'>
          <div className='px-4 py-6 sm:p-0'>
            <h1 className='text-3xl font-bold text-gray-900 tracking-tight'>
              Visual Workflow Designer
            </h1>
            <p className='mt-2 text-sm text-gray-600'>
              Design and automate complex business processes with our intuitive drag-and-drop
              workflow editor. Create workflows that scale with your business.
            </p>
          </div>

          <WorkflowDesigner />

          {/* Feature highlights */}
          <div className='mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            <div className='bg-gray-50 rounded-lg p-6'>
              <h3 className='text-lg font-medium text-gray-900 mb-4'>🎯 Drag & Drop Builder</h3>
              <p className='text-sm text-gray-600'>
                Intuitive visual workflow creation with snap-to-grid alignment and smart
                connections.
              </p>
            </div>

            <div className='bg-gray-50 rounded-lg p-6'>
              <h3 className='text-lg font-medium text-gray-900 mb-4'>🔀 Real-time Collaboration</h3>
              <p className='text-sm text-gray-600'>
                Build workflows together with real-time editing and instant sync.
              </p>
            </div>

            <div className='bg-gray-50 rounded-lg p-6'>
              <h3 className='text-lg font-medium text-gray-900 mb-4'>📊 Analytics & Insights</h3>
              <p className='text-sm text-gray-600'>
                Monitor performance and optimize workflows with detailed analytics.
              </p>
            </div>

            <div className='bg-gray-50 rounded-lg p-6'>
              <h3 className='text-lg font-medium text-gray-900 mb-4'>🔗 Smart Integrations</h3>
              <p className='text-sm text-gray-600'>
                Connect to 50+ business apps and services with pre-built connectors.
              </p>
            </div>

            <div className='bg-gray-50 rounded-lg p-6'>
              <h3 className='text-lg font-medium text-gray-900 mb-4'>
                ⚡ Auto-save & Version Control
              </h3>
              <p className='text-sm text-gray-600'>
                Never lose work with automatic saving and complete version history.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
