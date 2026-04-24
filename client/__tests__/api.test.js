global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ name: 'Kirti' }),
  })
);

test('mock API call', async () => {
  const response = await fetch('https://dummyapi.com');
  const data = await response.json();
  expect(data.name).toBe('Kirti');
});

test('fetch is called with correct URL', async () => {
  await fetch('https://dummyapi.com');
  expect(global.fetch).toHaveBeenCalledWith('https://dummyapi.com');
});

test('mock API returns expected shape', async () => {
  const response = await fetch('https://dummyapi.com');
  const data = await response.json();
  expect(data).toHaveProperty('name');
  expect(typeof data.name).toBe('string');
});
