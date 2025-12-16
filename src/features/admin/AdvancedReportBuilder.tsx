// =============================================================================
// ADVANCED REPORT BUILDER COMPONENT
// =============================================================================

import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import {
  BarChart3,
  Download,
  FileText,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Trash2,
} from 'lucide-react'
import React, { useCallback, useState } from 'react'
import { DragDropContext, Draggable, Droppable, DropResult } from 'react-beautiful-dnd'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Types
interface ChartComponent {
  id: string
  type: 'line' | 'bar' | 'pie' | 'metric' | 'table'
  title: string
  dataSource: string
  config: {
    xAxis?: string
    yAxis?: string
    color?: string
    size?: 'small' | 'medium' | 'large'
  }
  position: { x: number; y: number }
  size: { width: number; height: number }
}

interface ReportTemplate {
  id: string
  name: string
  description: string
  components: ChartComponent[]
  layout: 'grid' | 'freeform'
}

interface DataSource {
  id: string
  name: string
  type: 'users' | 'tenants' | 'api_calls' | 'revenue' | 'performance'
  schema: Record<string, any>
  sampleData: any[]
}

// Sample data sources
const dataSources: DataSource[] = [
  {
    id: 'users',
    name: 'User Analytics',
    type: 'users',
    schema: { userId: 'string', email: 'string', signupDate: 'date', lastActive: 'date' },
    sampleData: Array.from({ length: 50 }, (_, i) => ({
      userId: `user_${i}`,
      email: `user${i}@example.com`,
      signupDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      lastActive: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    })),
  },
  {
    id: 'revenue',
    name: 'Revenue Metrics',
    type: 'revenue',
    schema: { month: 'string', revenue: 'number', subscriptions: 'number' },
    sampleData: [
      { month: 'Jan', revenue: 45000, subscriptions: 120 },
      { month: 'Feb', revenue: 52000, subscriptions: 135 },
      { month: 'Mar', revenue: 48000, subscriptions: 142 },
      { month: 'Apr', revenue: 61000, subscriptions: 158 },
      { month: 'May', revenue: 55000, subscriptions: 165 },
      { month: 'Jun', revenue: 67000, subscriptions: 178 },
    ],
  },
]

// Chart component templates
const chartTemplates = [
  { id: 'line', name: 'Line Chart', icon: LineChartIcon, type: 'line' as const },
  { id: 'bar', name: 'Bar Chart', icon: BarChart3, type: 'bar' as const },
  { id: 'pie', name: 'Pie Chart', icon: PieChartIcon, type: 'pie' as const },
]

// Report templates
const reportTemplates: ReportTemplate[] = [
  {
    id: 'user-overview',
    name: 'User Overview Report',
    description: 'Comprehensive user analytics dashboard',
    layout: 'grid',
    components: [
      {
        id: 'comp_1',
        type: 'metric',
        title: 'Total Users',
        dataSource: 'users',
        config: {},
        position: { x: 0, y: 0 },
        size: { width: 300, height: 200 },
      },
      {
        id: 'comp_2',
        type: 'line',
        title: 'User Growth',
        dataSource: 'users',
        config: { xAxis: 'signupDate', yAxis: 'count', color: '#3b82f6' },
        position: { x: 320, y: 0 },
        size: { width: 400, height: 250 },
      },
    ],
  },
  {
    id: 'revenue-dashboard',
    name: 'Revenue Dashboard',
    description: 'Monthly revenue and subscription metrics',
    layout: 'grid',
    components: [
      {
        id: 'comp_3',
        type: 'bar',
        title: 'Monthly Revenue',
        dataSource: 'revenue',
        config: { xAxis: 'month', yAxis: 'revenue', color: '#10b981' },
        position: { x: 0, y: 0 },
        size: { width: 400, height: 300 },
      },
    ],
  },
]

