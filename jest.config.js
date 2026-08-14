module.exports = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/tests/setup.js',
  setupFiles: ['<rootDir>/tests/env.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  verbose: true,
  forceExit: false,
};
