'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

import { WorkflowStep } from '@/features/workflow-automation/types'

// Connection system types
interface Connection {
  id: string
  fromStepId: string
  toStepId: string
  fromPoint: { x: number; y: number }
  toPoint: { x: number; y: number }
  type: 'normal' | 'conditional' | 'error' | 'success'
}

interface ConnectionManagerProps {
  steps: WorkflowStep[]
  connections: Connection[]
  onStepsChange: (steps: WorkflowStep[]) => void
  onConnectionsChange: (connections: Connection[]) => void
  onConnectionClick?: (connection: Connection) => void
}

/**
 * Workflow Connection Manager Component
 * Manages step connections in the workflow designer
 */
export default function ConnectionManager({
  steps,
  connections,
  onStepsChange,
  onConnectionsChange,
  onConnectionClick,
}: ConnectionManagerProps) {
  const [isDragging, setIsDragging] = useState<string | 'from-port' | 'to-port' | 'line' | null>(
    null
  )
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [tempConnection, setTempConnection] = useState<Connection | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)

  /**
   * Calculate connection endpoint position
   */
  const getConnectionPoint = (step: WorkflowStep, type: 'from' | 'to') => {
    if (!step.position) return { x: 0, y: 0 }

    return {
      x: step.position.x + (type === 'from' ? 200 : -6),
      y: step.position.y + 40,
    }
  }

  /**
   * Update connection when steps move
   */
  const updateConnectionPositions = useCallback(() => {
    const updatedConnections = connections.map((connection) => {
      const fromStep = steps.find((s) => s.id === connection.fromStepId)
      const toStep = steps.find((s) => s.id === connection.toStepId)

      if (fromStep && toStep) {
        return {
          ...connection,
          fromPoint: getConnectionPoint(fromStep, 'from'),
          toPoint: getConnectionPoint(toStep, 'to'),
        }
      }
      return connection
    })

    onConnectionsChange(updatedConnections)
  }, [steps, connections, onConnectionsChange])

  /**
   * Handle connection drag start
   */
  const handleConnectionMouseDown = useCallback((e: React.MouseEvent, connection: Connection) => {
    e.stopPropagation()
    setIsDragging('line')
    setDragStart({ x: e.clientX, y: e.clientY })
    setTempConnection(connection)
  }, [])

  /**
   * Handle connection drag
   */
  const handleConnectionMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !tempConnection || !dragStart) return

      const deltaX = e.clientX - dragStart.x
      const deltaY = e.clientY - dragStart.y

      const updatedConnection = {
        ...tempConnection,
        fromPoint: {
          x: Math.min(tempConnection.fromPoint.x + deltaX, tempConnection.toPoint.x),
          y: Math.min(tempConnection.fromPoint.y + deltaY, tempConnection.toPoint.y),
        },
        toPoint: {
          x: Math.min(tempConnection.toPoint.x + deltaX, tempConnection.toPoint.y),
          y: Math.min(tempConnection.toPoint.y + deltaY, tempConnection.toPoint.y),
        },
      }

      setTempConnection(updatedConnection)
    },
    [isDragging, tempConnection, dragStart]
  )

  /**
   * Handle connection drag end
   */
  const handleConnectionMouseUp = useCallback(() => {
    if (!isDragging || !tempConnection) return

    setIsDragging(null)

    // Update the connections with the new position
    const updatedConnections = connections.map((conn) => {
      if (conn.id === tempConnection.id) {
        return tempConnection
      }
      return conn
    })

    onConnectionsChange(updatedConnections)
    setTempConnection(null)
    setDragStart(null)
  }, [isDragging, tempConnection, onConnectionsChange])

  /**
   * Handle port click for creating connections
   */
  const handlePortClick = useCallback(
    (stepId: string, portType: 'from' | 'to', e: React.MouseEvent) => {
      e.stopPropagation()
      setIsDragging(portType)

      // Create new connection
      const newConnection: Connection = {
        id: `conn-${Date.now()}`,
        fromStepId:
          portType === 'from' ? stepId : ((e.target as HTMLElement).dataset.fromStepId as string),
        toStepId:
          portType === 'to' ? stepId : ((e.target as HTMLElement).dataset.toStepId as string),
        fromPoint: { x: 0, y: 0 }, // Will be updated
        toPoint: { x: 0, y: 0 }, // Will be updated
        type: 'normal',
      }

      onConnectionsChange([...connections, newConnection])
    },
    [connections, onConnectionsChange]
  )

  /**
   * Delete connection
   */
  const handleConnectionDelete = useCallback(
    (connectionId: string, e: React.MouseEvent) => {
      e.stopPropagation()

      const updatedConnections = connections.filter((c) => c.id !== connectionId)
      onConnectionsChange(updatedConnections)
    },
    [connections, onConnectionsChange]
  )

  /**
   * Update connection type (normal/conditional/error/success)
   */
  const updateConnectionType = useCallback(
    (connectionId: string, type: Connection['type']) => {
      const updatedConnections = connections.map((conn) => {
        if (conn.id === connectionId) {
          return { ...conn, type }
        }
        return conn
      })

      onConnectionsChange(updatedConnections)
    },
    [connections, onConnectionsChange]
  )

  /**
   * Global mouse up handler
   */
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(null)
      setTempConnection(null)
      setDragStart(null)
    }

    document.addEventListener('mouseup', handleGlobalMouseUp)
    document.addEventListener('mousemove', handleConnectionMouseMove)

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp)
      document.removeEventListener('mousemove', handleConnectionMouseMove)
    }
  }, [isDragging, tempConnection, dragStart])

  return (
    <div className='relative'>
      {/* Render connections */}
      <svg
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
          {connections.map((connection) => {
            const fromStep = steps.find((s) => s.id === connection.fromStepId)
            const toStep = steps.find((s) => s.id === connection.toStepId)

            if (!fromStep || !toStep) return null

            return (
              <g key={connection.id}>
                <line
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
                  strokeWidth={
                    connection.type === 'conditional'
                      ? '2'
                      : connection.type === 'error'
                        ? '3'
                        : '2'
                  }
                  strokeDasharray={
                    connection.type === 'conditional'
                      ? '5,5'
                      : connection.type === 'error'
                        ? '3,3'
                        : 'none'
                  }
                  markerEnd='url(#arrowhead)'
                  className='cursor-pointer hover:opacity-80 transition-opacity'
                  onClick={() => onConnectionClick?.(connection)}
                />

                {/* Connection type indicator */}
                {(connection.type === 'conditional' ||
                  connection.type === 'error' ||
                  connection.type === 'success') && (
                  <circle
                    cx={(connection.fromPoint.x + connection.toPoint.x) / 2}
                    cy={(connection.fromPoint.y + connection.toPoint.y) / 2}
                    r='4'
                    fill={
                      connection.type === 'success'
                        ? '#10B981'
                        : connection.type === 'error'
                          ? '#EF4444'
                          : '#F59E0B'
                    }
                    stroke='none'
                  />
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* Render step ports */}
      {steps.map((step) => {
        if (!step.position) return null

        return (
          <div key={step.id}>
            {/* From port */}
            <div
              className='absolute w-3 h-3 bg-blue-500 rounded-full cursor-crosshair hover:bg-blue-600 transition-colors'
              style={{
                left: `${step.position.x + 194}px`,
                top: `${step.position.y + 35}px`,
              }}
              data-step-id={step.id}
              data-port-type='from'
              onMouseDown={(e) => handlePortClick(step.id, 'from', e)}
              title='Connect from this step'
            />

            {/* To port */}
            <div
              className='absolute w-3 h-3 bg-gray-500 rounded-full cursor-crosshair hover:bg-gray-600 transition-colors'
              style={{
                left: `${step.position.x + 194}px`,
                top: `${step.position.y + 45}px`,
              }}
              data-step-id={step.id}
              data-port-type='to'
              onMouseDown={(e) => handlePortClick(step.id, 'to', e)}
              title='Connect to this step'
            />
          </div>
        )
      })}

      {/* Temporary connection line while dragging */}
      {isDragging && tempConnection && (
        <svg
          className='absolute inset-0 pointer-events-none'
          style={{ width: '100%', height: '100%' }}
        >
          <defs>
            <marker
              id='temp-arrowhead'
              markerWidth='10'
              markerHeight='7'
              refX='9'
              refY='3.5'
              orient='auto'
            >
              <polygon points='0 0, 10 3.5, 0 7' fill='#3B82F6' />
            </marker>
          </defs>

          <line
            x1={tempConnection.fromPoint.x}
            y1={tempConnection.fromPoint.y}
            x2={tempConnection.toPoint.x}
            y2={tempConnection.toPoint.y}
            stroke='#3B82F6'
            strokeWidth='2'
            strokeDasharray='5,5'
            markerEnd='url(#temp-arrowhead)'
            opacity='0.7'
          />
        </svg>
      )}
    </div>
  )
}
