#!/usr/bin/env node

/**
 * ESM Import Validator
 * Validates that all relative imports in dist/*.js files have .js extensions
 * This prevents ERR_MODULE_NOT_FOUND errors in production
 */

import { readdir, readFile, stat, access } from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// Regex to match relative imports without .js extension
const RELATIVE_IMPORT_REGEX = /import\s+.*\s+from\s+['"](\.(?!.*\.js$)[^'"]*)['"]/g;
const DYNAMIC_IMPORT_REGEX = /import\s*\(\s*['"](\.(?!.*\.js$)[^'"]*)['"]\s*\)/g;

async function validateFile(filePath) {
  const content = await readFile(filePath, 'utf8');
  const errors = [];
  
  // Check static imports
  let match;
  while ((match = RELATIVE_IMPORT_REGEX.exec(content)) !== null) {
    errors.push({
      file: path.relative(ROOT_DIR, filePath),
      line: content.substring(0, match.index).split('\n').length,
      import: match[1],
      type: 'static import'
    });
  }
  
  // Check dynamic imports
  while ((match = DYNAMIC_IMPORT_REGEX.exec(content)) !== null) {
    errors.push({
      file: path.relative(ROOT_DIR, filePath),
      line: content.substring(0, match.index).split('\n').length,
      import: match[1],
      type: 'dynamic import'
    });
  }
  
  return errors;
}

async function findJsFiles(dir, files = []) {
  const entries = await readdir(dir);
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stats = await stat(fullPath);
    
    if (stats.isDirectory()) {
      await findJsFiles(fullPath, files);
    } else if (entry.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

async function validateDistStructure() {
  console.log('🔍 Validating ESM imports in dist/ directory...\n');
  
  const errors = [];
  
  try {
    // Check if dist directory exists
    await access(DIST_DIR);
    
    // Find all .js files in dist
    const jsFiles = await findJsFiles(DIST_DIR);
    
    if (jsFiles.length === 0) {
      console.error('❌ No .js files found in dist/ directory');
      console.error('   Run npm run build first');
      process.exit(1);
    }
    
    console.log(`📄 Found ${jsFiles.length} JavaScript files to validate`);
    
    // Validate each file
    for (const file of jsFiles) {
      const fileErrors = await validateFile(file);
      errors.push(...fileErrors);
    }
    
    if (errors.length === 0) {
      console.log('✅ All imports have correct .js extensions\n');
      console.log('🚀 The build is ready for deployment!');
      process.exit(0);
    } else {
      console.error(`❌ Found ${errors.length} import errors:\n`);
      
      for (const error of errors) {
        console.error(`   📂 ${error.file}:${error.line}`);
        console.error(`      ${error.type}: "${error.import}"`);
        console.error(`      💡 Must be: "${error.import}.js"`);
        console.error('');
      }
      
      console.error('🔧 To fix these errors:');
      console.error('   1. Check TypeScript source files in src/');
      console.error('   2. Ensure all relative imports end with .js');
      console.error('   3. Rerun npm run build');
      console.error('   4. Run this validation again');
      
      process.exit(1);
    }
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('❌ dist/ directory does not exist');
      console.error('   Run: npm run build');
    } else {
      console.error('❌ Validation error:', error.message);
    }
    process.exit(1);
  }
}

// Run validation
validateDistStructure().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
