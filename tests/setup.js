const { execFileSync } = require('child_process');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_NAME = process.env.DB_NAME || 'operaon_reporting';
process.env.TEST_DB_NAME = process.env.TEST_DB_NAME || 'operaon_reporting_test';
process.env.DB_USER = process.env.DB_USER || 'dbadmin';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || '';
process.env.DB_SSL = process.env.DB_SSL || 'false';
process.env.JWT_ALGORITHM = 'HS256';
process.env.JWT_SECRET = 'reporting-test-jwt-secret-change-me-please';
process.env.JWT_ISSUER = 'operaon-identity';
process.env.JWT_AUDIENCE = 'operaon-reporting';
process.env.SERVICE_API_KEY = 'reporting-test-service-key';

const projectRoot = path.resolve(__dirname, '..');
const sequelizeCli = path.join(projectRoot, 'node_modules', '.bin', 'sequelize-cli');

module.exports = async function globalSetup() {
  const env = { ...process.env, NODE_ENV: 'test' };
  const run = (args) => execFileSync(sequelizeCli, args, {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
  });

  run(['db:drop', '--env', 'test']);
  run(['db:create', '--env', 'test']);
  run(['db:migrate', '--env', 'test']);
};

module.exports.teardown = async () => {};
