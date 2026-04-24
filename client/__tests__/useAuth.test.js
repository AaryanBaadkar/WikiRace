// client/__tests__/useAuth.test.js
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { useAuth, AuthProvider } from '../hooks/useAuth';

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

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
  it('starts unauthenticated', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    await act(async () => {}); // flush getAccessToken() microtask
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('sets user on successful login', async () => {
    mockApi.login.mockResolvedValue({
      accessToken: 'acc', refreshToken: 'ref',
      user: { id: '1', username: 'alice', email: 'alice@test.com' },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login({ email: 'alice@test.com', password: 'pass' });
    });
    expect(result.current.user?.username).toBe('alice');
  });

  it('clears user on logout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => { await result.current.logout(); });
    expect(result.current.user).toBeNull();
  });
});
