<!-- FORK-ONLY: do not upstream to HeyItsChloe/agent-ops without confirming
     Kotlin/Android skills belong there too. See CONTRIBUTING.md. -->
---
name: android-conventions
description: Project skill for OrderMate (11thandOrange/OrderMate) — Android/Kotlin dev-ticket pipeline conventions.
applies_to: [kotlin]
---

# android-conventions — OrderMate

Project skill for `11thandOrange/OrderMate`, the Kotlin/Android sibling to
BusyBuddy_v2's `project-conventions` skill. Content ported from OrderMate's
own `.agents/agents/{build-release,tester,ordermate-implementer}.md` and
`.agents/skills/env-setup.md` — those already document real, working
commands for this repo; this file summarizes them for the dev-ticket
pipeline rather than inventing new conventions.

## Repo

`11thandOrange/OrderMate` (Gradle root project name: `orderAppClover`).
Native Android app for Clover POS terminals — Kotlin, Gradle Kotlin DSL,
Clover Android SDK v3, Firebase (Crashlytics/Analytics/Database).

## Structure and conventions

- **Module layout**: single `:app` module (see `settings.gradle.kts`).
  Source under `app/src/main/java/com/orderMate/` — `model`, `modals`,
  `repository`, `services`, `fragment`, `networkManager`, `communicators`,
  `activities`, `viewmodel`, `broadcast`, `utils`, `adapters`. A second,
  narrower package tree lives at `app/src/main/java/com/specialOrder/`.
- **Namespace/applicationId**: `com.orderMate`. `minSdk = 21`, `targetSdk = 25`,
  `compileSdk = 34` (per `app/build.gradle.kts`).
- **Tests**: unit tests under `app/src/test/java/com/orderMate/...`, mirroring
  the source package (e.g. `utils/CommonFunctionsTest.kt` for
  `utils/CommonFunctions.kt`). Instrumented tests under
  `app/src/androidTest/java/...` (currently just the stock
  `ExampleInstrumentedTest.kt` — sparse, don't assume broad instrumented
  coverage exists).
- **Test framework actually wired into `app/build.gradle.kts` today**: JUnit 4
  (`junit:junit:4.13.2`) for unit tests, `androidx.test.ext:junit` +
  `espresso-core` for instrumented tests. OrderMate's own `.agents/agents/tester.md`
  describes a broader aspirational stack (JUnit 5, MockK, Mockito, Robolectric,
  Turbine) — none of those are actual Gradle dependencies in this repo yet;
  don't assume they're available without adding them first.
- **Build**: Gradle 8.5 (see `gradle/wrapper/gradle-wrapper.properties`), Kotlin
  1.9.0, `com.android.application` 8.1.1.

## Commands

- **Unit tests**: `./gradlew test` — the real, working command (confirmed
  across `.agents/agents/tester.md`, `build-release.md`, and
  `ordermate-implementer.md`). This is this skill's `test_command`
  (`pipelines.yaml`'s `ordermate-dev` entry — keep in sync if it changes).
- **Instrumented tests** (requires a device/emulator, not run by this
  pipeline): `./gradlew connectedAndroidTest`.
- **Compile check**: `./gradlew compileDebugKotlin`.
- **Debug build**: `./gradlew clean assembleDebug` (APK at
  `app/build/outputs/apk/debug/`).
- **Release build**: `./gradlew clean assembleRelease` (requires the signing
  config in `app/build.gradle.kts`) — this pipeline does not do release
  builds or version bumps; that stays a human/`build-release` agent action,
  per that doc's "never push release tags without confirmation" rule.
- **Coverage**: not actually wired up. `tester.md` references
  `./gradlew testDebugUnitTest jacocoTestReport`, but no jacoco plugin is
  applied in `app/build.gradle.kts` — that task does not currently produce a
  report. `pipelines.yaml`'s `ordermate-dev` entry assumes `coverage_type:
  jacoco` with a low starting `desired_coverage` (40) as a placeholder; the
  jacoco plugin and report path need to be added to the Gradle build before
  the coverage gate can enforce anything real.

## Approach docs and implementation

- Follow `skills/shared/dev/approach-doc-format/SKILL.md` and
  `skills/shared/dev/approval-gate-protocol/SKILL.md` — this file only adds
  what's specific to OrderMate.
- Reviewer: `heyitschloe` (per `pipelines.yaml`'s `ordermate-dev` entry).
- Follow the AAA (Arrange/Act/Assert) pattern and
  `should_[expected behavior]_when_[condition]` test naming, per
  `.agents/agents/tester.md` — write unit tests against acceptance criteria
  as part of implementation.
- New test files go in `app/src/test/java/com/orderMate/<same package as
  source>/`, mirroring the class under test.

## Guardrails

- Never build or push a release APK/AAB, bump `versionCode`/`versionName`,
  or create/push a release git tag — that's `build-release`'s job and
  requires explicit human confirmation per its own safety rules, not
  something this pipeline does unattended.
- Never commit `google-services.json` with real keys, `local.properties`
  with real SDK paths, or `.gradle` cache directories (per
  `.agents/skills/env-setup.md`).
- Don't rely on `./gradlew connectedAndroidTest` in this pipeline — it needs
  a device/emulator this pipeline's runner doesn't have; unit tests
  (`./gradlew test`) are what the coverage gate actually runs.
