// client/app/(app)/index.jsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';

export default function LobbyScreen() {
  const { user } = useAuth();
  const router   = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Hey, {user?.username}</Text>
      <Text style={styles.subtitle}>Where will Wikipedia take you today?</Text>

      <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(app)/setup?mode=bot')}>
        <Text style={styles.primaryText}>Play vs Bot</Text>
        <Text style={styles.secondaryText}>Race the algorithm</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/(app)/setup?mode=pvp')}>
        <Text style={styles.primaryText}>Play vs Human</Text>
        <Text style={styles.secondaryText}>Create or join a match</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, padding: 24, backgroundColor: '#fff', justifyContent: 'center' },
  greeting:        { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subtitle:        { color: '#6b7280', marginBottom: 40, fontSize: 15 },
  primaryButton:   { backgroundColor: '#2563eb', borderRadius: 12, padding: 20, marginBottom: 16 },
  secondaryButton: { backgroundColor: '#1e3a5f', borderRadius: 12, padding: 20, marginBottom: 16 },
  primaryText:     { color: '#fff', fontSize: 18, fontWeight: '700' },
  secondaryText:   { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
});
