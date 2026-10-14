// Se ejecuta una vez antes de todas las pruebas: recrea prisma/test.db
// aplicando las mismas migraciones que usa la base de datos de desarrollo
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

module.exports = async () => {
  const databaseUrl = 'file:./test.db';
  const dbFile = path.join(__dirname, '..', 'prisma', 'test.db');

  // Protección: nunca borrar otra base de datos que no sea la de pruebas
  if (!dbFile.endsWith(path.join('prisma', 'test.db'))) {
    throw new Error('La base de datos de pruebas debe ser prisma/test.db');
  }

  for (const file of [dbFile, `${dbFile}-journal`]) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  execSync('npx prisma migrate deploy', {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'ignore',
  });
};
