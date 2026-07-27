#!/usr/bin/env node
/**
 * Cross-checks a repo's critical-flow manifest against actual test results, for
 * e2e-pipeline-reusable.yml's coverage requirement (BusyBuddy_v2#285 Phase 6):
 * not just "the suite passed," but "every *declared* flow specifically ran and
 * passed" - catches a flow's test being silently deleted while everything else
 * still passes.
 *
 * Manifest format (e2e-coverage.yaml at the repo root, or wherever
 * coverage_manifest_path points):
 *
 *   flows:
 *     - announcement-bar-enable-disable
 *     - bundle-checkout
 *
 * Convention: a flow is "covered" if its name appears as a substring of at least
 * one PASSING test's identifier. Works across frameworks by reading whichever
 * report format is actually present - Playwright's JSON reporter
 * (test-results/results.json) or JUnit XML (androidTest's default report,
 * anywhere under build/outputs/androidTest-results or build/reports/androidTests).
 * Framework-specific test naming is the repo's job (e.g. Playwright
 * `test.describe('flow: bundle-checkout', ...)`, an Espresso test class named
 * `BundleCheckoutFlowTest`) - this script only does the substring match.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import YAML from 'yaml'

const manifestPath = process.argv[2]
if (!manifestPath) {
  console.error('Usage: check-flow-coverage.mjs <path-to-manifest.yaml>')
  process.exit(1)
}
if (!existsSync(manifestPath)) {
  console.error(`Manifest not found: ${manifestPath} - nothing to check, treating as pass.`)
  process.exit(0)
}

const manifest = YAML.parse(readFileSync(manifestPath, 'utf8'))
const flows = manifest?.flows ?? []
if (flows.length === 0) {
  console.log('Manifest has no declared flows - nothing to check.')
  process.exit(0)
}

const repoRoot = dirname(manifestPath)
const passingTestNames = collectPassingTestNames(repoRoot)

if (passingTestNames.length === 0) {
  console.error('No test results found (checked Playwright JSON report and JUnit XML reports) - cannot verify flow coverage.')
  process.exit(1)
}

const missing = flows.filter(
  (flow) => !passingTestNames.some((name) => name.toLowerCase().includes(flow.toLowerCase())),
)

if (missing.length > 0) {
  console.error(`Flow coverage check FAILED. ${missing.length}/${flows.length} declared flows have no matching passing test:`)
  for (const flow of missing) console.error(`  - ${flow}`)
  console.error(`\nPassing tests found (${passingTestNames.length}):`)
  for (const name of passingTestNames) console.error(`  - ${name}`)
  process.exit(1)
}

console.log(`Flow coverage check passed: all ${flows.length} declared flows have a matching passing test.`)

function collectPassingTestNames(root) {
  const names = []

  const playwrightReport = join(root, 'test-results', 'results.json')
  if (existsSync(playwrightReport)) {
    names.push(...extractFromPlaywrightJson(playwrightReport))
  }

  for (const dir of ['build/outputs/androidTest-results', 'build/reports/androidTests']) {
    const full = join(root, dir)
    if (existsSync(full)) {
      names.push(...findJUnitXmlFiles(full).flatMap(extractFromJUnitXml))
    }
  }

  return names
}

function extractFromPlaywrightJson(path) {
  const report = JSON.parse(readFileSync(path, 'utf8'))
  const names = []
  function walk(suite) {
    for (const spec of suite.specs ?? []) {
      const passed = (spec.tests ?? []).some((t) => (t.results ?? []).some((r) => r.status === 'passed'))
      if (passed) names.push(spec.title)
    }
    for (const child of suite.suites ?? []) walk(child)
  }
  for (const suite of report.suites ?? []) walk(suite)
  return names
}

function findJUnitXmlFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...findJUnitXmlFiles(full))
    else if (entry.name.endsWith('.xml')) files.push(full)
  }
  return files
}

function extractFromJUnitXml(path) {
  const xml = readFileSync(path, 'utf8')
  const names = []
  // Deliberately not a full XML parser dependency for this - JUnit testcase
  // elements are a simple, stable enough shape to match with a regex here.
  const testcaseRe = /<testcase\b[^>]*\bname="([^"]+)"[^>]*\/?>(?:(?!<\/testcase>)[\s\S])*?(?:<\/testcase>)?/g
  let match
  while ((match = testcaseRe.exec(xml))) {
    const block = match[0]
    const failed = /<failure\b|<error\b/.test(block)
    if (!failed) names.push(match[1])
  }
  return names
}
