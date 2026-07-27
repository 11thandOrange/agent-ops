---
name: code-audit
description: >
  How to audit a codebase for bugs, tech debt, security issues, and code quality problems,
  and produce a report with severity ratings and remediation recommendations. Generic across
  languages/stacks — the scan patterns below are worked examples (originally written for a
  Kotlin/Android codebase); adapt the grep patterns and framework-specific checks to whatever
  language the target repo actually uses.
applies_to: all
---

# code-audit

Was previously a standalone `code-auditor` subagent, duplicated per repo. Converted to a
skill: nothing here needs a different tool/permission scope than the calling session, so
there was no reason to pay for a separate subagent-delegation mechanism (and its own
never-solved cross-repo sharing problem) when this shared-skill path already has a real,
live fetch mechanism (`dev-pipeline-reusable.yml`'s "Match shared skills" step checks out
`skills/shared/dev/` on every ticket run). `applies_to: all` means this is read on every
dev-ticket-pipeline run regardless of relevance to the specific ticket — a real, accepted
token-cost tradeoff in exchange for actually being shareable without extra tooling.

When asked to audit a codebase (a repo-wide sweep, not scoped to one ticket's changes),
follow this process.

## How to Execute

### Step 1: Understand the Codebase Structure
1. List the project structure to understand the architecture
2. Identify key modules/layers for this stack (e.g. `app/`, `domain/`, `data/`,
   `presentation/` for Android; `src/routes/`, `src/controllers/` for an Express backend;
   `src/pages/`, `src/components/` for a React frontend — adapt to what's actually there)
3. Check the manifest/dependency file for the stack in use (`build.gradle*`, `package.json`,
   `requirements.txt`, ...) for dependencies and versions
4. Review any platform-specific config (`AndroidManifest.xml`, `.env.example`,
   `next.config.js`, ...) for permissions/components/exposed surface

### Step 2: Scan for Common Issues

**Bug Detection (language-agnostic):**
```bash
grep -rn "TODO\|FIXME\|BUG\|HACK\|XXX" .
```

**Null/undefined safety** — adapt the pattern to the language:
```bash
# Kotlin: force-unwrap and unchecked casts
grep -rn "!!\|as \w\+\?" --include="*.kt" .
# TypeScript: non-null assertions and any
grep -rn "!\.\|: any\b" --include="*.ts" --include="*.tsx" .
```

**Deprecated API usage:**
```bash
grep -rn "@Deprecated\|@deprecated\|@SuppressWarnings" .
```

**Hardcoded values:**
```bash
grep -rn "http://\|https://\|api_key\|password\|secret" --exclude-dir=node_modules --exclude-dir=build .
```

### Step 3: Analyze Code Quality

**Check for:**
- Functions longer than 50 lines
- Classes/modules with too many responsibilities (God classes/files)
- Duplicate code blocks
- Missing error handling (empty catch blocks, unhandled promise rejections)
- Unused imports and variables
- Inconsistent naming conventions

### Step 4: Security Audit

**Check for:**
- Hardcoded credentials or API keys
- Insecure network configurations (cleartext traffic, missing TLS enforcement)
- SQL/NoSQL injection vulnerabilities
- Improper input validation
- Missing release-build hardening (ProGuard/R8 rules for Android; CSP/helmet headers for
  a web backend)
- Exposed internal endpoints or components

### Step 5: Tech Debt Assessment

**Identify:**
- Outdated dependencies (check versions against latest)
- Missing tests for critical business logic
- Commented-out code that should be removed
- Inconsistent architecture patterns
- Missing documentation for public APIs

## Output Format

```markdown
# Code Audit Report - [Repo Name]

**Date:** [YYYY-MM-DD]
**Scope:** [Full repo / Specific modules]

## Executive Summary

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Bugs | X | X | X | X |
| Security | X | X | X | X |
| Tech Debt | X | X | X | X |
| Code Quality | X | X | X | X |
| **Total** | **X** | **X** | **X** | **X** |

## Critical Issues (Requires Immediate Attention)

### [CRIT-001] [Issue Title]
- **File:** `path/to/file:line`
- **Category:** [Bug/Security/Tech Debt/Quality]
- **Description:** [What's wrong]
- **Impact:** [What could happen]
- **Recommendation:** [How to fix]
- **Effort:** [Low/Medium/High]

## High Priority Issues
### [HIGH-001] [Issue Title]
[Same format as above]

## Medium Priority Issues
### [MED-001] [Issue Title]
[Same format as above]

## Low Priority Issues
### [LOW-001] [Issue Title]
[Same format as above]

## Recommendations Summary

1. **Immediate Actions:**
2. **Short-term (1-2 sprints):**
3. **Long-term (Backlog):**

## Appendix: Files Reviewed

| File | Issues Found |
|------|--------------|
| `path/to/file` | CRIT-001, HIGH-003 |
```

## Severity Classification

| Level | Criteria | Response Time |
|-------|----------|---------------|
| **Critical** | Security breach, data loss, crash in production | Immediate |
| **High** | Major functionality broken, performance degradation | This sprint |
| **Medium** | Minor bugs, code smells, maintainability issues | Next sprint |
| **Low** | Style issues, optimization opportunities | Backlog |

## Gotchas

- Do not report issues in test files or generated code unless specifically asked
- Do not flag third-party library code in `build/`, `node_modules/`, `dist/`
- Do not create false positives - verify issues before reporting
- Do not miss context - check if "issues" are intentional workarounds with comments

## Edge Cases

- **Legacy Code**: Flag but be pragmatic - some tech debt may be too risky to refactor
- **Generated Code**: Skip files in `build/`, `generated/`, `.gradle/`, `dist/` directories
- **Test Code**: Different standards apply - mock data and hardcoded values are acceptable
- **Configuration Files**: Be careful about reporting secrets - they might be placeholders
