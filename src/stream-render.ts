import { detectsRepetition } from './context-utils.js';

export type RepetitionSensitivity = 'off' | 'conservative' | 'moderate';

export interface StreamRenderState {
  contentStarted: boolean;
  emittedOutput: boolean;
  responseBuffer: string;
  thinkingLineStart: boolean;
  thinkingStarted: boolean;
}

export function createStreamRenderState(): StreamRenderState {
  return {
    thinkingStarted: false,
    thinkingLineStart: true,
    contentStarted: false,
    emittedOutput: false,
    responseBuffer: ''
  };
}

export function beginThinkingSection(state: StreamRenderState): boolean {
  if (state.thinkingStarted) {
    return false;
  }

  state.thinkingStarted = true;
  state.thinkingLineStart = true;
  state.emittedOutput = true;
  return true;
}

export function markThinkingLineContinued(state: StreamRenderState): void {
  state.thinkingLineStart = false;
}

export function beginContentSection(state: StreamRenderState): boolean {
  if (!(state.thinkingStarted && !state.contentStarted)) {
    return false;
  }

  state.contentStarted = true;
  return true;
}

export function appendVisibleResponseChunk(
  state: StreamRenderState,
  chunk: string,
  repSensitivity: RepetitionSensitivity
): boolean {
  if (!chunk) {
    return false;
  }

  state.emittedOutput = true;
  state.responseBuffer = (state.responseBuffer + chunk).slice(-600);
  return detectsRepetition(state.responseBuffer, repSensitivity);
}

export function resolveRepetitionSensitivity(value: string): RepetitionSensitivity {
  return value === 'off' || value === 'moderate' || value === 'conservative' ? value : 'conservative';
}
