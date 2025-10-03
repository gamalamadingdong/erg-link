# AI-Assisted Legacy System Discovery Guide

This guide helps AI analyze existing codebases and plan migration to the **SGE Template architecture**.

🎯 **CRITICAL CONTEXT:** The SGE template provides your TARGET architecture:
- **Tech Stack:** React + TypeScript + Vite + Supabase + Capacitor + Tailwind + shadcn/ui
- **Architecture Patterns:** Multi-tenant SaaS, real-time subscriptions, mobile-first responsive design
- **Data Models:** Users, businesses, roles, subscriptions, notifications - see `infra/schema/`
- **Component Library:** Pre-built auth, UI components, mobile compliance - see `packages/`
- **Integration Patterns:** Stripe subscriptions, email notifications, Edge Functions - see `packages/functions/`

## Phase 1: SGE-Focused Codebase Analysis

### Analysis Goal: Map Legacy → SGE Template
Use these prompts to analyze the legacy system **in context of migrating to SGE template**:

**SGE Template Migration Analysis:**
```
Analyze this legacy codebase for migration to SGE Template architecture.

SGE TEMPLATE PROVIDES (your target):
- Frontend: React + TypeScript + Vite + Tailwind + shadcn/ui
- Backend: Supabase (PostgreSQL + Edge Functions + Auth + Realtime)
- Mobile: Capacitor for native iOS/Android apps
- Payments: Stripe subscriptions (see packages/functions/subscriptions/)
- Email: Resend/SendGrid notifications (see packages/functions/notifications/)
- Auth: Complete auth system (see packages/functions/auth/)
- Schema: Multi-tenant with users/businesses/roles (see infra/schema/)

ANALYZE LEGACY SYSTEM FOR SGE MAPPING:
1. **Frontend Migration Path:**
   - Current framework → How to migrate to React + TypeScript?
   - Current styling → How to adopt Tailwind + shadcn/ui components?
   - Current state management → How to use React Query + Supabase?
   - Current routing → How to adopt React Router patterns?

2. **Backend Migration Path:**
   - Current database → How to migrate to Supabase PostgreSQL?
   - Current API → How to use Supabase Edge Functions + RLS?
   - Current auth → How to migrate to Supabase Auth?
   - Current file storage → How to use Supabase Storage?

3. **Business Logic Mapping:**
   - Core entities → How do they map to SGE schema (users/businesses/roles)?
   - Business processes → Which can use SGE functions vs. need custom?
   - User permissions → How to map to SGE role-based access control?
   - Integrations → Which SGE patterns (Stripe, email) can be adopted?

4. **SGE Template Opportunity Assessment:**
   - Which SGE components can replace custom code?
   - What business value comes from SGE's multi-tenant architecture?
   - How can SGE's mobile-first design improve user experience?
   - What new capabilities (subscriptions, notifications) could be added?
```

**Technical Debt Evaluation:**
```
Assess the technical health of this codebase:
1. **Dependency Analysis:**
   - Outdated or deprecated packages
   - Security vulnerabilities in dependencies
   - Licensing compatibility issues
   - Package size and bundle analysis

2. **Code Quality Issues:**
   - Duplication and maintainability concerns
   - Performance bottlenecks and optimization opportunities
   - Security vulnerabilities and best practice violations
   - Error handling and logging patterns
   - Scalability limitations

3. **Migration Complexity Factors:**
   - Custom implementations vs. standard patterns
   - Tightly coupled components requiring refactoring
   - Legacy browser/platform compatibility requirements
   - Complex database schemas or migrations needed
   - Integration complexity with external systems
```

### File Analysis Priorities
Focus AI analysis on these key files (in order of importance):

1. **Configuration Files:** `package.json`, `requirements.txt`, `Gemfile`, etc.
2. **Database Schema:** Migration files, schema definitions, ORM models
3. **Authentication/Authorization:** User models, auth middleware, permission systems
4. **API Routes/Controllers:** REST endpoints, GraphQL schemas, route definitions
5. **Business Logic:** Service layers, domain models, core algorithms
6. **Frontend Components:** Main layouts, key user interface components
7. **Integration Code:** External API clients, webhook handlers, queue processors

## Phase 2: Interactive AI Discovery Session

