# OOO headless development and deployment

This guide supports the Git CLI policy in `AGENTS.md`. It does not authorize publication by itself. Setup and lock-screen tests must not create test commits or trigger a production deployment.

## Confirmed project identity

| Item | Expected value |
| --- | --- |
| Local repository | `C:\OOO\OOO WEB\portfolio` |
| GitHub repository | `Bobox1996/OOO-WEB` |
| Existing origin and upstream URLs | `https://github.com/Bobox1996/OOO-WEB.git` |
| Existing branch and tracking | `main` → `origin/main` |
| Vercel project | `ooo-web` |
| Vercel build root | Repository root (`.`) |
| Deployment dashboard | <https://vercel.com/ooos-projects-f7dc45af/ooo-web/deployments> |
| Documented live URL | <https://ooo-web.vercel.app> |

The local Vercel link is `.vercel/repo.json`; this checkout has no `.vercel/project.json`. Local documentation says GitHub `main` triggers production deployment. Verify the provider's actual configuration and commit-specific deployment before reporting a release. Do not change these identifiers to make a check pass.

OOO and TypeFive must remain independent. Use only credentials and environments authorized for the selected organization. Do not copy API keys, storage configuration, authentication, or deployment configuration from the other organization.

## Workstation prerequisites

The initial power-policy audit found AC sleep and automatic hibernation already set to never, with AC display timeout at 30 minutes. Preserve Windows password protection and the battery power policy. A screen turning off or Windows locking is not permission to sign out, shut down, or suspend the machine. Keep the machine plugged in, the user session signed in, the Codex host running, and the network connected. Lid closure, manual sleep, restart, or power loss can still interrupt work unless separately addressed.

Codex must actually route phone tasks to this Windows host and this local checkout. A cloud task on a different host cannot verify access to this workstation. This guide does not claim that new phone tasks can be received while locked until the test below demonstrates it. An approval prompt or missing repository write permission can also block unattended execution; resolve only the specific required permissions while preserving the security boundary.

## Initial blockers to recheck

These are setup findings, not permanent assumptions:

- The initial checkout was clean at `87ceb2148a9a5bd510a6a8e43cb67b6c1857ee3f`, ahead by one and behind by three relative to the cached `origin/main`. Refresh remote state before interpreting this count. Do not publish or silently reconcile the histories.
- The current authentication attempt reports HTTP 403 for account `shiminzh` against the OOO repository. This does not establish authorized push access. Confirm the intended GitHub identity and repository permission before changing any account or credential mapping. Do not assume the repository owner name is the required login.
- Initial checks found Node `v24.19.0`, npm `11.17.0`, an existing `node_modules` directory, and `package-lock.json`. Build, lint, tests, lock-screen task delivery, and commit-specific deployment verification must each be recorded from actual execution; this guide alone does not certify them.

If one-time authorization is required, complete it while the workstation is available and save credentials only through the official secure credential flow. Consolidate the intended account/repository permission and any organization authorization into that one setup step. Do not paste a token into this document, a chat transcript, a remote URL, or a shell command. A later revoked/expired credential must fail clearly rather than silently starting a GUI during a locked-screen task.

## Noninteractive checks

Run from the confirmed OOO checkout. The environment settings below apply to the current PowerShell process only:

```powershell
Set-Location -LiteralPath 'C:\OOO\OOO WEB\portfolio'
$env:GIT_TERMINAL_PROMPT = '0'
$env:GCM_INTERACTIVE = 'Never'
$env:GCM_GUI_PROMPT = '0'
git status --short
git branch --show-current
git rev-parse HEAD
git ls-remote --heads origin refs/heads/main
git -c credential.interactive=false push --dry-run --porcelain origin HEAD:refs/heads/main
```

Inspect each exit code. Dry run does not update GitHub or trigger Vercel. A non-fast-forward rejection means the histories need attention; 403 or a disabled-prompt failure means authorization remains unresolved. Do not enable interactive prompts during the lock-screen test. Do not use force flags.

Current release checks:

```powershell
npm run lint
node --test tests/sumiyoshi-world.test.mjs tests/sumiyoshi-home-model.test.mjs
npm run build
```

There is no `npm test` script. Preserve existing dependencies and use the lockfile if installation becomes necessary. Do not publish when required checks fail. Build outputs and temporary lock-test probes must not enter a commit.

## Lock-screen test protocol

1. Before locking, finish any needed one-time authorization and repository permissions. Start a bounded timestamped background probe using PowerShell, writing only a small disposable file or log. Record the host, session, start time, and initial lock-state evidence without collecting credentials or screenshots of unrelated content.
2. Tell the user the probe is ready. The user presses **Win+L**, leaves the computer powered and signed in, then opens Codex on their phone and selects this Windows-hosted task. Do not request an unlock as part of normal execution.
3. From the phone, send a fresh message such as: **“锁屏测试 OOO-<当前时间>：电脑已 Win+L。请确认收到这条新任务，在 C:\OOO\OOO WEB\portfolio 读取 package.json，创建、修改并删除一个临时探针文件，执行 PowerShell、Git status、Build 和 Git Push Dry Run。禁止 Commit、真实 Push 或部署。记录锁屏期间证据。”**
4. The receiving agent records the unique message marker and reception time, verifies this is the same local Windows host, and observes session lock state where available. It then reads a project file, writes/edits/reads/deletes a uniquely named temporary probe, executes PowerShell and Git, runs the build, and performs noninteractive dry run. Use an ignored temporary location; never overwrite an existing file.
5. Compare timestamps with the user's reported lock interval and the observed lock state. Record each check separately: new task reception, background continuity, file read, file edit, PowerShell, Git, build, dry run, and absence of GUI authentication. A command failure from 403, history divergence, or project build errors must remain a failure even if the command ran while locked.
6. Remove only the test's own disposable files and stop its bounded probe. Do not create a commit or deployment. If only a prestarted background process was observed, mark **new remote task reception unverified**. If the lock interval cannot be established, mark **locked execution unverified**.

If the phone cannot target this host or no fresh message executes while locked, investigate that specific Codex limitation before claiming support. Secure alternatives may include Tailscale with Windows OpenSSH or another authenticated background service. Installing a remote-access service, changing firewall rules, or opening a public port requires separate confirmation; none is authorized by this guide. Do not disable Windows locking, authentication, or security controls.

## Daily phone workflow

Keep this workstation awake on AC and signed in. From the phone, select the verified Windows host and OOO project/task, then describe the work and explicitly state whether publishing is wanted. Example: **“在 OOO portfolio 完成以下修改……，验证通过后 Git Push，并核对 Vercel 与线上版本。”** For validation without publication, say **“只修改和验证，不 Commit、不 Push、不部署。”**

After authorization, follow `AGENTS.md`: inspect repository and outgoing commits; check remote history; build/lint/test; dry run; isolate and review task changes; commit; repeat the final remote/dry-run checks; CLI push; verify remote SHA; verify the Vercel deployment for that SHA and the live site. Report blockers and incomplete verification explicitly. A successful push is not by itself a successful deployment.
