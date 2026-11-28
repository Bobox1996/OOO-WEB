[CmdletBinding()]
param(
    [string]$Repo = 'C:\OOO\OOO WEB\portfolio',
    [switch]$RequireLocked,
    [switch]$RunBuild
)

# Windows 10/11: SessionFlags 0 = locked, 1 = unlocked. Unknown is never a pass.
# https://learn.microsoft.com/en-us/windows/win32/api/wtsapi32/ns-wtsapi32-wtsinfoex_level1_w
# This probe never locks/unlocks Windows, commits, installs dependencies, or pushes changes.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

if (-not ('HeadlessLockProbe.Session' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
namespace HeadlessLockProbe {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct Level1 {
        public uint SessionId;
        public int SessionState, SessionFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 33)] public string WinStationName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 21)] public string UserName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 18)] public string DomainName;
        public long LogonTime, ConnectTime, DisconnectTime, LastInputTime, CurrentTime;
        public uint IncomingBytes, OutgoingBytes, IncomingFrames, OutgoingFrames;
        public uint IncomingCompressedBytes, OutgoingCompressedBytes;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct InfoEx { public uint Level; public Level1 Data; }
    public class State {
        public int ProcessSessionId;
        public uint QuerySessionId;
        public int? SessionFlags;
        public string LockState = "unknown";
        public int? Error;
    }
    public static class Session {
        [DllImport("wtsapi32.dll", EntryPoint="WTSQuerySessionInformationW", SetLastError=true)]
        static extern bool Query(IntPtr server, uint session, int infoClass, out IntPtr buffer, out uint bytes);
        [DllImport("wtsapi32.dll")] static extern void WTSFreeMemory(IntPtr buffer);
        [DllImport("kernel32.dll")] static extern uint WTSGetActiveConsoleSessionId();
        public static State Read() {
            var result = new State();
            result.ProcessSessionId = Process.GetCurrentProcess().SessionId;
            result.QuerySessionId = result.ProcessSessionId == 0
                ? WTSGetActiveConsoleSessionId() : (uint)result.ProcessSessionId;
            IntPtr buffer;
            uint bytes;
            if (!Query(IntPtr.Zero, result.QuerySessionId, 25, out buffer, out bytes)) {
                result.Error = Marshal.GetLastWin32Error();
                return result;
            }
            try {
                if (bytes < Marshal.SizeOf(typeof(InfoEx))) return result;
                var info = (InfoEx)Marshal.PtrToStructure(buffer, typeof(InfoEx));
                if (info.Level != 1 || info.Data.SessionId != result.QuerySessionId) return result;
                result.SessionFlags = info.Data.SessionFlags;
                if (info.Data.SessionFlags == 0) result.LockState = "locked";
                if (info.Data.SessionFlags == 1) result.LockState = "unlocked";
                return result;
            } finally { WTSFreeMemory(buffer); }
        }
    }
}
'@
}

$steps = [System.Collections.Generic.List[object]]::new()
$initialState = [HeadlessLockProbe.Session]::Read()
if ($RequireLocked -and $initialState.LockState -ne 'locked') {
    [ordered]@{ startedUtc = [DateTime]::UtcNow.ToString('o'); result = 'blocked'; reason = 'RequireLocked: session is not confirmed locked'; session = $initialState } | ConvertTo-Json -Depth 5
    exit 2
}

function Protect-Output([string]$Text) {
    $Text = $Text -replace '(https?://)[^/@\s]+@', '$1[REDACTED]@'
    $Text = $Text -replace '(?i)(authorization\s*[:=]\s*(?:bearer|token)\s+)\S+', '$1[REDACTED]'
    $Text = $Text -replace '\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)\b', '[REDACTED]'
    if ($Text.Length -gt 16000) { return $Text.Substring(0, 16000) + "`n[output truncated]" }
    return $Text
}

function Invoke-ProbeStep([string]$Name, [scriptblock]$Action) {
    $before = [HeadlessLockProbe.Session]::Read()
    if ($RequireLocked -and $before.LockState -ne 'locked') { throw "Session no longer confirmed locked before $Name" }
    $started = [DateTime]::UtcNow.ToString('o')
    $global:LASTEXITCODE = 0
    $code = 0
    try {
        $output = @(& $Action 2>&1 | ForEach-Object { $_.ToString() }) -join "`n"
        $code = $LASTEXITCODE
    } catch {
        $output = $_.Exception.Message
        $code = 1
    }
    $after = [HeadlessLockProbe.Session]::Read()
    $steps.Add([ordered]@{
        step = $Name; startedUtc = $started; endedUtc = [DateTime]::UtcNow.ToString('o')
        exitCode = $code; lockBefore = $before; lockAfter = $after
        output = Protect-Output $output
    })
}

