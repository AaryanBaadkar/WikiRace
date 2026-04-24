// client/hooks/useMatch.js
import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { getSocket } from '../services/socket';
import { createMatchHttp, startBotRace, submitStep, getRaceStatus, abandonRace } from '../services/api';
import * as EVENTS from '../constants/events';

const INITIAL_STATE = {
  phase: 'idle',       // idle | ready | racing | finished | won | lost | error
  matchId: null,
  mode: null,
  startArticle: null,
  targetArticle: null,
  headStartSec: 60,
  currentArticle: null,
  mySteps: 0,
  myPath: [],          // track articles visited (solo mode)
  opponentSteps: 0,
  opponentArticle: null,
  winnerPath: null,
  loserPath: null,
  winnerId: null,
  finishers: [],       // [{ userId, steps, timeTaken, timeTakenSec }]
  myTimeTakenSec: null,
  opponentTimeTakenSec: null,
  raceStartTime: null, // ms timestamp when race started (solo mode timer)
  botStartsIn: null,   // seconds until bot begins (bot mode countdown)
  error: null,
};

const MatchContext = createContext(null);

export function MatchProvider({ children }) {
  const [state, setState]  = useState(INITIAL_STATE);
  const stateRef           = useRef(state);
  stateRef.current         = state;

  const update = useCallback((patch) => setState(s => ({ ...s, ...patch })), []);

  useEffect(() => {
    let retryTimer = null;
    let attached = false;

    function attach() {
      const socket = getSocket();
      if (!socket) {
        // Socket not available yet — retry until it is
        retryTimer = setTimeout(attach, 200);
        return;
      }
      if (attached) return;
      attached = true;
      setupListeners(socket);
    }

    function setupListeners(socket) {

    const onReady = ({ matchId, mode, startArticle, targetArticle, headStartSec }) => {
      // Full reset of match state so nothing carries over from a previous game
      setState({
        ...INITIAL_STATE,
        phase: 'ready',
        matchId,
        mode,
        startArticle,
        targetArticle,
        headStartSec,
        currentArticle: startArticle,
      });
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

    const onPlayerFinished = ({ participantId }) => {
      const myId = getSocket()?.userId;
      if (participantId === myId) {
        // I reached the target — waiting for grace period to resolve
        update({ phase: 'finished' });
      }
    };

    const onWon = ({ winnerId, winnerPath, loserPath, finishers }) => {
      const myId = getSocket()?.userId;
      const mine     = finishers?.find(f => f.userId === myId);
      const opponent = finishers?.find(f => f.userId !== myId);
      update({
        phase: winnerId === myId ? 'won' : 'lost',
        winnerId,
        winnerPath,
        loserPath,
        finishers: finishers || [],
        myTimeTakenSec:       mine?.timeTakenSec     ?? null,
        opponentTimeTakenSec: opponent?.timeTakenSec ?? null,
      });
    };

    const onError     = ({ message }) => update({ phase: 'error', error: message });
    const onAbandoned = () => update({ phase: 'idle', error: 'Opponent disconnected' });

    socket.on(EVENTS.MATCH_READY,           onReady);
    socket.on(EVENTS.MATCH_START,           onStart);
    socket.on(EVENTS.MATCH_BOT_START,       onStart);
    socket.on(EVENTS.MATCH_STEP,            onStep);
    socket.on(EVENTS.MATCH_PLAYER_FINISHED, onPlayerFinished);
    socket.on(EVENTS.MATCH_WON,             onWon);
    socket.on(EVENTS.MATCH_ERROR,           onError);
    socket.on(EVENTS.MATCH_ABANDONED,       onAbandoned);

    } // end setupListeners

    attach();

    return () => {
      clearTimeout(retryTimer);
      const socket = getSocket();
      if (socket && attached) {
        socket.removeAllListeners(EVENTS.MATCH_READY);
        socket.removeAllListeners(EVENTS.MATCH_START);
        socket.removeAllListeners(EVENTS.MATCH_BOT_START);
        socket.removeAllListeners(EVENTS.MATCH_STEP);
        socket.removeAllListeners(EVENTS.MATCH_PLAYER_FINISHED);
        socket.removeAllListeners(EVENTS.MATCH_WON);
        socket.removeAllListeners(EVENTS.MATCH_ERROR);
        socket.removeAllListeners(EVENTS.MATCH_ABANDONED);
      }
    };
  }, [update]);

  const createMatch  = useCallback(async (config) => {
    try {
      // Use HTTP API — works even when socket.io can't connect
      const { matchId, startArticle, targetArticle } = await createMatchHttp(config);
      setState({
        ...INITIAL_STATE,
        phase: 'ready',
        matchId,
        mode: config.mode,
        startArticle,
        targetArticle,
        headStartSec: config.headStartSec || 0,
        currentArticle: startArticle,
      });
    } catch (err) {
      update({ phase: 'error', error: err?.response?.data?.error || 'Could not create match' });
    }
  }, [update]);
  const joinMatch    = useCallback((matchId) => { getSocket()?.emit(EVENTS.MATCH_JOIN, { matchId }); }, []);
  const startRace    = useCallback(async () => {
    const s = stateRef.current;
    if (s.mode === 'solo') {
      update({ phase: 'racing', raceStartTime: Date.now(), myPath: [s.startArticle] });
      return;
    }
    if (s.mode === 'bot') {
      try {
        await startBotRace(s.matchId);
        update({ phase: 'racing', raceStartTime: Date.now(), myPath: [s.startArticle] });
      } catch {
        update({ phase: 'error', error: 'Could not start bot race' });
      }
      return;
    }
    getSocket()?.emit(EVENTS.MATCH_START, { matchId: s.matchId });
  }, [update]);

  const stepTo       = useCallback(async (article) => {
    const s = stateRef.current;
    const newPath = [...s.myPath, article];
    const newSteps = s.mySteps + 1;

    if (s.mode === 'solo') {
      const patch = { mySteps: newSteps, currentArticle: article, myPath: newPath };
      if (article === s.targetArticle) {
        const timeSec = Math.round((Date.now() - s.raceStartTime) / 1000);
        patch.phase = 'won';
        patch.winnerId = 'self';
        patch.winnerPath = newPath;
        patch.myTimeTakenSec = timeSec;
      }
      update(patch);
      return;
    }

    if (s.mode === 'bot') {
      update({ mySteps: newSteps, currentArticle: article, myPath: newPath });
      try {
        const res = await submitStep(s.matchId, article);
        if (res.status === 'finished') {
          // Poll one final time for result
          const status = await getRaceStatus(s.matchId);
          const timeSec = Math.round((Date.now() - s.raceStartTime) / 1000);
          update({
            phase: status.winner === 'player' ? 'won' : 'lost',
            winnerId: status.winner === 'player' ? 'self' : 'bot',
            winnerPath: status.winner === 'player' ? status.playerPath : status.botPath,
            loserPath: status.winner === 'player' ? status.botPath : status.playerPath,
            myTimeTakenSec: status.playerTimeSec || timeSec,
            opponentTimeTakenSec: status.botTimeSec,
            opponentSteps: status.botSteps,
          });
        }
      } catch { /* non-fatal, step already recorded locally */ }
      return;
    }

    getSocket()?.emit(EVENTS.MATCH_STEP, { matchId: s.matchId, article });
  }, [update]);

  const abandonMatch = useCallback(async () => {
    const s = stateRef.current;
    if (s.mode === 'bot' && s.matchId) {
      try { await abandonRace(s.matchId); } catch {}
    }
    getSocket()?.emit(EVENTS.MATCH_ABANDON, { matchId: s.matchId });
    setState(INITIAL_STATE);
  }, []);
  const reset        = useCallback(() => setState(INITIAL_STATE), []);

  // Poll bot status during bot races
  useEffect(() => {
    if (state.mode !== 'bot' || state.phase !== 'racing' || !state.matchId) return;
    const interval = setInterval(async () => {
      try {
        const status = await getRaceStatus(state.matchId);
        update({ opponentSteps: status.botSteps, botStartsIn: status.botStartsIn || 0 });
        // Bot finished while player hasn't — bot wins
        if (status.botFinished && !stateRef.current.winnerPath) {
          clearInterval(interval);
          const timeSec = Math.round((Date.now() - stateRef.current.raceStartTime) / 1000);
          update({
            phase: 'lost',
            winnerId: 'bot',
            winnerPath: status.botPath,
            loserPath: stateRef.current.myPath,
            myTimeTakenSec: timeSec,
            opponentTimeTakenSec: status.botTimeSec,
            opponentSteps: status.botSteps,
          });
        }
      } catch { /* ignore polling errors */ }
    }, 1500);
    return () => clearInterval(interval);
  }, [state.mode, state.phase, state.matchId, update]);

  const value = {
    ...state,
    createMatch, joinMatch, startRace, stepTo, abandonMatch, reset,
  };

  return (
    <MatchContext.Provider value={value}>
      {children}
    </MatchContext.Provider>
  );
}

export function useMatch() {
  const ctx = useContext(MatchContext);
  if (!ctx) throw new Error('useMatch must be used within a MatchProvider');
  return ctx;
}
