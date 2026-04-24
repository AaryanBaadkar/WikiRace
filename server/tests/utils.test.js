const { hashPassword, verifyPassword } = require('../src/utils/password');
const { signAccess, signRefresh, verifyAccess, verifyRefresh } = require('../src/utils/jwt');

describe('password utils', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('secret123');
    expect(hash).not.toBe('secret123');
    expect(await verifyPassword('secret123', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});

describe('jwt utils', () => {
  it('signs and verifies an access token', () => {
    const token = signAccess({ userId: 'abc', username: 'alice' });
    const payload = verifyAccess(token);
    expect(payload.userId).toBe('abc');
    expect(payload.username).toBe('alice');
  });

  it('signs and verifies a refresh token', () => {
    const token = signRefresh({ userId: 'abc' });
    const payload = verifyRefresh(token);
    expect(payload.userId).toBe('abc');
  });

  it('throws on invalid access token', () => {
    expect(() => verifyAccess('bad.token.here')).toThrow();
  });
});
