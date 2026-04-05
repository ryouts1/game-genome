import { createInitialState } from './state.js';
import { applyAction } from './game-engine.js';

export function createSession(game) {
  return {
    timeline: [createInitialState(game)],
    index: 0,
  };
}

export function getPresentState(session) {
  return session.timeline[session.index];
}

export function canUndo(session) {
  return session.index > 0;
}

export function canRedo(session) {
  return session.index < session.timeline.length - 1;
}

export function jumpToTurn(session, index) {
  if (index < 0 || index >= session.timeline.length) {
    return session;
  }

  return {
    ...session,
    index,
  };
}

export function undoTurn(session) {
  return jumpToTurn(session, session.index - 1);
}

export function redoTurn(session) {
  return jumpToTurn(session, session.index + 1);
}

export function applySessionAction(game, session, action) {
  const present = getPresentState(session);
  const nextState = applyAction(game, present, action);
  const timeline = session.timeline.slice(0, session.index + 1);

  timeline.push(nextState);
  return {
    timeline,
    index: timeline.length - 1,
  };
}
