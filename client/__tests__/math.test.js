import { add, subtract, multiply, divide } from '../utils/math';

test('adds two numbers', () => {
  expect(add(5, 3)).toBe(8);
});

test('adds decimal numbers', () => {
  expect(add(0.1, 0.2)).toBeCloseTo(0.3);
});

test('subtracts two numbers', () => {
  expect(subtract(10, 4)).toBe(6);
});

test('multiplies two numbers', () => {
  expect(multiply(3, 4)).toBe(12);
});

test('divides two numbers', () => {
  expect(divide(10, 2)).toBe(5);
});

test('divide by zero returns error message', () => {
  expect(divide(5, 0)).toBe('Cannot divide by zero');
});
