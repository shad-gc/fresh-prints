import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.resolve(__dirname, '../../prompts/edition.md');

export const EDITION_TOOL = {
  name: 'submit_edition',
  description: 'Submit the completed morning edition as structured JSON.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['edition_title', 'top_stories', 'the_wire'],
    properties: {
      edition_title: { type: 'string', minLength: 1 },
      top_stories: {
        type: 'array',
        minItems: 5,
        maxItems: 5,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['headline', 'summary', 'why_it_matters', 'source_urls'],
          properties: {
            headline: { type: 'string', minLength: 1 },
            summary: { type: 'string', minLength: 1 },
            why_it_matters: { type: 'string', minLength: 1 },
            source_urls: {
              type: 'array',
              minItems: 1,
              items: { type: 'string', minLength: 1 },
            },
          },
        },
      },
      the_wire: {
        type: 'array',
        minItems: 10,
        maxItems: 20,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['blurb', 'source_url'],
          properties: {
            blurb: { type: 'string', minLength: 1 },
            source_url: { type: 'string', minLength: 1 },
          },
        },
      },
    },
  },
};

function loadPromptTemplate() {
  return fs.readFileSync(PROMPT_PATH, 'utf8');
}

/**
 * Lightweight runtime validation beyond what the tool schema enforces.
 * Throws with a clear message on failure.
 */
export function validateEditionPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Edition payload is not an object');
  }
  const { edition_title, top_stories, the_wire } = payload;
  if (typeof edition_title !== 'string' || !edition_title.trim()) {
    throw new Error('edition_title missing or empty');
  }
  if (!Array.isArray(top_stories) || top_stories.length !== 5) {
    throw new Error(`top_stories must have exactly 5 items (got ${top_stories?.length})`);
  }
  for (let i = 0; i < top_stories.length; i++) {
    const s = top_stories[i];
    for (const key of ['headline', 'summary', 'why_it_matters']) {
      if (typeof s[key] !== 'string' || !s[key].trim()) {
        throw new Error(`top_stories[${i}].${key} missing`);
      }
    }
    if (!Array.isArray(s.source_urls) || s.source_urls.length < 1) {
      throw new Error(`top_stories[${i}].source_urls must be non-empty`);
    }
    for (const u of s.source_urls) {
      if (typeof u !== 'string' || !/^https?:\/\//i.test(u)) {
        throw new Error(`top_stories[${i}] has invalid source URL`);
      }
    }
  }
  if (!Array.isArray(the_wire) || the_wire.length < 10 || the_wire.length > 20) {
    throw new Error(`the_wire must have 10–20 items (got ${the_wire?.length})`);
  }
  for (let i = 0; i < the_wire.length; i++) {
    const w = the_wire[i];
    if (typeof w.blurb !== 'string' || !w.blurb.trim()) {
      throw new Error(`the_wire[${i}].blurb missing`);
    }
    if (typeof w.source_url !== 'string' || !/^https?:\/\//i.test(w.source_url)) {
      throw new Error(`the_wire[${i}].source_url invalid`);
    }
  }
  return payload;
}

/**
 * Call Claude with tool-enforced JSON. Retries once on validation failure.
 */
export async function generateEdition(candidates) {
  if (!config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const template = loadPromptTemplate();
  const prompt = template.replace('{{CANDIDATES}}', JSON.stringify(candidates, null, 2));

  let lastError;
  let totalIn = 0;
  let totalOut = 0;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await client.messages.create({
        model: config.anthropicModel,
        max_tokens: 8192,
        tools: [EDITION_TOOL],
        tool_choice: { type: 'tool', name: 'submit_edition' },
        messages: [
          {
            role: 'user',
            content:
              attempt === 1
                ? prompt
                : `${prompt}\n\n---\nPrevious attempt failed validation: ${lastError}. Fix and resubmit via the tool.`,
          },
        ],
      });

      totalIn += response.usage?.input_tokens || 0;
      totalOut += response.usage?.output_tokens || 0;

      const toolBlock = (response.content || []).find(
        (b) => b.type === 'tool_use' && b.name === 'submit_edition'
      );
      if (!toolBlock) {
        throw new Error('Claude did not call submit_edition tool');
      }

      const payload = validateEditionPayload(toolBlock.input);
      return {
        payload,
        model: response.model || config.anthropicModel,
        input_tokens: totalIn,
        output_tokens: totalOut,
      };
    } catch (err) {
      lastError = err.message || String(err);
      console.error(`[edition] attempt ${attempt} failed:`, lastError);
      if (attempt === 2) {
        const fail = new Error(
          `Edition generation failed after retry: ${lastError}`
        );
        fail.tokens = { input: totalIn, output: totalOut };
        throw fail;
      }
    }
  }

  throw new Error('unreachable');
}
