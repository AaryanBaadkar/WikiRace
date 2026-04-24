import { renderHook, act } from '@testing-library/react-native';
import useCounter from '../hooks/useCounter';

test('custom hook starts at 0', () => {
  const { result } = renderHook(() => useCounter());
  expect(result.current.count).toBe(0);
});

test('custom hook increments', () => {
  const { result } = renderHook(() => useCounter());
  act(() => {
    result.current.increment();
  });
  expect(result.current.count).toBe(1);
});

test('custom hook increments multiple times', () => {
  const { result } = renderHook(() => useCounter());
  act(() => {
    result.current.increment();
    result.current.increment();
    result.current.increment();
  });
  expect(result.current.count).toBe(3);
});
