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
