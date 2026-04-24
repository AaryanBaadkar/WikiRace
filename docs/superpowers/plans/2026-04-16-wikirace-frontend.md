# WikiRace Frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the React Native + Expo Go mobile client with auth screens, full-article Wikipedia WebView renderer, real-time race screen (bot + PvP), results, replay, profile, and leaderboard.

**Architecture:** Expo Router for file-based navigation. A custom `ArticleWebView` component renders stripped Wikipedia HTML in a WebView with injected JS that intercepts link taps and posts article titles back to React Native. Socket.io client manages all real-time race state via a `useMatch` hook. Auth tokens are stored in Expo SecureStore.

**Tech Stack:** React Native, Expo SDK 51+, Expo Router, `react-native-webview`, `socket.io-client`, `axios`, `expo-secure-store`, Jest + `@testing-library/react-native`

**Prerequisite:** Backend server from `2026-04-16-wikirace-backend.md` must be running at `API_URL` (set in `.env`).

---

## File Structure

```
client/
  app/
    _layout.jsx                   # Root layout: auth guard, navigation container
    (auth)/
      _layout.jsx                 # Auth stack layout (no tab bar)
      login.jsx                   # Login screen
      register.jsx                # Register screen
    (app)/
      _layout.jsx                 # Tab layout (authenticated)
      index.jsx                   # Home / Lobby
      setup.jsx                   # Game Setup screen
      matchmaking.jsx             # PvP waiting room
      race.jsx                    # Race screen (WebView + HUD)
      results.jsx                 # Results screen (both paths, winner)
      replay.jsx                  # Match replay (step-through)
      profile.jsx                 # User profile + match history
      leaderboard.jsx             # Global leaderboard
  components/
    ArticleWebView.jsx            # WebView + injected JS, emits onLinkTap(articleTitle)
    HUD.jsx                       # Race overlay: steps, target, opponent indicator
    PathDisplay.jsx               # Renders a path array as a step-by-step list
  hooks/
    useAuth.js                    # Auth state: user, login(), logout(), register()
    useMatch.js                   # Socket.io match state machine
  services/
    api.js                        # Axios instance + all REST calls
    socket.js                     # Socket.io client singleton
    storage.js                    # Expo SecureStore: getToken, setToken, clearToken
  constants/
    events.js                     # Socket event name constants (mirrors backend)
  __tests__/
    ArticleWebView.test.jsx
    HUD.test.jsx
    PathDisplay.test.jsx
    useAuth.test.js
    useMatch.test.js
  app.json
  package.json
  .env                            # API_URL=http://localhost:3000
```

---

## Task 1: Scaffold Expo Project

**Files:**
- Create: `client/` (Expo project)
- Create: `client/.env`
- Create: `client/services/storage.js`
- Create: `client/services/api.js`
- Create: `client/constants/events.js`

- [ ] **Step 1: Create Expo project with Expo Router**

```bash
cd /c/Users/Admin/Documents/Code/WikiRace
npx create-expo-app client --template tabs
cd client
```

- [ ] **Step 2: Install dependencies**

```bash
npx expo install react-native-webview expo-secure-store
npm install socket.io-client@^4.7.5 axios@^1.7.2
npm install -D @testing-library/react-native@^12.5.0 @testing-library/jest-native@^5.4.3
```

- [ ] **Step 3: Create .env**

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
```

- [ ] **Step 4: Write services/storage.js**

```js
// client/services/storage.js
import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY  = 'wikirace_access_token';
const REFRESH_KEY = 'wikirace_refresh_token';

export const getAccessToken  = () => SecureStore.getItemAsync(ACCESS_KEY);
export const getRefreshToken = () => SecureStore.getItemAsync(REFRESH_KEY);

export const setTokens = async ({ accessToken, refreshToken }) => {
  await SecureStore.setItemAsync(ACCESS_KEY,  accessToken);
  await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
};

export const clearTokens = async () => {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
};
```

- [ ] **Step 5: Write services/api.js**

```js
// client/services/api.js
import axios from 'axios';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({ baseURL: API_URL });

// Attach access token to every request
api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  res => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await getRefreshToken();
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        await setTokens({ accessToken: data.accessToken, refreshToken });
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        await clearTokens();
        // Navigation to login handled by useAuth
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const register = (body) => api.post('/auth/register', body).then(r => r.data);
export const login    = (body) => api.post('/auth/login',    body).then(r => r.data);

// Articles
export const fetchArticle = (title, matchId) =>
  api.get(`/articles/${encodeURIComponent(title)}`, { params: { matchId } }).then(r => r.data);

// Matches
export const getMatches  = ()   => api.get('/matches').then(r => r.data);
export const getMatch    = (id) => api.get(`/matches/${id}`).then(r => r.data);

// Profile
export const getMyProfile     = ()      => api.get('/profile/me').then(r => r.data);
export const getUserProfile   = (id)    => api.get(`/profile/${id}`).then(r => r.data);

// Leaderboard
export const getLeaderboard = (params) => api.get('/leaderboard', { params }).then(r => r.data);

export default api;
```

- [ ] **Step 6: Write constants/events.js**

```js
// client/constants/events.js
export const MATCH_CREATE   = 'match:create';
export const MATCH_JOIN     = 'match:join';
export const MATCH_READY    = 'match:ready';
export const MATCH_START    = 'match:start';
export const MATCH_BOT_START = 'match:bot_start';
export const MATCH_STEP     = 'match:step';
export const MATCH_WON      = 'match:won';
export const MATCH_ABANDON  = 'match:abandon';
export const MATCH_ABANDONED = 'match:abandoned';
export const MATCH_ERROR    = 'match:error';
```

- [ ] **Step 7: Write services/socket.js**

```js
// client/services/socket.js
import { io } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

