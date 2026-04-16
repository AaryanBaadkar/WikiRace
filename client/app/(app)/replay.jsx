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

  const human  = match.participants?.find(p => p.user_id);
  const bot    = match.participants?.find(p => !p.user_id);
  const maxStep = Math.max(human?.path?.length || 0, bot?.path?.length || 0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Match Replay</Text>
      <Text style={styles.subtitle}>{match.start_article} → {match.target_article}</Text>

      <Text style={styles.stepLabel}>Step {step} of {maxStep}</Text>
      <View style={styles.stepControls}>
        <TouchableOpacity style={styles.stepBtn} onPress={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
          <Text style={styles.stepBtnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.stepBtn} onPress={() => setStep(Math.min(maxStep, step + 1))} disabled={step === maxStep}>
          <Text style={styles.stepBtnText}>Next</Text>
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
  container:    { padding: 24, backgroundColor: '#fff' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title:        { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  subtitle:     { color: '#6b7280', marginBottom: 20 },
  stepLabel:    { textAlign: 'center', color: '#374151', marginBottom: 8 },
  stepControls: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 20 },
  stepBtn:      { backgroundColor: '#e5e7eb', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20 },
  stepBtnText:  { fontWeight: '600', color: '#374151' },
  pathSection:  { marginBottom: 20 },
  playerLabel:  { fontWeight: '600', fontSize: 14, color: '#1e40af', marginBottom: 4 },
});
