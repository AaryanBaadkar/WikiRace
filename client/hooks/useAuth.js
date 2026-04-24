// client/hooks/useAuth.js
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { login as apiLogin, register as apiRegister } from '../services/api';
import { setTokens, clearTokens, getAccessToken } from '../services/storage';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    getAccessToken().then(token => {
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          connectSocket(token);  // connect before setting user so socket is ready
          setUser({ id: payload.userId, username: payload.username });
        } catch { /* invalid token */ }
      }
      setLoading(false);
    });
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await apiLogin(credentials);
    await setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    connectSocket(data.accessToken);  // connect before setting user so socket is ready
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (credentials) => {
    const data = await apiRegister(credentials);
    await setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    connectSocket(data.accessToken);  // connect before setting user so socket is ready
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await clearTokens();
    disconnectSocket();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
