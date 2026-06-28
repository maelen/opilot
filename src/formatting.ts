/**
 * Shared formatting utilities for extension and provider paths.
 * Implementation delegated to @agentsy/core.
 */

import { splitLeadingXmlContextBlocks as _split } from '@agentsy/core/context';
import { sanitizeNonStreamingModelOutput as _sanitizeNonStreamingModelOutput } from '@agentsy/core/formatting';

export {
  dedupeXmlContextBlocksByTag,
  stripXmlContextTags
} from '@agentsy/core/context';
export {
  formatXmlLikeResponseForDisplay,
  sanitizeNonStreamingModelOutput
} from '@agentsy/core/formatting';
export {
  createXmlStreamFilter,
  type XmlStreamFilter
} from '@agentsy/core/xml-filter';

/**
 * Appends text to a markdown blockquote, adding `> ` prefix at line starts.
 * @see https://github.com/agentsy/core/issues/123 — remove when @agentsy/core publishes this upstream.
 */
export function appendToBlockquote(text: string, atLineStart: boolean): string {
  if (!text) {
    return '';
  }

  return `${atLineStart ? '> ' : ''}${text.replaceAll('\n', '\n> ')}`;
}

/**
 * Return shape matching existing call sites that access `.content`.
 * The library uses `.remaining` — this wrapper preserves backward compat.
 */
export interface SplitLeadingXmlContextResult {
  content: string;
  contextBlocks: string[];
}

export function splitLeadingXmlContextBlocks(text: string): SplitLeadingXmlContextResult {
  const { remaining, contextBlocks } = _split(text);
  return { content: remaining, contextBlocks };
}

/**
 * Declarative per-family model metadata for prompt-control-token stripping and
 * non-default thinking tag pairs.
 */
interface ModelTextProfile {
  id: string;
  modelMatch: RegExp;
  supportsThinking?: boolean;
  thinkingTags?: readonly [string, string];
  visibleControlTokenPatterns: readonly RegExp[];
}

const DEFAULT_THINKING_TAGS = ['<think>', '</think>'] as const;

const GEMMA4_VISIBLE_CONTROL_TOKEN_RE =
  /(<\|turn>[a-z]+\n?|<turn\|>|<\|channel>[a-z]*\n?|<channel\|>|<\|image\|>|<\|audio\|>|<\|"\|>)/g;

const QWEN_CHATML_VISIBLE_CONTROL_TOKEN_RE = /(<\|im_start\|>(system|user|assistant)\n?|<\|im_end\|>|<\|endoftext\|>)/g;

const MODEL_TEXT_PROFILES: readonly ModelTextProfile[] = [
  {
    id: 'gemma4',
    modelMatch: /gemma4/i,
    supportsThinking: true,
    thinkingTags: ['<|channel>thought', '<channel|>'],
    visibleControlTokenPatterns: [GEMMA4_VISIBLE_CONTROL_TOKEN_RE]
  },
  {
    id: 'qwen3',
    modelMatch: /qwen3/i,
    supportsThinking: true,
    thinkingTags: DEFAULT_THINKING_TAGS,
    visibleControlTokenPatterns: [QWEN_CHATML_VISIBLE_CONTROL_TOKEN_RE]
  },
  {
    id: 'qwq',
    modelMatch: /qwq/i,
    supportsThinking: true,
    thinkingTags: DEFAULT_THINKING_TAGS,
    visibleControlTokenPatterns: [QWEN_CHATML_VISIBLE_CONTROL_TOKEN_RE]
  },
  {
    id: 'qwen-chatml',
    modelMatch: /qwen|qwq/i,
    visibleControlTokenPatterns: [QWEN_CHATML_VISIBLE_CONTROL_TOKEN_RE]
  },
  {
    id: 'deepseek-r1',
    modelMatch: /deepseek-?r1/i,
    supportsThinking: true,
    thinkingTags: DEFAULT_THINKING_TAGS,
    visibleControlTokenPatterns: []
  },
  {
    id: 'phi-reasoning',
    modelMatch: /phi[0-9]+-reasoning/i,
    supportsThinking: true,
    thinkingTags: DEFAULT_THINKING_TAGS,
    visibleControlTokenPatterns: []
  },
  {
    id: 'kimi',
    modelMatch: /kimi/i,
    supportsThinking: true,
    thinkingTags: DEFAULT_THINKING_TAGS,
    visibleControlTokenPatterns: []
  },
  {
    id: 'gpt-oss',
    modelMatch: /gpt-oss/i,
    supportsThinking: true,
    thinkingTags: DEFAULT_THINKING_TAGS,
    visibleControlTokenPatterns: []
  },
  {
    id: 'generic-thinking',
    modelMatch: /thinking/i,
    supportsThinking: true,
    thinkingTags: DEFAULT_THINKING_TAGS,
    visibleControlTokenPatterns: []
  }
] as const;

export const MODEL_THINKING_TAG_MAP = new Map<string, readonly [string, string]>(
  MODEL_TEXT_PROFILES.filter(
    (profile): profile is ModelTextProfile & { supportsThinking: true; thinkingTags: readonly [string, string] } =>
      profile.supportsThinking === true && profile.thinkingTags !== undefined
  ).map(profile => [profile.id, profile.thinkingTags])
);

export function isThinkingModelId(modelId: string): boolean {
  return MODEL_TEXT_PROFILES.some(profile => profile.supportsThinking === true && profile.modelMatch.test(modelId));
}

/**
 * Strip known prompt-format control tokens that should never be shown to the
 * user if a model leaks them into visible content.
 */
export function stripVisiblePromptControlTokens(text: string): string {
  let output = text;
  for (const profile of MODEL_TEXT_PROFILES) {
    for (const pattern of profile.visibleControlTokenPatterns) {
      output = output.replace(pattern, '');
    }
  }
  return output;
}

function stripKnownThinkingTags(text: string): string {
  let output = text;
  const uniqueThinkingTags = new Set<string>();

  for (const profile of MODEL_TEXT_PROFILES) {
    if (profile.thinkingTags) {
      uniqueThinkingTags.add(profile.thinkingTags[0]);
      uniqueThinkingTags.add(profile.thinkingTags[1]);
    }
  }

  for (const token of uniqueThinkingTags) {
    output = output.replaceAll(token, '');
  }

  return output;
}

/**
 * Strip known model-authored reasoning/control artifacts from tool-round text
 * without applying broader XML-to-markdown formatting.
 */
export function sanitizeToolRoundText(text: string): string {
  return stripKnownThinkingTags(stripVisiblePromptControlTokens(text));
}

export function sanitizeToolRoundPayload(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeToolRoundText(value);
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeToolRoundPayload(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, sanitizeToolRoundPayload(nestedValue)])
    );
  }

  return value;
}