🎯 **CRITICAL PHASE:** After automated code analysis, engage in detailed AI chat to understand business context, clarify complex functionality, and validate migration approach.

### Why This Phase is Essential
- **Code Analysis Limitations:** Automated analysis can identify structure and patterns but misses business context, edge cases, and domain-specific logic
- **Risk Reduction:** Interactive discovery prevents costly mistakes from misunderstanding critical functionality
- **Strategic Alignment:** Ensures migration strategy aligns with actual business needs and user workflows
- **Knowledge Transfer:** Captures tribal knowledge and business rules that aren't evident in code

### Pre-Session Preparation
Before starting the discovery session, AI should:
1. ✅ Complete initial codebase analysis using Phase 1 framework
2. ✅ Fill out analysis-worksheet.md with technical findings
3. ✅ Prepare specific questions based on code analysis findings
4. ✅ Identify areas needing clarification or seeming overly complex
5. ✅ Draft preliminary migration complexity assessment

### Interactive Session Structure
**Duration:** 30-60 minutes of focused AI conversation
**Goal:** Deep understanding of business logic, user workflows, and migration requirements

### Discovery Questions Framework

#### Business Context & Goals
```
Let's start by understanding your business context and migration goals:

1. **Business Overview:**
   - What type of business/industry is this application serving?
   - Who are the primary users (internal staff, customers, partners)?
   - What are the core business processes this system supports?

2. **Migration Drivers:**
   - What's motivating this migration/refactoring project?
   - Are there specific pain points with the current system?
   - What business outcomes are you hoping to achieve?

3. **Success Criteria:**
   - How will you measure the success of this migration?
   - Are there specific performance, scalability, or user experience goals?
   - What would make this project a clear win for your organization?
```

#### Technical Requirements & Constraints
```
Now let's dive into technical requirements and constraints:

1. **System Requirements:**
   - Do you need to maintain backward compatibility with existing data?
   - Are there specific performance requirements (response times, concurrent users)?
   - What are your security and compliance requirements?

2. **Infrastructure Constraints:**
   - Do you have preferences for cloud providers or hosting approaches?
   - Are there budget constraints that might influence technology choices?
   - Do you have existing infrastructure that needs to be considered?

3. **Team & Timeline:**
   - What's your development team's experience with modern web technologies?
   - Do you have a target timeline or deadline for this migration?
   - Are there external factors (vendor contracts, business events) influencing timing?
```

#### Feature Prioritization
```
Let's prioritize what needs to be migrated and what can be enhanced:

1. **Core Feature Assessment:**
   Based on my analysis, I identified these main features: [LIST FEATURES]
   - Which of these are absolutely critical for day-one functionality?
   - Are there any features you'd like to retire or significantly change?
   - What new capabilities would you like to add during the migration?

2. **User Experience Priorities:**
   - Are there specific user workflows that are particularly important to preserve?
   - What are the most common user complaints about the current system?
   - Are there modern UX patterns you'd like to adopt?

3. **Integration Requirements:**
   - Which external system integrations are critical to maintain?
   - Are there new integrations you'd like to add during the migration?
   - Do you have API consumers that need to be considered?
```

#### Risk Assessment & Mitigation
```
Let's identify and plan for potential risks:

1. **Technical Risks:**
   Based on my analysis, I see these potential technical challenges: [LIST CHALLENGES]
   - How critical is system uptime during the migration?
   - Do you have the ability to run systems in parallel during transition?
   - Are there particular areas where you've had problems before?

2. **Business Risks:**
   - Are there seasonal or cyclical business patterns we need to work around?
   - How much user training/change management is feasible?
   - What's your tolerance for temporary feature gaps during migration?

3. **Resource Constraints:**
   - What development resources can be allocated to this project?
   - Do you need to maintain the existing system while building the new one?
   - Are there external consultants or contractors involved?
```

### Discovery Session Output Template
At the end of the discovery session, AI should produce:

