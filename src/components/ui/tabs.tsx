import * as React from 'react'

import { cn } from '@/utils/Helpers'

export interface TabsProps {
  children: React.ReactNode
  className?: string
  value?: string
  onValueChange?: (value: string) => void
}

export interface TabsContextType {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextType | undefined>(undefined)

export const Tabs: React.FC<TabsProps> = ({
  value: controlledValue,
  onValueChange,
  children,
  className,
}) => {
  const [internalValue, setInternalValue] = React.useState('')
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue

  const handleValueChange = (newValue: string) => {
    if (!isControlled) {
      setInternalValue(newValue)
    }
    onValueChange?.(newValue)
  }

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export interface TabsListProps {
  className?: string
  children: React.ReactNode
}

export const TabsList: React.FC<TabsListProps> = ({ children, className }) => {
  const context = React.useContext(TabsContext)
  if (!context) throw new Error('TabsList must be used within Tabs')

  return (
    <div
      role='tablist'
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
        className
      )}
    >
      {children}
    </div>
  )
}

export interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ value, children, className }) => {
  const context = React.useContext(TabsContext)
  if (!context) throw new Error('TabsTrigger must be used within Tabs')

  const isActive = context.value === value

  return (
    <button
      type='button'
      role='tab'
      onClick={() => context.onValueChange(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        isActive
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
        className
      )}
    >
      {children}
    </button>
  )
}

export interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

export const TabsContent: React.FC<TabsContentProps> = ({ value, children, className }) => {
  const context = React.useContext(TabsContext)
  if (!context) throw new Error('TabsContent must be used within Tabs')

  const isActive = context.value === value

  return (
    <div
      role='tabpanel'
      className={cn(
        'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
      hidden={!isActive}
    >
      {isActive && children}
    </div>
  )
}
