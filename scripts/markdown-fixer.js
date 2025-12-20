#!/usr/bin/env node

/**
 * Markdown Auto-Fixer Script
 * Automatically fixes common markdown formatting issues in documentation files
 */

import fs from 'fs'
import path from 'path'

class MarkdownAutoFixer {
  constructor(filePath) {
    this.filePath = filePath
    this.content = ''
    this.fixedIssues = []
  }

  // Read the markdown file
  read() {
    try {
      this.content = fs.readFileSync(this.filePath, 'utf8')
      return true
    } catch (error) {
      console.error(`Error reading file ${this.filePath}:`, error.message)
      return false
    }
  }

  // Write the fixed content back to the file
  write() {
    try {
      fs.writeFileSync(this.filePath, this.content, 'utf8')
      return true
    } catch (error) {
      console.error(`Error writing file ${this.filePath}:`, error.message)
      return false
    }
  }

  // Fix trailing whitespace on each line
  fixTrailingWhitespace() {
    const originalContent = this.content
    this.content = this.content.replace(/[ \t]+$/gm, '')

    if (originalContent !== this.content) {
      this.fixedIssues.push('Removed trailing whitespace')
    }
  }

  // Fix multiple consecutive blank lines
  fixMultipleBlankLines() {
    const originalContent = this.content
    // Allow maximum 2 consecutive blank lines
    this.content = this.content.replace(/\n{3,}/g, '\n\n')

    if (originalContent !== this.content) {
      this.fixedIssues.push('Reduced multiple consecutive blank lines to maximum 2')
    }
  }

  // Fix lines ending with spaces followed by newlines (line breaks)
  fixLineBreaks() {
    const originalContent = this.content
    // Remove spaces before newlines (soft line breaks)
    this.content = this.content.replace(/ +\n/g, '\n')

    if (originalContent !== this.content) {
      this.fixedIssues.push('Fixed line breaks')
    }
  }

  // Fix headers (ensure proper spacing around headers)
  fixHeaders() {
    const originalContent = this.content
    const lines = this.content.split('\n')
    const fixedLines = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmedLine = line.trim()

      // Check if it's a header line
      if (trimmedLine.startsWith('#')) {
        // Ensure there's a space after the #
        let fixedLine = line.replace(/^(\#{1,6})([^\s])/, '$1 $2')

        // Ensure previous line is blank if it's not a header
        if (i > 0 && !lines[i - 1].trim().startsWith('#') && lines[i - 1].trim() !== '') {
          fixedLines.push('')
        }

        fixedLines.push(fixedLine)

        // Ensure next line is blank if it exists and is not a header
        if (
          i < lines.length - 1 &&
          !lines[i + 1].trim().startsWith('#') &&
          lines[i + 1].trim() !== ''
        ) {
          fixedLines.push('')
        }
      } else {
        fixedLines.push(line)
      }
    }

    this.content = fixedLines.join('\n')

    if (originalContent !== this.content) {
      this.fixedIssues.push('Fixed header formatting and spacing')
    }
  }

  // Fix list formatting
  fixLists() {
    const originalContent = this.content
    const lines = this.content.split('\n')
    const fixedLines = []

    let inList = false

    for (const line of lines) {
      const trimmedLine = line.trim()

      // Check if it's a list item
      if (trimmedLine.match(/^[-*+]\s+/) || trimmedLine.match(/^\d+\.\s+/)) {
        // Fix spacing after list marker
        let fixedLine = line.replace(/^([-*+]|\d+\.)\s*/, '$1 ')

        // If we're not in a list and the previous line isn't blank, add a blank line
        if (!inList && fixedLines.length > 0 && fixedLines[fixedLines.length - 1].trim() !== '') {
          fixedLines.push('')
        }

        fixedLines.push(fixedLine)
        inList = true
      } else if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        // Blank line or header ends the list context
        fixedLines.push(line)
        if (trimmedLine !== '') inList = false
      } else {
        // Regular line
        fixedLines.push(line)
        if (!trimmedLine.startsWith(' ') && !trimmedLine.startsWith('\t')) {
          inList = false
        }
      }
    }

    this.content = fixedLines.join('\n')

    if (originalContent !== this.content) {
      this.fixedIssues.push('Fixed list formatting')
    }
  }

  // Fix code block formatting
  fixCodeBlocks() {
    const originalContent = this.content
    const lines = this.content.split('\n')
    const fixedLines = []
    let inCodeBlock = false

    for (const line of lines) {
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock
        fixedLines.push(line)
      } else if (inCodeBlock) {
        // Preserve code block content exactly as-is
        fixedLines.push(line)
      } else {
        fixedLines.push(line)
      }
    }

