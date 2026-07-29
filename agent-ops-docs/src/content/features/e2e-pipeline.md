---
title: E2E Pipeline
order: 4
summary: Shared reusable GitHub Actions workflow that runs end-to-end tests, with a hardened self-managed Android emulator path.
status: stable
implements:
  workflows: [e2e-pipeline-reusable]
  skills: []
  dependencies: []
  integrations: [github-actions]
runWith:
  - "Each app repo keeps a thin caller (templates/e2e-pipeline-caller.yml) that passes its own working_directory, install/test commands, and needs_emulator flag."
tradeoffs:
  - "Test framework and commands are opaque pass-through inputs, never interpreted here, so one workflow serves Playwright and Android/Espresso stacks — at the cost of the emulator branch being the one real point of divergence."
notes:
  - kind: warning
    body: "The emulator path launches and boots the AVD itself and adds explicit waits and retries because reactivecircus/android-emulator-runner's internal boot handshake intermittently races the input service and fails the whole step."
---

## What it does
`e2e-pipeline-reusable.yml` (agent-ops "Phase 6") is a single, centrally-hosted reusable workflow that runs a repo's end-to-end tests. It centralizes the shared parts — checkout, test-result and video artifact upload, the PR status comment, the `record_video` toggle, and an optional critical-flow coverage manifest check — while leaving which test framework actually runs as an opaque input each caller passes through. The one real branch point is `needs_emulator`: non-emulator stacks (Playwright, or any future non-Android e2e stack) run `test_command` as a bare step, while Android/Espresso repos run it inside a live emulator session.

## How it works
The workflow exposes `workflow_call` inputs including `working_directory`, `install_command`, `test_command`, `needs_emulator`, `emulator_api_level` (default 30), `record_video`, `coverage_manifest_path`, and `node_version` (default 22). It defines two jobs gated on `needs_emulator`.

The **non-emulator job** sets up Node, optionally installs, runs `test_command` (passing `PLAYWRIGHT_VIDEO=on/off`), optionally checks out agent-ops for the coverage-manifest check, and uploads results/video plus a PR comment.

The **emulator job** is deliberately hardened rather than relying on `reactivecircus/android-emulator-runner`'s boot handshake. That action polls `sys.boot_completed` then immediately fires `adb shell input keyevent 82`, which can hit a gap where `InputManagerService` isn't yet registered and throws "No service published for: input", erroring the step. To avoid racing it, this job instead:

- **Installs SDK components first** — because the cached AVD path (`~/.android/avd/*`) doesn't include the emulator binary, system images, or platform-tools, it runs `sdkmanager` to install platform-tools, the platform, the emulator, and the API-level system image on every run.
- **Puts sdkmanager/adb/emulator on PATH** — exporting PATH within the step (since `$GITHUB_PATH` only affects later steps) and appending to `$GITHUB_PATH` for downstream steps.
- **Launches the cached AVD itself** with a realistic device profile (the caching AVD is created with `profile: pixel_6`, after an earlier bare 320x640 skin overflowed real UI), then waits for `sys.boot_completed=1` and for `service check input` to report ready before touching input.
- **Retries the input keyevent briefly and treats it as non-fatal** (`|| true`) — the keyevent only dismisses a cosmetic lock screen the tests don't depend on.

It then disables animation scales, runs the tests via a pre-written runner script (which optionally wraps `adb shell screenrecord` for video), terminates the emulator, runs the optional coverage check, and uploads Android test results/video plus the PR comment.

## Configuration & running
Consuming repos don't copy this workflow — they add a thin caller based on `templates/e2e-pipeline-caller.yml` that invokes the reusable workflow and supplies repo-specific inputs: `working_directory`, `install_command`, `test_command`, and `needs_emulator: true` for Android/Espresso repos. Optional inputs turn on video capture (`record_video`) and the critical-flow coverage manifest (`coverage_manifest_path`, e.g. `e2e-coverage.yaml`), and let Android callers pick `emulator_api_level`. On pull requests the workflow posts a pass/fail comment linking the CI run.
