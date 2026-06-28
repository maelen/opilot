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

/**
 * Apply non-streaming XML/context sanitization and then strip any known leaked
 * prompt-control tokens before rendering to the user.
 */
export function sanitizeVisibleNonStreamingModelOutput(text: string): string {
  return stripVisiblePromptControlTokens(_sanitizeNonStreamingModelOutput(text));
}
