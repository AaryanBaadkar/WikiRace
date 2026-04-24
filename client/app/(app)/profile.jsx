// client/app/(app)/profile.jsx
import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getMyProfile } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyProfile().then(setProfile).finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  const stats = profile?.stats;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.username}>{user?.username}</Text>
        <TouchableOpacity onPress={logout}><Text style={styles.logout}>Log out</Text></TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        {[['Wins', stats?.wins], ['Losses', stats?.losses], ['Avg Steps', stats?.avgSteps], ['Best', stats?.bestSteps]].map(([label, val]) => (
          <View key={label} style={styles.stat}>
            <Text style={styles.statValue}>{val ?? '–'}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Recent Matches</Text>
      <FlatList
        data={profile?.recentMatches || []}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.matchRow}
            onPress={() => router.push({ pathname: '/(app)/replay', params: { matchData: JSON.stringify(item) } })}
          >
            <Text style={[styles.matchResult, item.won ? styles.win : styles.lose]}>{item.won ? 'W' : 'L'}</Text>
            <View style={styles.matchInfo}>
              <Text style={styles.matchArticles} numberOfLines={1}>{item.start_article} → {item.target_article}</Text>
              <Text style={styles.matchMeta}>{item.mode} · {item.steps} steps</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No matches yet — go play!</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#fff' },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  username:      { fontSize: 24, fontWeight: 'bold' },
  logout:        { color: '#ef4444', fontWeight: '600' },
  statsRow:      { flexDirection: 'row', justifyContent: 'space-around', padding: 16, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  stat:          { alignItems: 'center' },
  statValue:     { fontSize: 22, fontWeight: 'bold', color: '#1e40af' },
  statLabel:     { fontSize: 12, color: '#6b7280' },
  sectionTitle:  { fontSize: 16, fontWeight: '700', padding: 16, paddingBottom: 8 },
  matchRow:      { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  matchResult:   { fontSize: 18, fontWeight: 'bold', width: 28 },
  win:           { color: '#16a34a' },
  lose:          { color: '#dc2626' },
  matchInfo:     { flex: 1 },
  matchArticles: { fontSize: 14, color: '#111' },
  matchMeta:     { fontSize: 12, color: '#9ca3af' },
  empty:         { textAlign: 'center', padding: 32, color: '#9ca3af' },
});
