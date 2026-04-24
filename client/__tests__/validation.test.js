import { isEmailValid, isPasswordStrong, isNotEmpty, isMobileValid } from '../utils/validation';

// Email tests
test('valid email test', () => {
  expect(isEmailValid('test@gmail.com')).toBe(true);
});

test('invalid email test', () => {
  expect(isEmailValid('testgmail.com')).toBe(false);
});

test('email without domain is invalid', () => {
  expect(isEmailValid('test@')).toBe(false);
});

test('email without TLD is invalid (regex requires dot in domain)', () => {
  expect(isEmailValid('test@domain')).toBe(false);
});

// Password tests
test('strong password with 6+ chars', () => {
  expect(isPasswordStrong('secure123')).toBe(true);
});

test('weak password with less than 6 chars', () => {
  expect(isPasswordStrong('abc')).toBe(false);
});

// Empty field tests
test('non-empty value passes', () => {
  expect(isNotEmpty('hello')).toBe(true);
});

test('blank spaces are considered empty', () => {
  expect(isNotEmpty('   ')).toBe(false);
});

// Mobile number tests
test('valid 10-digit mobile number', () => {
  expect(isMobileValid('9876543210')).toBe(true);
});

test('invalid mobile with letters', () => {
  expect(isMobileValid('98765abc10')).toBe(false);
});

test('invalid mobile with less than 10 digits', () => {
  expect(isMobileValid('12345')).toBe(false);
});
