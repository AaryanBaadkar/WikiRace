import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve('React Native')),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

test('store data', async () => {
  await AsyncStorage.setItem('course', 'React Native');
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('course', 'React Native');
});

test('retrieve data', async () => {
  const value = await AsyncStorage.getItem('course');
  expect(value).toBe('React Native');
});

test('remove data', async () => {
  await AsyncStorage.removeItem('course');
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith('course');
});

test('clear all storage', async () => {
  await AsyncStorage.clear();
  expect(AsyncStorage.clear).toHaveBeenCalled();
});
