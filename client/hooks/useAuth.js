// client/hooks/useAuth.js
import { useState, useEffect, useCallback } from 'react';
import { login as apiLogin, register as apiRegister } from '../services/api';
import { setTokens, clearTokens, getAccessToken } from '../services/storage';
import { connectSocket, disconnectSocket } from '../services/socket';

export function useAuth() {
  const [user, setUser]         = useState(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    getAccessToken().then(token => {
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setUser({ id: payload.userId, username: payload.username });
          connectSocket(token);
        } catch { /* invalid token */ }
      }
      setLoading(false);
    });
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await apiLogin(credentials);
    await setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    setUser(data.user);
    connectSocket(data.accessToken);
    return data.user;
  }, []);

  const register = useCallback(async (credentials) => {
    const data = await apiRegister(credentials);
    await setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    setUser(data.user);
    connectSocket(data.accessToken);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await clearTokens();
    disconnectSocket();
    setUser(null);
  }, []);

  return { user, isLoading, login, register, logout };
}
