---
description: Review a pull request, always including test coverage analysis
argument-hint: "[pr-number]"
allowed-tools: ["Bash", "Read", "Glob", "Grep", "WebFetch", "Agent"]
---

Review the pull request specified by $ARGUMENTS (or the current branch's open PR if no argument given).

## Steps

1. **Identify the PR**
   - If an argument was given, use `gh pr view $ARGUMENTS`
   - Otherwise use `gh pr view` to find the open PR for the current branch
   - If the PR is a draft, closed, or clearly automated, stop and say so

2. **Get the diff**
   - Run `gh pr diff` to see all changed files and their contents

3. **Run these four reviews in parallel using agents:**

   **a. Correctness / bugs**
   - Look for logic errors, off-by-ones, missing null checks, race conditions
   - Focus on changed lines only; ignore pre-existing issues

   **b. Test coverage** *(always required)*
   - Identify every new function, branch, and edge case introduced by the PR
   - Check whether tests exist for each one
   - Flag any meaningful behavior that has no test
   - Note if test files were changed at all — if none were touched for a non-trivial change, that's a red flag
   - Evaluate quality of existing tests: are they testing behavior or just calling functions?

   **c. CLAUDE.md compliance**
   - Read the root CLAUDE.md (if it exists) and any CLAUDE.md files in changed directories
   - Flag violations of project-specific conventions

   **d. Code clarity**
   - Flag confusing names, missing context, or logic that needs a comment to be understood

4. **Aggregate and output findings**

   Format the result as:

   ```
   ## PR Review: <title>

   ### Test Coverage
   <findings — always present, even if coverage looks good>

   ### Bugs / Correctness
   <findings, or "None found">

   ### Project Conventions
   <findings, or "None found">

   ### Code Clarity
   <findings, or "None found">

   ### Summary
   <1-2 sentence overall assessment and recommendation>
   ```

## Notes
- Cite findings with file and line number where possible
- Do not flag issues a linter or type-checker would catch
- Do not flag pre-existing issues on lines the PR didn't touch
- Test coverage is always the first section and is never omitted
