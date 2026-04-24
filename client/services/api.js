// client/services/api.js
import axios from 'axios';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './storage';
import { connectSocket } from './socket';

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
        connectSocket(data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        await clearTokens();
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
export const getMatches      = ()       => api.get('/matches').then(r => r.data);
export const getMatch        = (id)     => api.get(`/matches/${id}`).then(r => r.data);
export const createMatchHttp = (body)   => api.post('/matches', body).then(r => r.data);
export const startBotRace    = (id)     => api.post(`/matches/${id}/start`).then(r => r.data);
export const submitStep      = (id, article) => api.post(`/matches/${id}/step`, { article }).then(r => r.data);
export const getRaceStatus   = (id)     => api.get(`/matches/${id}/status`).then(r => r.data);
export const abandonRace     = (id)     => api.post(`/matches/${id}/abandon`).then(r => r.data);

// Profile
export const getMyProfile   = ()   => api.get('/profile/me').then(r => r.data);
export const getUserProfile = (id) => api.get(`/profile/${id}`).then(r => r.data);

// Leaderboard
export const getLeaderboard = (params) => api.get('/leaderboard', { params }).then(r => r.data);

export default api;
