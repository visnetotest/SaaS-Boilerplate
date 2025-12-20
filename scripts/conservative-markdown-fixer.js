#!/usr/bin/env node

/**
 * Conservative Markdown Fixer Script
 * Fixes only the most common and safe markdown formatting issues
 */

import fs from 'fs'
import path from 'path'

class ConservativeMarkdownFixer {
  constructor(filePath) {
    this.filePath = filePath
    this.content = ''
    this.fixedIssues = []
  }

  read() {
    try {
      this.content = fs.readFileSync(this.filePath, 'utf8')
      return true
    } catch (error) {
      console.error(`Error reading file ${this.filePath}:`, error.message)
      return false
    }
  }

  write() {
    try {
      fs.writeFileSync(this.filePath, this.content, 'utf8')
      return true
    } catch (error) {
      console.error(`Error writing file ${this.filePath}:`, error.message)
      return false
    }
  }

  // Fix trailing whitespace only
  fixTrailingWhitespace() {
    const originalContent = this.content
    this.content = this.content.replace(/[ \t]+$/gm, '')

    if (originalContent !== this.content) {
      this.fixedIssues.push('Removed trailing whitespace')
    }
  }

  // Fix multiple consecutive blank lines (limit to 2)
  fixMultipleBlankLines() {
    const originalContent = this.content
    this.content = this.content.replace(/\n{3,}/g, '\n\n')

    if (originalContent !== this.content) {
      this.fixedIssues.push('Reduced multiple consecutive blank lines to maximum 2')
    }
  }

  // Fix line endings
  fixLineEndings() {
    const originalContent = this.content
    this.content = this.content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    if (originalContent !== this.content) {
      this.fixedIssues.push('Standardized line endings to LF')
    }
  }

  // Ensure file ends with single newline
  fixFileEnding() {
    const originalContent = this.content
    this.content = this.content.replace(/\s+$/, '') + '\n'

    if (originalContent !== this.content) {
      this.fixedIssues.push('Ensured file ends with single newline')
    }
  }

  // Fix obvious broken header spacing (only add space after #)
  fixHeaderSpacing() {
    const originalContent = this.content
    this.content = this.content.replace(/^(\#{1,6})([^\s#])/gm, '$1 $2')

    if (originalContent !== this.content) {
      this.fixedIssues.push('Fixed header spacing')
    }
  }

  // Fix broken lines that are single words (conservative)
  fixObviousBrokenLines() {
    const originalContent = this.content
    const lines = this.content.split('\n')
    const fixedLines = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmedLine = line.trim()

      // Only fix very obvious broken lines (single words not starting with # or -)
      if (
        trimmedLine.length > 0 &&
        trimmedLine.length <= 3 &&
        !trimmedLine.match(/^#/) &&
        !trimmedLine.match(/^[-*+]\s/) &&
        !trimmedLine.match(/^\d+\.\s/) &&
        i > 0 &&
        lines[i - 1].trim().length > 0
      ) {
        // Check if previous line doesn't end with sentence terminators
        const prevLine = lines[i - 1].trim()
        if (
          !prevLine.endsWith('.') &&
          !prevLine.endsWith(':') &&
          !prevLine.endsWith('?') &&
          !prevLine.endsWith('!')
        ) {
          const previousLine = fixedLines.pop()
          fixedLines.push(previousLine + ' ' + trimmedLine)
          this.fixedIssues.push(`Fixed obvious broken line: "${trimmedLine}"`)
          continue
        }
      }

      fixedLines.push(line)
    }

    this.content = fixedLines.join('\n')

    if (originalContent !== this.content) {
      this.fixedIssues.push('Fixed obvious broken lines')
    }
  }

  // Run conservative fixes only
  fixAll() {
    if (!this.read()) {
      return false
    }

    const originalContent = this.content

    // Run only conservative fixes
    this.fixLineEndings()
    this.fixTrailingWhitespace()
    this.fixObviousBrokenLines()
    this.fixMultipleBlankLines()
    this.fixHeaderSpacing()
    this.fixFileEnding()

    // Only write if changes were made
    if (originalContent !== this.content) {
      if (this.write()) {
        return true
      }
    }

    return false
  }

  getFixedIssues() {
    return this.fixedIssues
  }
}

function main() {
  const filePath = process.argv[2]

  if (!filePath) {
    console.error('Usage: node conservative-markdown-fixer.js <markdown-file-path>')
    process.exit(1)
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  const fixer = new ConservativeMarkdownFixer(filePath)

  console.log(`Fixing markdown file: ${filePath}`)
  console.log('----------------------------------------')

  if (fixer.fixAll()) {
    const issues = fixer.getFixedIssues()
    if (issues.length > 0) {
      console.log('✅ Fixed issues:')
      issues.forEach((issue) => console.log(`  • ${issue}`))
    } else {
      console.log('✅ File was already properly formatted')
    }
  } else {
    console.log('❌ No changes needed or an error occurred')
    process.exit(1)
  }

  console.log('----------------------------------------')
  console.log('Markdown fixing complete!')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export default ConservativeMarkdownFixer
