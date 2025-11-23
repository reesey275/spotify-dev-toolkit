#!/usr/bin/env node
const fs = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const resultsPath = path.join(repoRoot, 'test-results.json');
if (!fs.existsSync(resultsPath)) {
    console.error('test-results.json not found');
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const failures = [];

function walkSuites(suites) {
    if (!suites) return;
    for (const s of suites) {
        if (s.specs) {
            for (const spec of s.specs) {
                if (!spec.tests) continue;
                for (const t of spec.tests) {
                    const failed = t.results && t.results.find(r => r.status === 'failed');
                    if (failed) {
                        failures.push({
                            title: t.title || spec.title,
                            file: t.file || s.file || spec.file || 'unknown',
                            line: (t.location && t.location.line) || (spec.line) || (s.line) || null,
                            error: failed.error || (failed.errors && failed.errors[0]) || null,
                            project: failed.projectName || failed.projectId || null
                        });
                    }
                }
            }
        }
        walkSuites(s.suites);
    }
}

walkSuites(data.suites || []);

if (failures.length === 0) {
    console.log('No failing tests found in test-results.json');
    process.exit(0);
}

console.log(`Found ${failures.length} failing tests — creating GitHub issues.`);

for (const f of failures) {
    const title = `test: Playwright - ${f.title} (${f.file}${f.line ? `:${f.line}` : ''})`;
    const bodyLines = [];
    bodyLines.push(`Repository: ${process.env.GITHUB_REPOSITORY || ''}`);
    if (f.project) bodyLines.push(`Project: ${f.project}`);
    bodyLines.push('');
    bodyLines.push('Failure context:');
    if (f.error && f.error.message) {
        bodyLines.push('---');
        bodyLines.push(f.error.message);
        bodyLines.push('---');
    }
    if (f.error && f.error.stack) {
        bodyLines.push('\nStack snippet (first 10 lines):');
        bodyLines.push(f.error.stack.split('\n').slice(0, 10).join('\n'));
    }
    bodyLines.push('');
    bodyLines.push('Reproduction:');
    bodyLines.push('Run the single test locally:');
    bodyLines.push('npx playwright test --project=chromium tests/' + path.basename(f.file));
    bodyLines.push('');
    bodyLines.push('Suggested fix: investigate API response and error handling in the server, ensure the test preconditions are met (server running, test data present).');

    const body = bodyLines.join('\n');

    // Create issue via gh CLI
    const args = ['issue', 'create', '-t', title, '-b', body, '--label', 'playwright-failure'];
    console.log('Creating issue:', title);
    const res = spawnSync('gh', args, { stdio: 'inherit' });
    if (res.error) {
        console.error('Failed to run gh:', res.error.message);
        process.exit(2);
    }
}

console.log('Done.');