export interface PromptControlStreamFilter {
  end: () => string;
  write: (chunk: string) => string;
}

interface PromptControlFilterState {
  carry: string;
  inGemmaChannel: boolean;
}

interface RoleTokenConsumeResult {
  carry: string;
  matched: boolean;
  next: number;
}

interface GemmaChannelOpenConsumeResult {
  carry: string;
  enterGemmaChannel: boolean;
  matched: boolean;
  next: number;
}

const GEMMA_CHANNEL_OPEN = '<|channel>';
const GEMMA_CHANNEL_CLOSE = '<channel|>';
const TOKEN_STARTS = [
  '<|turn>',
  '<turn|>',
  GEMMA_CHANNEL_OPEN,
  GEMMA_CHANNEL_CLOSE,
  '<|im_start|>',
  '<|im_end|>',
  '<|endoftext|>',
  '<|image|>',
  '<|audio|>',
  '<|"|>'
] as const;

function isTokenPrefix(value: string): boolean {
  return TOKEN_STARTS.some(token => token.startsWith(value));
}

function trailingPrefixLength(value: string, fullToken: string): number {
  const max = Math.min(value.length, fullToken.length - 1);
  for (let len = max; len > 0; len--) {
    if (fullToken.startsWith(value.slice(-len))) {
      return len;
    }
  }
  return 0;
}

function consumeAsciiWord(input: string, start: number): number {
  let index = start;
  while (index < input.length) {
    const code = input.charCodeAt(index);
    const isUpper = code >= 65 && code <= 90;
    const isLower = code >= 97 && code <= 122;
    const isDigit = code >= 48 && code <= 57;
    const isUnderscore = code === 95;
    if (!(isUpper || isLower || isDigit || isUnderscore)) {
      break;
    }
    index++;
  }
  return index;
}

function consumeRoleHeaderToken(
  input: string,
  index: number,
  token: '<|turn>' | '<|im_start|>',
  isFinal: boolean
): RoleTokenConsumeResult {
  if (!input.startsWith(token, index)) {
    return { matched: false, next: index, carry: '' };
  }

  let next = index + token.length;
  next = consumeAsciiWord(input, next);

  if (!isFinal && next === input.length) {
    return { matched: true, next, carry: input.slice(index) };
  }

  if (next < input.length && input[next] === '\n') {
    next++;
  }

  return { matched: true, next, carry: '' };
}