```markdown
# Discovery Session Summary

## Business Context
- **Industry/Domain:** [Identified business type]
- **Primary Users:** [User roles and personas]
- **Core Business Value:** [Main business processes supported]

## Migration Drivers
- **Primary Motivation:** [Why migrating now]
- **Pain Points:** [Current system issues]
- **Success Metrics:** [How success will be measured]

## Technical Assessment
- **Current Stack:** [Technology summary from analysis]
- **Complexity Score:** [High/Medium/Low with justification]
- **Key Technical Challenges:** [Major technical hurdles]

## Requirements & Constraints
- **Must-Have Features:** [Critical functionality]
- **Nice-to-Have Features:** [Enhancement opportunities]
- **Technical Constraints:** [Infrastructure, security, performance requirements]
- **Timeline Constraints:** [Deadline and milestone requirements]

## Migration Strategy Recommendation
- **Recommended Approach:** [Big bang, phased, parallel, etc.]
- **Suggested Timeline:** [High-level timeline with phases]
- **Risk Mitigation:** [Key risk areas and mitigation strategies]

## SGE Template Component Exploration

During discovery, explore how SGE template components can accelerate migration:

### Pre-Built Components to Leverage
- **Auth System:** `packages/functions/auth/` - Complete user management
- **UI Library:** `packages/ui/` - shadcn/ui components with Tailwind
- **Mobile Hooks:** `packages/shared/hooks/use-mobile.tsx` - Responsive design
- **Database Schema:** `infra/schema/core.sql` - Multi-tenant foundation
- **Subscription System:** `packages/functions/subscriptions/` - Stripe integration
- **Email System:** `packages/functions/notifications/` - Transactional emails

### Discovery Questions for Component Adoption
```
For each major legacy system component, ask:

1. **Can I adopt SGE's [component] instead of rebuilding?**
   - What customization would SGE's component need?
   - How much development time would this save?
   - What business value comes from SGE's proven patterns?

2. **How does my data model map to SGE's schema?**
   - Which entities map to users/businesses/roles?
   - What custom tables need to be added?
   - How can I leverage SGE's multi-tenant isolation?

3. **What new capabilities could SGE enable?**
   - Could SGE's subscription system add revenue streams?
   - Could SGE's mobile patterns improve user experience?
   - Could SGE's notification system improve engagement?
```

## Next Steps
1. Generate detailed migration plan emphasizing SGE component adoption
2. Design data migration strategy mapping to SGE schema patterns
3. Create implementation roadmap prioritizing SGE template leverage
4. Set up SGE development environment and explore components
```

## Interactive Discovery Prompts

### Starting the Interactive Session
Use this prompt to begin your AI discovery conversation:

```
I'm migrating a legacy system to the SGE Template architecture. I've completed automated analysis.

SGE TEMPLATE CONTEXT:
The SGE template provides a complete React + Supabase + TypeScript stack with:
- Pre-built auth system, UI components, mobile support
- Multi-tenant database schema with users/businesses/roles
- Stripe subscriptions, email notifications, Edge Functions
- See packages/ and infra/schema/ for complete architecture

LEGACY SYSTEM ANALYSIS SUMMARY:
- Technology Stack: [Summary from analysis-worksheet.md]
- Key Business Entities: [List from analysis]
- Main Functionality: [Core features identified]
- Technical Challenges: [Issues found]

MIGRATION FOCUS:
I need to understand how to map my legacy system to SGE template patterns:
1. How do my business entities map to SGE's users/businesses/roles schema?
2. What custom business logic needs to move to SGE Edge Functions?
3. How can I leverage SGE's pre-built components vs. custom development?
4. Which SGE patterns (auth, subscriptions, notifications) apply to my use case?
5. What legacy functionality doesn't fit SGE patterns and needs adaptation?

Based on the SGE template architecture, what questions do you have about mapping my legacy system to these proven patterns?
```

### Follow-Up Discovery Questions
During the interactive session, use these question frameworks:

**SGE Template Mapping Deep Dive:**
```
Based on my analysis, I found these complex areas: [SPECIFIC CODE AREAS]

For SGE Template migration:
- How does this functionality map to SGE's Edge Functions architecture?
- Can this leverage SGE's pre-built components (auth, subscriptions, notifications)?
- What business rules need custom Edge Functions vs. database constraints?
- How does this integrate with SGE's multi-tenant user/business model?
- What SGE patterns (RLS, realtime, storage) apply to this functionality?
```

