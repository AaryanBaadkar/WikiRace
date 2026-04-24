// client/app/(app)/race.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, BackHandler, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArticleWebView } from '../../components/ArticleWebView';
import { HUD } from '../../components/HUD';
import { useMatch } from '../../hooks/useMatch';

export default function RaceScreen() {
  const router = useRouter();
  const {
    phase, matchId, mode, startArticle, targetArticle,
    currentArticle, mySteps, opponentSteps, botStartsIn,
    startRace, stepTo, abandonMatch,
  } = useMatch();

  const [displayTitle, setDisplayTitle] = useState(null);
  const [elapsedSec,   setElapsedSec]   = useState(0);
  const [webViewError, setWebViewError] = useState(false);
  const timerRef  = useRef(null);
  const startedRef = useRef(null); // track which matchId we already started

  // When startArticle becomes available (match:ready received), show it and start race
  useEffect(() => {
    if (!startArticle || !matchId) return;
    // Prevent double-start if this matchId was already started
    if (startedRef.current === matchId) return;
    startedRef.current = matchId;

    setDisplayTitle(startArticle);
    setElapsedSec(0);
    setWebViewError(false);
    clearInterval(timerRef.current);
    startRace();
  }, [startArticle, matchId, startRace]);

  // Stopwatch for solo mode
  useEffect(() => {
    if (mode === 'solo' && phase === 'racing') {
      timerRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [mode, phase]);

  // Navigate to results when match ends
  useEffect(() => {
    if (phase === 'won' || phase === 'lost') {
      clearInterval(timerRef.current);
      startedRef.current = null;
      router.replace('/(app)/results');
    }
  }, [phase]);

  // Android back button
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert('Abandon Race', 'Are you sure you want to quit?', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Quit', style: 'destructive', onPress: () => {
          startedRef.current = null;
          abandonMatch();
          router.replace('/(app)/');
        }},
      ]);
      return true;
    });
    return () => handler.remove();
  }, [abandonMatch, router]);

  const handleLinkTap = useCallback((article) => {
    if (phase === 'finished') return;
    stepTo(article);
    setDisplayTitle(article);
    setWebViewError(false);
  }, [phase, stepTo]);

  // Error state
  if (phase === 'error') {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['top', 'bottom']}>
        <Text style={styles.errorTitle}>Connection error</Text>
        <Text style={styles.errorSub}>Could not start the match. Check your connection and try again.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.replace('/(app)/')}>
          <Text style={styles.retryText}>Back to lobby</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Waiting for match:ready from server
  if (!displayTitle) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Setting up race…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HUD
        currentArticle={currentArticle || startArticle}
        steps={mySteps}
        targetArticle={targetArticle}
        opponentSteps={opponentSteps}
        isBot={mode === 'bot'}
        isSolo={mode === 'solo'}
        elapsedSec={elapsedSec}
        botStartsIn={botStartsIn}
      />
      {webViewError ? (
        <View style={[styles.webViewFallback, styles.center]}>
          <Text style={styles.errorTitle}>Failed to load article</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => {
            setWebViewError(false);
            setDisplayTitle(prev => prev); // force re-render
          }}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ArticleWebView
          title={displayTitle}
          onLinkTap={handleLinkTap}
          onError={() => setWebViewError(true)}
        />
      )}
      {phase === 'finished' && mode === 'bot' && (
        <View style={styles.finishedOverlay}>
          <Text style={styles.finishedEmoji}>🎯</Text>
          <Text style={styles.finishedTitle}>You made it!</Text>
          <Text style={styles.finishedSub}>Waiting for result…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#1e3a5f' },
  center:          { alignItems: 'center', justifyContent: 'center' },
  loadingText:     { color: '#93c5fd', marginTop: 12, fontSize: 14 },
  errorTitle:      { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errorSub:        { color: '#93c5fd', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn:        { marginTop: 20, backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
  retryText:       { color: '#fff', fontWeight: '600' },
  webViewFallback: { flex: 1, backgroundColor: '#fff' },
  finishedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(22, 163, 74, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishedEmoji:   { fontSize: 64, marginBottom: 12 },
  finishedTitle:   { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 6 },
  finishedSub:     { fontSize: 16, color: '#dcfce7', fontWeight: '500' },
});