function consumeGemmaChannelOpenToken(input: string, index: number, isFinal: boolean): GemmaChannelOpenConsumeResult {
  if (!input.startsWith(GEMMA_CHANNEL_OPEN, index)) {
    return { matched: false, next: index, carry: '', enterGemmaChannel: false };
  }

  let next = index + GEMMA_CHANNEL_OPEN.length;
  if (input.startsWith('thought', next)) {
    next += 'thought'.length;
  } else if (!isFinal && input.slice(next).startsWith('th')) {
    return { matched: true, next, carry: input.slice(index), enterGemmaChannel: false };
  }

  if (next < input.length && input[next] === '\n') {
    next++;
  }

  return { matched: true, next, carry: '', enterGemmaChannel: true };
}

function consumeStandaloneControlToken(input: string, index: number): number {
  for (const token of TOKEN_STARTS) {
    const isStandaloneToken =
      token === '<turn|>' ||
      token === GEMMA_CHANNEL_CLOSE ||
      token === '<|im_end|>' ||
      token === '<|endoftext|>' ||
      token === '<|image|>' ||
      token === '<|audio|>' ||
      token === '<|"|>';

    if (isStandaloneToken && input.startsWith(token, index)) {
      return token.length;
    }
  }

  return 0;
}

function skipGemmaChannelContent(
  state: PromptControlFilterState,
  input: string,
  index: number,
  isFinal: boolean
): { done: boolean; index: number } {
  const closeIdx = input.indexOf(GEMMA_CHANNEL_CLOSE, index);
  if (closeIdx === -1) {
    if (!isFinal) {
      const keep = trailingPrefixLength(input.slice(index), GEMMA_CHANNEL_CLOSE);
      state.carry = keep > 0 ? input.slice(input.length - keep) : '';
    }
    return { done: true, index };
  }

  state.inGemmaChannel = false;
  return {
    done: false,
    index: closeIdx + GEMMA_CHANNEL_CLOSE.length
  };
}

/**
 * Stateful filter for prompt-control tokens in streamed output.
 * Handles chunk boundaries and suppresses Gemma channel content until close tag.
 */
export function createPromptControlStreamFilter(): PromptControlStreamFilter {
  const state: PromptControlFilterState = {
    carry: '',
    inGemmaChannel: false
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: streaming parser loop tracks partial tokens and cross-chunk state.
  const write = (chunk: string, isFinal = false): string => {
    if (!(chunk || state.carry)) {
      return '';
    }

    const input = state.carry + chunk;
    state.carry = '';
    let output = '';
    let index = 0;

    while (index < input.length) {
      if (state.inGemmaChannel) {
        const skipped = skipGemmaChannelContent(state, input, index, isFinal);
        if (skipped.done) {
          return output;
        }
        index = skipped.index;
        continue;
      }

      const ltIdx = input.indexOf('<', index);
      if (ltIdx === -1) {
        output += input.slice(index);
        break;
      }

      output += input.slice(index, ltIdx);
      index = ltIdx;

      const turnToken = consumeRoleHeaderToken(input, index, '<|turn>', isFinal);
      if (turnToken.matched) {
        if (turnToken.carry) {
          state.carry = turnToken.carry;
          return output;
        }
        index = turnToken.next;
        continue;
      }

      const imStartToken = consumeRoleHeaderToken(input, index, '<|im_start|>', isFinal);
      if (imStartToken.matched) {
        if (imStartToken.carry) {
          state.carry = imStartToken.carry;
          return output;
        }
        index = imStartToken.next;
        continue;
      }

      const gemmaOpenToken = consumeGemmaChannelOpenToken(input, index, isFinal);
      if (gemmaOpenToken.matched) {
        if (gemmaOpenToken.carry) {
          state.carry = gemmaOpenToken.carry;
          return output;
        }
        if (gemmaOpenToken.enterGemmaChannel) {
          state.inGemmaChannel = true;
        }
        index = gemmaOpenToken.next;
        continue;
      }

      const standaloneTokenLength = consumeStandaloneControlToken(input, index);
      if (standaloneTokenLength > 0) {
        index += standaloneTokenLength;
        continue;
      }

      if (!isFinal) {
        const remaining = input.slice(index);
        if (isTokenPrefix(remaining)) {
          state.carry = remaining;
          return output;
        }
      }

      output += input[index];
      index++;
    }

    return output;
  };

  return {
    write: chunk => write(chunk, false),
    end: () => {
      const tail = write('', true);
      state.carry = '';
      state.inGemmaChannel = false;
      return tail;
    }
  };
}

/**
 * Apply non-streaming XML/context sanitization and then strip any known leaked
 * prompt-control tokens before rendering to the user.
 */
export function sanitizeVisibleNonStreamingModelOutput(text: string): string {
  return stripVisiblePromptControlTokens(_sanitizeNonStreamingModelOutput(text));
}
