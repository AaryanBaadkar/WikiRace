// client/app/(app)/_layout.jsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MatchProvider } from '../../hooks/useMatch';
import { useAuth } from '../../hooks/useAuth';

export default function AppLayout() {
  const { user } = useAuth();

  return (
    <MatchProvider key={user?.id || 'anon'}>
      <Tabs screenOptions={{ tabBarActiveTintColor: '#2563eb' }}>
        <Tabs.Screen name="index"       options={{ title: 'Play',        tabBarIcon: ({ color }) => <Ionicons name="play-circle" size={24} color={color} /> }} />
        <Tabs.Screen name="leaderboard" options={{ title: 'Leaderboard', tabBarIcon: ({ color }) => <Ionicons name="trophy"      size={24} color={color} /> }} />
        <Tabs.Screen name="profile"     options={{ title: 'Profile',     tabBarIcon: ({ color }) => <Ionicons name="person"      size={24} color={color} /> }} />
        <Tabs.Screen name="setup"       options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="matchmaking" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="race"        options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="results"     options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="replay"      options={{ href: null, headerShown: false }} />
      </Tabs>
    </MatchProvider>
  );
}
