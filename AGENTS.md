<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Quality rules

Marker: HELM-QR-1. If you are asked whether you read this file, quote this marker
and rule 1.

These exist because a session in September 2026 shipped work that was correct
inside every file it edited and wrong about what the application does. Every rule
below is mechanical and takes under a minute. Follow them for any change to
application code.

## Before you change anything

1. **Open every caller.** If you change a shared function, grep for its callers
   first and read all of them. State in your summary how many exist and that you
   read them. A predicate tightened in one library deleted database rows because
   its single production caller discarded the record when it returned null.
2. **A changed status code is a behavior change.** Open every caller's error
   branch. A status that was previously unreachable can activate dead fallback
   code. Returning 502 once made a settings page fall back to a route that stamped
   every account "healthy" without contacting the provider.
3. **Read the migration before you write to a table.** Quote the constraints you
   are designing around. An idempotency scheme once promised to preserve separate
   lots per ticker against a table carrying UNIQUE(user_id, account_id, security_id).
4. **Fix the class, not the instance.** Grep for every occurrence before claiming a
   bug is fixed. Two of fourteen sites is not fixed.
5. **Check the cron and the webhooks.** If a scheduled job writes the same rows as
   your change, open it. A daily job that overwrites your values means your fix
   lasts one day.

## Tests

6. **Run the whole suite, never only the files you touched.** Report totals before
   and after. A change in the failure count is a finding, not noise. Four cron auth
   tests once passed individually and failed together, because new test files
   cleared an environment variable that older ones set.
7. **Write mocks from the schema, not from memory.** State which constraints your
   mock enforces. A mock that is more permissive than the database certifies your
   belief rather than the behavior.
8. **Confirm the test reaches the branch.** A test that passes because the scenario
   never touches the real path is worse than no test.

## Claims

9. **Every summary bullet is a proposition that can be false.** Next to each, name
   the check that proves it: a file and line you read, a query you ran, a command
   whose output you saw. If you cannot name one, write UNVERIFIED.
10. **Separate "correct in the file I edited" from "correct in the application."**
    Only claim the second after checking the boundary.
11. **Do not call behavior removed** until you have grepped for the other places
    that still do it.

## Database

12. **Query, do not infer.** Schema questions, row counts, and "does this column
    exist in production" are one query with the service-role client in `scripts/`.
13. **Run a migration's backfill predicate as a SELECT first** and report the row
    count it would touch.

## Working tree

14. **Commit in coherent units as you go.** Do not accumulate days of uncommitted
    work. A file you added that is imported by a file you modified belongs in the
    same commit, or the tree does not build.
15. **Finish with `git status --porcelain`.** Any untracked file imported by
    tracked code is a blocker, not a detail.
16. **Other agents share this working tree.** Check a file's git status and mtime
    before editing it. Never commit, stash, revert, or reformat a file you did not
    change. Stage your own files by name.

## Shipping

17. **Ship through GitHub.** When Evan asks to ship, push or deploy, the default is
    to commit the reviewed work and push it to the existing GitHub repository,
    then let its Vercel Git integration build the deployment. Check the current
    remote branch before pushing; the established branch is `master`. Direct
    Vercel uploads are an exception, not the normal shipping workflow.
18. **Include a useful shipping note.** Commit messages must explain the user
    problem, resulting behavior, validation and material limitations. Vercel
    displays this GitHub commit message with the deployment. Report the GitHub
    commit and matching Vercel deployment links when shipping completes.
19. **Keep promotion manual.** Publishing source to GitHub is separate from
    promoting a Vercel deployment to production. Evan promotes manually unless he
    explicitly asks otherwise. Preserve the existing deployment settings and
    check that the automatically created deployment matches the pushed commit.
    Never include credentials, customer data, private business documents or
    unrelated working-copy changes in a release.
