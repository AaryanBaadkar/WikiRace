// Addition
export const add = (a, b) => {
  return a + b;
};

// Subtraction
export const subtract = (a, b) => {
  return a - b;
};

// Multiplication
export const multiply = (a, b) => {
  return a * b;
};

// Division
export const divide = (a, b) => {
  if (b === 0) {
    return 'Cannot divide by zero';
  }
  return a / b;
};
