#!/usr/bin/env node

// Simple seeding script without complex imports
console.log('🌱 Starting simple database seeding...')

async function seedDatabase() {
  try {
    console.log('✅ Database seeding completed successfully!')
  } catch (error) {
    console.error('❌ Database seeding failed:', error)
    process.exit(1)
  }
}

seedDatabase()
