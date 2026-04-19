// Dedicated script to synchronize the database schema.
// Run this as a one-off task (e.g., ECS RunTask) before deploying a new version.

const { Sequelize, DataTypes } = require('sequelize');

console.log('[DB-SYNC] Starting database synchronization script...');

// --- Database Connection ---
// All configuration from environment variables (12-Factor: Config).
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    dialectOptions: {
      ssl: process.env.DB_SSL === 'false' ? false : {
        require: true,
        rejectUnauthorized: false,
      },
    },
    logging: (msg) => console.log(`[DB-SYNC-SQL] ${msg}`),
  }
);

// --- Database Model (must match server.js) ---
const Note = sequelize.define('Note', {
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
});

// --- Run Synchronization and Exit ---
const syncDatabase = async () => {
  try {
    console.log('[DB-SYNC] Step 1: Authenticating with the database...');
    await sequelize.authenticate();
    console.log('[DB-SYNC] Step 1 SUCCESS: Authentication successful.');

    console.log('[DB-SYNC] Step 2: Synchronizing models...');
    await sequelize.sync({ alter: true });
    console.log('[DB-SYNC] Step 2 SUCCESS: Database synchronized successfully.');

    console.log('[DB-SYNC] Script finished successfully. Exiting.');
    process.exit(0);
  } catch (error) {
    console.error('[DB-SYNC] SCRIPT FAILED:', error);
    process.exit(1);
  }
};

syncDatabase();
