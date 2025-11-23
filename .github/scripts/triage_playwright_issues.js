#!/usr/bin/env node
const { spawnSync } = require('child_process');
const res = spawnSync('gh', ['issue', 'list', '--label', 'playwright-failure', '--limit', '100', '--json', 'number,title,createdAt'], { encoding: 'utf8' });
if (res.error) { console.error('gh error', res.error); process.exit(1); }
if (res.status !== 0) { console.error(res.stdout || res.stderr); process.exit(res.status); }
let issues = JSON.parse(res.stdout || '[]');
if (!issues.length) { console.log('No issues with label playwright-failure'); process.exit(0); }
// Normalize title by removing suffix like " (api.spec.js:70)"
function normalize(title) {
    return title.replace(/\s*\([^)]*\)$/, '').trim();
}
const groups = {};
for (const it of issues) {
    const key = normalize(it.title);
    groups[key] = groups[key] || [];
    groups[key].push(it);
}
for (const [key, list] of Object.entries(groups)) {
    if (list.length <= 1) continue;
    // sort by issue number (older first)
    list.sort((a, b) => a.number - b.number);
    const canonical = list[0].number;
    console.log(`Canonical #${canonical} for "${key}"; closing ${list.length - 1} duplicates`);
    // add label 'triage' to canonical
    spawnSync('gh', ['issue', 'edit', String(canonical), '--add-label', 'triage'], { stdio: 'inherit' });
    for (let i = 1; i < list.length; i++) {
        const dup = list[i].number;
        // comment and close
        const body = `Marked duplicate of #${canonical} by automation (triage).`;
        spawnSync('gh', ['issue', 'comment', String(dup), '--body', body], { stdio: 'inherit' });
        spawnSync('gh', ['issue', 'close', String(dup)], { stdio: 'inherit' });
    }
}
console.log('Triage complete.');
