/**
 * Shared formatting utilities for extension and provider paths.
 * Implementation delegated to @agentsy/core.
 */

import { splitLeadingXmlContextBlocks as _split } from '@agentsy/core/context';

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
 * Gemma 4 thinking tag map for use with `ThinkingParser.forModel()` and
 * `LLMStreamProcessor`'s `thinkingTagMap` option.
 *
 * Gemma 4 uses `<|channel>thought … <channel|>` for internal reasoning when
 * thinking mode is enabled via the `<|think|>` system instruction.
 */
export const GEMMA4_THINKING_TAG_MAP = new Map<string, readonly [string, string]>([
  ['gemma4', ['<|channel>thought', '<channel|>']]
]);

/**
 * Regex matching Gemma 4 pipe-delimited control tokens that can leak into model
 * output when Ollama does not fully strip them server-side. These tokens use
 * Gemma 4's non-XML format and are invisible to the SAX-based `xmlFilter`.
 *
 * Covered tokens:
 *   <|turn>model / <|turn>user / <|turn>system   — turn start markers
 *   <turn|>                                       — turn end marker
 *   <|channel>thought / <|channel>               — thinking channel open
 *   <channel|>                                    — thinking channel close
 *   <|image|> / <|audio|>                         — multimodal placeholders
 *   <|"|>                                         — string delimiter
 *
 * Does NOT match Granite's `<|thinking|>` / `</|thinking|>` or
 * ChatML's `<|im_start|>` / `<|im_end|>`.
 */
const GEMMA4_PIPE_TOKEN_RE =
  /(<\|turn>[a-z]+\n?|<turn\|>|<\|channel>[a-z]*\n?|<channel\|>|<\|image\|>|<\|audio\|>|<\|"\|>)/g;

export function stripGemmaPipeTokens(text: string): string {
  return text.replace(GEMMA4_PIPE_TOKEN_RE, '');
}

/**
 * Regex matching Qwen ChatML control tokens that can leak into visible output.
 *
 * Covered tokens:
 *   <|im_start|>system / user / assistant  — turn start markers
 *   <|im_end|>                             — turn end marker
 *   <|endoftext|>                          — end-of-document marker
 *
 * Does NOT match Gemma 4's `<|turn>` / `<turn|>` format or Granite's
 * `<|thinking|>` tags.
 */
const QWEN_CHATML_TOKEN_RE = /(<\|im_start\|>(system|user|assistant)\n?|<\|im_end\|>|<\|endoftext\|>)/g;

export function stripQwenChatMlTokens(text: string): string {
  return text.replace(QWEN_CHATML_TOKEN_RE, '');
}

export function stripKnownPromptControlTokens(text: string): string {
  return stripQwenChatMlTokens(stripGemmaPipeTokens(text));
}