    this.content = fixedLines.join('\n')

    if (originalContent !== this.content) {
      this.fixedIssues.push('Preserved code block formatting')
    }
  }

  // Fix table formatting
  fixTables() {
    const originalContent = this.content
    const lines = this.content.split('\n')
    const fixedLines = []
    let inTable = false

    for (const line of lines) {
      const trimmedLine = line.trim()

      // Check if it's a table row or separator
      if (trimmedLine.includes('|')) {
        // If this is the start of a table, ensure previous line is blank
        if (!inTable && fixedLines.length > 0 && fixedLines[fixedLines.length - 1].trim() !== '') {
          fixedLines.push('')
        }

        fixedLines.push(line)
        inTable = true
      } else if (trimmedLine === '') {
        // Blank line ends the table
        fixedLines.push(line)
        inTable = false
      } else {
        // Regular line
        fixedLines.push(line)
        inTable = false
      }
    }

    this.content = fixedLines.join('\n')

    if (originalContent !== this.content) {
      this.fixedIssues.push('Fixed table spacing')
    }
  }

  // Fix inconsistent line endings (convert to \n)
  fixLineEndings() {
    const originalContent = this.content
    this.content = this.content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    if (originalContent !== this.content) {
      this.fixedIssues.push('Standardized line endings to LF')
    }
  }

  // Ensure file ends with a single newline
  fixFileEnding() {
    const originalContent = this.content
    // Remove trailing whitespace and ensure single newline at end
    this.content = this.content.replace(/\s+$/, '') + '\n'

    if (originalContent !== this.content) {
      this.fixedIssues.push('Ensured file ends with single newline')
    }
  }

  // Fix broken lines and incomplete sentences (basic fix for the file)
  fixBrokenLines() {
    const originalContent = this.content
    const lines = this.content.split('\n')
    const fixedLines = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmedLine = line.trim()

      // Fix specific issues found in the file
      if (trimmedLine === 'Re' && i > 0 && lines[i - 1].trim() === '## Executive Summary') {
        // Remove the standalone "Re" line
        this.fixedIssues.push('Removed broken line: "Re"')
        continue
      }

      // Fix lines that look like incomplete sentences at the beginning
      if (
        trimmedLine.length > 0 &&
        !trimmedLine.match(/^#/) &&
        !trimmedLine.match(/^[-*+]\s/) &&
        !trimmedLine.match(/^\d+\.\s/) &&
        !trimmedLine.includes('|') &&
        !trimmedLine.startsWith('```') &&
        !trimmedLine.match(/^<[^>]+>$/)
      ) {
        // Check if this might be a continuation of a previous line
        if (
          i > 0 &&
          lines[i - 1].trim().length > 0 &&
          !lines[i - 1].trim().endsWith('.') &&
          !lines[i - 1].trim().endsWith(':') &&
          !lines[i - 1].trim().endsWith('#') &&
          !lines[i - 1].trim().startsWith('#') &&
          !lines[i - 1].trim().startsWith('```')
        ) {
          // This might be a broken sentence, join with previous line
          const previousLine = fixedLines.pop()
          fixedLines.push(previousLine + ' ' + trimmedLine)
          this.fixedIssues.push('Fixed broken sentence line')
          continue
        }
      }

      fixedLines.push(line)
    }

    this.content = fixedLines.join('\n')

    if (originalContent !== this.content) {
      this.fixedIssues.push('Fixed broken lines and incomplete sentences')
    }
  }

  // Run all fixes
  fixAll() {
    if (!this.read()) {
      return false
    }

    const originalContent = this.content

    // Run all fix methods in order
    this.fixLineEndings()
    this.fixTrailingWhitespace()
    this.fixLineBreaks()
    this.fixBrokenLines()
    this.fixMultipleBlankLines()
    this.fixHeaders()
    this.fixLists()
    this.fixCodeBlocks()
    this.fixTables()
    this.fixFileEnding()

    // Only write if changes were made
    if (originalContent !== this.content) {
      if (this.write()) {
        return true
      }
    }

    return false
  }

  // Get the list of fixed issues
  getFixedIssues() {
    return this.fixedIssues
  }
}

// Main execution
function main() {
  const filePath = process.argv[2]

  if (!filePath) {
    console.error('Usage: node markdown-fixer.js <markdown-file-path>')
    process.exit(1)
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  const fixer = new MarkdownAutoFixer(filePath)

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

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export default MarkdownAutoFixer
