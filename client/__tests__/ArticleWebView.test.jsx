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
      <ArticleWebView html="<p>Hello</p>" onLinkTap={jest.fn()} />
    );
    expect(getByTestId('article-webview')).toBeTruthy();
  });

  it('calls onLinkTap with article title when message received', () => {
    const onLinkTap = jest.fn();
    handleMessage({ nativeEvent: { data: JSON.stringify({ type: 'LINK_TAP', article: 'Paris' }) } }, onLinkTap);
    expect(onLinkTap).toHaveBeenCalledWith('Paris');
  });
});
