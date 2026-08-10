import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

/**
 * Batch drafting for The Examiner.
 *
 * This is the ONLY place a model writes exam questions, and it runs behind a
 * manual dispatch — never on the request path, never on a cron. Output lands
 * as status='draft' and cannot reach the paper until a human approves it.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.resolve(__dirname, '../../prompts/questions.md');

const MAX_BATCH = 30;

/** Exam blueprints. Weights are the vendor's own, rounding included. */
export const CERT_BLUEPRINTS = {
  'associate-google-workspace-administrator': {
    name: 'Associate Google Workspace Administrator',
    domains: [
      ['Managing user accounts, domains, and Directory', 20],
      ['Managing core Workspace services', 23],
      ['Managing data governance and compliance', 15],
      ['Managing security policies and access controls', 20],
      ['Managing browsers and endpoints', 10],
      ['Monitoring and troubleshooting common issues', 13],
    ],
  },
  'gcp-associate-cloud-engineer': {
    name: 'GCP Associate Cloud Engineer',
    domains: [
      ['Setting up a cloud solution environment', 20],
      ['Planning and configuring a cloud solution', 18],
      ['Deploying and implementing a cloud solution', 25],
      ['Ensuring successful operation of a cloud solution', 22],
      ['Configuring access and security', 15],
    ],
  },
};

export const QUESTIONS_TOOL = {
  name: 'submit_questions',
  description: 'Submit a batch of drafted certification practice questions.',
  input_schema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            domain: {
              type: 'string',
              description: 'The exam blueprint section this question belongs to.',
            },
            prompt: {
              type: 'string',
              description: 'The scenario and question. Include "(Choose two.)" if multi-select.',
            },
            choices: {
              type: 'array',
              items: { type: 'string' },
              minItems: 4,
              maxItems: 4,
              description: 'Exactly four answer choices, in the order they should print.',
            },
            answer_indices: {
              type: 'array',
              items: { type: 'integer' },
              minItems: 1,
              maxItems: 2,
              description: 'Zero-based indices of the correct choice(s).',
            },
            explanation: {
              type: 'string',
              description: 'Why the answer is right and why the best distractor is wrong.',
            },
            source_url: {
              type: 'string',
              description: 'Official documentation URL that settles the question. Omit if unsure.',
            },
          },
          required: ['domain', 'prompt', 'choices', 'answer_indices', 'explanation'],
        },
      },
    },
    required: ['questions'],
  },
};

/**
 * Drop anything malformed rather than failing the batch. A draft that survives
 * this is still only a draft — the reviewer is the real gate.
 */
export function validateQuestions(raw, certSlug) {
  const out = [];
  const seen = new Set();

  for (const q of raw || []) {
    if (!q || typeof q.prompt !== 'string' || !q.prompt.trim()) continue;
    if (!Array.isArray(q.choices) || q.choices.length !== 4) continue;
    if (q.choices.some((c) => typeof c !== 'string' || !c.trim())) continue;
    if (!Array.isArray(q.answer_indices) || !q.answer_indices.length) continue;

    const answers = [...new Set(q.answer_indices.map(Number))].sort((a, b) => a - b);
    if (answers.some((i) => !Number.isInteger(i) || i < 0 || i > 3)) continue;
    if (answers.length > 2) continue;
    if (typeof q.explanation !== 'string' || !q.explanation.trim()) continue;

    // Dedupe within the batch on a normalized prompt.
    const key = q.prompt.trim().toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);

    // A source_url must at least be a real https URL; drop the field otherwise
    // rather than storing a hallucinated link.
    let sourceUrl = null;
    if (typeof q.source_url === 'string' && q.source_url.trim()) {
      try {
        const parsed = new URL(q.source_url.trim());
        if (parsed.protocol === 'https:') sourceUrl = parsed.toString();
      } catch {
        sourceUrl = null;
      }
    }

    out.push({
      cert_slug: certSlug,
      domain: typeof q.domain === 'string' && q.domain.trim() ? q.domain.trim() : null,
      prompt: q.prompt.trim(),
      choices: q.choices.map((c) => c.trim()),
      answer_indices: answers,
      explanation: q.explanation.trim(),
      source_url: sourceUrl,
    });
  }

  return out;
}

