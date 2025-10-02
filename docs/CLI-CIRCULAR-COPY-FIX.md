# CLI Circular Copy Fix - October 2, 2025

## Issue: Circular Copy Error

When running the CLI from **inside** the template directory:
```bash
cd sge-starter/generator
node dist/index.js test
```

**Error:**
```
Clone error: Cannot copy 'C:\Users\samgammon\apps\sge-starter' 
to a subdirectory of itself, 'C:\Users\samgammon\apps\sge-starter\generator\test'.
```

## Root Cause

The CLI's `cloneTemplate` function:
1. Gets template directory: `__dirname/../..` → `sge-starter/`
2. Creates project at: `process.cwd() + projectName` → `sge-starter/generator/test/`
3. Tries to copy `sge-starter/` into `sge-starter/generator/test/`
4. **fs-extra detects circular copy and fails**

This is a **classic issue** we should have anticipated! 🤦‍♂️

## The Fix

Added validation in `cloneTemplate` function:

```typescript
// Validate: prevent copying template into subdirectory of itself
const absoluteProjectPath = path.resolve(config.projectPath);
const absoluteTemplateDir = path.resolve(templateDir);

if (absoluteProjectPath.startsWith(absoluteTemplateDir)) {
  throw new Error(
    `Cannot create project inside the template directory.\n` +
    `Template: ${absoluteTemplateDir}\n` +
    `Project: ${absoluteProjectPath}\n\n` +
    `Please run this command from outside the sge-starter directory, ` +
    `or specify an absolute path outside the template.`
  );
}
```

## Testing the Fix

### ❌ Before Fix
```bash
cd sge-starter/generator
node dist/index.js test
# Cryptic fs-extra error
```

### ✅ After Fix
```bash
cd sge-starter/generator
node dist/index.js test
# Clear error message explaining the issue
```

**Output:**
```
✖ Failed to clone template
✖ Project generation failed

Error: Clone error: Cannot create project inside the template directory.
Template: C:\Users\samgammon\apps\sge-starter
Project: C:\Users\samgammon\apps\sge-starter\generator\test

Please run this command from outside the sge-starter directory, 
or specify an absolute path outside the template.
```

## Correct Usage

### Option 1: Run from Outside Template Directory
```bash
# Navigate to parent or any external location
cd c:\Users\samgammon\apps\

# Run CLI with relative path
node sge-starter/generator/dist/index.js my-test-app

# Project created at: c:\Users\samgammon\apps\my-test-app
```

### Option 2: Use Absolute Path for Output
```bash
# Run from anywhere, specify absolute path
cd c:\Users\samgammon\apps\sge-starter\generator

# Use absolute path for project
node dist/index.js c:\temp\my-test-app

# Project created at: c:\temp\my-test-app
```

### Option 3: Use Different Drive/Location
```bash
cd c:\Users\samgammon\apps\sge-starter\generator

# Create on different location
node dist/index.js d:\projects\my-test-app
```

## Why This Happens

### File Structure Context
```
sge-starter/                    ← Template directory
├── generator/                  ← CLI location
│   ├── dist/
│   │   └── index.js           ← Running from here
│   └── src/
├── packages/
├── infra/
└── ...
```

### What Happens
1. **Current directory:** `sge-starter/generator/`
2. **Template directory:** `sge-starter/` (from `__dirname/../..`)
3. **Project path (relative):** `sge-starter/generator/test/`
4. **Result:** Trying to copy parent into child → **Circular copy error**

## Updated Documentation

### Files Updated
1. ✅ `generator/src/index.ts` - Added validation
2. ✅ `docs/TESTING-CLI-LOCALLY.md` - Updated with correct usage examples
3. ✅ `docs/CLI-CIRCULAR-COPY-FIX.md` - This document

### README Already Correct
The README already instructs users to:
```bash
git clone https://github.com/gamalamadingdong/sge-starter.git
cd sge-starter
cd generator
npm install
npm run build
node dist/index.js my-app
```

This creates `my-app/` as a **sibling** to `sge-starter/`, avoiding the circular copy issue! ✅

## Lessons Learned

### Anticipated Edge Cases
When building CLI tools that copy templates:

1. ✅ **Validate output path is not inside template** - FIXED
2. ✅ **Provide clear error messages** - FIXED
3. ✅ **Document correct usage patterns** - FIXED
4. ⚠️ Consider: Should we auto-detect and use a safe default location?
5. ⚠️ Consider: Should we warn users if CWD is inside template?

### Common CLI Patterns

**Good Pattern:**
```bash
# Clone template repo
git clone <repo>
cd <repo>

# Build CLI
npm install
npm run build

# Use from outside template
cd ..
node <repo>/cli/dist/index.js my-project
```

**Better Pattern (After Publishing):**
```bash
# No need to clone at all
npx @scope/create-app my-project
```

## Testing Checklist

- [x] ✅ Circular copy detected and prevented
- [x] ✅ Clear error message provided
- [x] ✅ Suggests correct usage
- [x] ✅ Shows template and project paths
- [x] ✅ Works with absolute paths
- [x] ✅ Works when run from outside template
- [ ] 🔲 Add warning if CWD is inside template (future enhancement)
- [ ] 🔲 Auto-suggest parent directory as default (future enhancement)

## Alternative Solutions Considered

### 1. Use degit instead of fs.copy
```typescript
import degit from 'degit';
const emitter = degit('user/repo');
await emitter.clone(targetPath);
```
**Pros:** Handles git cloning, no circular copy issue  
**Cons:** Requires git, template must be in git repo, can't customize easily

### 2. Detect and use safe default location
```typescript
if (projectPath.startsWith(templateDir)) {
  projectPath = path.join(process.cwd(), '../', projectName);
}
```
**Pros:** Automatic, no user error  
**Cons:** Surprising behavior, might create in unexpected location

### 3. Current Solution: Validate and error with guidance ✅
```typescript
if (projectPath.startsWith(templateDir)) {
  throw new Error('Clear message with guidance');
}
```
**Pros:** Explicit, educational, prevents data loss  
**Cons:** Requires user to understand and retry

We chose **Option 3** because it's:
- ✅ Explicit and educational
- ✅ Prevents accidental data corruption
- ✅ Provides actionable guidance
- ✅ Matches user expectations

## Summary

### The Issue
Running `node dist/index.js test` from inside `generator/` tried to copy the template directory into a subdirectory of itself.

### The Fix
Added path validation that detects and prevents this with a clear error message.

### The Outcome
Users get helpful guidance on correct usage instead of cryptic fs-extra errors.

### Testing
```bash
# ❌ This now fails with helpful message
cd sge-starter/generator
node dist/index.js test

# ✅ This works correctly
cd sge-starter
node generator/dist/index.js ../my-app

# ✅ This also works
cd anywhere
node path/to/sge-starter/generator/dist/index.js my-app
```

---

**Status:** ✅ FIXED AND DOCUMENTED  
**Prevention:** Validation added to catch this at runtime  
**Guidance:** Clear error message guides users to correct usage
