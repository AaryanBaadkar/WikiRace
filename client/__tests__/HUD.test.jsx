// client/__tests__/HUD.test.jsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { HUD } from '../components/HUD';

describe('HUD', () => {
  it('shows current article, step count, and target', () => {
    const { getByText } = render(
      <HUD currentArticle="Potato" steps={3} targetArticle="Barack Obama" opponentSteps={1} />
    );
    expect(getByText('Potato')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
    expect(getByText('Barack Obama')).toBeTruthy();
  });
});
