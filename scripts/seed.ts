#!/usr/bin/env node

import { Command } from 'commander'

import { clearDatabase, getSeedStatus, seedDatabase } from '@/libs/DatabaseSeeder'

const program = new Command()

program.name('seed').description('Database seeding CLI').version('1.0.0')

program
  .command('all')
  .description('Seed all data (tenants, organizations, users, roles, plugins)')
  .action(async () => {
    try {
      console.log('🌱 Starting complete database seeding...')
      await seedDatabase()
      console.log('✅ Seeding completed successfully!')
    } catch (error) {
      console.error('❌ Seeding failed:', error)
      process.exit(1)
    }
  })

program
  .command('clear')
  .description('Clear all seeded data')
  .action(async () => {
    try {
      console.log('🧹 Clearing seeded data...')
      await clearDatabase()
      console.log('✅ Data cleared successfully!')
    } catch (error) {
      console.error('❌ Clear failed:', error)
      process.exit(1)
    }
  })

program
  .command('status')
  .description('Show seeding status')
  .action(async () => {
    try {
      const status = await getSeedStatus()
      console.log('📊 Database Seeding Status:')
      console.log(`  Tenants: ${status.tenantsCount}`)
      console.log(`  Organizations: ${status.organizationsCount}`)
      console.log(`  Users: ${status.usersCount}`)
      console.log(`  Roles: ${status.rolesCount}`)
      console.log(`  Plugins: ${status.pluginsCount}`)
    } catch (error) {
      console.error('❌ Failed to get status:', error)
      process.exit(1)
    }
  })

program
  .command('tenants')
  .description('Seed only tenants')
  .action(async () => {
    try {
      const { databaseSeeder } = await import('@/libs/DatabaseSeeder')
      console.log('🏢 Seeding tenants...')
      await databaseSeeder.seedTenants()
      console.log('✅ Tenants seeded successfully!')
    } catch (error) {
      console.error('❌ Tenant seeding failed:', error)
      process.exit(1)
    }
  })

program
  .command('organizations')
  .description('Seed only organizations')
  .action(async () => {
    try {
      const { databaseSeeder } = await import('@/libs/DatabaseSeeder')
      console.log('🏢 Seeding organizations...')
      await databaseSeeder.seedOrganizations()
      console.log('✅ Organizations seeded successfully!')
    } catch (error) {
      console.error('❌ Organization seeding failed:', error)
      process.exit(1)
    }
  })

program
  .command('users')
  .description('Seed only users')
  .action(async () => {
    try {
      const { databaseSeeder } = await import('@/libs/DatabaseSeeder')
      console.log('👤 Seeding users...')
      await databaseSeeder.seedUsers()
      console.log('✅ Users seeded successfully!')
    } catch (error) {
      console.error('❌ User seeding failed:', error)
      process.exit(1)
    }
  })

program
  .command('roles')
  .description('Seed only roles')
  .action(async () => {
    try {
      const { databaseSeeder } = await import('@/libs/DatabaseSeeder')
      console.log('👥 Seeding roles...')
      await databaseSeeder.seedRoles()
      console.log('✅ Roles seeded successfully!')
    } catch (error) {
      console.error('❌ Role seeding failed:', error)
      process.exit(1)
    }
  })

program
  .command('plugins')
  .description('Seed only plugins')
  .action(async () => {
    try {
      const { databaseSeeder } = await import('@/libs/DatabaseSeeder')
      console.log('🔌 Seeding plugins...')
      await databaseSeeder.seedPlugins()
      console.log('✅ Plugins seeded successfully!')
    } catch (error) {
      console.error('❌ Plugin seeding failed:', error)
      process.exit(1)
    }
  })

program.parse()
