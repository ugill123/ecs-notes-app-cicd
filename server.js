// A simple note-taking application backend using Express and Sequelize.

const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

console.log('[SERVER] Application starting...');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from /public

// --- Database Connection ---
// All configuration is pulled from environment variables (12-Factor: Config).
// No fallback to SQLite — in Docker/ECS, always connect to an external PostgreSQL instance.
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
    logging: false,
  }
);

// --- Database Model ---
const Note = sequelize.define('Note', {
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
});

// --- API Routes ---
app.get('/api/notes', async (req, res) => {
  try {
    const notes = await Note.findAll({ order: [['createdAt', 'DESC']] });
    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to retrieve notes' });
  }
});

app.post('/api/notes', async (req, res) => {
  try {
    if (!req.body.content || req.body.content.trim() === '') {
      return res.status(400).json({ error: 'Note content cannot be empty.' });
    }
    const newNote = await Note.create({ content: req.body.content });
    res.status(201).json(newNote);
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

app.delete('/api/notes/:id', async (req, res) => {
  try {
    const noteId = req.params.id;
    const result = await Note.destroy({ where: { id: noteId } });
    if (result === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// --- Serve Frontend ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Health Check (useful for ECS/ALB target group health checks) ---
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// --- Start Server ---
const startServer = async () => {
  try {
    console.log('[SERVER] Authenticating database connection...');
    await sequelize.authenticate();
    console.log('[SERVER] Database connection established successfully.');

    await sequelize.sync();
    console.log('[SERVER] All models synchronized successfully.');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[SERVER] Server is listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('[SERVER] CRITICAL: Unable to connect to the database or start server:', error);
    process.exit(1);
  }
};

startServer();
