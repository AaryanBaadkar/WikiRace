// client/__tests__/PathDisplay.test.jsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { PathDisplay } from '../components/PathDisplay';

describe('PathDisplay', () => {
  it('renders each step in the path', () => {
    const { getByText } = render(
      <PathDisplay path={['Potato', 'Ireland', 'Barack Obama']} label="Your path" />
    );
    expect(getByText('Potato')).toBeTruthy();
    expect(getByText('Ireland')).toBeTruthy();
    expect(getByText('Barack Obama')).toBeTruthy();
    expect(getByText('Your path (3 steps)')).toBeTruthy();
  });
});
