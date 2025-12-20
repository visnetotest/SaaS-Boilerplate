#!/usr/bin/env node

/**
 * Quick fix for duplicate headers in implementation-roadmap.md
 */

import fs from 'fs'

const filePath =
  '/Volumes/MacMini4-ssd/home/Users/kong/code_nextjs/SaaS-Boilerplate/docs/implementation-roadmap.md'

let content = fs.readFileSync(filePath, 'utf8')

// Fix all duplicate header patterns
const replacements = [
  { from: '# # # ', to: '### ' },
  { from: '# # ', to: '## ' },
  { from: '## # # ', to: '#### ' },
]

replacements.forEach(({ from, to }) => {
  const regex = new RegExp(from.replace(/#/g, '\\#'), 'g')
  content = content.replace(regex, to)
})

fs.writeFileSync(filePath, content, 'utf8')

console.log('✅ Fixed duplicate headers in implementation-roadmap.md')