**SGE Role & Permission Mapping:**
```
I see these user roles: [IDENTIFIED ROLES]
SGE template provides: OWNER, ADMIN, MANAGER, USER roles with business-based isolation

For SGE migration:
- How do my roles map to SGE's user_business_roles pattern?
- What permissions can use SGE's RLS policies vs. need custom logic?
- How do my user workflows fit SGE's multi-tenant business model?
- What role-specific features can leverage SGE's pre-built components?
- How can SGE's business invitation system improve user onboarding?
```

**Integration and Data Flow Questions:**
```
I identified these external integrations: [LIST INTEGRATIONS]

For each integration:
- How critical is real-time vs. batch processing?
- What happens when the external system is unavailable?
- Are there data consistency or timing requirements?
- How is error handling and retry logic implemented?
```

**Migration Risk Assessment:**
```
Based on the complexity I see, these areas concern me most: [RISK AREAS]

Help me understand:
- Which areas absolutely cannot have downtime or data loss?
- Where have you experienced problems with changes in the past?
- What testing approaches work best for this type of functionality?
- Are there seasonal or timing considerations for the migration?
```

### Session Documentation Template
Document key insights from your interactive session:

```markdown
# Interactive Discovery Session - [DATE]

## Critical Business Logic Insights
- **Key Finding 1:** [What you learned about complex business rules]
- **Key Finding 2:** [Important user workflow details]
- **Key Finding 3:** [Critical integration requirements]

## Migration Risk Assessment
- **High Risk Areas:** [Functionality that needs extra care]
- **Dependencies:** [Critical dependencies identified]
- **Timing Constraints:** [Business timing requirements]

## User Experience Requirements
- **Critical Workflows:** [Must-preserve user workflows]
- **Pain Points to Fix:** [Current UX issues to address]
- **Enhancement Opportunities:** [Improvements to include]

## Technical Decision Points
- **Architecture Choices:** [Key technical decisions needed]
- **Integration Approach:** [How to handle external systems]
- **Data Migration Strategy:** [Approach for data migration]

## Next Steps
1. Update migration-plan.md with these insights
2. Proceed to detailed technical architecture design
3. Begin Phase 1 implementation planning
```

## Phase 3: Migration Plan Generation

### Plan Customization Prompts
After discovery, use these prompts to generate the detailed migration plan:

```
Based on the discovery session findings, please customize the migration plan template with:

1. **Business-Specific Configuration:**
   - Configure SGE template for [BUSINESS_TYPE] with appropriate entity names
   - Customize workflow templates for identified business processes
   - Set up role-based access control matching current user roles

2. **Technical Architecture Plan:**
   - Map current data models to Supabase schema design
   - Plan API compatibility layer for external integrations
   - Design authentication migration strategy from [CURRENT_AUTH] to Supabase Auth
   - Create component migration plan from [CURRENT_FRONTEND] to SGE UI patterns

3. **Phased Implementation Strategy:**
   - Break down features into logical migration phases
   - Identify dependencies and prerequisite work
   - Plan parallel operation strategy if needed
   - Create rollback procedures for each phase

4. **Resource and Timeline Planning:**
   - Estimate effort for each migration phase based on complexity analysis
   - Identify skill gaps and training needs
   - Plan testing strategy appropriate for system criticality
   - Create milestone schedule aligned with business constraints
```

## Phase 4: Implementation Guidance

### AI-Assisted Development Workflow
During implementation, AI should provide ongoing guidance:

1. **Code Generation:** Generate SGE template components based on legacy patterns
2. **Migration Scripts:** Create data migration and transformation scripts
3. **Testing Strategy:** Generate test suites covering critical business logic
4. **Documentation:** Maintain architecture decisions and migration progress
5. **Quality Assurance:** Review code against SGE template patterns and best practices

### Progress Tracking Prompts
```
Please review migration progress and provide:
1. **Completed Work Assessment:** What has been successfully migrated?
2. **Remaining Work Analysis:** What still needs to be done?
3. **Risk Updates:** Any new risks or issues identified?
4. **Timeline Adjustments:** Are we on track with the original plan?
5. **Quality Review:** Does the migrated code follow SGE template patterns?
```

---

This framework enables AI to systematically analyze legacy systems, gather comprehensive requirements through structured discovery, and generate detailed migration plans tailored to specific business needs and technical constraints.