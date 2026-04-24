/**
 * Unit tests for API routes: POST /api/notes, GET /api/notes, DELETE /api/notes/:id
 *
 * Validates: Requirements 2.3, 2.4
 *
 * These tests mock the Sequelize Note model and Express request/response
 * objects to verify route handler logic in isolation.
 */

// Mock Sequelize before requiring server module
jest.mock('sequelize', () => {
  const mockDefine = jest.fn(() => ({
    findAll: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  }));

  const mockSequelize = jest.fn(() => ({
    define: mockDefine,
    authenticate: jest.fn().mockResolvedValue(),
    sync: jest.fn().mockResolvedValue(),
  }));

  mockSequelize.prototype.define = mockDefine;
  mockSequelize.prototype.authenticate = jest.fn().mockResolvedValue();
  mockSequelize.prototype.sync = jest.fn().mockResolvedValue();

  return {
    Sequelize: mockSequelize,
    DataTypes: {
      TEXT: 'TEXT',
      STRING: 'STRING',
      INTEGER: 'INTEGER',
    },
  };
});

// Mock express.listen to prevent the server from actually starting
jest.mock('express', () => {
  const mockApp = {
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
    listen: jest.fn(),
  };
  const express = jest.fn(() => mockApp);
  express.json = jest.fn(() => 'json-middleware');
  express.static = jest.fn(() => 'static-middleware');
  express._mockApp = mockApp;
  return express;
});

// Helper to create mock request/response objects
function createMockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res;
}

function createMockReq(overrides = {}) {
  return {
    body: {},
    params: {},
    ...overrides,
  };
}

describe('API Routes', () => {
  let app;
  let Note;
  let getHandler, postHandler, deleteHandler;

  beforeAll(() => {
    // Require express to get the mock app
    const express = require('express');
    app = express._mockApp;

    // Require server.js — this registers routes on the mock app
    require('../server');

    // Extract the registered route handlers from mock calls
    // app.get is called for: /api/notes, /, /health
    const getCalls = app.get.mock.calls;
    const getNotesCall = getCalls.find((call) => call[0] === '/api/notes');
    getHandler = getNotesCall[1];

    // app.post is called for: /api/notes
    const postCalls = app.post.mock.calls;
    const postNotesCall = postCalls.find((call) => call[0] === '/api/notes');
    postHandler = postNotesCall[1];

    // app.delete is called for: /api/notes/:id
    const deleteCalls = app.delete.mock.calls;
    const deleteNotesCall = deleteCalls.find(
      (call) => call[0] === '/api/notes/:id'
    );
    deleteHandler = deleteNotesCall[1];

    // Get the Note model from the Sequelize mock
    const { Sequelize } = require('sequelize');
    // The Note model is created via sequelize.define — grab it from the mock
    const mockSequelizeInstance = Sequelize.mock.results[0].value;
    Note = mockSequelizeInstance.define.mock.results[0].value;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- GET /api/notes ---
  describe('GET /api/notes', () => {
    test('returns all notes ordered by createdAt DESC', async () => {
      const mockNotes = [
        { id: 2, content: 'Second note', createdAt: '2024-01-02' },
        { id: 1, content: 'First note', createdAt: '2024-01-01' },
      ];
      Note.findAll.mockResolvedValue(mockNotes);

      const req = createMockReq();
      const res = createMockRes();

      await getHandler(req, res);

      expect(Note.findAll).toHaveBeenCalledWith({
        order: [['createdAt', 'DESC']],
      });
      expect(res.json).toHaveBeenCalledWith(mockNotes);
    });

    test('returns empty array when no notes exist', async () => {
      Note.findAll.mockResolvedValue([]);

      const req = createMockReq();
      const res = createMockRes();

      await getHandler(req, res);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    test('returns 500 when database query fails', async () => {
      Note.findAll.mockRejectedValue(new Error('DB error'));

      const req = createMockReq();
      const res = createMockRes();

      await getHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to retrieve notes',
      });
    });
  });

  // --- POST /api/notes ---
  describe('POST /api/notes', () => {
    test('creates a note and returns 201', async () => {
      const newNote = { id: 1, content: 'Test note' };
      Note.create.mockResolvedValue(newNote);

      const req = createMockReq({ body: { content: 'Test note' } });
      const res = createMockRes();

      await postHandler(req, res);

      expect(Note.create).toHaveBeenCalledWith({ content: 'Test note' });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(newNote);
    });

    test('returns 400 when content is empty string', async () => {
      const req = createMockReq({ body: { content: '' } });
      const res = createMockRes();

      await postHandler(req, res);

      expect(Note.create).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Note content cannot be empty.',
      });
    });

    test('returns 400 when content is whitespace only', async () => {
      const req = createMockReq({ body: { content: '   ' } });
      const res = createMockRes();

      await postHandler(req, res);

      expect(Note.create).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns 400 when content is missing', async () => {
      const req = createMockReq({ body: {} });
      const res = createMockRes();

      await postHandler(req, res);

      expect(Note.create).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns 500 when database create fails', async () => {
      Note.create.mockRejectedValue(new Error('DB error'));

      const req = createMockReq({ body: { content: 'Test note' } });
      const res = createMockRes();

      await postHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to create note',
      });
    });
  });

  // --- DELETE /api/notes/:id ---
  describe('DELETE /api/notes/:id', () => {
    test('deletes a note and returns 204', async () => {
      Note.destroy.mockResolvedValue(1);

      const req = createMockReq({ params: { id: '1' } });
      const res = createMockRes();

      await deleteHandler(req, res);

      expect(Note.destroy).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    test('returns 404 when note does not exist', async () => {
      Note.destroy.mockResolvedValue(0);

      const req = createMockReq({ params: { id: '999' } });
      const res = createMockRes();

      await deleteHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Note not found' });
    });

    test('returns 500 when database delete fails', async () => {
      Note.destroy.mockRejectedValue(new Error('DB error'));

      const req = createMockReq({ params: { id: '1' } });
      const res = createMockRes();

      await deleteHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to delete note',
      });
    });
  });
});
