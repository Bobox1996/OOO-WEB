# Out Of Office Design website

This repository contains the Out Of Office Design portfolio. Its Git remote is `Bobox1996/OOO-WEB`, Vercel hosts the Next.js app, and Supabase stores project data and media.

## Task changes and publication authority

For website edits requested on `main`, verify the change and create a local commit containing only the files or hunks for that task. Review the staged diff and preserve unrelated work, including any changes the user already staged. If verification is blocked, report the blocker and which checks passed. If the user requests a review or an uncommitted change, follow that request. Give the user the commit ID.

Use Git CLI for Git operations, including while Windows is locked. Do not depend on GitHub Desktop, browser clicks, desktop automation, or unlocking Windows. The former GitHub Desktop handoff is replaced by this workflow.

Push or deploy only when explicitly requested. Requests such as “完成以后 Git Push”, “发布新版本”, “Deploy the latest version”, and “Push origin” authorize publication of the relevant task changes after the checks below pass; do not ask for the same authorization again. A setup, authentication, review, or dry-run request does not authorize a real push or deployment. Never create a meaningless commit just to test publishing.

## Repository and organization boundaries

- Expected local checkout: `C:\OOO\OOO WEB\portfolio`; expected repository: `Bobox1996/OOO-WEB`. Confirm the actual repository root, fetch and push URLs, branch, upstream, author identity, and authenticated account before publishing. The existing production branch is `main`; do not silently switch branches, remotes, accounts, or deployment settings.
- OOO and TypeFive are independent organizations. Keep their repositories, credential permissions, API credentials, Cloud Storage, databases, and deployment environments separate. Do not copy credentials or configuration between them, use TypeFive authorization for OOO, or broaden a credential's access to solve an OOO failure.
- Use existing secure OS credential storage through Git Credential Manager or the appropriate authenticated CLI. Do not write or print passwords, tokens, credential-helper output containing secrets, or authorization headers. Do not place tokens in remote URLs, command arguments, tracked files, reports, or logs.

## Headless validation and release sequence

1. Inspect `git status --short`, staged and unstaged diffs, current HEAD, branch, upstream, and both remote URLs. Record pre-existing changes. Inspect any local commits that would be included in the push: the entire unpublished commit range must be within the user's publication request.
2. Query the remote branch and fetch its latest state when permitted. Compare the local and remote histories. If the local branch is behind, diverged, has conflicts, or the remote changed during preparation, stop publication and report the exact state. Do not silently merge, rebase, reset, overwrite another developer's changes, or discard local work.
3. Run the applicable checks from the repository root using the existing lockfile and supported Node version. The current full release checks are `npm run lint`, `node --test tests/sumiyoshi-world.test.mjs tests/sumiyoshi-home-model.test.mjs`, and `npm run build`. There is currently no `npm test` script. Inspect scripts again if the project changes. Report existing failures as well as task-related failures; do not represent skipped or failing checks as passed or push while required checks fail.
4. Run a noninteractive Git push dry run against the confirmed destination. For the existing main branch, use `git -c credential.interactive=false push --dry-run --porcelain origin HEAD:refs/heads/main` with process-scoped `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=Never`, and `GCM_GUI_PROMPT=0`. A rejection due to history is not an authentication failure; an up-to-date dry run does not prove every server-side branch rule will accept a new commit.
5. Stage only task-related files or hunks using explicit paths. Do not blindly use `git add .` or `git add -A`. If unrelated work was already staged, preserve it and isolate this task's index, for example with a temporary index built from HEAD. Do not use a plain commit that includes unrelated staged work. If the changes cannot be isolated reliably, stop and explain.
6. Review the exact commit diff, check for whitespace errors and accidental secrets, and create an accurate commit message describing the actual change. Commit only the reviewed task changes. Do not rewrite published commits. If signing or authentication needs interaction, stop instead of opening a GUI or disabling protections.
7. Before an authorized push, recheck the remote head and outgoing commit range, then repeat the dry run for the final commit. Push the explicit branch using Git CLI, for example `git push origin HEAD:refs/heads/main`. Never use force push, `--force-with-lease`, a `+` refspec, `--mirror`, or an unrequested branch/tag deletion.
8. Obtain the local full commit SHA and compare it with `git ls-remote --heads origin refs/heads/main`. If they differ, report the discrepancy rather than claiming success. Do not overwrite a newer remote commit.
9. For Git-triggered deployment, inspect the deployment associated with that exact commit. Confirm its final state, intended production/preview environment, and production-domain assignment. For this repository, the existing Vercel project is `ooo-web` in the OOO team, with repository-root builds and production tracking of `main` documented locally. Do not relink the project, promote a preview, change environment variables, or run a separate production deployment without authorization for that action.
10. Check the live site and relevant changed behavior. An HTTP 200 response alone does not prove the commit is live. Report the commit SHA, push result, build/lint/test results, deployment URL/state, and any unverified item separately. If provider access is missing, state that deployment verification remains incomplete.

## Lock-screen operation

Keep Windows locking, password protection, and security controls intact. The workstation must remain signed in, powered on, network-connected, and awake; locking is distinct from signing out or sleeping. Never bypass the lock screen. Use terminal and filesystem operations for development and validation.

For a lock-screen test, tell the user when to press Win+L and ask them to send a fresh, uniquely identifiable test task from their phone afterward. Separately verify a previously running background task and receipt/execution of that new phone task. A local timer continuing to run proves only background continuity. Use a disposable file outside tracked source, delete only that probe afterward, and run build and Git dry run without committing or deploying. Record actual evidence; do not claim locked-screen success from an unlocked test.

For operator steps and current setup limitations, see `HEADLESS-WORKFLOW.md`.
