#!/bin/bash

# Validate Docker build fixes script
echo "🔍 Validating Docker build fixes..."

echo -e "\n1. Checking React types compatibility..."
if grep -q "@types/react.*^18" package.json; then
    echo "✅ Root package.json has React 18 types"
else
    echo "❌ Root package.json has incorrect React types"
fi

if grep -q "@types/react.*^18" frontend/package.json; then
    echo "✅ Frontend package.json has React 18 types"
else
    echo "❌ Frontend package.json has incorrect React types"
fi

echo -e "\n2. Checking Firebase packages..."
if grep -q "firebase.*12.6.0" package.json; then
    echo "✅ Firebase 12.6.0 found in package.json"
else
    echo "❌ Firebase package not found"
fi

if [ -d "src/dataconnect-generated" ]; then
    echo "✅ Firebase dataconnect-generated directory exists"
else
    echo "❌ Firebase dataconnect-generated directory missing"
fi

echo -e "\n3. Checking package-lock.json files..."
if [ -f "package-lock.json" ]; then
    echo "✅ Root package-lock.json exists"
    if grep -q "firebase.*12.6.0" package-lock.json; then
        echo "✅ Firebase found in lock file"
    else
        echo "⚠️  Firebase might not be in lock file (check manually)"
    fi
else
    echo "❌ Root package-lock.json missing"
fi

if [ -f "frontend/package-lock.json" ]; then
    echo "✅ Frontend package-lock.json exists"
else
    echo "❌ Frontend package-lock.json missing"
fi

echo -e "\n4. Checking Dockerfile.production..."
if grep -q "npm ci.*omit=dev.*||.*npm install" Dockerfile.production; then
    echo "✅ Dockerfile.production has fallback for npm ci"
else
    echo "❌ Dockerfile.production missing npm ci fallback"
fi

echo -e "\n5. Checking .dockerignore..."
if [ -f ".dockerignore" ]; then
    echo "✅ .dockerignore exists"
else
    echo "⚠️  .dockerignore missing (recommended for Docker builds)"
fi

echo -e "\n🎯 To test the Docker build locally:"
echo "  1. Start Docker daemon"
echo "  2. Run: docker build -f Dockerfile.production -t workshopsai-cms ."
echo "  3. Run: docker run -p 3010:3010 workshopsai-cms"

echo -e "\n🔧 If build still fails, try:"
echo "  1. rm package-lock.json && npm install  # Regenerate lock file"
echo "  2. npm audit fix                    # Fix dependency conflicts"
echo "  3. docker system prune -a            # Clean Docker cache"