// client/app/(app)/leaderboard.jsx
import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { getLeaderboard } from '../../services/api';

const SORT_OPTIONS = [
  { label: 'Most Wins',    value: 'wins' },
  { label: 'Fewest Steps', value: 'avg_steps' },
  { label: 'Fastest',      value: 'fastest_win_secs' },
];

const MODE_OPTIONS = [
  { label: 'All',    value: undefined },
  { label: 'vs Bot', value: 'bot' },
  { label: 'PvP',    value: 'pvp' },
];

const MEDALS = ['🥇', '🥈', '🥉'];

function formatStat(sortBy, item) {
  if (sortBy === 'avg_steps')        return item.avg_steps ? `${item.avg_steps} steps avg` : null;
  if (sortBy === 'fastest_win_secs') return item.fastest_win_secs ? `${Math.round(item.fastest_win_secs)}s best` : null;
  return null;
}

function Initials({ name }) {
  const letters = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{letters}</Text>
    </View>
  );
}

export default function LeaderboardScreen() {
  const [entries, setEntries] = useState([]);
  const [sortBy,  setSortBy]  = useState('wins');
  const [mode,    setMode]    = useState(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getLeaderboard({ mode, sortBy })
      .then(d => setEntries(d.leaderboard || []))
      .finally(() => setLoading(false));
  }, [mode, sortBy]);

  return (
    <View style={styles.container}>
      {/* Title */}
      <View style={styles.titleRow}>
        <Text style={styles.titleEmoji}>🏆</Text>
        <Text style={styles.title}>Leaderboard</Text>
      </View>

      {/* Sort pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
        {SORT_OPTIONS.map(s => (
          <TouchableOpacity key={s.value} style={[styles.pill, sortBy === s.value && styles.pillActive]} onPress={() => setSortBy(s.value)}>
            <Text style={[styles.pillText, sortBy === s.value && styles.pillTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Mode pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
        {MODE_OPTIONS.map(m => (
          <TouchableOpacity key={m.label} style={[styles.pill, mode === m.value && styles.pillModeActive]} onPress={() => setMode(m.value)}>
            <Text style={[styles.pillText, mode === m.value && styles.pillTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color="#2563eb" />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => item.user_id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🏁</Text>
              <Text style={styles.emptyTitle}>No players yet</Text>
              <Text style={styles.emptySub}>Complete 10+ matches to appear here</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const isTop3  = index < 3;
            const stat    = formatStat(sortBy, item);
            return (
              <View style={[styles.card, isTop3 && styles.cardTop]}>
                <View style={styles.rankCol}>
                  {isTop3
                    ? <Text style={styles.medal}>{MEDALS[index]}</Text>
                    : <Text style={styles.rankNum}>#{index + 1}</Text>
                  }
                </View>
                <Initials name={item.username} />
                <View style={styles.info}>
                  <Text style={styles.username}>{item.username}</Text>
                  {stat && <Text style={styles.statSub}>{stat}</Text>}
                </View>
                <View style={[styles.winsBadge, isTop3 && styles.winsBadgeTop]}>
                  <Text style={[styles.winsNum, isTop3 && styles.winsNumTop]}>{item.wins}</Text>
                  <Text style={[styles.winsLabel, isTop3 && styles.winsLabelTop]}>wins</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f8fafc' },

  titleRow:       { flexDirection: 'row', alignItems: 'center', paddingTop: 16, paddingHorizontal: 20, paddingBottom: 16 },
  titleEmoji:     { fontSize: 28, marginRight: 10 },
  title:          { fontSize: 28, fontWeight: '800', color: '#111827' },

  pills:          { paddingHorizontal: 16, paddingBottom: 10, gap: 8, flexDirection: 'row' },
  pill:           { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  pillActive:     { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  pillModeActive: { backgroundColor: '#1e3a5f', borderColor: '#1e3a5f' },
  pillText:       { color: '#374151', fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: '#fff' },

  list:           { padding: 16, gap: 10 },

  card:           { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardTop:        { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },

  rankCol:        { width: 36, alignItems: 'center' },
  medal:          { fontSize: 22 },
  rankNum:        { fontSize: 14, fontWeight: '700', color: '#9ca3af' },

  avatar:         { width: 42, height: 42, borderRadius: 21, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 },
  avatarText:     { fontSize: 15, fontWeight: '700', color: '#1d4ed8' },

  info:           { flex: 1 },
  username:       { fontSize: 15, fontWeight: '700', color: '#111827' },
  statSub:        { fontSize: 12, color: '#6b7280', marginTop: 1 },

  winsBadge:      { alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12 },
  winsBadgeTop:   { backgroundColor: '#2563eb' },
  winsNum:        { fontSize: 18, fontWeight: '800', color: '#374151' },
  winsNumTop:     { color: '#fff' },
  winsLabel:      { fontSize: 10, color: '#9ca3af', fontWeight: '600' },
  winsLabelTop:   { color: '#bfdbfe' },

  emptyBox:       { alignItems: 'center', paddingTop: 60 },
  emptyEmoji:     { fontSize: 48, marginBottom: 12 },
  emptyTitle:     { fontSize: 18, fontWeight: '700', color: '#374151', marginBottom: 4 },
  emptySub:       { fontSize: 14, color: '#9ca3af' },
});
