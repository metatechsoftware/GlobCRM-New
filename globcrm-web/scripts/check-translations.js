#!/usr/bin/env node

/**
 * CI Translation Validation Script
 *
 * Three checks:
 *   1. Key Parity (HARD FAIL) - EN and TR files must have identical key sets
 *   2. Hardcoded String Detection (HARD FAIL) - No unlocalized text in templates
 *   3. Unused Key Detection (WARNING) - Translation keys not referenced in code
 *
 * The hardcoded string detector uses a baseline file (scripts/i18n-baseline.json)
 * to track known exceptions. New hardcoded strings not in the baseline will fail CI.
 * To update the baseline after intentional changes, run:
 *   node scripts/check-translations.js --update-baseline
 *
 * Usage: node scripts/check-translations.js
 * npm:   npm run check:i18n
 */

const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '../src/assets/i18n');
const APP_DIR = path.join(__dirname, '../src/app');
const BASELINE_PATH = path.join(__dirname, 'i18n-baseline.json');

const UPDATE_BASELINE = process.argv.includes('--update-baseline');

let errors = 0;
let warnings = 0;

// ============================================================================
// Utilities
// ============================================================================

/**
 * Recursively read all files matching extensions in a directory.
 */
function walkDir(dir, ext, results = []) {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip known non-source directories
      if (['node_modules', '.angular', 'dist'].includes(entry.name)) continue;
      walkDir(fullPath, ext, results);
    } else if (Array.isArray(ext) ? ext.some(e => entry.name.endsWith(e)) : entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Flatten a nested JSON object to dot-notation keys.
 * e.g. { common: { save: "Save" } } => ["common.save"]
 */
function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys.push(...flattenKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

/**
 * Get relative path from project root (globcrm-web/).
 */
function relPath(filePath) {
  return path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');
}

// ============================================================================
// Check 1: Key Parity
// ============================================================================

function checkKeyParity() {
  console.log('\n--- Check 1: Key Parity (EN vs TR) ---\n');
  let checkErrors = 0;

  const entries = fs.readdirSync(I18N_DIR, { withFileTypes: true });

  // Collect all scope directories + root-level
  const scopes = [{ scope: 'global', dir: I18N_DIR }];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      scopes.push({ scope: entry.name, dir: path.join(I18N_DIR, entry.name) });
    }
  }

  for (const { scope, dir } of scopes) {
    const enPath = path.join(dir, 'en.json');
    const trPath = path.join(dir, 'tr.json');

    if (!fs.existsSync(enPath)) {
      console.log(`  SKIP: [${scope}] No en.json found`);
      continue;
    }
    if (!fs.existsSync(trPath)) {
      console.log(`  ERROR: [${scope}] en.json exists but tr.json is missing`);
      checkErrors++;
      continue;
    }

    let enData, trData;
    try {
      enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
      trData = JSON.parse(fs.readFileSync(trPath, 'utf8'));
    } catch (e) {
      console.log(`  ERROR: [${scope}] Failed to parse JSON: ${e.message}`);
      checkErrors++;
      continue;
    }

    const enKeys = new Set(flattenKeys(enData));
    const trKeys = new Set(flattenKeys(trData));

    for (const key of enKeys) {
      if (!trKeys.has(key)) {
        console.log(`  ERROR: [${scope}] Key "${key}" exists in en.json but missing in tr.json`);
        checkErrors++;
      }
    }

    for (const key of trKeys) {
      if (!enKeys.has(key)) {
        console.log(`  ERROR: [${scope}] Key "${key}" exists in tr.json but missing in en.json`);
        checkErrors++;
      }
    }
  }

  if (checkErrors === 0) {
    console.log('  PASS: All EN/TR key sets match across all scopes.');
  } else {
    console.log(`\n  FAIL: ${checkErrors} key parity error(s) found.`);
  }

  errors += checkErrors;
}

// ============================================================================
// Check 2: Hardcoded String Detection
// ============================================================================

/**
 * Brand names and technical terms that should never be translated.
 */
const BRAND_ALLOWLIST = new Set([
  'GlobCRM', 'Glob', 'CRM',
  'LinkedIn', 'GitHub', 'Twitter', 'Twitter / X',
  'Google', 'Microsoft', 'Slack', 'Zapier',
  'EN', 'TR', 'USD', 'EUR', 'TRY',
  'API', 'URL', 'HTML', 'CSS', 'JSON', 'XML', 'PDF', 'CSV',
  'OK', 'N/A',
]);

