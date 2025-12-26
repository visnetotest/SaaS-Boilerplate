'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Connection, Workflow, WorkflowStep } from '../../types/workflow-local'

// Canvas types
interface Point {
  x: number
  y: number
}

interface CanvasState {
  steps: WorkflowStep[]
  connections: Connection[]
  selectedStepId: string | null
  isDragging: boolean
  dragType: string | null
  scale: number
  offset: Point
  canvasSize: { width: number; height: number }
}

// Step type configuration
const STEP_TYPES = {
  'data-entry': {
    name: 'Data Entry',
    color: '#3B82F6',
    icon: '📝',
  },
  'document-gen': {
    name: 'Document Gen',
    color: '#10B981',
    icon: '📄',
  },
  decision: {
    name: 'Decision',
    color: '#F59E0B',
    icon: '🔀',
  },
  integration: {
    name: 'Integration',
    color: '#8B5CF6',
    icon: '🔗',
  },
  approval: {
    name: 'Approval',
    color: '#EF4444',
    icon: '✅',
  },
  notification: {
    name: 'Notification',
    color: '#06B6D4',
    icon: '📢',
  },
}

// Constants
const GRID_SIZE = 20
const STEP_WIDTH = 200
const STEP_HEIGHT = 80
const CANVAS_PADDING = 50

/**
 * Visual Workflow Designer Canvas
 */
