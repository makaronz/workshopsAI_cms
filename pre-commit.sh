#!/bin/bash

echo "🚀 Running pre-commit checks..."

# Run TypeScript type checking
echo "📝 Running TypeScript type check..."
if ! npm run typecheck; then
    echo "❌ TypeScript type check failed!"
    exit 1
fi
echo "✅ TypeScript type check passed"

# Run ESLint
echo "🔧 Running ESLint..."
if ! npm run lint; then
    echo "❌ ESLint check failed!"
    echo "Fix linting issues with: npm run lint:fix"
    exit 1
fi
echo "✅ ESLint check passed"

# Run tests
echo "🧪 Running tests..."
if ! npm run test; then
    echo "❌ Tests failed!"
    exit 1
fi
echo "✅ All tests passed"

# Check for security vulnerabilities
echo "🔒 Running security audit..."
if ! npm audit --audit-level=moderate; then
    echo "⚠️  Security issues found. Run 'npm audit fix' to address them."
fi

echo "✅ All pre-commit checks completed successfully!"
exit 0