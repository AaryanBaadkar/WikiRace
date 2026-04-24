const jwt = require('jsonwebtoken');
const { config } = require('../config');

const signAccess = (payload) => jwt.sign(payload, config.jwtSecret, { expiresIn: '15m' });
const signRefresh = (payload) => jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: '30d' });
const verifyAccess = (token) => jwt.verify(token, config.jwtSecret);
const verifyRefresh = (token) => jwt.verify(token, config.jwtRefreshSecret);

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh };
