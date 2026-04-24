// client/app/(app)/results.jsx
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMatch } from '../../hooks/useMatch';

function formatTime(sec) {
  if (!sec && sec !== 0) return '–';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function PathSteps({ path, label, color }) {
  if (!path || path.length === 0) return null;
  return (
    <View style={styles.pathBlock}>
      <Text style={[styles.pathLabel, { color }]}>{label}</Text>
      {path.map((article, i) => (
        <View key={i} style={styles.pathRow}>
          <View style={[styles.stepBadge, { backgroundColor: color + '22' }]}>
            <Text style={[styles.stepNum, { color }]}>{i + 1}</Text>
          </View>
          <Text style={styles.stepArticle} numberOfLines={1}>{article}</Text>
        </View>
      ))}
    </View>
  );
}

export default function ResultsScreen() {
  const router = useRouter();
  const {
    phase, winnerId, winnerPath, loserPath,
    startArticle, targetArticle,
    mySteps, myPath: soloPath, opponentSteps, mode,
    myTimeTakenSec, opponentTimeTakenSec, reset,
  } = useMatch();

  const isSolo    = mode === 'solo';
  const didWin    = phase === 'won';
  const isBotMatch = mode === 'bot';
  const opponentLabel = isBotMatch ? 'Bot' : 'Opponent';

  const myPath       = isSolo ? (soloPath || []) : didWin ? (winnerPath || []) : (loserPath || []);
  const opponentPath = didWin ? (loserPath  || []) : (winnerPath || []);

  const resultEmoji = isSolo ? '🏁' : didWin ? '🏆' : winnerId === 'bot' ? '🤖' : '😤';
  const resultText  = isSolo ? 'Finished!' : didWin ? 'You Won!' : winnerId === 'bot' ? 'Bot Won' : 'Opponent Won';
  const resultColor = isSolo ? '#7c3aed' : didWin ? '#16a34a' : '#dc2626';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

      {/* Result banner */}
      <View style={[styles.banner, { backgroundColor: resultColor }]}>
        <Text style={styles.bannerEmoji}>{resultEmoji}</Text>
        <Text style={styles.bannerText}>{resultText}</Text>
      </View>

      {/* Match info card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Match Summary</Text>

        <View style={styles.articleRow}>
          <View style={styles.articleBox}>
            <Text style={styles.articleLabel}>Start</Text>
            <Text style={styles.articleName} numberOfLines={2}>{startArticle}</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
          <View style={styles.articleBox}>
            <Text style={styles.articleLabel}>Target</Text>
            <Text style={[styles.articleName, styles.targetName]} numberOfLines={2}>{targetArticle}</Text>
          </View>
        </View>

        {isSolo ? (
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{mySteps || myPath.length}</Text>
              <Text style={styles.statLabel}>Steps</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatTime(myTimeTakenSec)}</Text>
              <Text style={styles.statLabel}>Time</Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{mySteps || myPath.length}</Text>
                <Text style={styles.statLabel}>Your steps</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{opponentSteps || opponentPath.length}</Text>
                <Text style={styles.statLabel}>{opponentLabel} steps</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{formatTime(didWin ? myTimeTakenSec : opponentTimeTakenSec)}</Text>
                <Text style={styles.statLabel}>{didWin ? 'Your time' : 'Winner time'}</Text>
              </View>
            </View>
            {mySteps > 0 && opponentPath.length > 0 && (
              <View style={[styles.verdict, { backgroundColor: didWin ? '#dcfce7' : '#fee2e2' }]}>
                <Text style={[styles.verdictText, { color: resultColor }]}>
                  {didWin
                    ? `You beat ${opponentLabel} by ${Math.abs((opponentSteps || opponentPath.length) - mySteps)} step${Math.abs((opponentSteps || opponentPath.length) - mySteps) !== 1 ? 's' : ''}`
                    : `${opponentLabel} beat you by ${Math.abs(mySteps - (opponentSteps || opponentPath.length))} step${Math.abs(mySteps - (opponentSteps || opponentPath.length)) !== 1 ? 's' : ''}`
                  }
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Paths */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Paths Taken</Text>
        <PathSteps path={myPath} label="Your path" color="#2563eb" />
        {!isSolo && <PathSteps path={opponentPath} label={`${opponentLabel}'s path`} color={isBotMatch ? '#7c3aed' : '#dc2626'} />}
      </View>

      {/* Actions */}
      <TouchableOpacity style={styles.primaryButton} onPress={() => { reset(); router.replace('/(app)/'); }}>
        <Text style={styles.primaryButtonText}>Play Again</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/(app)/profile')}>
        <Text style={styles.secondaryButtonText}>View Profile</Text>
      </TouchableOpacity>

    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { padding: 20, backgroundColor: '#f8fafc', paddingBottom: 40 },

  banner:             { borderRadius: 16, padding: 28, alignItems: 'center', marginBottom: 16 },
  bannerEmoji:        { fontSize: 52, marginBottom: 6 },
  bannerText:         { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  card:               { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 16,
                        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardTitle:          { fontSize: 13, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 },

  articleRow:         { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  articleBox:         { flex: 1 },
  articleLabel:       { fontSize: 11, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  articleName:        { fontSize: 15, fontWeight: '600', color: '#111827' },
  targetName:         { color: '#2563eb' },
  arrow:              { fontSize: 20, color: '#d1d5db', marginHorizontal: 10 },

  statsRow:           { flexDirection: 'row', alignItems: 'center' },
  stat:               { flex: 1, alignItems: 'center' },
  statValue:          { fontSize: 24, fontWeight: '800', color: '#111827' },
  statLabel:          { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  statDivider:        { width: 1, height: 36, backgroundColor: '#f3f4f6' },

  verdict:            { marginTop: 14, borderRadius: 8, padding: 10, alignItems: 'center' },
  verdictText:        { fontWeight: '700', fontSize: 14 },

  pathBlock:          { marginBottom: 16 },
  pathLabel:          { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  pathRow:            { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  stepBadge:          { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  stepNum:            { fontSize: 12, fontWeight: '700' },
  stepArticle:        { flex: 1, fontSize: 14, color: '#374151' },

  primaryButton:      { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  primaryButtonText:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton:    { borderRadius: 12, padding: 14, alignItems: 'center' },
  secondaryButtonText:{ color: '#6b7280', fontSize: 15 },
});
