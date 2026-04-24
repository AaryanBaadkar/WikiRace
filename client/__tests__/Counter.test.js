import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import Counter from '../components/Counter';

test('renders initial count of 0', () => {
  const { getByTestId } = render(<Counter />);
  expect(getByTestId('count').props.children[1]).toBe(0);
});

test('button click updates state', () => {
  const { getByText, getByTestId } = render(<Counter />);
  fireEvent.press(getByText('Increment'));
  expect(getByTestId('count').props.children[1]).toBe(1);
});

test('multiple button clicks increment correctly', () => {
  const { getByText, getByTestId } = render(<Counter />);
  fireEvent.press(getByText('Increment'));
  fireEvent.press(getByText('Increment'));
  fireEvent.press(getByText('Increment'));
  expect(getByTestId('count').props.children[1]).toBe(3);
});

test('two clicks gives count of 2', () => {
  const { getByText, getByTestId } = render(<Counter />);
  fireEvent.press(getByText('Increment'));
  fireEvent.press(getByText('Increment'));
  expect(getByTestId('count').props.children[1]).toBe(2);
});