// Individual chart component renderer
const ReportChart: React.FC<{
  component: ChartComponent
  data: any[]
  onEdit: () => void
  onDelete: () => void
}> = ({ component, data, onEdit, onDelete }) => {
  const renderChart = () => {
    switch (component.type) {
      case 'line':
        return (
          <ResponsiveContainer width='100%' height='100%'>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis dataKey={component.config.xAxis || 'x'} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type='monotone'
                dataKey={component.config.yAxis || 'y'}
                stroke={component.config.color || '#3b82f6'}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        )

      case 'bar':
        return (
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis dataKey={component.config.xAxis || 'x'} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar
                dataKey={component.config.yAxis || 'y'}
                fill={component.config.color || '#10b981'}
              />
            </BarChart>
          </ResponsiveContainer>
        )

      case 'pie':
        const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']
        return (
          <ResponsiveContainer width='100%' height='100%'>
            <PieChart>
              <Pie
                data={data}
                cx='50%'
                cy='50%'
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill='#8884d8'
                dataKey={component.config.yAxis || 'value'}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )

      case 'metric':
        const value = data.length > 0 ? data[0][component.config.yAxis || 'value'] || 0 : 0
        return (
          <div className='flex flex-col items-center justify-center h-full'>
            <div className='text-3xl font-bold text-gray-800'>{value.toLocaleString()}</div>
            <div className='text-sm text-gray-600 mt-2'>{component.title}</div>
          </div>
        )

      default:
        return (
          <div className='flex items-center justify-center h-full text-gray-500'>
            Unsupported chart type
          </div>
        )
    }
  }

  return (
    <Card className='h-full relative group'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-sm font-medium'>{component.title}</CardTitle>
        <div className='absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1'>
          <Button size='sm' variant='ghost' onClick={onEdit}>
            <FileText className='h-3 w-3' />
          </Button>
          <Button size='sm' variant='ghost' onClick={onDelete}>
            <Trash2 className='h-3 w-3' />
          </Button>
        </div>
      </CardHeader>
      <CardContent className='p-4'>
        <div style={{ width: '100%', height: 'calc(100% - 60px)' }}>{renderChart()}</div>
      </CardContent>
    </Card>
  )
}