let socket = null;

export function connectSocket(accessToken) {
  if (socket?.connected) return socket;
  socket = io(API_URL, {
    auth: { token: accessToken },
    transports: ['websocket'],
    reconnection: true,
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
```

- [ ] **Step 8: Verify Expo project boots**

```bash
npx expo start
```

Expected: Expo dev server starts. Open in Expo Go on device or simulator — default template screens show.

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: scaffold Expo client project with API and socket services"
```

---

## Task 2: Auth Hook + Auth Screens

**Files:**
- Create: `client/hooks/useAuth.js`
- Create: `client/app/(auth)/_layout.jsx`
- Create: `client/app/(auth)/login.jsx`
- Create: `client/app/(auth)/register.jsx`
- Modify: `client/app/_layout.jsx`
- Create: `client/__tests__/useAuth.test.js`

- [ ] **Step 1: Write failing useAuth test**

```js
// client/__tests__/useAuth.test.js
import { renderHook, act } from '@testing-library/react-native';
import { useAuth } from '../hooks/useAuth';

// Mock services
jest.mock('../services/api', () => ({
  login:    jest.fn(),
  register: jest.fn(),
}));
jest.mock('../services/storage', () => ({
  setTokens:    jest.fn(),
  clearTokens:  jest.fn(),
  getAccessToken: jest.fn(() => Promise.resolve(null)),
}));

const mockApi = require('../services/api');

describe('useAuth', () => {
  it('starts unauthenticated', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(true); // checking stored token
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest __tests__/useAuth.test.js
```

Expected: FAIL — module not found

- [ ] **Step 3: Write hooks/useAuth.js**

```js
// client/hooks/useAuth.js
import { useState, useEffect, useCallback } from 'react';
import { login as apiLogin, register as apiRegister } from '../services/api';
import { setTokens, clearTokens, getAccessToken } from '../services/storage';
import { connectSocket, disconnectSocket } from '../services/socket';

export function useAuth() {
  const [user, setUser]       = useState(null);
  const [isLoading, setLoading] = useState(true);

  // Restore session from stored token
  useEffect(() => {
    getAccessToken().then(token => {
      if (token) {
        // Decode username from JWT payload (no verify needed client-side)
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setUser({ id: payload.userId, username: payload.username });
          connectSocket(token);
        } catch { /* invalid token, stay logged out */ }
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
```

- [ ] **Step 4: Write app/_layout.jsx (root layout with auth guard)**

```jsx
// client/app/_layout.jsx
import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useAuth } from '../hooks/useAuth';

export default function RootLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) router.replace('/(auth)/login');
    if (user && inAuthGroup)   router.replace('/(app)/');
  }, [user, isLoading, segments]);

  return <Slot />;
}
```

- [ ] **Step 5: Write app/(auth)/_layout.jsx**

```jsx
// client/app/(auth)/_layout.jsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 6: Write app/(auth)/login.jsx**

```jsx
// client/app/(auth)/login.jsx
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Error', 'Please fill in all fields');
    setLoading(true);
    try {
      await login({ email, password });
      // Auth guard in _layout.jsx handles redirect
    } catch {
      Alert.alert('Login failed', 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>WikiRace</Text>
      <Text style={styles.subtitle}>Race through Wikipedia</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Logging in…' : 'Log In'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
        <Text style={styles.link}>Don't have an account? Register</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title:      { fontSize: 36, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  subtitle:   { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 32 },
  input:      { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 16 },
  button:     { backgroundColor: '#2563eb', borderRadius: 8, padding: 16, alignItems: 'center', marginBottom: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link:       { color: '#2563eb', textAlign: 'center', fontSize: 14 },
});
```

- [ ] **Step 7: Write app/(auth)/register.jsx**

```jsx
// client/app/(auth)/register.jsx
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!username || !email || !password) return Alert.alert('Error', 'Please fill in all fields');
    setLoading(true);
    try {
      await register({ username, email, password });
    } catch (err) {
      Alert.alert('Registration failed', err?.response?.data?.error || 'Try a different username or email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <TextInput style={styles.input} placeholder="Username" value={username} onChangeText={setUsername} />
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none"
        keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Creating account…' : 'Register'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.link}>Already have an account? Log in</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title:      { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 32 },
  input:      { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 16 },
  button:     { backgroundColor: '#2563eb', borderRadius: 8, padding: 16, alignItems: 'center', marginBottom: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link:       { color: '#2563eb', textAlign: 'center', fontSize: 14 },
});
```

- [ ] **Step 8: Run tests to verify useAuth tests pass**

```bash
npx jest __tests__/useAuth.test.js
```

Expected: PASS (3 tests)

- [ ] **Step 9: Open in Expo Go and verify login/register screens render**

```bash
npx expo start
```

Tap "Log in" and "Register" links — both screens should render and form inputs should work.

- [ ] **Step 10: Commit**

```bash
git add app/ hooks/useAuth.js services/ constants/ __tests__/useAuth.test.js
git commit -m "feat: add auth screens and useAuth hook"
```

---

## Task 3: ArticleWebView Component

**Files:**
- Create: `client/components/ArticleWebView.jsx`
- Create: `client/__tests__/ArticleWebView.test.jsx`

This is the most critical component: it takes stripped Wikipedia HTML from the server, renders it in a WebView, and calls `onLinkTap(articleTitle)` when the user taps an internal link.

- [ ] **Step 1: Write failing test**

```jsx
// client/__tests__/ArticleWebView.test.jsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { ArticleWebView } from '../components/ArticleWebView';

// WebView is mocked in Jest environment
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return {
    WebView: ({ testID }) => <View testID={testID || 'webview'} />,
  };
});

describe('ArticleWebView', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(
      <ArticleWebView html="<p>Hello</p>" onLinkTap={jest.fn()} />
    );
    expect(getByTestId('article-webview')).toBeTruthy();
  });

  it('calls onLinkTap with article title when message received', () => {
    // The injected JS posts { type: 'LINK_TAP', article: 'Paris' }
    // We test that the onMessage handler correctly calls onLinkTap
    const onLinkTap = jest.fn();
    // We test the handler function directly
    const { result } = require('../components/ArticleWebView');
    // See implementation — handleMessage is exported for testing
    result.handleMessage({ nativeEvent: { data: JSON.stringify({ type: 'LINK_TAP', article: 'Paris' }) } }, onLinkTap);
    expect(onLinkTap).toHaveBeenCalledWith('Paris');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest __tests__/ArticleWebView.test.jsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Write components/ArticleWebView.jsx**

The injected JavaScript intercepts all `<a data-article="...">` taps and posts them back to React Native. It also prevents default link navigation.

```jsx
// client/components/ArticleWebView.jsx
import { useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

// Injected into the WebView — intercepts taps on data-article links
const INJECTED_JS = `
  (function() {
    document.addEventListener('click', function(e) {
      var el = e.target.closest('a[data-article]');
      if (!el) return;
      e.preventDefault();
      var article = el.getAttribute('data-article');
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LINK_TAP', article: article }));
    }, true);
  })();
  true;
`;

export function handleMessage(event, onLinkTap) {
  try {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === 'LINK_TAP' && data.article) {
      onLinkTap(data.article);
    }
  } catch { /* ignore malformed messages */ }
}

export function ArticleWebView({ html, onLinkTap, style }) {
  const webViewRef = useRef(null);

  // Wrap the server HTML in a minimal document with mobile-friendly styles
  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, sans-serif; font-size: 16px; line-height: 1.6;
                 padding: 12px; color: #111; max-width: 100%; }
          a[data-article] { color: #2563eb; text-decoration: underline; }
          img { max-width: 100%; height: auto; }
          table { max-width: 100%; overflow-x: auto; display: block; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `;

  return (
    <WebView
      ref={webViewRef}
      testID="article-webview"
      originWhitelist={['*']}
      source={{ html: fullHtml }}
      injectedJavaScript={INJECTED_JS}
      onMessage={(e) => handleMessage(e, onLinkTap)}
      javaScriptEnabled
      style={[styles.webview, style]}
    />
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: '#fff' },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/ArticleWebView.test.jsx
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add components/ArticleWebView.jsx __tests__/ArticleWebView.test.jsx
git commit -m "feat: add ArticleWebView component with link interception"
```

---

## Task 4: HUD + PathDisplay Components

**Files:**
- Create: `client/components/HUD.jsx`
- Create: `client/components/PathDisplay.jsx`
- Create: `client/__tests__/HUD.test.jsx`
- Create: `client/__tests__/PathDisplay.test.jsx`

- [ ] **Step 1: Write failing tests**

```jsx
// client/__tests__/HUD.test.jsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { HUD } from '../components/HUD';

describe('HUD', () => {
  it('shows current article, step count, and target', () => {
    const { getByText } = render(
      <HUD currentArticle="Potato" steps={3} targetArticle="Barack Obama" opponentSteps={1} />
    );
    expect(getByText('Potato')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
    expect(getByText('Barack Obama')).toBeTruthy();
  });
});
```

```jsx
// client/__tests__/PathDisplay.test.jsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { PathDisplay } from '../components/PathDisplay';

describe('PathDisplay', () => {
  it('renders each step in the path', () => {
    const { getByText } = render(
      <PathDisplay path={['Potato', 'Ireland', 'Barack Obama']} label="Your path" />
    );
    expect(getByText('Potato')).toBeTruthy();
    expect(getByText('Ireland')).toBeTruthy();
    expect(getByText('Barack Obama')).toBeTruthy();
    expect(getByText('Your path')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to confirm failures**

```bash
npx jest __tests__/HUD.test.jsx __tests__/PathDisplay.test.jsx
```

Expected: FAIL — modules not found

- [ ] **Step 3: Write components/HUD.jsx**

```jsx
// client/components/HUD.jsx
import { View, Text, StyleSheet } from 'react-native';

export function HUD({ currentArticle, steps, targetArticle, opponentSteps, isBot }) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.label}>You</Text>
          <Text style={styles.value}>{steps}</Text>
          <Text style={styles.sublabel}>steps</Text>
        </View>
        <View style={styles.target}>
          <Text style={styles.targetLabel}>Target</Text>
          <Text style={styles.targetArticle} numberOfLines={2}>{targetArticle}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.label}>{isBot ? 'Bot' : 'Rival'}</Text>
          <Text style={styles.value}>{opponentSteps ?? '–'}</Text>
          <Text style={styles.sublabel}>steps</Text>
        </View>
      </View>
      <Text style={styles.currentArticle} numberOfLines={1}>{currentArticle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { backgroundColor: '#1e3a5f', padding: 10 },
  row:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  stat:           { alignItems: 'center', minWidth: 60 },
  label:          { color: '#93c5fd', fontSize: 11, fontWeight: '600' },
  value:          { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  sublabel:       { color: '#93c5fd', fontSize: 10 },
  target:         { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  targetLabel:    { color: '#fbbf24', fontSize: 10, fontWeight: '600' },
  targetArticle:  { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  currentArticle: { color: '#cbd5e1', fontSize: 12, textAlign: 'center' },
});
```

- [ ] **Step 4: Write components/PathDisplay.jsx**

```jsx
// client/components/PathDisplay.jsx
import { View, Text, ScrollView, StyleSheet } from 'react-native';

export function PathDisplay({ path, label, highlight }) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label} ({path.length} steps)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {path.map((article, index) => (
          <View key={index} style={styles.stepRow}>
            <View style={[styles.dot, article === highlight && styles.dotHighlight]} />
            <Text style={[styles.step, article === highlight && styles.stepHighlight]}>
              {article}
            </Text>
            {index < path.length - 1 && <Text style={styles.arrow}>→</Text>}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { marginVertical: 8 },
  label:          { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  stepRow:        { flexDirection: 'row', alignItems: 'center', marginRight: 4 },
  dot:            { width: 8, height: 8, borderRadius: 4, backgroundColor: '#93c5fd', marginRight: 4 },
  dotHighlight:   { backgroundColor: '#16a34a' },
  step:           { fontSize: 13, color: '#1e40af', marginRight: 4 },
  stepHighlight:  { color: '#16a34a', fontWeight: '700' },
  arrow:          { color: '#9ca3af', marginRight: 4, fontSize: 13 },
});
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest __tests__/HUD.test.jsx __tests__/PathDisplay.test.jsx
```

Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add components/HUD.jsx components/PathDisplay.jsx __tests__/HUD.test.jsx __tests__/PathDisplay.test.jsx
git commit -m "feat: add HUD and PathDisplay components"
```

---

## Task 5: useMatch Hook

**Files:**
- Create: `client/hooks/useMatch.js`
- Create: `client/__tests__/useMatch.test.js`

`useMatch` is the state machine for a race. It manages all Socket.io events and exposes race state to screens.

- [ ] **Step 1: Write failing test**

```js
// client/__tests__/useMatch.test.js
import { renderHook, act } from '@testing-library/react-native';
import { useMatch } from '../hooks/useMatch';

// Mock socket
const mockSocket = {
  on:   jest.fn(),
  off:  jest.fn(),
  emit: jest.fn(),
};
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
    // Simulate socket emitting match:ready
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest __tests__/useMatch.test.js
```

Expected: FAIL — module not found

- [ ] **Step 3: Write hooks/useMatch.js**

```js
// client/hooks/useMatch.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket } from '../services/socket';
import * as EVENTS from '../constants/events';

const INITIAL_STATE = {
  phase: 'idle',       // idle | ready | racing | won | lost | error
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
  const [state, setState]     = useState(INITIAL_STATE);
  const stateRef              = useRef(state);
  stateRef.current            = state;

  const update = useCallback((patch) => setState(s => ({ ...s, ...patch })), []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onReady = ({ matchId, startArticle, targetArticle, headStartSec }) => {
      update({ phase: 'ready', matchId, startArticle, targetArticle, headStartSec, currentArticle: startArticle });
    };

    const onStart = () => update({ phase: 'racing' });

    const onStep = ({ participantId, article, steps, isBot }) => {
      const { matchId } = stateRef.current;
      const socket = getSocket();
      const myId = socket?.userId; // set by auth middleware
      if (participantId === myId) {
        update({ mySteps: steps, currentArticle: article });
      } else {
        update({ opponentSteps: steps, opponentArticle: article });
      }
    };

    const onWon = ({ winnerId, winnerPath, loserPath }) => {
      const socket = getSocket();
      const myId = socket?.userId;
      update({
        phase: winnerId === myId ? 'won' : 'lost',
        winnerId,
        winnerPath,
        loserPath,
      });
    };

    const onError = ({ message }) => update({ phase: 'error', error: message });

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

  const createMatch = useCallback((config) => {
    getSocket()?.emit(EVENTS.MATCH_CREATE, config);
  }, []);

  const joinMatch = useCallback((matchId) => {
    getSocket()?.emit(EVENTS.MATCH_JOIN, { matchId });
  }, []);

  const startRace = useCallback(() => {
    getSocket()?.emit(EVENTS.MATCH_START, { matchId: stateRef.current.matchId });
  }, []);

  const stepTo = useCallback((article) => {
    getSocket()?.emit(EVENTS.MATCH_STEP, { matchId: stateRef.current.matchId, article });
  }, []);

  const abandonMatch = useCallback(() => {
    getSocket()?.emit(EVENTS.MATCH_ABANDON, { matchId: stateRef.current.matchId });
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return { ...state, createMatch, joinMatch, startRace, stepTo, abandonMatch, reset };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/useMatch.test.js
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add hooks/useMatch.js __tests__/useMatch.test.js
git commit -m "feat: add useMatch hook for Socket.io race state"
```

---

## Task 6: Home Screen + Game Setup Screen

**Files:**
- Create: `client/app/(app)/_layout.jsx`
- Create: `client/app/(app)/index.jsx`
- Create: `client/app/(app)/setup.jsx`
- Create: `client/app/(app)/matchmaking.jsx`

- [ ] **Step 1: Write app/(app)/_layout.jsx**

```jsx
// client/app/(app)/_layout.jsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function AppLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2563eb' }}>
      <Tabs.Screen name="index"       options={{ title: 'Play',        tabBarIcon: ({ color }) => <Ionicons name="play-circle" size={24} color={color} /> }} />
      <Tabs.Screen name="leaderboard" options={{ title: 'Leaderboard', tabBarIcon: ({ color }) => <Ionicons name="trophy"      size={24} color={color} /> }} />
      <Tabs.Screen name="profile"     options={{ title: 'Profile',     tabBarIcon: ({ color }) => <Ionicons name="person"      size={24} color={color} /> }} />
      {/* Hidden from tab bar — navigated to programmatically */}
      <Tabs.Screen name="setup"       options={{ href: null }} />
      <Tabs.Screen name="matchmaking" options={{ href: null }} />
      <Tabs.Screen name="race"        options={{ href: null }} />
      <Tabs.Screen name="results"     options={{ href: null }} />
      <Tabs.Screen name="replay"      options={{ href: null }} />
    </Tabs>
  );
}
```

- [ ] **Step 2: Write app/(app)/index.jsx (Lobby)**

```jsx
// client/app/(app)/index.jsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';

export default function LobbyScreen() {
  const { user } = useAuth();
  const router   = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Hey, {user?.username} 👋</Text>
      <Text style={styles.subtitle}>Where will Wikipedia take you today?</Text>

      <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(app)/setup?mode=bot')}>
        <Text style={styles.primaryText}>Play vs Bot</Text>
        <Text style={styles.secondaryText}>Race the algorithm</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/(app)/setup?mode=pvp')}>
        <Text style={styles.primaryText}>Play vs Human</Text>
        <Text style={styles.secondaryText}>Create or join a match</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, padding: 24, backgroundColor: '#fff', justifyContent: 'center' },
  greeting:        { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subtitle:        { color: '#6b7280', marginBottom: 40, fontSize: 15 },
  primaryButton:   { backgroundColor: '#2563eb', borderRadius: 12, padding: 20, marginBottom: 16 },
  secondaryButton: { backgroundColor: '#1e3a5f', borderRadius: 12, padding: 20, marginBottom: 16 },
  primaryText:     { color: '#fff', fontSize: 18, fontWeight: '700' },
  secondaryText:   { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
});
```

- [ ] **Step 3: Write app/(app)/setup.jsx**

For PvP mode, the screen offers both "Create Match" (become the host and share the Match ID) and "Join Match" (enter an existing Match ID). This is required because the second player needs a way to join the first player's room.

```jsx
// client/app/(app)/setup.jsx
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Slider from '@react-native-community/slider';
import { useMatch } from '../../hooks/useMatch';

export default function SetupScreen() {
  const { mode } = useLocalSearchParams();
  const router   = useRouter();
  const { createMatch, joinMatch } = useMatch();

  const [difficulty,   setDifficulty]   = useState('medium');
  const [headStartSec, setHeadStartSec] = useState(60);
  // PvP-specific: 'create' or 'join'
  const [pvpAction, setPvpAction] = useState('create');
  const [joinId,    setJoinId]    = useState('');

  const DIFFICULTIES = ['easy', 'medium', 'hard'];

  const handleStart = () => {
    if (mode === 'pvp' && pvpAction === 'join') {
      if (!joinId.trim()) return Alert.alert('Enter a Match ID', 'Paste the Match ID shared by your opponent.');
      joinMatch(joinId.trim());
      router.push('/(app)/matchmaking');
      return;
    }
    createMatch({
      mode,
      difficulty: mode === 'bot' ? difficulty : undefined,
      headStartSec: mode === 'bot' ? headStartSec : 0,
    });
    router.push(mode === 'pvp' ? '/(app)/matchmaking' : '/(app)/race');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{mode === 'bot' ? 'vs Bot' : 'vs Human'}</Text>

      {mode === 'bot' && (
        <>
          <Text style={styles.sectionTitle}>Difficulty</Text>
          <View style={styles.diffRow}>
            {DIFFICULTIES.map(d => (
              <TouchableOpacity key={d} style={[styles.diffBtn, difficulty === d && styles.diffBtnActive]} onPress={() => setDifficulty(d)}>
                <Text style={[styles.diffText, difficulty === d && styles.diffTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.sectionTitle}>Head Start: {headStartSec}s</Text>
          <Slider minimumValue={30} maximumValue={120} step={15}
            value={headStartSec} onValueChange={setHeadStartSec}
            minimumTrackTintColor="#2563eb" style={styles.slider} />
        </>
      )}

      {mode === 'pvp' && (
        <>
          <View style={styles.diffRow}>
            {['create', 'join'].map(a => (
              <TouchableOpacity key={a} style={[styles.diffBtn, pvpAction === a && styles.diffBtnActive]} onPress={() => setPvpAction(a)}>
                <Text style={[styles.diffText, pvpAction === a && styles.diffTextActive]}>
                  {a === 'create' ? 'Create Match' : 'Join Match'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {pvpAction === 'join' && (
            <TextInput
              style={styles.input}
              placeholder="Paste Match ID"
              value={joinId}
              onChangeText={setJoinId}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
        </>
      )}

      <TouchableOpacity style={styles.startButton} onPress={handleStart}>
        <Text style={styles.startText}>
          {mode === 'pvp' && pvpAction === 'join' ? 'Join Race' : 'Start Race'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, padding: 24, backgroundColor: '#fff' },
  title:          { fontSize: 28, fontWeight: 'bold', marginBottom: 32 },
  sectionTitle:   { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 8 },
  diffRow:        { flexDirection: 'row', gap: 10, marginBottom: 24 },
  diffBtn:        { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center' },
  diffBtnActive:  { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  diffText:       { color: '#374151', fontWeight: '600' },
  diffTextActive: { color: '#fff' },
  slider:         { marginBottom: 32 },
  input:          { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 24, fontSize: 15 },
  startButton:    { backgroundColor: '#16a34a', borderRadius: 12, padding: 18, alignItems: 'center' },
  startText:      { color: '#fff', fontSize: 18, fontWeight: '700' },
});
```

- [ ] **Step 4: Write app/(app)/matchmaking.jsx (PvP waiting room)**

```jsx
// client/app/(app)/matchmaking.jsx
import { useEffect } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, Share, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useMatch } from '../../hooks/useMatch';

export default function MatchmakingScreen() {
  const { matchId, phase, abandonMatch } = useMatch();
  const router = useRouter();

  // Navigate to race when match starts
  useEffect(() => {
    if (phase === 'racing') router.replace('/(app)/race');
  }, [phase]);

  const shareMatchId = () => {
    Share.share({ message: `Join my WikiRace match! Match ID: ${matchId}` });
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563eb" style={styles.spinner} />
      <Text style={styles.title}>Waiting for opponent…</Text>
      {matchId && (
        <>
          <Text style={styles.label}>Share your Match ID</Text>
          <Text style={styles.matchId}>{matchId}</Text>
          <TouchableOpacity style={styles.shareButton} onPress={shareMatchId}>
            <Text style={styles.shareText}>Share Match ID</Text>
          </TouchableOpacity>
        </>
      )}
      <TouchableOpacity style={styles.cancelButton} onPress={() => { abandonMatch(); router.back(); }}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  spinner:     { marginBottom: 20 },
  title:       { fontSize: 22, fontWeight: '700', marginBottom: 24 },
  label:       { color: '#6b7280', fontSize: 13, marginBottom: 4 },
  matchId:     { fontSize: 16, fontFamily: 'monospace', color: '#1e40af', marginBottom: 16, letterSpacing: 1 },
  shareButton: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24, marginBottom: 12 },
  shareText:   { color: '#fff', fontWeight: '600' },
  cancelButton: { marginTop: 20 },
  cancelText:  { color: '#ef4444' },
});
```

- [ ] **Step 5: Install slider dependency**

```bash
npx expo install @react-native-community/slider
```

- [ ] **Step 6: Verify lobby + setup render in Expo Go**

Navigate to Play → "Play vs Bot" → Setup screen should show difficulty + head start slider.

- [ ] **Step 7: Commit**

```bash
git add app/(app)/
git commit -m "feat: add lobby, game setup, and PvP matchmaking screens"
```

---

## Task 7: Race Screen

**Files:**
- Create: `client/app/(app)/race.jsx`

The race screen shows the ArticleWebView and HUD. When the player taps a link, it fetches the new article from the backend and calls `stepTo()`.

- [ ] **Step 1: Write app/(app)/race.jsx**

```jsx
// client/app/(app)/race.jsx
import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { ArticleWebView } from '../../components/ArticleWebView';
import { HUD } from '../../components/HUD';
import { useMatch } from '../../hooks/useMatch';
import { fetchArticle } from '../../services/api';

export default function RaceScreen() {
  const router = useRouter();
  const {
    phase, matchId, mode, startArticle, targetArticle,
    currentArticle, mySteps, opponentSteps,
    startRace, stepTo, abandonMatch,
  } = useMatch();

  const [html, setHtml]         = useState('');
  const [loading, setLoading]   = useState(true);

  // Load initial article and signal race start
  useEffect(() => {
    if (!startArticle) return;
    loadArticle(startArticle);
    startRace();
  }, [startArticle]);

  // Navigate to results when race ends
  useEffect(() => {
    if (phase === 'won' || phase === 'lost') {
      router.replace('/(app)/results');
    }
  }, [phase]);

  // Block hardware back button during race
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert('Abandon Race', 'Are you sure you want to quit?', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Quit', style: 'destructive', onPress: () => { abandonMatch(); router.replace('/(app)/'); } },
      ]);
      return true;
    });
    return () => handler.remove();
  }, []);

  const loadArticle = useCallback(async (title) => {
    setLoading(true);
    try {
      const { html: articleHtml } = await fetchArticle(title, matchId);
      setHtml(articleHtml);
    } catch {
      Alert.alert('Error', 'Could not load article. Try tapping another link.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  const handleLinkTap = useCallback((article) => {
    stepTo(article);       // notify server
    loadArticle(article);  // load new article in WebView
  }, [stepTo, loadArticle]);

  return (
    <View style={styles.container}>
      <HUD
        currentArticle={currentArticle || startArticle}
        steps={mySteps}
        targetArticle={targetArticle}
        opponentSteps={opponentSteps}
        isBot={mode === 'bot'}
      />
      <ArticleWebView
        html={html}
        onLinkTap={handleLinkTap}
        style={loading ? styles.loading : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loading:   { opacity: 0.5 },
});
```

- [ ] **Step 2: Verify race screen renders with backend running**

Start backend: `cd server && node src/index.js`
Start client: `cd client && npx expo start`

Navigate: Play → vs Bot → Start Race → race screen should show article with tappable links and HUD.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/race.jsx
git commit -m "feat: add race screen with WebView and HUD"
```

---

## Task 8: Results + Replay Screens

**Files:**
- Create: `client/app/(app)/results.jsx`
- Create: `client/app/(app)/replay.jsx`

- [ ] **Step 1: Write app/(app)/results.jsx**

```jsx
// client/app/(app)/results.jsx
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { PathDisplay } from '../../components/PathDisplay';
import { useMatch } from '../../hooks/useMatch';
import { useAuth } from '../../hooks/useAuth';

export default function ResultsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { phase, winnerId, winnerPath, loserPath, targetArticle, reset } = useMatch();

  const didWin = phase === 'won';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.result, didWin ? styles.win : styles.lose]}>
        {didWin ? 'You Won!' : winnerId === 'bot' ? 'Bot Won' : 'Opponent Won'}
      </Text>
      <Text style={styles.target}>Target: {targetArticle}</Text>

      <PathDisplay
        path={didWin ? winnerPath : loserPath}
        label={didWin ? 'Your path' : (winnerId === 'bot' ? 'Your path' : 'Your path')}
        highlight={targetArticle}
      />
      <PathDisplay
        path={didWin ? loserPath : winnerPath}
        label={didWin ? (winnerId === 'bot' ? "Bot's path" : "Opponent's path") : (winnerId === 'bot' ? "Bot's winning path" : "Opponent's winning path")}
        highlight={targetArticle}
      />

      <TouchableOpacity style={styles.primaryButton} onPress={() => { reset(); router.replace('/(app)/'); }}>
        <Text style={styles.buttonText}>Play Again</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:     { padding: 24, backgroundColor: '#fff', flexGrow: 1 },
  result:        { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  win:           { color: '#16a34a' },
  lose:          { color: '#dc2626' },
  target:        { color: '#6b7280', textAlign: 'center', marginBottom: 24 },
  primaryButton: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  buttonText:    { color: '#fff', fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 2: Write app/(app)/replay.jsx**

```jsx
// client/app/(app)/replay.jsx
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PathDisplay } from '../../components/PathDisplay';

export default function ReplayScreen() {
  const { matchData } = useLocalSearchParams();
  const match = matchData ? JSON.parse(matchData) : null;
  const [step, setStep] = useState(0);

  if (!match) return <View style={styles.center}><Text>No match data</Text></View>;

  const human = match.participants?.find(p => p.user_id);
  const bot   = match.participants?.find(p => !p.user_id);
  const maxStep = Math.max(human?.path?.length || 0, bot?.path?.length || 0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Match Replay</Text>
      <Text style={styles.subtitle}>{match.start_article} → {match.target_article}</Text>

      <Text style={styles.stepLabel}>Step {step} of {maxStep}</Text>
      <View style={styles.stepControls}>
        <TouchableOpacity style={styles.stepBtn} onPress={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
          <Text style={styles.stepBtnText}>◀ Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.stepBtn} onPress={() => setStep(Math.min(maxStep, step + 1))} disabled={step === maxStep}>
          <Text style={styles.stepBtnText}>Next ▶</Text>
        </TouchableOpacity>
      </View>

      {human && (
        <View style={styles.pathSection}>
          <Text style={styles.playerLabel}>You (step {step}): {human.path[step - 1] || match.start_article}</Text>
          <PathDisplay path={human.path.slice(0, step)} label="Your path" highlight={human.path[step - 1]} />
        </View>
      )}
      {bot && (
        <View style={styles.pathSection}>
          <Text style={styles.playerLabel}>Bot (step {step}): {bot.path[step - 1] || match.start_article}</Text>
          <PathDisplay path={bot.path.slice(0, step)} label="Bot path" highlight={bot.path[step - 1]} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { padding: 24, backgroundColor: '#fff' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title:       { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  subtitle:    { color: '#6b7280', marginBottom: 20 },
  stepLabel:   { textAlign: 'center', color: '#374151', marginBottom: 8 },
  stepControls: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 20 },
  stepBtn:     { backgroundColor: '#e5e7eb', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20 },
  stepBtnText: { fontWeight: '600', color: '#374151' },
  pathSection: { marginBottom: 20 },
  playerLabel: { fontWeight: '600', fontSize: 14, color: '#1e40af', marginBottom: 4 },
});
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/results.jsx app/(app)/replay.jsx
git commit -m "feat: add results and replay screens"
```

---

## Task 9: Profile + Leaderboard Screens

**Files:**
- Create: `client/app/(app)/profile.jsx`
- Create: `client/app/(app)/leaderboard.jsx`

- [ ] **Step 1: Write app/(app)/profile.jsx**

```jsx
// client/app/(app)/profile.jsx
import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getMyProfile } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyProfile().then(setProfile).finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  const stats = profile?.stats;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.username}>{user?.username}</Text>
        <TouchableOpacity onPress={logout}><Text style={styles.logout}>Log out</Text></TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        {[['Wins', stats?.wins], ['Losses', stats?.losses], ['Avg Steps', stats?.avgSteps], ['Best', stats?.bestSteps]].map(([label, val]) => (
          <View key={label} style={styles.stat}>
            <Text style={styles.statValue}>{val ?? '–'}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Recent Matches</Text>
      <FlatList
        data={profile?.recentMatches || []}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.matchRow}
            onPress={() => router.push({ pathname: '/(app)/replay', params: { matchData: JSON.stringify(item) } })}
          >
            <Text style={[styles.matchResult, item.won ? styles.win : styles.lose]}>{item.won ? 'W' : 'L'}</Text>
            <View style={styles.matchInfo}>
              <Text style={styles.matchArticles} numberOfLines={1}>{item.start_article} → {item.target_article}</Text>
              <Text style={styles.matchMeta}>{item.mode} · {item.steps} steps</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No matches yet — go play!</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#fff' },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60 },
  username:      { fontSize: 24, fontWeight: 'bold' },
  logout:        { color: '#ef4444', fontWeight: '600' },
  statsRow:      { flexDirection: 'row', justifyContent: 'space-around', padding: 16, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  stat:          { alignItems: 'center' },
  statValue:     { fontSize: 22, fontWeight: 'bold', color: '#1e40af' },
  statLabel:     { fontSize: 12, color: '#6b7280' },
  sectionTitle:  { fontSize: 16, fontWeight: '700', padding: 16, paddingBottom: 8 },
  matchRow:      { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  matchResult:   { fontSize: 18, fontWeight: 'bold', width: 28 },
  win:           { color: '#16a34a' },
  lose:          { color: '#dc2626' },
  matchInfo:     { flex: 1 },
  matchArticles: { fontSize: 14, color: '#111' },
  matchMeta:     { fontSize: 12, color: '#9ca3af' },
  empty:         { textAlign: 'center', padding: 32, color: '#9ca3af' },
});
```

- [ ] **Step 2: Write app/(app)/leaderboard.jsx**

The leaderboard has two filter rows: sort tabs (Most Wins / Fewest Avg Steps / Fastest Time) and mode filters (All / vs Bot / PvP), matching the spec.

```jsx
// client/app/(app)/leaderboard.jsx
import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { getLeaderboard } from '../../services/api';

const SORT_OPTIONS = [
  { label: 'Most Wins',       value: 'wins' },
  { label: 'Fewest Steps',    value: 'avg_steps' },
  { label: 'Fastest Time',    value: 'fastest_win_secs' },
];

const MODE_OPTIONS = [
  { label: 'All',    value: undefined },
  { label: 'vs Bot', value: 'bot' },
  { label: 'PvP',    value: 'pvp' },
];

function StatValue({ sortBy, item }) {
  if (sortBy === 'avg_steps')        return <Text style={styles.statSub}>{item.avg_steps ?? '–'} avg steps</Text>;
  if (sortBy === 'fastest_win_secs') return <Text style={styles.statSub}>{item.fastest_win_secs ? `${Math.round(item.fastest_win_secs)}s` : '–'}</Text>;
  return null;
}

export default function LeaderboardScreen() {
  const [entries, setEntries] = useState([]);
  const [sortBy, setSortBy]   = useState('wins');
  const [mode, setMode]       = useState(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getLeaderboard({ mode, sortBy }).then(d => setEntries(d.leaderboard)).finally(() => setLoading(false));
  }, [mode, sortBy]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Leaderboard</Text>

      {/* Sort tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {SORT_OPTIONS.map(s => (
          <TouchableOpacity key={s.value} style={[styles.filter, sortBy === s.value && styles.filterActive]} onPress={() => setSortBy(s.value)}>
            <Text style={[styles.filterText, sortBy === s.value && styles.filterTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Mode filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {MODE_OPTIONS.map(m => (
          <TouchableOpacity key={m.label} style={[styles.filter, mode === m.value && styles.filterSecondaryActive]} onPress={() => setMode(m.value)}>
            <Text style={[styles.filterText, mode === m.value && styles.filterTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} /> : (
        <FlatList
          data={entries}
          keyExtractor={item => item.user_id}
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <Text style={styles.rank}>#{index + 1}</Text>
              <Text style={styles.username}>{item.username}</Text>
              <View style={styles.stats}>
                <Text style={styles.stat}>{item.wins}W</Text>
                <StatValue sortBy={sortBy} item={item} />
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No qualifying players yet (need 10+ matches)</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: '#fff', paddingTop: 60 },
  title:                  { fontSize: 24, fontWeight: 'bold', padding: 16, paddingBottom: 8 },
  filterRow:              { paddingBottom: 4 },
  filterContent:          { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  filter:                 { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#d1d5db', marginBottom: 6 },
  filterActive:           { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterSecondaryActive:  { backgroundColor: '#1e3a5f', borderColor: '#1e3a5f' },
  filterText:             { color: '#374151', fontSize: 13 },
  filterTextActive:       { color: '#fff' },
  row:                    { flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  rank:                   { width: 36, color: '#9ca3af', fontWeight: '700' },
  username:               { flex: 1, fontSize: 15, fontWeight: '600' },
  stats:                  { alignItems: 'flex-end' },
  stat:                   { fontWeight: '700', color: '#1e40af' },
  statSub:                { fontSize: 11, color: '#9ca3af' },
  empty:                  { textAlign: 'center', padding: 32, color: '#9ca3af' },
});
```

- [ ] **Step 3: Verify profile and leaderboard render in Expo Go**

```bash
npx expo start
```

Navigate to Profile tab — should show username and empty recent matches. Leaderboard tab shows filter buttons and empty state.

- [ ] **Step 4: Run all tests**

```bash
npx jest
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/(app)/profile.jsx app/(app)/leaderboard.jsx
git commit -m "feat: add profile and leaderboard screens — frontend complete"
```

---

## Done

The frontend is now complete. All screens are implemented and connected to the backend via REST and Socket.io.

**Full E2E test:** Start backend (`cd server && node src/index.js`), start client (`cd client && npx expo start`), register two accounts on two devices/simulators, play a bot race and a PvP race end-to-end.
