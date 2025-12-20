# Markdown Auto-Fix Tools

## Usage

### Fix a single markdown file:

```bash
npm run fix:markdown -- path/to/file.md
```

### Fix all markdown files in docs directory:

```bash
npm run fix:markdown:all
```

### Fix all markdown files in specific directory:

```bash
npm run fix:markdown:all -- path/to/directory
```

## What the tools fix

### Conservative Fixes (Recommended):

- Removes trailing whitespace
- Reduces multiple consecutive blank lines to maximum 2
- Standardizes line endings to LF
- Ensures file ends with single newline
- Fixes obvious broken lines (single words)
- Fixes header spacing (adds space after #)

### Scripts Available:

1. **`conservative-markdown-fixer.js`** - Safe, minimal fixes for single files
2. **`simple-markdown-fixer.js`** - Batch processing with conservative fixes
3. **`fix-duplicate-headers.js`** - Specific fix for duplicate header issues

## Examples

```bash
# Fix the implementation roadmap specifically
npm run fix:markdown -- docs/implementation-roadmap.md

# Fix all documentation
npm run fix:markdown:all -- docs/

# Fix markdown files in a custom location
npm run fix:markdown:all -- ./documentation/
```

The tools are designed to be conservative and safe, only fixing the most obvious formatting issues without changing content structure.
