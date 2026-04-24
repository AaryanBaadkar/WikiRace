// client/app/(app)/matchmaking.jsx
import { useEffect } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMatch } from '../../hooks/useMatch';

export default function MatchmakingScreen() {
  const { matchId, phase, abandonMatch } = useMatch();
  const router = useRouter();

  useEffect(() => {
    if (phase === 'racing') router.replace('/(app)/race');
  }, [phase]);

  const shareMatchId = () => {
    Share.share({ message: `Join my WikiRace match! Match ID: ${matchId}` });
  };

  return (
    <SafeAreaView style={styles.container}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  spinner:      { marginBottom: 20 },
  title:        { fontSize: 22, fontWeight: '700', marginBottom: 24 },
  label:        { color: '#6b7280', fontSize: 13, marginBottom: 4 },
  matchId:      { fontSize: 16, fontFamily: 'monospace', color: '#1e40af', marginBottom: 16, letterSpacing: 1 },
  shareButton:  { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24, marginBottom: 12 },
  shareText:    { color: '#fff', fontWeight: '600' },
  cancelButton: { marginTop: 20 },
  cancelText:   { color: '#ef4444' },
});
