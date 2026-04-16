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
  const [pvpAction,    setPvpAction]    = useState('create');
  const [joinId,       setJoinId]       = useState('');

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
