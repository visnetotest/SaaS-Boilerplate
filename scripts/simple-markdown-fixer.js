#!/usr/bin/env node

/**
 * Simple Batch Markdown Fixer
 * Uses conservative fixing for all markdown files in a directory
 */

import fs from 'fs'
import path from 'path'

import ConservativeMarkdownFixer from './conservative-markdown-fixer.js'

function findMarkdownFiles(dir, files = []) {
  try {
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
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message)
  }

  return files
}

function main() {
  const targetDir = process.argv[2] || './docs'

  if (!fs.existsSync(targetDir)) {
    console.error(`Directory not found: ${targetDir}`)
    process.exit(1)
  }

  const markdownFiles = findMarkdownFiles(targetDir)

  if (markdownFiles.length === 0) {
    console.log('No markdown files found.')
    return
  }

  let totalFixed = 0
  let totalIssues = []

  for (const file of markdownFiles) {
    const fixer = new ConservativeMarkdownFixer(file)

    if (fixer.fixAll()) {
      const issues = fixer.getFixedIssues()
      if (issues.length > 0) {
        console.log(`✅ ${path.basename(file)}: Fixed ${issues.length} issues`)
        totalIssues.push(...issues)
        totalFixed++
      }
    } else {
      console.log(`✅ ${path.basename(file)}: Already formatted`)
    }
  }

  console.log(`\nSummary: Fixed ${totalFixed} files with ${totalIssues.length} total issues`)
}

main()
