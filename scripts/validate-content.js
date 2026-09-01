#!/usr/bin/env node
/**
 * CI gate for content/ — fails the build if desk.json or
 * examiner-questions.json would be rejected (or silently dropped)
 * by src/services/content.js at runtime.
 *
 * Run: node scripts/validate-content.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { questionProblem } from '../src/services/content.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, '../content');

const problems = [];

function fail(msg) {
  problems.push(msg);
}

function readJson(name) {
  const file = path.join(CONTENT_DIR, name);
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    fail(`${name}: unreadable (${err.message})`);
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    fail(`${name}: invalid JSON (${err.message})`);
    return undefined;
  }
}

// ---- desk.json ----
const desk = readJson('desk.json');
if (desk !== undefined) {
  if (typeof desk !== 'object' || desk === null || Array.isArray(desk)) {
    fail('desk.json: must be an object');
  } else {
    if (typeof desk.active_cert !== 'string' || !desk.active_cert.trim()) {
      fail('desk.json: active_cert must be a non-empty string');
    }
    if (desk.current_class !== null && typeof desk.current_class !== 'string') {
      fail('desk.json: current_class must be a string or null');
    }
    if (
      desk.calendar_filter !== undefined &&
      desk.calendar_filter !== null &&
      (typeof desk.calendar_filter !== 'string' || !desk.calendar_filter.trim())
    ) {
      fail('desk.json: calendar_filter must be a non-empty string, null, or omitted');
    }
    if (!Array.isArray(desk.grades)) {
      fail('desk.json: grades must be an array');
    } else {
      desk.grades.forEach((g, i) => {
        if (!g || typeof g.assignment !== 'string' || !g.assignment.trim()) {
          fail(`desk.json: grades[${i}].assignment must be a non-empty string`);
        }
        if (!g || (typeof g.score !== 'string' && typeof g.score !== 'number')) {
          fail(`desk.json: grades[${i}].score must be a string or number`);
        }
      });
    }
  }
}

// ---- examiner-questions.json ----
const questions = readJson('examiner-questions.json');
if (questions !== undefined) {
  if (!Array.isArray(questions)) {
    fail('examiner-questions.json: must be an array');
  } else {
    const seen = new Set();
    questions.forEach((q, i) => {
      const problem = questionProblem(q);
      if (problem) fail(`examiner-questions.json[${i}] (${q?.key ?? 'no key'}): ${problem}`);
      if (q?.key) {
        if (seen.has(q.key)) fail(`examiner-questions.json[${i}]: duplicate key "${q.key}"`);
        seen.add(q.key);
      }
    });
    console.log(`examiner-questions.json: ${questions.length} questions, ${seen.size} unique keys`);
  }
}

if (problems.length) {
  console.error(`\ncontent validation FAILED (${problems.length} problem${problems.length === 1 ? '' : 's'}):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('content validation passed');
