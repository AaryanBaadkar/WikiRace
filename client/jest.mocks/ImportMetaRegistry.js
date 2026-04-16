// Mock for expo/src/winter/ImportMetaRegistry
// Prevents "import outside test scope" error in Jest environment
module.exports = {
  ImportMetaRegistry: { url: null },
};
