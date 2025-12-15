# How to Use This AI-Assisted Development Template

## 🎯 Quick Start

### Option A: New Project (5 minutes)

```bash
# Clone this template
git clone <this-repo-url> my-new-project
cd my-new-project

# Remove git history and start fresh
rm -rf .git
git init
git add .
git commit -m "Initial commit from AI-assisted template"
```

### Option B: Integrate into Existing Project (10 minutes)

**This is the recommended approach for testing the template with a real project!**

```bash
# From your existing project directory
cd my-existing-project

# Copy the template structure
# Option 1: Manual copy
mkdir -p .github/instructions memory-bank
cp /path/to/template/.github/instructions/copilot-instructions.md .github/instructions/
cp -r /path/to/template/memory-bank/* memory-bank/

# Option 2: Download specific files
curl -O <raw-github-url>/copilot-instructions.md
# ... etc

# Commit the new structure
git add .github/instructions memory-bank
git commit -m "Add AI-assisted development structure (Memory Bank)"
```

**What to copy for existing projects:**
- ✅ `.github/instructions/copilot-instructions.md` (MUST HAVE)
- ✅ `memory-bank/*.md` files (MUST HAVE)
- ⚠️ `scripts/` only if building mobile apps
- ⚠️ `package.json` only if starting fresh (don't overwrite existing!)

## 📝 Customizing for Existing Projects

When integrating into an existing codebase, follow this process:

### 1. Start with Current State Documentation

## 📝 Customizing for Existing Projects

When integrating into an existing codebase, follow this process:

### 1. Start with Current State Documentation

**First priority: Document what already exists**

#### `activeContext.md` - Start Here! ⭐
```markdown
**Current Session Focus**: Integrating Memory Bank into existing project

## Current State Summary

### ✅ Completed (What already exists)
1. **[Feature/Module 1]**: [Brief description of what's built]
2. **[Feature/Module 2]**: [Brief description of what's built]
3. **Tech Stack**: [List what you're already using]

### 🚧 In Progress (What you're currently working on)
1. [Current work item 1]
2. [Current work item 2]

### ❌ Not Started (Backlog/planned features)
1. [Planned feature 1]
2. [Planned feature 2]
```

#### `projectBrief.md` - Capture the Mission
- Why did this project start?
- What problem does it solve?
- What are the non-negotiable requirements?

#### `techContext.md` - Document Actual Stack
- List your ACTUAL dependencies and versions
- Document environment variables you're using
- Note any deployment configuration

### 2. Reverse-Engineer Your Patterns

**Look at your existing code and extract patterns:**

#### `systemPatterns.md` - What patterns are you already using?
- Review 3-5 recent files you've written
- Identify recurring patterns (how you structure components, handle errors, etc.)
- Document what works well
- Note what you want to change/improve

Example prompt for AI:
```
"Review these files [list 3-5 key files] and help me document the patterns 
I'm already using in systemPatterns.md"
```

### 3. Customize Copilot Instructions

#### `.github/instructions/copilot-instructions.md`

Update the placeholder sections with your actual stack:

```markdown
## Critical Technical Components
backend: Python + FastAPI       # <-- Your actual backend
database: PostgreSQL + SQLAlchemy  # <-- Your actual database
frontend: React + TypeScript + Vite  # <-- Your actual frontend
```

Add project-specific context:
```markdown
## Project Overview
**[Your Project Name]** is [what it actually does]

**CURRENT STATUS**: [MVP in production | Active development | Stable]

### Mission
[Your actual project goal]
```

### 4. Test the Integration

**Run this test to validate:**

Open a new Copilot chat and say:
```
"Read memory-bank/activeContext.md and summarize the current state of this project. 
Then read systemPatterns.md and tell me what architectural patterns I should follow."
```

**Expected result**: AI should accurately describe your project and patterns.

**If AI is confused**: Your Memory Bank files need more specifics.

## 🧠 Memory Bank Workflow (All Projects)

### 2. Customize Memory Bank (Required!)

#### `projectBrief.md` ⭐ CRITICAL
- Define your core mission
- List non-negotiable requirements
- Specify success criteria

#### `productContext.md` ⭐ CRITICAL  
- Describe user problems you're solving
- Define your business model
- Identify target users

#### `activeContext.md` ⭐ UPDATE FREQUENTLY
- Set initial implementation state
- Track current progress
- **Update at end of every session!**

#### `systemPatterns.md`
- Define your architectural patterns
- Document coding standards
- Add anti-patterns (what NOT to do)

#### `techContext.md`
- Specify your tech stack and versions
- Document environment variables
- List deployment configuration

#### `decisionLog.md` (Fills over time)
- Add ADRs as you make architectural decisions
- Use provided template

#### `implementationLog.md` (Fills over time)
- Track feature implementation history
- Note what worked/failed

### 3. Customize Copilot Instructions

Edit `.github/instructions/copilot-instructions.md`:

```markdown
## Critical Technical Components
backend: Node.js + Express  # <-- YOUR STACK
database: PostgreSQL        # <-- YOUR DATABASE
frontend: React + Vite      # <-- YOUR FRONTEND
# ... etc
```

Replace ALL placeholder sections marked with:
> **IMPORTANT**: Update this section...

### 4. Start AI-Assisted Development!

Open VS Code with GitHub Copilot and say:

```
"Read memory-bank/activeContext.md and help me set up [your project]. 
Let's start by reviewing the project brief and creating an implementation plan."
```

## 🧠 Memory Bank Workflow

### Every Session START:
```
AI reads: memory-bank/activeContext.md
You say: "What's the current state? What should we work on next?"
```

### During Development:
```
AI cross-references: memory-bank/systemPatterns.md
Before implementing: AI proposes plan → you approve
```

### Every Session END:
```
AI updates: memory-bank/activeContext.md
- What was completed
- What's next
- Any blockers
```

### When Milestone Reached:
```
AI updates: memory-bank/implementationLog.md
- Document what was built
- Note what worked/failed
```

## 📋 Example Workflows

### Adding a New Feature

1. **Start Session**:
   ```
   "Read activeContext.md. I want to add user authentication. 
   Based on systemPatterns.md, what's the best approach?"
   ```

2. **AI Proposes Plan** (waits for approval)

3. **You Approve**: "Looks good, proceed"

4. **AI Implements** (according to plan)

5. **Update Context**:
   ```
   "Update activeContext.md with what we just completed"
   ```

### Making an Architectural Decision

1. **Discuss Options**:
   ```
   "Should we use PostgreSQL or MongoDB for this project? 
   Consider the requirements in projectBrief.md"
   ```

2. **AI Presents Trade-offs**

3. **You Decide**: "Let's go with PostgreSQL"

4. **Document Decision**:
   ```
   "Add an ADR to decisionLog.md documenting why we chose PostgreSQL"
   ```

5. **Update Patterns**:
   ```
   "Update systemPatterns.md with our database patterns"
   ```

### Context Gets Bloated

If chat history is getting too long:

1. **Save State**:
   ```
   "Update activeContext.md with our current state and next steps"
   ```

2. **Start Fresh Chat**

3. **Restore Context**:
   ```
   "Read memory-bank files and summarize where we are"
   ```

## 🛠️ Optional: Mobile Build Scripts

If you're building iOS/Android apps:

```bash
# Increment iOS build number (required for App Store)
npm run increment:ios

# Increment Android versionCode (required for Play Store)
npm run increment:android
```

These scripts automatically update build numbers in your Xcode/Android Studio projects.

## ✅ Checklist: Is Your Template Ready?

- [ ] Cloned template and removed git history
- [ ] Updated `projectBrief.md` with your mission
- [ ] Updated `productContext.md` with user problems
- [ ] Set initial state in `activeContext.md`
- [ ] Defined patterns in `systemPatterns.md`
- [ ] Specified tech stack in `techContext.md`
- [ ] Customized `copilot-instructions.md` placeholders
- [ ] Tested AI assistant reads Memory Bank correctly

## 🎓 Tips for Success

### 1. Be Specific in Memory Bank
❌ Bad: "Build a web app"  
✅ Good: "Build a B2B SaaS project management tool for design agencies with real-time collaboration"

### 2. Update activeContext.md Religiously
This is your source of truth. Update it EVERY session.

### 3. Use ADRs for Big Decisions
Document the "why" not just the "what". Future you will thank you.

### 4. Start New Chats When Needed
Don't let context get bloated. Memory Bank maintains continuity.

### 5. Challenge AI Complexity
If AI suggests over-engineering, say: "That seems too complex. What's a simpler approach?"

## 🤝 Working with a Team

### Solo Developer
- Keep Memory Bank personal and informal
- Update as you think through problems

### Small Team (2-5)
- Treat Memory Bank as shared team context
- Require everyone to read activeContext.md daily
- Review decisionLog.md together

### Larger Team
- Assign Memory Bank maintenance to tech lead
- Create team-specific sections in systemPatterns.md
- Use implementationLog.md for sprint retrospectives

## 📚 Additional Resources

- [Memory Bank Pattern Explanation](./README.md#core-concept-the-memory-bank)
- [Plan & Act Workflow](./README.md#the-plan--act-workflow)
- [Best Practices](./README.md#best-practices)

---

**Ready to build?** Update those Memory Bank files and start your first AI-assisted session! 🚀
