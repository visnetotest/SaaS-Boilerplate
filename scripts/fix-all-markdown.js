#!/usr/bin/env node

/**
 * Batch Markdown Fixer Script
 * Automatically fixes markdown formatting issues in all files in a directory
 */

import fs from 'fs'
import path from 'path'

import MarkdownAutoFixer from './markdown-fixer.js'

function findMarkdownFiles(dir, files = []) {
  const items = fs.readdirSync(dir)

  for (const item of items) {
    const fullPath = path.join(dir, item)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      findMarkdownFiles(fullPath, files)
    } else if (item.endsWith('.md')) {
      files.push(fullPath)
    }
  }

  return files
}

function main() {
  const targetDir = process.argv[2] || './docs'

  if (!fs.existsSync(targetDir)) {
    console.error(`Directory not found: ${targetDir}`)
    process.exit(1)
  }

  console.log(`Finding markdown files in: ${targetDir}`)
  console.log('========================================')

  const markdownFiles = findMarkdownFiles(targetDir)

  if (markdownFiles.length === 0) {
    console.log('No markdown files found.')
    return
  }

  console.log(`Found ${markdownFiles.length} markdown files:`)
  markdownFiles.forEach((file) => console.log(`  • ${file}`))
  console.log('========================================')
  console.log('Fixing all markdown files...\n')

  let totalFixed = 0
  let totalIssues = []

  for (const file of markdownFiles) {
    console.log(`Processing: ${path.basename(file)}`)
    const fixer = new MarkdownAutoFixer(file)

    if (fixer.fixAll()) {
      const issues = fixer.getFixedIssues()
      if (issues.length > 0) {
        console.log(`  ✅ Fixed ${issues.length} issues:`)
        issues.forEach((issue) => console.log(`    • ${issue}`))
        totalIssues.push(...issues)
        totalFixed++
      } else {
        console.log(`  ✅ Already properly formatted`)
      }
    } else {
      console.log(`  ❌ Error processing file`)
    }
    console.log('')
  }

  console.log('========================================')
  console.log(`Batch Fix Summary:`)
  console.log(`• Total files processed: ${markdownFiles.length}`)
  console.log(`• Files fixed: ${totalFixed}`)
  console.log(`• Total issues resolved: ${totalIssues.length}`)

  if (totalIssues.length > 0) {
    console.log('\nIssues Summary:')
    const issueCounts = {}
    totalIssues.forEach((issue) => {
      issueCounts[issue] = (issueCounts[issue] || 0) + 1
    })

    Object.entries(issueCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([issue, count]) => {
        console.log(`  • ${issue}: ${count} times`)
      })
  }

  console.log('\n✅ All markdown files have been processed!')
}

main()
