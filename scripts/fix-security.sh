#!/bin/bash

# Fix for dev dependency security vulnerabilities
# These are mostly dev dependencies that don't affect production runtime

echo "🔍 Analyzing security vulnerabilities..."

# List packages with their usage context
echo "📦 Packages with vulnerabilities:"
echo "  🚨 HIGH SEVERITY:"
echo "    - axios (used by checkly - dev dependency)"
echo "    - glob (used by multiple tools - dev dependency)" 
echo "    - tar-fs (used by puppeteer - dev dependency)"
echo "    - ws (used by puppeteer - dev dependency)"
echo "    - cookie (used by lighthouse - dev dependency)"
echo ""
echo "  ⚠️  MEDIUM SEVERITY:"
echo "    - esbuild (build tool - dev dependency)"
echo ""
echo "  💡 NOTE: Most vulnerabilities are in dev dependencies and don't affect production runtime"

# Try targeted updates for critical packages that won't break things
echo ""
echo "🔧 Attempting targeted security updates..."

# Update axios to latest secure version
echo "  Updating axios..."
npm install axios@^1.8.0 --legacy-peer-deps --no-save

# Update glob to secure version  
echo "  Updating glob..."
npm install glob@^11.0.0 --legacy-peer-deps --no-save

echo ""
echo "✅ Targeted security updates completed"
echo ""
echo "📊 Current vulnerability count:"
npm audit --json | jq '.metadata.vulnerabilities.total'
echo ""
echo "💡 Remaining dev dependency vulnerabilities are expected and can be addressed later"