export default function WorkflowDesigner({ workflowId }: { workflowId?: string }) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const [canvasState, setCanvasState] = useState<CanvasState>({
    steps: [],
    connections: [],
    selectedStepId: null,
    isDragging: false,
    dragType: null,
    scale: 1,
    offset: { x: 0, y: 0 },
    canvasSize: { width: 1200, height: 800 },
  })

  // Load workflow from API on mount
  useEffect(() => {
    if (workflowId) {
      loadWorkflow(workflowId)
    }
  }, [workflowId])

  /**
   * Load workflow from API
   */
  const loadWorkflow = async (id: string) => {
    try {
      const response = await fetch(`/api/workflows/${id}`)
      if (response.ok) {
        const workflow = await response.json()
        setCanvasState((prev) => ({
          ...prev,
          steps: workflow.data?.steps || [],
          connections: inferConnections(workflow.data?.steps || []),
        }))
      }
    } catch (error) {
      console.error('Failed to load workflow:', error)
    }
  }

  /**
   * Infer connections from workflow steps
   */
  const inferConnections = (steps: WorkflowStep[]): Connection[] => {
    const connections: Connection[] = []

    steps.forEach((step) => {
      if (step.nextSteps) {
        step.nextSteps.forEach((nextStepId) => {
          const fromStep = steps.find((s) => s.id === step.id)
          const toStep = steps.find((s) => s.id === nextStepId)

          if (fromStep && toStep) {
            connections.push({
              id: `${step.id}-${nextStepId}`,
              fromStepId: step.id,
              toStepId: nextStepId,
              fromPoint: {
                x: (fromStep.position?.x || 0) + STEP_WIDTH,
                y: (fromStep.position?.y || 0) + STEP_HEIGHT / 2,
              },
              toPoint: {
                x: toStep.position?.x || 0,
                y: (toStep.position?.y || 0) + STEP_HEIGHT / 2,
              },
              type: 'normal',
            })
          }
        })
      }
    })

    return connections
  }

  /**
   * Handle canvas mouse events
   */
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setCanvasState((prev) => ({
      ...prev,
      isDragging: true,
      dragType: 'canvas',
      offset: { x, y },
    }))
  }, [])

  /**
   * Handle step mouse down
   */
  const handleStepMouseDown = useCallback((stepId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    setCanvasState((prev) => ({
      ...prev,
      isDragging: true,
      dragType: 'step',
      selectedStepId: stepId,
    }))
  }, [])

  /**
   * Handle canvas mouse move
   */
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setCanvasState((prev) => {
      if (prev.isDragging && prev.dragType === 'canvas') {
        return {
          ...prev,
          offset: { x, y },
        }
      }
      return prev
    })
  }, [])

  /**
   * Handle mouse up
   */
  const handleCanvasMouseUp = useCallback(() => {
    setCanvasState((prev) => ({
      ...prev,
      isDragging: false,
      dragType: null,
      selectedStepId: null,
    }))
  }, [])

  /**
   * Handle canvas wheel (zoom)
   */
  const handleCanvasWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()

      const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1
      const newScale = Math.min(Math.max(canvasState.scale * scaleFactor, 0.1), 5)

      setCanvasState((prev) => ({
        ...prev,
        scale: newScale,
      }))
    },
    [canvasState.scale]
  )

  /**
   * Add new step to canvas
   */
  const addStep = useCallback((stepType: string, position: Point) => {
    const newStep: WorkflowStep = {
      id: crypto.randomUUID(),
      type: stepType as any,
      name: `${STEP_TYPES[stepType as keyof typeof STEP_TYPES]?.name} Step`,
      description: '',
      config: {
        fields: [
          { name: 'input1', type: 'text', required: true, label: 'Input Field' },
          { name: 'input2', type: 'email', required: false, label: 'Email Field' },
        ],
      },
      position,
      nextSteps: [],
      parallelGroups: [],
      conditions: [],
      timeout: 300,
    }

    setCanvasState((prev) => ({
      ...prev,
      steps: [...prev.steps, newStep],
    }))
  }, [])

  /**
   * Delete step from canvas
   */
  const deleteStep = useCallback((stepId: string) => {
    setCanvasState((prev) => ({
      ...prev,
      steps: prev.steps.filter((s) => s.id !== stepId),
    }))
  }, [])

  /**
   * Auto-save workflow to backend
   */
  const saveWorkflow = useCallback(async () => {
    try {
      const workflowData = {
        id: workflowId || 'new-workflow',
        name: 'Untitled Workflow',
        description: 'Created with visual designer',
        category: 'general',
        steps: canvasState.steps,
        variables: [],
        settings: {
          timeout: 300,
          retryPolicy: 'steps',
          parallelExecution: true,
          requireApproval: false,
          notificationSettings: {
            onStart: true,
            onComplete: true,
            onError: true,
            recipients: [],
            channels: ['in-app'],
          },
          securitySettings: {
            requireAuthentication: true,
            allowedRoles: [],
            dataEncryption: true,
            auditLogging: true,
          },
        },
        metadata: {
          category: 'general',
          priority: 'medium',
          tags: ['visual-designer'],
          dependencies: [],
          integrationRequirements: [],
        },
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-id',
        updatedBy: 'user-id',
      }

      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflowData),
      })

      if (response.ok) {
        console.log('Workflow saved successfully')
      }
    } catch (error) {
      console.error('Failed to save workflow:', error)
    }
  }, [canvasState.steps, workflowId])

  return (
    <div className='h-screen bg-gray-50 flex flex-col'>
      {/* Toolbar */}
      <div className='bg-white border-b border-gray-200 p-4 flex items-center justify-between'>
        <div className='flex items-center space-x-4'>
          <h1 className='text-xl font-bold text-gray-900 tracking-tight'>Workflow Designer</h1>
          <span className='text-sm text-gray-500'>
            {canvasState.steps.length} steps • {canvasState.connections.length} connections
          </span>
        </div>

        <div className='flex items-center space-x-2'>
          {/* Zoom controls */}
          <div className='flex items-center space-x-1'>
            <button
              className='p-2 bg-gray-100 rounded hover:bg-gray-200'
              onClick={() =>
                setCanvasState((prev) => ({ ...prev, scale: Math.min(prev.scale * 1.2, 5) }))
              }
            >
              🔍+
            </button>
            <span className='text-sm font-medium text-gray-600'>
              {Math.round(canvasState.scale * 100)}%
            </span>
            <button
              className='p-2 bg-gray-100 rounded hover:bg-gray-200'
              onClick={() =>
                setCanvasState((prev) => ({ ...prev, scale: Math.max(prev.scale * 0.8, 0.2) }))
              }
            >
              🔍-
            </button>
          </div>

          {/* Save button */}
          <button
            className='px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 font-medium'
            onClick={saveWorkflow}
          >
            💾 Save Workflow
          </button>
        </div>
      </div>

      {/* Main canvas area */}
      <div className='flex-1 relative overflow-hidden'>
        <div
          ref={canvasRef}
          className='absolute inset-0 bg-gray-100 border-2 border-gray-300 rounded-lg'
          style={{
            backgroundImage: `
              radial-gradient(circle, #e5e7eb 1px, transparent 1px)
            `,
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onWheel={handleCanvasWheel}
        >
          {/* SVG for connections */}
          <svg
            ref={svgRef}
            className='absolute inset-0 pointer-events-none'
            style={{ width: '100%', height: '100%' }}
          >
            <defs>
              <marker
                id='arrowhead'
                markerWidth='10'
                markerHeight='7'
                refX='9'
                refY='3.5'
                orient='auto'
              >
                <polygon points='0 0, 10 3.5, 0 7' fill='#3B82F6' />
              </marker>
            </defs>

            <g>
              {canvasState.connections.map((connection) => (
                <line
                  key={connection.id}
                  x1={connection.fromPoint.x}
                  y1={connection.fromPoint.y}
                  x2={connection.toPoint.x}
                  y2={connection.toPoint.y}
                  stroke={
                    connection.type === 'success'
                      ? '#10B981'
                      : connection.type === 'error'
                        ? '#EF4444'
                        : connection.type === 'conditional'
                          ? '#F59E0B'
                          : '#3B82F6'
                  }
                  strokeWidth='2'
                  markerEnd='url(#arrowhead)'
                  className='transition-all hover:opacity-80'
                />
              ))}
            </g>
          </svg>

          {/* Render steps */}
          {canvasState.steps.map((step) => {
            if (!step.position) return null

            const stepType = STEP_TYPES[step.type as keyof typeof STEP_TYPES]
            const isSelected = canvasState.selectedStepId === step.id

            return (
              <div
                key={step.id}
                className={`absolute cursor-move transition-all ${isSelected ? 'ring-2 ring-blue-500' : 'hover:shadow-lg'}`}
                style={{
                  left: `${step.position.x * canvasState.scale + canvasState.offset.x}px`,
                  top: `${step.position.y * canvasState.scale + canvasState.offset.y}px`,
                  width: `${STEP_WIDTH * canvasState.scale}px`,
                  height: `${STEP_HEIGHT * canvasState.scale}px`,
                }}
                onMouseDown={(e) => handleStepMouseDown(step.id, e)}
              >
                <div
                  className={`bg-white rounded-lg border-2 p-4 h-full flex items-center ${isSelected ? 'border-blue-500' : 'border-gray-300'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xl flex-shrink-0`}
                    style={{ backgroundColor: stepType?.color || '#6B7280' }}
                  >
                    {stepType?.icon}
                  </div>
                  <div className='ml-3 flex-1 min-w-0'>
                    <div className='text-sm font-semibold text-gray-900'>{stepType?.name}</div>
                    <div className='text-xs text-gray-500 truncate'>{step.name}</div>
                  </div>
                </div>

                {/* Connection points */}
                <div
                  className='absolute w-3 h-3 bg-blue-500 rounded-full cursor-crosshair hover:bg-blue-600 transition-colors'
                  style={{
                    left: `${STEP_WIDTH * canvasState.scale - 6}px`,
                    top: `${(STEP_HEIGHT * canvasState.scale) / 2 - 6}px`,
                  }}
                  data-step-id={step.id}
                  data-connection-point='right'
                  title='Connect from this step'
                />
              </div>
            )
          })}

          {/* Grid overlay */}
          <div
            className='absolute inset-0 pointer-events-none opacity-30'
            style={{
              backgroundImage: `
                repeating-linear-gradient(0deg, transparent, transparent 19px, #d1d5db 19px, #d1d5db 20px)
              `,
            }}
          ></div>
        </div>
      </div>
    </div>
  )
}
