// client/app/(app)/_layout.jsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function AppLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2563eb' }}>
      <Tabs.Screen name="index"       options={{ title: 'Play',        tabBarIcon: ({ color }) => <Ionicons name="play-circle" size={24} color={color} /> }} />
      <Tabs.Screen name="leaderboard" options={{ title: 'Leaderboard', tabBarIcon: ({ color }) => <Ionicons name="trophy"      size={24} color={color} /> }} />
      <Tabs.Screen name="profile"     options={{ title: 'Profile',     tabBarIcon: ({ color }) => <Ionicons name="person"      size={24} color={color} /> }} />
      <Tabs.Screen name="setup"       options={{ href: null }} />
      <Tabs.Screen name="matchmaking" options={{ href: null }} />
      <Tabs.Screen name="race"        options={{ href: null }} />
      <Tabs.Screen name="results"     options={{ href: null }} />
      <Tabs.Screen name="replay"      options={{ href: null }} />
    </Tabs>
  );
}
