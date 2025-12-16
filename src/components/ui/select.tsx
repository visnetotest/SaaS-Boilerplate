import { ChevronDown } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/utils/Helpers'

export interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  children: React.ReactNode
  className?: string
}

export const SelectItem = React.forwardRef<
  HTMLDivElement,
  {
    value: string
    children: React.ReactNode
    onClick?: (value: string) => void
  }
>(({ value, children, onClick, ...props }, ref) => {
  return (
    <div
      ref={ref}
      onClick={() => onClick?.(value)}
      className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground'
      {...props}
    >
      {children}
    </div>
  )
})

export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  {
    children: React.ReactNode
    onClick?: () => void
    className?: string
  }
>(({ children, onClick, className, ...props }, ref) => {
  return (
    <button
      ref={ref}
      type='button'
      onClick={onClick}
      className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className || ''}`}
      {...props}
    >
      {children}
      <ChevronDown className='h-4 w-4 opacity-50' />
    </button>
  )
})

export const Select: React.FC<SelectProps> = ({
  value,
  onValueChange,
  placeholder,
  children,
  className,
}) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const selectRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const items = React.Children.toArray(children).filter(
    React.isValidElement
  ) as React.ReactElement[]
  const selectedItem = items.find((item) => item.props.value === value)

  return (
    <div ref={selectRef} className={cn('relative w-full', className)}>
      <SelectTrigger onClick={() => setIsOpen(!isOpen)}>
        <span className='block truncate'>
          {selectedItem ? selectedItem.props.children : placeholder}
        </span>
      </SelectTrigger>

      {isOpen && (
        <div className='absolute top-full z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md'>
          <div className='max-h-60 overflow-auto p-1'>
            {items.map((item) => (
              <SelectItem
                key={item.props.value}
                value={item.props.value}
                onClick={(selectedValue) => {
                  onValueChange?.(selectedValue)
                  setIsOpen(false)
                }}
              >
                {item.props.children}
              </SelectItem>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export interface SelectValueProps {
  placeholder?: string
}

export const SelectValue: React.FC<SelectValueProps> = ({ placeholder }) => {
  return <>{placeholder}</>
}

export interface SelectContentProps {
  children: React.ReactNode
}

export const SelectContent: React.FC<SelectContentProps> = ({ children }) => {
  return (
    <div className='absolute top-full z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md'>
      <div className='max-h-60 overflow-auto p-1'>{children}</div>
    </div>
  )
}
