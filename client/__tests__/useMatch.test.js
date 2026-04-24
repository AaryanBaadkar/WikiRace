// client/__tests__/useMatch.test.js
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { useMatch, MatchProvider } from '../hooks/useMatch';

const mockSocket = { on: jest.fn(), off: jest.fn(), emit: jest.fn(), removeAllListeners: jest.fn(), connected: true };
jest.mock('../services/socket', () => ({ getSocket: () => mockSocket }));
jest.mock('../services/api', () => ({
  createMatchHttp: jest.fn(() => Promise.resolve({
    matchId: 'm1', startArticle: 'Potato', targetArticle: 'France',
  })),
}));

const wrapper = ({ children }) => <MatchProvider>{children}</MatchProvider>;

describe('useMatch', () => {
  beforeEach(() => {
    mockSocket.on.mockClear();
    mockSocket.emit.mockClear();
    mockSocket.removeAllListeners.mockClear();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useMatch(), { wrapper });
    expect(result.current.phase).toBe('idle');
    expect(result.current.matchId).toBeNull();
  });

  it('transitions to ready phase on match:ready event', () => {
    const { result } = renderHook(() => useMatch(), { wrapper });
    const readyCb = mockSocket.on.mock.calls.find(c => c[0] === 'match:ready')?.[1];
    act(() => {
      readyCb?.({ matchId: 'm1', startArticle: 'Potato', targetArticle: 'Barack Obama', headStartSec: 60 });
    });
    expect(result.current.phase).toBe('ready');
    expect(result.current.matchId).toBe('m1');
    expect(result.current.startArticle).toBe('Potato');
    expect(result.current.targetArticle).toBe('Barack Obama');
  });

  it('createMatch sets state via HTTP API', async () => {
    const { result } = renderHook(() => useMatch(), { wrapper });
    await act(async () => {
      await result.current.createMatch({ mode: 'bot', difficulty: 'easy', headStartSec: 60 });
    });
    expect(result.current.phase).toBe('ready');
    expect(result.current.matchId).toBe('m1');
    expect(result.current.startArticle).toBe('Potato');
  });
});
