// client/components/PathDisplay.jsx
import { View, Text, ScrollView, StyleSheet } from 'react-native';

export function PathDisplay({ path, label, highlight }) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label} ({path.length} steps)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {path.map((article, index) => (
          <View key={index} style={styles.stepRow}>
            <View style={[styles.dot, article === highlight && styles.dotHighlight]} />
            <Text style={[styles.step, article === highlight && styles.stepHighlight]}>
              {article}
            </Text>
            {index < path.length - 1 && <Text style={styles.arrow}>→</Text>}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { marginVertical: 8 },
  label:        { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  stepRow:      { flexDirection: 'row', alignItems: 'center', marginRight: 4 },
  dot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: '#93c5fd', marginRight: 4 },
  dotHighlight: { backgroundColor: '#16a34a' },
  step:         { fontSize: 13, color: '#1e40af', marginRight: 4 },
  stepHighlight:{ color: '#16a34a', fontWeight: '700' },
  arrow:        { color: '#9ca3af', marginRight: 4, fontSize: 13 },
});