function blueprintFor(certSlug, certName) {
  const known = CERT_BLUEPRINTS[certSlug];
  if (known) return known;
  // Unknown cert: still draftable, just without weighted sections.
  return { name: certName || certSlug, domains: [] };
}

/**
 * Draft a batch of questions for a cert. Returns the inserted rows.
 * Throws only on total failure (no API key, model refused twice) — the caller
 * surfaces that to the desk, and no cron depends on it.
 */
export async function draftQuestions(db, { certSlug, certName, count = 25 } = {}) {
  if (!config.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  if (!certSlug) throw new Error('certSlug is required');

  const want = Math.min(Math.max(Number(count) || 25, 1), MAX_BATCH);
  const blueprint = blueprintFor(certSlug, certName);

  const domainLines = blueprint.domains.length
    ? blueprint.domains.map(([d, w]) => `- ${d} (~${w}% of the exam)`).join('\n')
    : '- (No published blueprint. Cover the certification\'s stated objectives evenly.)';

  // Show recent prompts so the model doesn't redraft what we already hold.
  const existing = db
    .prepare(`SELECT prompt FROM puzzle_questions WHERE cert_slug = ? ORDER BY id DESC LIMIT 60`)
    .all(certSlug)
    .map((r) => `- ${r.prompt}`)
    .join('\n');

  const prompt = fs
    .readFileSync(PROMPT_PATH, 'utf8')
    .replace(/{{CERT_NAME}}/g, blueprint.name)
    .replace('{{DOMAINS}}', domainLines)
    .replace('{{COUNT}}', String(want))
    .replace('{{EXISTING}}', existing || '- (none yet)');

  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  let lastError;
  let totalIn = 0;
  let totalOut = 0;
  let accepted = [];
  let model = config.anthropicModel;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await client.messages.create({
        model: config.anthropicModel,
        max_tokens: 16000,
        tools: [QUESTIONS_TOOL],
        tool_choice: { type: 'tool', name: 'submit_questions' },
        messages: [
          {
            role: 'user',
            content:
              attempt === 1
                ? prompt
                : `${prompt}\n\n---\nPrevious attempt produced no usable questions (${lastError}). Follow the tool schema exactly.`,
          },
        ],
      });

      totalIn += response.usage?.input_tokens || 0;
      totalOut += response.usage?.output_tokens || 0;
      model = response.model || model;

      const toolBlock = (response.content || []).find(
        (b) => b.type === 'tool_use' && b.name === 'submit_questions'
      );
      if (!toolBlock) throw new Error('model did not call submit_questions');

      accepted = validateQuestions(toolBlock.input?.questions, certSlug);
      if (!accepted.length) throw new Error('every drafted question failed validation');
      break;
    } catch (err) {
      lastError = err.message || String(err);
      console.error(`[examiner] draft attempt ${attempt} failed:`, lastError);
      if (attempt === 2) throw new Error(`Question drafting failed: ${lastError}`);
    }
  }

  const batchId = `${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}`;
  const createdAt = new Date().toISOString();

  const insert = db.prepare(
    `INSERT INTO puzzle_questions
       (cert_slug, domain, prompt, choices_json, answer_indices, explanation, source_url,
        status, model, batch_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`
  );

  const insertAll = db.transaction((rows) => {
    for (const q of rows) {
      insert.run(
        q.cert_slug,
        q.domain,
        q.prompt,
        JSON.stringify(q.choices),
        JSON.stringify(q.answer_indices),
        q.explanation,
        q.source_url,
        model,
        batchId,
        createdAt
      );
    }
  });
  insertAll(accepted);

  return {
    batch_id: batchId,
    requested: want,
    drafted: accepted.length,
    model,
    input_tokens: totalIn,
    output_tokens: totalOut,
  };
}
