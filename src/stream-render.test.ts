import { describe, expect, it } from 'vitest';

import {
  appendVisibleResponseChunk,
  beginContentSection,
  beginThinkingSection,
  createStreamRenderState,
  markThinkingLineContinued
} from './stream-render.js';

describe('stream render state helpers', () => {
  it('starts the thinking section only once', () => {
    const state = createStreamRenderState();

    expect(beginThinkingSection(state)).toBe(true);
    expect(beginThinkingSection(state)).toBe(false);
    expect(state.thinkingStarted).toBe(true);
    expect(state.emittedOutput).toBe(true);
    expect(state.thinkingLineStart).toBe(true);
  });

  it('tracks thinking line continuation', () => {
    const state = createStreamRenderState();

    beginThinkingSection(state);
    markThinkingLineContinued(state);

    expect(state.thinkingLineStart).toBe(false);
  });

  it('starts the content section only after thinking has started', () => {
    const state = createStreamRenderState();

    expect(beginContentSection(state)).toBe(false);
    beginThinkingSection(state);
    expect(beginContentSection(state)).toBe(true);
    expect(beginContentSection(state)).toBe(false);
    expect(state.contentStarted).toBe(true);
  });

  it('marks visible output and keeps a bounded response buffer', () => {
    const state = createStreamRenderState();
    const chunk = 'x'.repeat(700);

    expect(appendVisibleResponseChunk(state, chunk, 'off')).toBe(false);
    expect(state.emittedOutput).toBe(true);
    expect(state.responseBuffer).toHaveLength(600);
  });
});
