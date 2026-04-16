// client/hooks/useMatch.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket } from '../services/socket';
import * as EVENTS from '../constants/events';

const INITIAL_STATE = {
  phase: 'idle',
  matchId: null,
  mode: null,
  startArticle: null,
  targetArticle: null,
  headStartSec: 60,
  currentArticle: null,
  mySteps: 0,
  opponentSteps: 0,
  opponentArticle: null,
  winnerPath: null,
  loserPath: null,
  winnerId: null,
  error: null,
};

export function useMatch() {
  const [state, setState]  = useState(INITIAL_STATE);
  const stateRef           = useRef(state);
  stateRef.current         = state;

  const update = useCallback((patch) => setState(s => ({ ...s, ...patch })), []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onReady = ({ matchId, startArticle, targetArticle, headStartSec }) => {
      update({ phase: 'ready', matchId, startArticle, targetArticle, headStartSec, currentArticle: startArticle });
    };
    const onStart = () => update({ phase: 'racing' });
    const onStep = ({ participantId, article, steps }) => {
      const myId = getSocket()?.userId;
      if (participantId === myId) {
        update({ mySteps: steps, currentArticle: article });
      } else {
        update({ opponentSteps: steps, opponentArticle: article });
      }
    };
    const onWon = ({ winnerId, winnerPath, loserPath }) => {
      const myId = getSocket()?.userId;
      update({ phase: winnerId === myId ? 'won' : 'lost', winnerId, winnerPath, loserPath });
    };
    const onError    = ({ message }) => update({ phase: 'error', error: message });
    const onAbandoned = () => update({ phase: 'idle', error: 'Opponent disconnected' });

    socket.on(EVENTS.MATCH_READY,     onReady);
    socket.on(EVENTS.MATCH_START,     onStart);
    socket.on(EVENTS.MATCH_BOT_START, onStart);
    socket.on(EVENTS.MATCH_STEP,      onStep);
    socket.on(EVENTS.MATCH_WON,       onWon);
    socket.on(EVENTS.MATCH_ERROR,     onError);
    socket.on(EVENTS.MATCH_ABANDONED, onAbandoned);

    return () => {
      socket.off(EVENTS.MATCH_READY,     onReady);
      socket.off(EVENTS.MATCH_START,     onStart);
      socket.off(EVENTS.MATCH_BOT_START, onStart);
      socket.off(EVENTS.MATCH_STEP,      onStep);
      socket.off(EVENTS.MATCH_WON,       onWon);
      socket.off(EVENTS.MATCH_ERROR,     onError);
      socket.off(EVENTS.MATCH_ABANDONED, onAbandoned);
    };
  }, [update]);

  const createMatch  = useCallback((config) => { getSocket()?.emit(EVENTS.MATCH_CREATE, config); }, []);
  const joinMatch    = useCallback((matchId) => { getSocket()?.emit(EVENTS.MATCH_JOIN, { matchId }); }, []);
  const startRace    = useCallback(() => { getSocket()?.emit(EVENTS.MATCH_START, { matchId: stateRef.current.matchId }); }, []);
  const stepTo       = useCallback((article) => { getSocket()?.emit(EVENTS.MATCH_STEP, { matchId: stateRef.current.matchId, article }); }, []);
  const abandonMatch = useCallback(() => { getSocket()?.emit(EVENTS.MATCH_ABANDON, { matchId: stateRef.current.matchId }); setState(INITIAL_STATE); }, []);
  const reset        = useCallback(() => setState(INITIAL_STATE), []);

  return { ...state, createMatch, joinMatch, startRace, stepTo, abandonMatch, reset };
}
