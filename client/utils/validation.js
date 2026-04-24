// Email validation
export const isEmailValid = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Password validation
export const isPasswordStrong = (password) => {
  return password.length >= 6;
};

// Empty field validation
export const isNotEmpty = (value) => {
  return value.trim().length > 0;
};

// Mobile number validation
export const isMobileValid = (mobile) => {
  return /^[0-9]{10}$/.test(mobile);
};