$savedEnvironment = @{}
foreach ($name in @('GIT_TERMINAL_PROMPT','GCM_INTERACTIVE','GCM_GUI_PROMPT','GIT_ASKPASS','SSH_ASKPASS','CI','NEXT_TELEMETRY_DISABLED')) {
    $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
$startedUtc = [DateTime]::UtcNow.ToString('o')
$probePath = $null
$fatalError = $null
try {
    $resolvedRepo = (Resolve-Path -LiteralPath $Repo).Path.TrimEnd('\','/')
    $gitRoot = (& git -C $resolvedRepo rev-parse --show-toplevel).Trim()
    if ($LASTEXITCODE -ne 0 -or [IO.Path]::GetFullPath($gitRoot).TrimEnd('\','/') -ne $resolvedRepo) { throw 'Repository root does not match the requested path.' }
    $fetchUrls = @(& git -C $resolvedRepo remote get-url --all origin)
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read origin fetch URL.' }
    $pushUrls = @(& git -C $resolvedRepo remote get-url --push --all origin)
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read origin push URL.' }
    $allowedUrls = @('https://github.com/Bobox1996/OOO-WEB.git','https://github.com/Bobox1996/OOO-WEB')
    if ($fetchUrls.Count -ne 1 -or $pushUrls.Count -ne 1 -or $fetchUrls[0] -notin $allowedUrls -or $pushUrls[0] -notin $allowedUrls) { throw 'Unexpected origin. This probe only permits the OOO HTTPS repository.' }
    $branch = (& git -C $resolvedRepo branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') { throw 'Expected existing main branch. No branch was changed.' }
    $head = (& git -C $resolvedRepo rev-parse --verify HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $head -notmatch '^[a-f0-9]{40,64}$') { throw 'Cannot verify HEAD.' }
    $gitDir = (& git -C $resolvedRepo rev-parse --absolute-git-dir).Trim()
    if ($LASTEXITCODE -ne 0 -or [IO.Path]::GetFullPath($gitDir).TrimEnd('\','/') -ne (Join-Path $resolvedRepo '.git')) { throw 'Probe requires the repository-local .git directory; linked worktrees are not supported.' }

    $env:GIT_TERMINAL_PROMPT = '0'
    $env:GCM_INTERACTIVE = 'Never'
    $env:GCM_GUI_PROMPT = '0'
    $env:GIT_ASKPASS = ''
    $env:SSH_ASKPASS = ''
    $env:CI = '1'
    $env:NEXT_TELEMETRY_DISABLED = '1'

    Invoke-ProbeStep 'powershell-and-project-read' {
        "PowerShell $($PSVersionTable.PSVersion); repo=$resolvedRepo; branch=$branch; head=$head"
        $package = Get-Content -LiteralPath (Join-Path $resolvedRepo 'package.json') -Raw | ConvertFrom-Json
        "package=$($package.name); buildScriptPresent=$([bool]$package.scripts.build)"
    }
    $probePath = Join-Path $gitDir ('headless-probe-' + [guid]::NewGuid().ToString('N') + '.txt')
    Invoke-ProbeStep 'file-create-edit-read-delete' {
        $marker = [guid]::NewGuid().ToString('N')
        [IO.File]::WriteAllText($probePath, $marker)
        [IO.File]::AppendAllText($probePath, ':edited')
        if ([IO.File]::ReadAllText($probePath) -ne ($marker + ':edited')) { throw 'Probe content mismatch.' }
        Remove-Item -LiteralPath $probePath
        'Temporary repository-local .git file created, edited, read, and removed.'
    }
    Invoke-ProbeStep 'git-status' { & git -C $resolvedRepo status --short --branch }
    Invoke-ProbeStep 'git-ls-remote' { & git -C $resolvedRepo -c credential.interactive=false ls-remote --heads origin main }
    Invoke-ProbeStep 'git-push-dry-run' { & git -C $resolvedRepo -c credential.interactive=false push --dry-run --porcelain origin HEAD:refs/heads/main }
    if ($RunBuild) {
        Invoke-ProbeStep 'build' {
            Push-Location -LiteralPath $resolvedRepo
            try { & npm.cmd run build } finally { Pop-Location }
        }
    }
} catch {
    $fatalError = Protect-Output $_.Exception.Message
} finally {
    if ($probePath -and (Test-Path -LiteralPath $probePath)) { Remove-Item -LiteralPath $probePath }
    foreach ($name in $savedEnvironment.Keys) { [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process') }
}

$finalState = [HeadlessLockProbe.Session]::Read()
$failed = [bool]$fatalError -or (@($steps | Where-Object { $_.exitCode -ne 0 }).Count -gt 0)
$lockSamplesPass = $initialState.LockState -eq 'locked' -and $finalState.LockState -eq 'locked' -and (@($steps | Where-Object { $_.lockBefore.LockState -ne 'locked' -or $_.lockAfter.LockState -ne 'locked' }).Count -eq 0)
if ($RequireLocked -and -not $lockSamplesPass) { $failed = $true }
[ordered]@{
    startedUtc = $startedUtc; endedUtc = [DateTime]::UtcNow.ToString('o')
    repo = $Repo; requireLocked = [bool]$RequireLocked; runBuild = [bool]$RunBuild
    initialSession = $initialState; finalSession = $finalState
    allSampledSessionStatesLocked = $lockSamplesPass
    result = $(if ($failed) { 'failed-or-blocked' } else { 'passed' })
    fatalError = $fatalError; steps = @($steps.ToArray())
    limitations = 'Samples do not prove uninterrupted lock state between samples. A new phone message after locking must separately prove remote task delivery. Dry run does not upload commits or prove deployment. Screen-off and overnight reliability require separate observation.'
} | ConvertTo-Json -Depth 8
if ($failed) { exit 1 }
