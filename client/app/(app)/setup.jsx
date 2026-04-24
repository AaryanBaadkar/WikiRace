// client/app/(app)/setup.jsx
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useMatch } from '../../hooks/useMatch';

const MODE_META = {
  bot:  { title: 'vs Bot',    icon: 'hardware-chip-outline', color: '#2563eb' },
  pvp:  { title: 'vs Human',  icon: 'people-outline',        color: '#1e3a5f' },
  solo: { title: 'Solo Run',  icon: 'timer-outline',         color: '#7c3aed' },
};

export default function SetupScreen() {
  const { mode }  = useLocalSearchParams();
  const router    = useRouter();
  const { createMatch, joinMatch, reset } = useMatch();

  const [difficulty,   setDifficulty]   = useState('medium');
  const [headStartSec, setHeadStartSec] = useState(60);
  const [pvpAction,    setPvpAction]    = useState('create');
  const [joinId,       setJoinId]       = useState('');

  const DIFFICULTIES = ['easy', 'medium', 'hard'];
  const meta = MODE_META[mode] || MODE_META.bot;

  const handleStart = () => {
    if (mode === 'pvp' && pvpAction === 'join') {
      if (!joinId.trim()) return Alert.alert('Enter a Match ID', 'Paste the Match ID shared by your opponent.');
      joinMatch(joinId.trim());
      router.push('/(app)/matchmaking');
      return;
    }
    // Reset previous match state, create new match, navigate immediately.
    // MatchProvider (context) persists across screens — race screen will
    // pick up match:ready as soon as the server responds.
    reset();
    createMatch({
      mode,
      difficulty: mode === 'bot' ? difficulty : undefined,
      headStartSec: mode === 'bot' ? headStartSec : 0,
    });
    router.push(mode === 'pvp' ? '/(app)/matchmaking' : '/(app)/race');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: meta.color + '33' }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={meta.color} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name={meta.icon} size={20} color={meta.color} style={{ marginRight: 6 }} />
          <Text style={[styles.headerTitle, { color: meta.color }]}>{meta.title}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.container}>
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

        {mode === 'solo' && (
          <Text style={styles.soloDesc}>
            Race from the start article to the target using only Wikipedia links. Your time starts the moment you begin.
          </Text>
        )}

        <TouchableOpacity style={[styles.startButton, { backgroundColor: meta.color }]} onPress={handleStart}>
          <Text style={styles.startText}>
            {mode === 'pvp' && pvpAction === 'join' ? 'Join Race' : 'Start Race'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:     { flex: 1, backgroundColor: '#fff' },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:      { width: 40, alignItems: 'flex-start' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 18, fontWeight: '700' },

  container:      { flex: 1, padding: 24 },
  sectionTitle:   { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 8 },
  diffRow:        { flexDirection: 'row', gap: 10, marginBottom: 24 },
  diffBtn:        { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center' },
  diffBtnActive:  { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  diffText:       { color: '#374151', fontWeight: '600' },
  diffTextActive: { color: '#fff' },
  slider:         { marginBottom: 32 },
  input:          { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 24, fontSize: 15 },
  soloDesc:       { fontSize: 15, color: '#6b7280', lineHeight: 22, marginBottom: 32 },
  startButton:    { borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 'auto' },
  startText:      { color: '#fff', fontSize: 18, fontWeight: '700' },
});
