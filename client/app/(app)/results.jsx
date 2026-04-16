// client/app/(app)/results.jsx
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { PathDisplay } from '../../components/PathDisplay';
import { useMatch } from '../../hooks/useMatch';

export default function ResultsScreen() {
  const router = useRouter();
  const { phase, winnerId, winnerPath, loserPath, targetArticle, reset } = useMatch();

  const didWin = phase === 'won';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.result, didWin ? styles.win : styles.lose]}>
        {didWin ? 'You Won!' : winnerId === 'bot' ? 'Bot Won' : 'Opponent Won'}
      </Text>
      <Text style={styles.target}>Target: {targetArticle}</Text>

      <PathDisplay
        path={didWin ? (winnerPath || []) : (loserPath || [])}
        label="Your path"
        highlight={targetArticle}
      />
      <PathDisplay
        path={didWin ? (loserPath || []) : (winnerPath || [])}
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
