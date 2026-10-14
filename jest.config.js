// Configuración de Jest
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  // Variables de entorno de prueba (antes de cargar la app en cada archivo)
  setupFiles: ['<rootDir>/tests/setup-env.js'],
  // Crea la base de datos de pruebas una sola vez antes de toda la suite
  globalSetup: '<rootDir>/tests/global-setup.js',
  testTimeout: 30000,
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  coverageReporters: ['text-summary', 'text', 'html'],
};
