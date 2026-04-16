// client/app/(app)/leaderboard.jsx
import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { getLeaderboard } from '../../services/api';

const SORT_OPTIONS = [
  { label: 'Most Wins',    value: 'wins' },
  { label: 'Fewest Steps', value: 'avg_steps' },
  { label: 'Fastest Time', value: 'fastest_win_secs' },
];

const MODE_OPTIONS = [
  { label: 'All',    value: undefined },
  { label: 'vs Bot', value: 'bot' },
  { label: 'PvP',    value: 'pvp' },
];

function StatValue({ sortBy, item }) {
  if (sortBy === 'avg_steps')        return <Text style={styles.statSub}>{item.avg_steps ?? '–'} avg steps</Text>;
  if (sortBy === 'fastest_win_secs') return <Text style={styles.statSub}>{item.fastest_win_secs ? `${Math.round(item.fastest_win_secs)}s` : '–'}</Text>;
  return null;
}

export default function LeaderboardScreen() {
  const [entries, setEntries] = useState([]);
  const [sortBy,  setSortBy]  = useState('wins');
  const [mode,    setMode]    = useState(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getLeaderboard({ mode, sortBy }).then(d => setEntries(d.leaderboard || [])).finally(() => setLoading(false));
  }, [mode, sortBy]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Leaderboard</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {SORT_OPTIONS.map(s => (
          <TouchableOpacity key={s.value} style={[styles.filter, sortBy === s.value && styles.filterActive]} onPress={() => setSortBy(s.value)}>
            <Text style={[styles.filterText, sortBy === s.value && styles.filterTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {MODE_OPTIONS.map(m => (
          <TouchableOpacity key={m.label} style={[styles.filter, mode === m.value && styles.filterSecondaryActive]} onPress={() => setMode(m.value)}>
            <Text style={[styles.filterText, mode === m.value && styles.filterTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} /> : (
        <FlatList
          data={entries}
          keyExtractor={item => item.user_id}
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <Text style={styles.rank}>#{index + 1}</Text>
              <Text style={styles.username}>{item.username}</Text>
              <View style={styles.stats}>
                <Text style={styles.stat}>{item.wins}W</Text>
                <StatValue sortBy={sortBy} item={item} />
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No qualifying players yet (need 10+ matches)</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:             { flex: 1, backgroundColor: '#fff', paddingTop: 60 },
  title:                 { fontSize: 24, fontWeight: 'bold', padding: 16, paddingBottom: 8 },
  filterRow:             { paddingBottom: 4 },
  filterContent:         { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  filter:                { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#d1d5db', marginBottom: 6 },
  filterActive:          { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterSecondaryActive: { backgroundColor: '#1e3a5f', borderColor: '#1e3a5f' },
  filterText:            { color: '#374151', fontSize: 13 },
  filterTextActive:      { color: '#fff' },
  row:                   { flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  rank:                  { width: 36, color: '#9ca3af', fontWeight: '700' },
  username:              { flex: 1, fontSize: 15, fontWeight: '600' },
  stats:                 { alignItems: 'flex-end' },
  stat:                  { fontWeight: '700', color: '#1e40af' },
  statSub:               { fontSize: 11, color: '#9ca3af' },
  empty:                 { textAlign: 'center', padding: 32, color: '#9ca3af' },
});
