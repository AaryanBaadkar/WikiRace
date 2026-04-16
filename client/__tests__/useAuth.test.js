// client/__tests__/useAuth.test.js
import { renderHook, act } from '@testing-library/react-native';
import { useAuth } from '../hooks/useAuth';

jest.mock('../services/api', () => ({
  login:    jest.fn(),
  register: jest.fn(),
}));
jest.mock('../services/storage', () => ({
  setTokens:      jest.fn(),
  clearTokens:    jest.fn(),
  getAccessToken: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('../services/socket', () => ({
  connectSocket:    jest.fn(),
  disconnectSocket: jest.fn(),
}));

const mockApi = require('../services/api');

describe('useAuth', () => {
  it('starts unauthenticated', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it('sets user on successful login', async () => {
    mockApi.login.mockResolvedValue({
      accessToken: 'acc', refreshToken: 'ref',
      user: { id: '1', username: 'alice', email: 'alice@test.com' },
    });
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.login({ email: 'alice@test.com', password: 'pass' });
    });
    expect(result.current.user?.username).toBe('alice');
  });

  it('clears user on logout', async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.logout(); });
    expect(result.current.user).toBeNull();
  });
});
