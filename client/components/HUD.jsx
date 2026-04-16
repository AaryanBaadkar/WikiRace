// client/components/HUD.jsx
import { View, Text, StyleSheet } from 'react-native';

export function HUD({ currentArticle, steps, targetArticle, opponentSteps, isBot }) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.label}>You</Text>
          <Text style={styles.value}>{steps}</Text>
          <Text style={styles.sublabel}>steps</Text>
        </View>
        <View style={styles.target}>
          <Text style={styles.targetLabel}>Target</Text>
          <Text style={styles.targetArticle} numberOfLines={2}>{targetArticle}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.label}>{isBot ? 'Bot' : 'Rival'}</Text>
          <Text style={styles.value}>{opponentSteps ?? '–'}</Text>
          <Text style={styles.sublabel}>steps</Text>
        </View>
      </View>
      <Text style={styles.currentArticle} numberOfLines={1}>{currentArticle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { backgroundColor: '#1e3a5f', padding: 10 },
  row:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  stat:          { alignItems: 'center', minWidth: 60 },
  label:         { color: '#93c5fd', fontSize: 11, fontWeight: '600' },
  value:         { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  sublabel:      { color: '#93c5fd', fontSize: 10 },
  target:        { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  targetLabel:   { color: '#fbbf24', fontSize: 10, fontWeight: '600' },
  targetArticle: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  currentArticle:{ color: '#cbd5e1', fontSize: 12, textAlign: 'center' },
});