// Component palette
const ComponentPalette: React.FC<{
  onAddComponent: (type: ChartComponent['type'], dataSource: string) => void
}> = ({ onAddComponent }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-sm'>Chart Components</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        {chartTemplates.map((template) => {
          const Icon = template.icon
          return (
            <div
              key={template.id}
              className='flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors'
              onClick={() => onAddComponent(template.type, 'users')}
            >
              <Icon className='h-5 w-5 text-gray-600' />
              <div>
                <div className='text-sm font-medium'>{template.name}</div>
                <div className='text-xs text-gray-500'>Drag to add to report</div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// Main report builder component
export const AdvancedReportBuilder: React.FC = () => {
  const [components, setComponents] = useState<ChartComponent[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null)
  const [reportName, setReportName] = useState('Custom Report')
  const [selectedDataSource, setSelectedDataSource] = useState<string>('users')
  const [isGenerating, setIsGenerating] = useState(false)

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return

      const { source, destination } = result

      // Handle adding new component from palette
      if (source.droppableId === 'palette') {
        const chartType = result.draggableId as ChartComponent['type']
        const newComponent: ChartComponent = {
          id: `chart_${Date.now()}`,
          type: chartType,
          title: `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`,
          dataSource: selectedDataSource,
          config: {
            color: chartType === 'line' ? '#3b82f6' : chartType === 'bar' ? '#10b981' : '#8884d8',
            size: 'medium',
          },
          position: { x: destination.index * 20, y: destination.index * 20 },
          size: { width: 400, height: 300 },
        }
        setComponents((prev) => [...prev, newComponent])
        return
      }

      // Handle reordering existing components
      const items = Array.from(components)
      const [reorderedItem] = items.splice(source.index, 1)
      if (reorderedItem) {
        items.splice(destination.index, 0, reorderedItem)
        setComponents(items)
      }
    },
    [components, selectedDataSource]
  )

  const addComponent = useCallback((type: ChartComponent['type'], dataSource: string) => {
    const newComponent: ChartComponent = {
      id: `chart_${Date.now()}`,
      type,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Chart`,
      dataSource,
      config: {
        color: type === 'line' ? '#3b82f6' : type === 'bar' ? '#10b981' : '#8884d8',
        size: 'medium',
      },
      position: { x: Math.random() * 100, y: Math.random() * 100 },
      size: { width: 400, height: 300 },
    }
    setComponents((prev) => [...prev, newComponent])
  }, [])

  const removeComponent = useCallback((componentId: string) => {
    setComponents((prev) => prev.filter((comp) => comp.id !== componentId))
  }, [])

  const editComponent = useCallback((componentId: string) => {
    // Open edit modal for component configuration
    console.log('Edit component:', componentId)
  }, [])

  const loadTemplate = useCallback((template: ReportTemplate) => {
    setSelectedTemplate(template)
    setComponents(template.components)
    setReportName(template.name)
  }, [])

  const generateReport = useCallback(
    async (format: 'pdf' | 'csv' | 'json') => {
      setIsGenerating(true)

      try {
        switch (format) {
          case 'pdf':
            await generatePDF()
            break
          case 'csv':
            generateCSV()
            break
          case 'json':
            generateJSON()
            break
        }
      } finally {
        setIsGenerating(false)
      }
    },
    [components]
  )

  const generatePDF = async () => {
    const element = document.getElementById('report-canvas')
    if (!element) return

    const canvas = await html2canvas(element)
    const imgData = canvas.toDataURL('image/png')

    const pdf = new jsPDF()
    const imgWidth = 210
    const pageHeight = 295
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    let heightLeft = imgHeight
    let position = 0

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    pdf.save(`${reportName}.pdf`)
  }

  const generateCSV = () => {
    // Generate CSV for the first component's data
    if (components.length === 0) return

    const dataSource = dataSources.find((ds) => ds.id === components[0]?.dataSource)
    if (!dataSource || dataSource.sampleData.length === 0) return

    const headers = Object.keys(dataSource.sampleData[0])
    const csvContent = [
      headers.join(','),
      ...dataSource.sampleData.map((row) => headers.map((header) => `"${row[header]}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reportName}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const generateJSON = () => {
    const reportData = {
      name: reportName,
      generatedAt: new Date().toISOString(),
      components: components.map((comp) => ({
        type: comp.type,
        title: comp.title,
        dataSource: comp.dataSource,
        config: comp.config,
      })),
      dataSources: components.reduce(
        (acc, comp) => {
          const ds = dataSources.find((d) => d.id === comp.dataSource)
          if (ds && !acc[comp.dataSource]) {
            acc[comp.dataSource] = ds.sampleData
          }
          return acc
        },
        {} as Record<string, any[]>
      ),
    }

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reportName}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <input
            type='text'
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
            className='text-xl font-semibold bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-2 py-1'
          />
          <Badge variant='secondary'>Draft</Badge>
        </div>

        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            onClick={() => generateReport('pdf')}
            disabled={isGenerating || components.length === 0}
          >
            <Download className='h-4 w-4 mr-2' />
            Export PDF
          </Button>
          <Button
            variant='outline'
            onClick={() => generateReport('csv')}
            disabled={isGenerating || components.length === 0}
          >
            <Download className='h-4 w-4 mr-2' />
            Export CSV
          </Button>
          <Button
            onClick={() => generateReport('json')}
            disabled={isGenerating || components.length === 0}
          >
            <Download className='h-4 w-4 mr-2' />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle className='text-sm'>Report Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {reportTemplates.map((template) => (
              <div
                key={template.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedTemplate?.id === template.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => loadTemplate(template)}
              >
                <div className='flex items-center gap-2 mb-2'>
                  <FileText className='h-4 w-4 text-blue-500' />
                  <span className='font-medium text-sm'>{template.name}</span>
                </div>
                <p className='text-xs text-gray-600'>{template.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main builder area */}
      <div className='grid grid-cols-1 lg:grid-cols-4 gap-6'>
        {/* Component Palette */}
        <div className='lg:col-span-1'>
          <ComponentPalette onAddComponent={addComponent} />

          {/* Data Source Selection */}
          <Card className='mt-4'>
            <CardHeader>
              <CardTitle className='text-sm'>Data Source</CardTitle>
            </CardHeader>
            <CardContent>
              <select
                value={selectedDataSource}
                onChange={(e) => setSelectedDataSource(e.target.value)}
                className='w-full p-2 border rounded-md text-sm'
              >
                {dataSources.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.name}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>
        </div>

        {/* Report Canvas */}
        <div className='lg:col-span-3'>
          <Card>
            <CardHeader>
              <CardTitle className='text-sm flex items-center gap-2'>
                <span>Report Canvas</span>
                <Badge variant='outline'>{components.length} components</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className='grid grid-cols-2 gap-4 min-h-[500px]'>
                  <Droppable droppableId='canvas' direction='vertical'>
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className='space-y-4'
                      >
                        {components.map((component, index) => {
                          const dataSource = dataSources.find(
                            (ds) => ds.id === component.dataSource
                          )
                          return (
                            <Draggable key={component.id} draggableId={component.id} index={index}>
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className='transform transition-transform hover:scale-[1.02]'
                                >
                                  <ReportChart
                                    component={component}
                                    data={dataSource?.sampleData || []}
                                    onEdit={() => editComponent(component.id)}
                                    onDelete={() => removeComponent(component.id)}
                                  />
                                </div>
                              )}
                            </Draggable>
                          )
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              </DragDropContext>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hidden canvas for PDF generation */}
      <div id='report-canvas' className='hidden'>
        <div className='p-8 bg-white'>
          <h1 className='text-2xl font-bold mb-6'>{reportName}</h1>
          <div className='grid grid-cols-2 gap-4'>
            {components.map((component) => {
              const dataSource = dataSources.find((ds) => ds.id === component.dataSource)
              return (
                <div key={component.id} className='mb-4'>
                  <h3 className='font-semibold mb-2'>{component.title}</h3>
                  <ReportChart
                    component={component}
                    data={dataSource?.sampleData || []}
                    onEdit={() => {}}
                    onDelete={() => {}}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdvancedReportBuilder
