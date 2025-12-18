import { NextRequest, NextResponse } from 'next/server'

// Simple GET endpoint for services list
export async function GET(_request: NextRequest) {
  try {
    // Return mock data for now to avoid DB issues
    return NextResponse.json({
      success: true,
      data: [],
      type: 'service-list'
    })
  } catch (error) {
    console.error('Failed to list services:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to list services' },
      { status: 500 }
    )
  }
}