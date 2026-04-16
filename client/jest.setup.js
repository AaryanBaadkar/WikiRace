// jest.setup.js - Fixes for Expo 54 "winter runtime" in Jest environment
jest.mock('expo/src/winter/ImportMetaRegistry', () => ({
  ImportMetaRegistry: { url: null },
}));
