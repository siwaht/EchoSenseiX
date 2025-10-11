#!/bin/bash

# Build script for Replit deployment
echo "Building project for deployment..."

# Run the npm build script
npm run build

# Fix the production wrapper after build
echo "Applying post-build fixes..."
node post-build.cjs

echo "Build complete and ready for deployment!"