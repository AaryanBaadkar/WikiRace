// client/components/ArticleWebView.jsx
import { useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const INJECTED_JS = `
  (function() {
    document.addEventListener('click', function(e) {
      var el = e.target.closest('a[data-article]');
      if (!el) return;
      e.preventDefault();
      var article = el.getAttribute('data-article');
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LINK_TAP', article: article }));
    }, true);
  })();
  true;
`;

export function handleMessage(event, onLinkTap) {
  try {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === 'LINK_TAP' && data.article) {
      onLinkTap(data.article);
    }
  } catch { /* ignore malformed messages */ }
}

export function ArticleWebView({ html, onLinkTap, style }) {
  const webViewRef = useRef(null);

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, sans-serif; font-size: 16px; line-height: 1.6;
                 padding: 12px; color: #111; max-width: 100%; }
          a[data-article] { color: #2563eb; text-decoration: underline; }
          img { max-width: 100%; height: auto; }
          table { max-width: 100%; overflow-x: auto; display: block; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `;

  return (
    <WebView
      ref={webViewRef}
      testID="article-webview"
      originWhitelist={['*']}
      source={{ html: fullHtml }}
      injectedJavaScript={INJECTED_JS}
      onMessage={(e) => handleMessage(e, onLinkTap)}
      javaScriptEnabled
      style={[styles.webview, style]}
    />
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: '#fff' },
});
