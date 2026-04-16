// client/__tests__/useMatch.test.js
import { renderHook, act } from '@testing-library/react-native';
import { useMatch } from '../hooks/useMatch';

const mockSocket = { on: jest.fn(), off: jest.fn(), emit: jest.fn() };
jest.mock('../services/socket', () => ({ getSocket: () => mockSocket }));

describe('useMatch', () => {
  beforeEach(() => { mockSocket.on.mockClear(); mockSocket.emit.mockClear(); });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useMatch());
    expect(result.current.phase).toBe('idle');
    expect(result.current.matchId).toBeNull();
  });

  it('transitions to ready phase on match:ready event', () => {
    const { result } = renderHook(() => useMatch());
    const readyCb = mockSocket.on.mock.calls.find(c => c[0] === 'match:ready')?.[1];
    act(() => {
      readyCb?.({ matchId: 'm1', startArticle: 'Potato', targetArticle: 'Barack Obama', headStartSec: 60 });
    });
    expect(result.current.phase).toBe('ready');
    expect(result.current.matchId).toBe('m1');
    expect(result.current.startArticle).toBe('Potato');
    expect(result.current.targetArticle).toBe('Barack Obama');
  });

  it('createMatch emits match:create on socket', () => {
    const { result } = renderHook(() => useMatch());
    act(() => { result.current.createMatch({ mode: 'bot', difficulty: 'easy', headStartSec: 60 }); });
    expect(mockSocket.emit).toHaveBeenCalledWith('match:create', {
      mode: 'bot', difficulty: 'easy', headStartSec: 60,
    });
  });
});