/**
 * Patterns for text content that is NOT a hardcoded translatable string.
 */
const TEXT_ALLOWLIST = [
  // Material icon names (lowercase with underscores)
  /^[a-z][a-z0-9_]*$/,
  // Pure numbers, math, punctuation
  /^[\d.,\s%$+\-/*=:;#()|&@!?]+$/,
  // Angular interpolation (with or without pipes)
  /\{\{[^}]+\}\}/,
  // Transloco pipe
  /\|\s*transloco/,
  // HTML entities only
  /^(&[a-zA-Z]+;|\s)+$/,
  // Empty or single character
  /^.?$/,
  // Angular structural directives
  /^@(if|for|switch|case|default|empty|else|defer|loading|placeholder|let)\b/,
  // Regex-like patterns
  /^\^|\$$/,
  // Code/formula examples (contain brackets, operators, parens)
  /[\[\](){}].*[\[\](){}]/,
  // Format strings
  /^(e\.g\.|i\.e\.)/i,
  // Placeholder patterns starting with e.g.
  /^e\.g\./,
  // Route/URL patterns
  /^(https?:\/\/|\/[a-z])/i,
  // CSS class-like identifiers
  /^[a-z][a-z0-9-]*$/,
  // Version strings
  /^v?\d+\.\d+/,
  // Hex colors
  /^#[0-9a-fA-F]{3,8}$/,
  // Template variable references
  /^#\w+$/,
  // Object property chains (a.b.c)
  /^\w+(\.\w+){2,}$/,
  // Angular pipe expressions
  /^\w+\s*\|\s*\w+/,
];

/**
 * Attributes whose static string values should be checked.
 */
const CHECKED_ATTRS = ['placeholder', 'aria-label', 'matTooltip', 'title', 'alt'];

/**
 * Extract inline template content from a .ts file.
 * Returns array of { content, startLine } objects.
 */
function extractInlineTemplates(tsContent) {
  const templates = [];
  const regex = /template\s*:\s*`([\s\S]*?)`/g;
  let match;
  while ((match = regex.exec(tsContent)) !== null) {
    const before = tsContent.substring(0, match.index);
    const startLine = before.split('\n').length;
    templates.push({ content: match[1], startLine });
  }
  return templates;
}

/**
 * Determine if text is a known non-translatable value.
 */
function isAllowlisted(text) {
  if (!text || text.length === 0) return true;
  if (BRAND_ALLOWLIST.has(text)) return true;
  if (TEXT_ALLOWLIST.some(rx => rx.test(text))) return true;

  // camelCase single words (variable names, identifiers)
  if (/^[a-z][a-zA-Z0-9]*$/.test(text)) return true;

  // ALL_CAPS identifiers
  if (/^[A-Z][A-Z0-9_]+$/.test(text)) return true;

  // Pure whitespace
  if (/^\s*$/.test(text)) return true;

  return false;
}

/**
 * Check template content for hardcoded English strings.
 * Returns array of { line, text, type } findings.
 */
function scanTemplate(templateContent, startLine) {
  const findings = [];
  const lines = templateContent.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineNum = startLine + i;
    const line = lines[i];
    const trimmed = line.trim();

    // Skip HTML comments
    if (trimmed.startsWith('<!--')) continue;

    // --- Text content between tags ---
    const textRegex = />([^<]+)</g;
    let m;
    while ((m = textRegex.exec(line)) !== null) {
      const raw = m[1];
      const text = raw.trim();
      if (!text) continue;
      if (isAllowlisted(text)) continue;

      // Skip if inside mat-icon element
      const before = line.substring(0, m.index);
      if (/<mat-icon[^>]*$/.test(before)) continue;

      // Skip if inside code element
      if (/<code[^>]*$/.test(before)) continue;

      // Skip if inside mat-error (these are validation messages, often dynamic)
      if (/<mat-error[^>]*$/.test(before)) continue;

      // Skip if inside mat-hint (explanatory text, often technical)
      if (/<mat-hint[^>]*$/.test(before)) continue;

      // Need at least one uppercase letter AND either multi-word or 3+ chars
      // This filters out abbreviations and very short tokens
      if (!/[A-Z]/.test(text)) continue;
      if (text.length < 3 && !/\s/.test(text)) continue;

      findings.push({ line: lineNum, text: text.substring(0, 80), type: 'text' });
    }

    // --- Checked attribute values ---
    for (const attr of CHECKED_ATTRS) {
      // Static attributes: attr="value" but NOT [attr]="expr"
      const attrRegex = new RegExp(`(?<!\\[)${attr}="([^"]*)"`, 'g');
      let am;
      while ((am = attrRegex.exec(line)) !== null) {
        const value = am[1].trim();
        if (!value) continue;
        if (isAllowlisted(value)) continue;
        if (!/[A-Z]/.test(value) && !/\s/.test(value)) continue;

        findings.push({ line: lineNum, text: `[${attr}] ${value.substring(0, 60)}`, type: 'attr' });
      }
    }

    // --- mat-label content ---
    const matLabelRegex = /<mat-label>([^<]+)<\/mat-label>/g;
    let ml;
    while ((ml = matLabelRegex.exec(line)) !== null) {
      const text = ml[1].trim();
      if (!text) continue;
      if (isAllowlisted(text)) continue;
      if (!/[A-Z]/.test(text)) continue;

      findings.push({ line: lineNum, text: `[mat-label] ${text.substring(0, 60)}`, type: 'mat-label' });
    }

    // --- mat-panel-title content ---
    const panelTitleRegex = /<mat-panel-title>([^<]+)<\/mat-panel-title>/g;
    let pt;
    while ((pt = panelTitleRegex.exec(line)) !== null) {
      const text = pt[1].trim();
      if (!text) continue;
      if (isAllowlisted(text)) continue;
      if (!/[A-Z]/.test(text)) continue;

      findings.push({ line: lineNum, text: `[panel-title] ${text.substring(0, 60)}`, type: 'panel-title' });
    }

    // --- mat-checkbox content ---
    const checkboxRegex = /<mat-checkbox[^>]*>([^<{]+)<\/mat-checkbox>/g;
    let cb;
    while ((cb = checkboxRegex.exec(line)) !== null) {
      const text = cb[1].trim();
      if (!text) continue;
      if (isAllowlisted(text)) continue;
      if (!/[A-Z]/.test(text)) continue;

      findings.push({ line: lineNum, text: `[checkbox] ${text.substring(0, 60)}`, type: 'checkbox' });
    }
  }

  return findings;
}

function checkHardcodedStrings() {
  console.log('\n--- Check 2: Hardcoded String Detection ---\n');

  // Load baseline if it exists
  let baseline = new Set();
  if (fs.existsSync(BASELINE_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
      baseline = new Set(data.known || []);
      console.log(`  Loaded baseline with ${baseline.size} known exception(s).\n`);
    } catch (e) {
      console.log(`  WARNING: Could not parse baseline file: ${e.message}\n`);
    }
  }

  const allFindings = []; // { file, line, text, type }

  // Scan .html files
  const htmlFiles = walkDir(APP_DIR, '.html');
  for (const filePath of htmlFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const findings = scanTemplate(content, 1);
    const rel = relPath(filePath);
    for (const f of findings) {
      allFindings.push({ file: rel, line: f.line, text: f.text, type: f.type });
    }
  }

  // Scan .ts files for inline templates
  const tsFiles = walkDir(APP_DIR, '.ts');
  for (const filePath of tsFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const templates = extractInlineTemplates(content);
    const rel = relPath(filePath);
    for (const tmpl of templates) {
      const findings = scanTemplate(tmpl.content, tmpl.startLine);
      for (const f of findings) {
        allFindings.push({ file: rel, line: f.line, text: f.text, type: f.type });
      }
    }
  }

  // Generate fingerprints for baseline comparison
  // Fingerprint = "file::text" (line numbers change, so we use file + text)
  const currentFingerprints = new Set();
  for (const f of allFindings) {
    currentFingerprints.add(`${f.file}::${f.text}`);
  }

  // If --update-baseline, write current findings and exit
  if (UPDATE_BASELINE) {
    const sorted = [...currentFingerprints].sort();
    fs.writeFileSync(BASELINE_PATH, JSON.stringify({
      _comment: 'Known hardcoded strings baseline. Regenerate with: node scripts/check-translations.js --update-baseline',
      updated: new Date().toISOString().split('T')[0],
      count: sorted.length,
      known: sorted
    }, null, 2) + '\n');
    console.log(`  Baseline updated: ${sorted.length} finding(s) recorded to ${path.basename(BASELINE_PATH)}`);
    console.log('  These will be treated as known exceptions in future runs.');
    return;
  }

  // Separate new findings from baselined ones
  let newErrors = 0;
  let baselinedCount = 0;

  for (const f of allFindings) {
    const fingerprint = `${f.file}::${f.text}`;
    if (baseline.has(fingerprint)) {
      baselinedCount++;
    } else {
      console.log(`  ERROR: [${f.file}:${f.line}] Potential hardcoded string: "${f.text}"`);
      newErrors++;
    }
  }

  if (baselinedCount > 0) {
    console.log(`\n  INFO: ${baselinedCount} known baselined exception(s) skipped.`);
  }

  if (newErrors === 0) {
    console.log('  PASS: No new hardcoded strings detected.');
  } else {
    console.log(`\n  FAIL: ${newErrors} new hardcoded string(s) found (not in baseline).`);
    console.log('  Fix these strings or run with --update-baseline to accept them.');
  }

  errors += newErrors;
}

// ============================================================================
// Check 3: Unused Key Detection
// ============================================================================

function checkUnusedKeys() {
  console.log('\n--- Check 3: Unused Key Detection ---\n');
  let checkWarnings = 0;

  // Collect all translation keys
  const allKeys = new Map(); // id => { scope, key }

  const entries = fs.readdirSync(I18N_DIR, { withFileTypes: true });

  // Global keys
  const globalEnPath = path.join(I18N_DIR, 'en.json');
  if (fs.existsSync(globalEnPath)) {
    const data = JSON.parse(fs.readFileSync(globalEnPath, 'utf8'));
    for (const key of flattenKeys(data)) {
      allKeys.set(`global::${key}`, { scope: 'global', key });
    }
  }

  // Scoped keys
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const scopeEnPath = path.join(I18N_DIR, entry.name, 'en.json');
    if (!fs.existsSync(scopeEnPath)) continue;

    const data = JSON.parse(fs.readFileSync(scopeEnPath, 'utf8'));
    for (const key of flattenKeys(data)) {
      allKeys.set(`${entry.name}::${key}`, { scope: entry.name, key });
    }
  }

  // Read all source files into a single string for searching
  const sourceFiles = walkDir(APP_DIR, ['.html', '.ts']);
  let allSource = '';
  for (const f of sourceFiles) {
    allSource += fs.readFileSync(f, 'utf8') + '\n';
  }

  for (const [id, { scope, key }] of allKeys) {
    const patterns = [];

    if (scope === 'global') {
      // Global keys: 'common.save', 'nav.myDay', etc.
      patterns.push(key);
    } else {
      // Scoped keys: 'list.title' (short form) and 'scope.list.title' (qualified)
      patterns.push(key);
      patterns.push(`${scope}.${key}`);
      // Also check for the scope name with hyphens converted to dots
      // (e.g., 'email-templates' scope may be referenced differently)
      const dotScope = scope.replace(/-/g, '');
      if (dotScope !== scope) {
        patterns.push(`${dotScope}.${key}`);
      }
    }

    const found = patterns.some(p =>
      allSource.includes(`'${p}'`) ||
      allSource.includes(`"${p}"`) ||
      allSource.includes(`\`${p}\``) ||
      allSource.includes(p)
    );

    if (!found) {
      console.log(`  WARNING: [${scope}] Key "${key}" appears unused`);
      checkWarnings++;
    }
  }

  if (checkWarnings === 0) {
    console.log('  PASS: All translation keys appear to be in use.');
  } else {
    console.log(`\n  INFO: ${checkWarnings} potentially unused key(s). (Warnings only, not a failure.)`);
  }

  warnings += checkWarnings;
}

// ============================================================================
// Main
// ============================================================================

console.log('=== Translation Validation ===');
console.log(`i18n dir: ${I18N_DIR}`);
console.log(`app dir:  ${APP_DIR}`);

checkKeyParity();
checkHardcodedStrings();

if (!UPDATE_BASELINE) {
  checkUnusedKeys();

  console.log(`\n=== Results: ${errors} error(s), ${warnings} warning(s) ===`);
  process.exit(errors > 0 ? 1 : 0);
} else {
  console.log('\n=== Baseline update complete ===');
  process.exit(0);
}
