// client/components/ArticleWebView.jsx
import { useRef, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

// Injected into every Wikipedia page to intercept link taps
const INJECTED_JS = `
(function() {
  // Hide Wikipedia chrome: header, footer, edit links, language links
  var css = document.createElement('style');
  css.textContent = [
    'header, .header-container, footer, .mw-footer, .pre-content,' +
    '.mw-editsection, .noprint, #mw-mf-page-left,' +
    '.last-modified-bar, .post-content, .mw-cite-backlink,' +
    '#page-actions, .minerva-footer, .menu,' +
    '.page-actions-menu { display: none !important; }',
    'a { color: #2563eb; }',
  ].join('\\n');
  document.head.appendChild(css);

  // Intercept link clicks
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';

    // Internal wiki link: /wiki/Article_Name
    if (href.startsWith('/wiki/') && !href.includes(':')) {
      e.preventDefault();
      e.stopPropagation();
      var title = decodeURIComponent(href.replace('/wiki/', '')).replace(/_/g, ' ');
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LINK_TAP', article: title }));
      return;
    }

    // Block all other navigation (external links, special pages)
    e.preventDefault();
    e.stopPropagation();
  }, true);
})();
true;
`;

function wikiUrl(title) {
  return 'https://en.m.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_'));
}

export function handleMessage(event, onLinkTap) {
  try {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === 'LINK_TAP' && data.article) {
      onLinkTap(data.article);
    }
  } catch { /* ignore malformed messages */ }
}

export function ArticleWebView({ title, onLinkTap, onError, style }) {
  const webViewRef = useRef(null);

  const onNavRequest = useCallback((req) => {
    const url = req.url || '';
    // Allow Wikipedia and Wikimedia domains (pages, CSS, JS, images)
    if (url.includes('wikipedia.org') || url.includes('wikimedia.org')) return true;
    if (url === 'about:blank') return true;
    // Block external navigation
    return false;
  }, []);

  if (!title) return null;

  return (
    <WebView
      ref={webViewRef}
      testID="article-webview"
      source={{ uri: wikiUrl(title) }}
      injectedJavaScript={INJECTED_JS}
      onMessage={(e) => handleMessage(e, onLinkTap)}
      onShouldStartLoadWithRequest={onNavRequest}
      onError={onError}
      onHttpError={onError}
      javaScriptEnabled
      showsVerticalScrollIndicator
      style={[styles.webview, style]}
    />
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: '#fff' },
});
