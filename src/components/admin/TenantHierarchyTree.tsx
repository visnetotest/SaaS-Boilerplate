'use client'

import {
  Building2,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  MoveUp,
  Plus,
  Settings,
  Trash2,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import * as React from 'react'

import { TenantTree } from '../../services/admin-tenant-hierarchy'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

interface TenantHierarchyTreeProps {
  tenant?: TenantTree
  level?: number
  onTenantSelect?: (tenant: TenantTree) => void
  onTenantCreate?: (parentId: string, data: any) => void
  onTenantMove?: (tenantId: string, newParentId?: string) => void
  onTenantDelete?: (tenantId: string) => void
  canManage?: boolean
}

interface CreateTenantDialogProps {
  parentId?: string
  availableParents: TenantTree[]
  onTenantCreate: (parentId: string | undefined, data: any) => void
  trigger?: React.ReactNode
}

interface MoveTenantDialogProps {
  tenant: TenantTree
  availableParents: TenantTree[]
  onTenantMove: (tenantId: string, newParentId?: string) => void
  trigger?: React.ReactNode
}

export function TenantHierarchyTree({
  tenant,
  level = 0,
  onTenantSelect,
  onTenantCreate,
  onTenantMove,
  onTenantDelete,
  canManage = false,
}: TenantHierarchyTreeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2) // Auto-expand first 2 levels
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showMoveDialog, setShowMoveDialog] = useState(false)

  if (!tenant) {
    return <div className='p-4 text-center text-muted-foreground'>No tenant data available</div>
  }

  const handleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  const handleSelect = () => {
    onTenantSelect?.(tenant)
  }

  return (
    <div className='select-none'>
      <div
        className={`group flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-accent/50 transition-colors ${level > 0 ? 'ml-6' : ''}`}
        style={{ marginLeft: `${level * 24}px` }}
      >
        <Button variant='ghost' size='sm' className='h-6 w-6 p-0' onClick={handleExpand}>
          {tenant.children.length > 0 &&
            (isExpanded ? (
              <ChevronDown className='h-3 w-3' />
            ) : (
              <ChevronRight className='h-3 w-3' />
            ))}
        </Button>

        <div className='flex-1 flex items-center gap-3 cursor-pointer' onClick={handleSelect}>
          <Building2 className='h-4 w-4 text-primary' />
          <div className='flex-1'>
            <div className='flex items-center gap-2'>
              <span className='font-medium'>{tenant.name}</span>
              <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
                {tenant.status}
              </Badge>
              <Badge variant='outline' className='text-xs'>
                Level {tenant.hierarchyLevel}
              </Badge>
            </div>
            <div className='text-sm text-muted-foreground'>{tenant.slug}</div>
          </div>
        </div>

        <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
          {tenant.children.length > 0 && (
            <Badge variant='secondary' className='text-xs'>
              {tenant.children.length} children
            </Badge>
          )}

          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='sm' className='h-6 w-6 p-0'>
                  <MoreHorizontal className='h-3 w-3' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem
                  onClick={() => {
                    setShowCreateDialog(true)
                  }}
                >
                  <Plus className='h-4 w-4 mr-2' />
                  Add Child Tenant
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setShowMoveDialog(true)
                  }}
                >
                  <MoveUp className='h-4 w-4 mr-2' />
                  Move Tenant
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onTenantSelect?.(tenant)}>
                  <Users className='h-4 w-4 mr-2' />
                  Manage Users
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    /* TODO: Open settings */
                  }}
                >
                  <Settings className='h-4 w-4 mr-2' />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className='text-destructive'
                  onClick={() => onTenantDelete?.(tenant.id)}
                >
                  <Trash2 className='h-4 w-4 mr-2' />
                  Delete Tenant
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {isExpanded && tenant.children.length > 0 && (
        <div className='mt-1'>
          {tenant.children.map((child) => (
            <TenantHierarchyTree
              key={child.id}
              tenant={child}
              level={level + 1}
              onTenantSelect={onTenantSelect}
              onTenantCreate={onTenantCreate}
              onTenantMove={onTenantMove}
              onTenantDelete={onTenantDelete}
              canManage={canManage}
            />
          ))}
        </div>
      )}

      {showCreateDialog && (
        <CreateTenantDialog
          parentId={tenant.id}
          availableParents={[]} // Will be passed from parent
          onTenantCreate={(parentId, data) => {
            onTenantCreate?.(parentId || tenant.id, data)
            setShowCreateDialog(false)
          }}
          trigger={null}
        />
      )}

      {showMoveDialog && (
        <MoveTenantDialog
          tenant={tenant}
          availableParents={[]} // Will be passed from parent
          onTenantMove={(tenantId, newParentId) => {
            onTenantMove?.(tenantId, newParentId)
            setShowMoveDialog(false)
          }}
          trigger={null}
        />
      )}
    </div>
  )
}

