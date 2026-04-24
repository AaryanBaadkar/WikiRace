// client/__tests__/ArticleWebView.test.jsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { ArticleWebView, handleMessage } from '../components/ArticleWebView';

jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return {
    WebView: ({ testID }) => <View testID={testID || 'webview'} />,
  };
});

describe('ArticleWebView', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(
      <ArticleWebView title="Potato" onLinkTap={jest.fn()} />
    );
    expect(getByTestId('article-webview')).toBeTruthy();
  });

  it('returns null when no title', () => {
    const { toJSON } = render(
      <ArticleWebView title={null} onLinkTap={jest.fn()} />
    );
    expect(toJSON()).toBeNull();
  });

  it('calls onLinkTap with article title when message received', () => {
    const onLinkTap = jest.fn();
    handleMessage({ nativeEvent: { data: JSON.stringify({ type: 'LINK_TAP', article: 'Paris' }) } }, onLinkTap);
    expect(onLinkTap).toHaveBeenCalledWith('Paris');
  });
});
