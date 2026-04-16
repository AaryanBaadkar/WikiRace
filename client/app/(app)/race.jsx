// client/app/(app)/race.jsx
import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { ArticleWebView } from '../../components/ArticleWebView';
import { HUD } from '../../components/HUD';
import { useMatch } from '../../hooks/useMatch';
import { fetchArticle } from '../../services/api';

export default function RaceScreen() {
  const router = useRouter();
  const {
    phase, matchId, mode, startArticle, targetArticle,
    currentArticle, mySteps, opponentSteps,
    startRace, stepTo, abandonMatch,
  } = useMatch();

  const [html,    setHtml]    = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!startArticle) return;
    loadArticle(startArticle);
    startRace();
  }, [startArticle]);

  useEffect(() => {
    if (phase === 'won' || phase === 'lost') {
      router.replace('/(app)/results');
    }
  }, [phase]);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert('Abandon Race', 'Are you sure you want to quit?', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Quit', style: 'destructive', onPress: () => { abandonMatch(); router.replace('/(app)/'); } },
      ]);
      return true;
    });
    return () => handler.remove();
  }, []);

  const loadArticle = useCallback(async (title) => {
    setLoading(true);
    try {
      const { html: articleHtml } = await fetchArticle(title, matchId);
      setHtml(articleHtml);
    } catch {
      Alert.alert('Error', 'Could not load article. Try tapping another link.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  const handleLinkTap = useCallback((article) => {
    stepTo(article);
    loadArticle(article);
  }, [stepTo, loadArticle]);

  return (
    <View style={styles.container}>
      <HUD
        currentArticle={currentArticle || startArticle}
        steps={mySteps}
        targetArticle={targetArticle}
        opponentSteps={opponentSteps}
        isBot={mode === 'bot'}
      />
      <ArticleWebView
        html={html}
        onLinkTap={handleLinkTap}
        style={loading ? styles.loading : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loading:   { opacity: 0.5 },
});