function CreateTenantDialog({
  parentId,
  availableParents: _availableParents,
  onTenantCreate,
  trigger: _trigger,
}: CreateTenantDialogProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    domain: '',
    parentTenantId: parentId,
    settings: {},
    settingsInheritance: {
      settings: [],
      permissions: [],
      plugins: [],
    },
    metadata: {},
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.slug.trim()) return

    onTenantCreate(parentId, formData)
    setFormData({
      name: '',
      slug: '',
      domain: '',
      parentTenantId: parentId,
      settings: {},
      settingsInheritance: {
        settings: [],
        permissions: [],
        plugins: [],
      },
      metadata: {},
    })
    setOpen(false)
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: prev.slug || generateSlug(name),
    }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* <DialogTrigger asChild>
        {triggerNode}
      </DialogTrigger> */}
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>{parentId ? 'Create Child Tenant' : 'Create Root Tenant'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <Label htmlFor='name'>Tenant Name</Label>
            <Input
              id='name'
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder='Enter tenant name'
              required
            />
          </div>

          <div>
            <Label htmlFor='slug'>Slug</Label>
            <Input
              id='slug'
              value={formData.slug}
              onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
              placeholder='tenant-slug'
              required
            />
          </div>

          <div>
            <Label htmlFor='domain'>Domain (Optional)</Label>
            <Input
              id='domain'
              value={formData.domain}
              onChange={(e) => setFormData((prev) => ({ ...prev, domain: e.target.value }))}
              placeholder='tenant.example.com'
            />
          </div>

          <div className='flex justify-end gap-2'>
            <Button type='button' variant='outline' onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type='submit'>Create Tenant</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MoveTenantDialog({
  tenant,
  availableParents,
  onTenantMove,
  trigger: _trigger,
}: MoveTenantDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedParentId, setSelectedParentId] = useState<string>('')

  const handleMove = () => {
    onTenantMove(tenant.id, selectedParentId || undefined)
    setOpen(false)
    setSelectedParentId('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* <DialogTrigger asChild>
        {triggerNode}
      </DialogTrigger> */}
      <DialogContent className='sm:max-w-[400px]'>
        <DialogHeader>
          <DialogTitle>Move "{tenant.name}"</DialogTitle>
        </DialogHeader>
        <div className='space-y-4'>
          <div>
            <Label htmlFor='parent'>New Parent (Optional)</Label>
            <Select value={selectedParentId} onValueChange={setSelectedParentId}>
              <SelectTrigger>
                <SelectValue placeholder='Select new parent or move to root' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=''>Move to Root Level</SelectItem>
                {availableParents.map((parent) => (
                  <SelectItem key={parent.id} value={parent.id}>
                    {parent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='text-sm text-muted-foreground'>
            Moving this tenant will also move all of its children. The hierarchy path will be
            automatically updated.
          </div>

          <div className='flex justify-end gap-2'>
            <Button type='button' variant='outline' onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMove}>Move Tenant</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { CreateTenantDialog, MoveTenantDialog }
