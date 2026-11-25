const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { DatabaseSync } = require('node:sqlite');
const env = require('./env');
const logger = require('../utils/logger');
const {
  UserModel,
  LeadModel,
  CallModel,
  AppointmentModel,
  KnowledgeModel,
} = require('../models/mongooseModels');

function newId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

function normalizeDoc(doc) {
  if (!doc) return null;
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const id = String(plain._id || plain.id);
  return { ...plain, id, _id: id };
}

class SqliteRepository {
  constructor(dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.sqlite = new DatabaseSync(dbPath);
    this.sqlite.exec('PRAGMA journal_mode = WAL;');
    this.initSchema();
  }

  initSchema() {
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'agent',
        company TEXT DEFAULT 'Horizon Crest Realty',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT DEFAULT '',
        email TEXT DEFAULT '',
        preferredLocation TEXT DEFAULT '',
        budget REAL DEFAULT 0,
        budgetLabel TEXT DEFAULT '',
        propertyType TEXT DEFAULT '',
        purchaseTimeline TEXT DEFAULT '',
        leadScore INTEGER DEFAULT 0,
        scoreBreakdown TEXT DEFAULT '{}',
        qualificationStatus TEXT DEFAULT 'New',
        qualified INTEGER DEFAULT 0,
        sentiment TEXT DEFAULT 'Neutral',
        intent TEXT DEFAULT 'Medium',
        source TEXT DEFAULT 'AI Voice Agent',
        industry TEXT DEFAULT 'real-estate',
        followUpDate TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        lastCallId TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS calls (
        id TEXT PRIMARY KEY,
        callerName TEXT DEFAULT 'Prospect Visitor',
        callerPhone TEXT DEFAULT '',
        leadId TEXT DEFAULT '',
        language TEXT DEFAULT 'en',
        industry TEXT DEFAULT 'real-estate',
        mode TEXT DEFAULT 'demo',
        status TEXT DEFAULT 'Active',
        startedAt TEXT NOT NULL,
        endedAt TEXT DEFAULT '',
        durationSeconds INTEGER DEFAULT 0,
        transcript TEXT DEFAULT '[]',
        extractedInfo TEXT DEFAULT '{}',
        sentiment TEXT DEFAULT 'Neutral',
        intent TEXT DEFAULT 'Medium',
        leadScore INTEGER DEFAULT 0,
        qualified INTEGER DEFAULT 0,
        summary TEXT DEFAULT '',
        recommendedNextAction TEXT DEFAULT '',
        appointmentBookedId TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        leadId TEXT DEFAULT '',
        customerName TEXT NOT NULL,
        customerPhone TEXT DEFAULT '',
        customerEmail TEXT DEFAULT '',
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        purpose TEXT NOT NULL,
        location TEXT DEFAULT 'Horizon Crest Experience Center',
        status TEXT DEFAULT 'Scheduled',
        source TEXT DEFAULT 'CRM',
        callId TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS knowledge_docs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT DEFAULT 'General',
        industry TEXT DEFAULT 'real-estate',
        sourceType TEXT DEFAULT 'text',
        fileName TEXT DEFAULT '',
        fileSize INTEGER DEFAULT 0,
        content TEXT NOT NULL,
        chunks TEXT DEFAULT '[]',
        chunkCount INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
      CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
      CREATE INDEX IF NOT EXISTS idx_leads_qualified ON leads(qualified);
      CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
      CREATE INDEX IF NOT EXISTS idx_appointments_date_time ON appointments(date, time);
    `);
  }

  parseLeadRow(row) {
    if (!row) return null;
    return {
      ...row,
      _id: row.id,
      qualified: Boolean(row.qualified),
      scoreBreakdown: JSON.parse(row.scoreBreakdown || '{}'),
    };
  }

  parseCallRow(row) {
    if (!row) return null;
    return {
      ...row,
      _id: row.id,
      qualified: Boolean(row.qualified),
      transcript: JSON.parse(row.transcript || '[]'),
      extractedInfo: JSON.parse(row.extractedInfo || '{}'),
    };
  }

  parseKnowledgeRow(row) {
    if (!row) return null;
    return {
      ...row,
      _id: row.id,
      chunks: JSON.parse(row.chunks || '[]'),
    };
  }

  get users() {
    const sqlite = this.sqlite;
    return {
      async findByEmail(email) {
        const row = sqlite.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email);
        return row ? { ...row, _id: row.id } : null;
      },
      async findById(id) {
        const row = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(id);
        return row ? { ...row, _id: row.id } : null;
      },
      async create(data) {
        const now = new Date().toISOString();
        const id = newId();
        sqlite
          .prepare(
            'INSERT INTO users (id, name, email, passwordHash, role, company, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          )
          .run(
            id,
            data.name,
            data.email.toLowerCase(),
            data.passwordHash,
            data.role || 'agent',
            data.company || env.companyName,
            now,
            now
          );
        return this.findById(id);
      },
      async count() {
        return sqlite.prepare('SELECT COUNT(*) as c FROM users').get().c;
      },
    };
  }

  get leads() {
    const sqlite = this.sqlite;
    const parseLeadRow = this.parseLeadRow.bind(this);
    return {
      async findAll(filter = {}) {
        const rows = sqlite.prepare('SELECT * FROM leads ORDER BY datetime(createdAt) DESC').all();
        let items = rows.map(parseLeadRow);
        if (filter.search) {
          const q = filter.search.toLowerCase();
          items = items.filter(
            (l) =>
              (l.name && l.name.toLowerCase().includes(q)) ||
              (l.phone && l.phone.toLowerCase().includes(q)) ||
              (l.email && l.email.toLowerCase().includes(q)) ||
              (l.preferredLocation && l.preferredLocation.toLowerCase().includes(q)) ||
              (l.propertyType && l.propertyType.toLowerCase().includes(q))
          );
        }
        if (filter.qualified !== undefined && filter.qualified !== '' && filter.qualified !== 'all') {
          const want = filter.qualified === true || filter.qualified === 'true';
          items = items.filter((l) => l.qualified === want);
        }
        if (filter.status && filter.status !== 'all') {
          items = items.filter((l) => l.qualificationStatus === filter.status);
        }
        if (filter.sentiment && filter.sentiment !== 'all') {
          items = items.filter((l) => l.sentiment === filter.sentiment);
        }
        return items;
      },
      async findById(id) {
        const row = sqlite.prepare('SELECT * FROM leads WHERE id = ?').get(id);
        return parseLeadRow(row);
      },
      async findDuplicate({ phone, email, excludeId }) {
        const normPhone = normalizePhone(phone);
        const normEmail = String(email || '').trim().toLowerCase();
        const rows = sqlite.prepare('SELECT * FROM leads').all().map(parseLeadRow);
        return (
          rows.find((l) => {
            if (excludeId && l.id === excludeId) return false;
            const phoneMatch = normPhone && normPhone.length >= 7 && normalizePhone(l.phone) === normPhone;
            const emailMatch = normEmail && l.email && l.email.toLowerCase() === normEmail;
            return Boolean(phoneMatch || emailMatch);
          }) || null
        );
      },
      async create(data) {
        const now = data.createdAt || new Date().toISOString();
        const id = data.id || newId();
        sqlite
          .prepare(
            `INSERT INTO leads (
              id, name, phone, email, preferredLocation, budget, budgetLabel, propertyType,
              purchaseTimeline, leadScore, scoreBreakdown, qualificationStatus, qualified,
              sentiment, intent, source, industry, followUpDate, notes, lastCallId, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            id,
            data.name || 'Unnamed Lead',
            data.phone || '',
            (data.email || '').toLowerCase(),
            data.preferredLocation || '',
            Number(data.budget) || 0,
            data.budgetLabel || '',
            data.propertyType || '',
            data.purchaseTimeline || '',
            Number(data.leadScore) || 0,
            JSON.stringify(data.scoreBreakdown || {}),
            data.qualificationStatus || (data.qualified ? 'Qualified' : 'New'),
            data.qualified ? 1 : 0,
            data.sentiment || 'Neutral',
            data.intent || 'Medium',
            data.source || 'AI Voice Agent',
            data.industry || 'real-estate',
            data.followUpDate || '',
            data.notes || '',
            data.lastCallId || '',
            now,
            now
          );
        return this.findById(id);
      },
      async update(id, data) {
        const existing = await this.findById(id);
        if (!existing) return null;
        const merged = {
          ...existing,
          ...data,
          email: data.email !== undefined ? String(data.email || '').toLowerCase() : existing.email,
          budget: data.budget !== undefined ? Number(data.budget) || 0 : existing.budget,
          leadScore: data.leadScore !== undefined ? Number(data.leadScore) || 0 : existing.leadScore,
          qualified: data.qualified !== undefined ? Boolean(data.qualified) : existing.qualified,
          scoreBreakdown:
            data.scoreBreakdown !== undefined ? data.scoreBreakdown : existing.scoreBreakdown,
          updatedAt: new Date().toISOString(),
        };
        sqlite
          .prepare(
            `UPDATE leads SET
              name = ?, phone = ?, email = ?, preferredLocation = ?, budget = ?, budgetLabel = ?,
              propertyType = ?, purchaseTimeline = ?, leadScore = ?, scoreBreakdown = ?,
              qualificationStatus = ?, qualified = ?, sentiment = ?, intent = ?, source = ?,
              industry = ?, followUpDate = ?, notes = ?, lastCallId = ?, updatedAt = ?
            WHERE id = ?`
          )
          .run(
            merged.name,
            merged.phone,
            merged.email,
            merged.preferredLocation,
            merged.budget,
            merged.budgetLabel,
            merged.propertyType,
            merged.purchaseTimeline,
            merged.leadScore,
            JSON.stringify(merged.scoreBreakdown || {}),
            merged.qualificationStatus,
            merged.qualified ? 1 : 0,
            merged.sentiment,
            merged.intent,
            merged.source,
            merged.industry,
            merged.followUpDate,
            merged.notes,
            merged.lastCallId,
            merged.updatedAt,
            id
          );
        return this.findById(id);
      },
      async delete(id) {
        const info = sqlite.prepare('DELETE FROM leads WHERE id = ?').run(id);
        return info.changes > 0;
      },
      async count() {
        return sqlite.prepare('SELECT COUNT(*) as c FROM leads').get().c;
      },
    };
  }

  get calls() {
    const sqlite = this.sqlite;
    const parseCallRow = this.parseCallRow.bind(this);
    return {
      async findAll(filter = {}) {
        const rows = sqlite.prepare('SELECT * FROM calls ORDER BY datetime(startedAt) DESC').all();
        let items = rows.map(parseCallRow);
        if (filter.status && filter.status !== 'all') {
          items = items.filter((c) => c.status === filter.status);
        }
        if (filter.sentiment && filter.sentiment !== 'all') {
          items = items.filter((c) => c.sentiment === filter.sentiment);
        }
        if (filter.leadId) {
          items = items.filter((c) => c.leadId === filter.leadId);
        }
        if (filter.search) {
          const q = filter.search.toLowerCase();
          items = items.filter(
            (c) =>
              (c.callerName && c.callerName.toLowerCase().includes(q)) ||
              (c.summary && c.summary.toLowerCase().includes(q)) ||
              (c.callerPhone && c.callerPhone.toLowerCase().includes(q))
          );
        }
        return items;
      },
      async findById(id) {
        const row = sqlite.prepare('SELECT * FROM calls WHERE id = ?').get(id);
        return parseCallRow(row);
      },
      async create(data) {
        const now = data.createdAt || new Date().toISOString();
        const id = data.id || newId();
        sqlite
          .prepare(
            `INSERT INTO calls (
              id, callerName, callerPhone, leadId, language, industry, mode, status,
              startedAt, endedAt, durationSeconds, transcript, extractedInfo, sentiment,
              intent, leadScore, qualified, summary, recommendedNextAction, appointmentBookedId,
              createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            id,
            data.callerName || 'Prospect Visitor',
            data.callerPhone || '',
            data.leadId || '',
            data.language || 'en',
            data.industry || 'real-estate',
            data.mode || 'demo',
            data.status || 'Active',
            data.startedAt || now,
            data.endedAt || '',
            Number(data.durationSeconds) || 0,
            JSON.stringify(data.transcript || []),
            JSON.stringify(data.extractedInfo || {}),
            data.sentiment || 'Neutral',
            data.intent || 'Medium',
            Number(data.leadScore) || 0,
            data.qualified ? 1 : 0,
            data.summary || '',
            data.recommendedNextAction || '',
            data.appointmentBookedId || '',
            now,
            now
          );
        return this.findById(id);
      },
      async update(id, data) {
        const existing = await this.findById(id);
        if (!existing) return null;
        const merged = {
          ...existing,
          ...data,
          transcript: data.transcript !== undefined ? data.transcript : existing.transcript,
          extractedInfo:
            data.extractedInfo !== undefined ? data.extractedInfo : existing.extractedInfo,
          qualified: data.qualified !== undefined ? Boolean(data.qualified) : existing.qualified,
          leadScore: data.leadScore !== undefined ? Number(data.leadScore) || 0 : existing.leadScore,
          durationSeconds:
            data.durationSeconds !== undefined
              ? Number(data.durationSeconds) || 0
              : existing.durationSeconds,
          updatedAt: new Date().toISOString(),
        };
        sqlite
          .prepare(
            `UPDATE calls SET
              callerName = ?, callerPhone = ?, leadId = ?, language = ?, industry = ?, mode = ?,
              status = ?, startedAt = ?, endedAt = ?, durationSeconds = ?, transcript = ?,
              extractedInfo = ?, sentiment = ?, intent = ?, leadScore = ?, qualified = ?,
              summary = ?, recommendedNextAction = ?, appointmentBookedId = ?, updatedAt = ?
            WHERE id = ?`
          )
          .run(
            merged.callerName,
            merged.callerPhone,
            merged.leadId,
            merged.language,
            merged.industry,
            merged.mode,
            merged.status,
            merged.startedAt,
            merged.endedAt,
            merged.durationSeconds,
            JSON.stringify(merged.transcript || []),
            JSON.stringify(merged.extractedInfo || {}),
            merged.sentiment,
            merged.intent,
            merged.leadScore,
            merged.qualified ? 1 : 0,
            merged.summary,
            merged.recommendedNextAction,
            merged.appointmentBookedId,
            merged.updatedAt,
            id
          );
        return this.findById(id);
      },
      async delete(id) {
        const info = sqlite.prepare('DELETE FROM calls WHERE id = ?').run(id);
        return info.changes > 0;
      },
      async count() {
        return sqlite.prepare('SELECT COUNT(*) as c FROM calls').get().c;
      },
    };
  }

  get appointments() {
    const sqlite = this.sqlite;
    return {
      async findAll(filter = {}) {
        const rows = sqlite
          .prepare('SELECT * FROM appointments ORDER BY date ASC, time ASC')
          .all();
        let items = rows.map((r) => ({ ...r, _id: r.id }));
        if (filter.status && filter.status !== 'all') {
          items = items.filter((a) => a.status === filter.status);
        }
        if (filter.date) {
          items = items.filter((a) => a.date === filter.date);
        }
        if (filter.leadId) {
          items = items.filter((a) => a.leadId === filter.leadId);
        }
        return items;
      },
      async findById(id) {
        const row = sqlite.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
        return row ? { ...row, _id: row.id } : null;
      },
      async findConflict({ date, time, excludeId }) {
        const rows = sqlite
          .prepare(
            "SELECT * FROM appointments WHERE date = ? AND time = ? AND status != 'Cancelled'"
          )
          .all(date, time);
        const hit = rows.find((r) => !excludeId || r.id !== excludeId);
        return hit ? { ...hit, _id: hit.id } : null;
      },
      async create(data) {
        const now = data.createdAt || new Date().toISOString();
        const id = data.id || newId();
        sqlite
          .prepare(
            `INSERT INTO appointments (
              id, leadId, customerName, customerPhone, customerEmail, date, time,
              purpose, location, status, source, callId, notes, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            id,
            data.leadId || '',
            data.customerName,
            data.customerPhone || '',
            data.customerEmail || '',
            data.date,
            data.time,
            data.purpose,
            data.location || 'Horizon Crest Experience Center',
            data.status || 'Scheduled',
            data.source || 'CRM',
            data.callId || '',
            data.notes || '',
            now,
            now
          );
        return this.findById(id);
      },
      async update(id, data) {
        const existing = await this.findById(id);
        if (!existing) return null;
        const merged = {
          ...existing,
          ...data,
          updatedAt: new Date().toISOString(),
        };
        sqlite
          .prepare(
            `UPDATE appointments SET
              leadId = ?, customerName = ?, customerPhone = ?, customerEmail = ?,
              date = ?, time = ?, purpose = ?, location = ?, status = ?,
              source = ?, callId = ?, notes = ?, updatedAt = ?
            WHERE id = ?`
          )
          .run(
            merged.leadId,
            merged.customerName,
            merged.customerPhone,
            merged.customerEmail,
            merged.date,
            merged.time,
            merged.purpose,
            merged.location,
            merged.status,
            merged.source,
            merged.callId,
            merged.notes,
            merged.updatedAt,
            id
          );
        return this.findById(id);
      },
      async delete(id) {
        const info = sqlite.prepare('DELETE FROM appointments WHERE id = ?').run(id);
        return info.changes > 0;
      },
      async count() {
        return sqlite.prepare('SELECT COUNT(*) as c FROM appointments').get().c;
      },
    };
  }

  get knowledge() {
    const sqlite = this.sqlite;
    const parseKnowledgeRow = this.parseKnowledgeRow.bind(this);
    return {
      async findAll() {
        const rows = sqlite
          .prepare('SELECT * FROM knowledge_docs ORDER BY datetime(createdAt) DESC')
          .all();
        return rows.map(parseKnowledgeRow);
      },
      async findById(id) {
        const row = sqlite.prepare('SELECT * FROM knowledge_docs WHERE id = ?').get(id);
        return parseKnowledgeRow(row);
      },
      async create(data) {
        const now = data.createdAt || new Date().toISOString();
        const id = data.id || newId();
        sqlite
          .prepare(
            `INSERT INTO knowledge_docs (
              id, title, category, industry, sourceType, fileName, fileSize,
              content, chunks, chunkCount, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            id,
            data.title,
            data.category || 'General',
            data.industry || 'real-estate',
            data.sourceType || 'text',
            data.fileName || '',
            Number(data.fileSize) || 0,
            data.content,
            JSON.stringify(data.chunks || []),
            Number(data.chunkCount) || (data.chunks ? data.chunks.length : 0),
            now,
            now
          );
        return this.findById(id);
      },
      async delete(id) {
        const info = sqlite.prepare('DELETE FROM knowledge_docs WHERE id = ?').run(id);
        return info.changes > 0;
      },
      async count() {
        return sqlite.prepare('SELECT COUNT(*) as c FROM knowledge_docs').get().c;
      },
    };
  }
}

class MongoRepository {
  get users() {
    return {
      async findByEmail(email) {
        return normalizeDoc(await UserModel.findOne({ email: email.toLowerCase() }));
      },
      async findById(id) {
        return normalizeDoc(await UserModel.findById(id));
      },
      async create(data) {
        return normalizeDoc(await UserModel.create(data));
      },
      async count() {
        return UserModel.countDocuments();
      },
    };
  }

  get leads() {
    return {
      async findAll(filter = {}) {
        const query = {};
        if (filter.qualified !== undefined && filter.qualified !== '' && filter.qualified !== 'all') {
          query.qualified = filter.qualified === true || filter.qualified === 'true';
        }
        if (filter.status && filter.status !== 'all') {
          query.qualificationStatus = filter.status;
        }
        if (filter.sentiment && filter.sentiment !== 'all') {
          query.sentiment = filter.sentiment;
        }
        if (filter.search) {
          const rx = new RegExp(filter.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          query.$or = [
            { name: rx },
            { phone: rx },
            { email: rx },
            { preferredLocation: rx },
            { propertyType: rx },
          ];
        }
        const docs = await LeadModel.find(query).sort({ createdAt: -1 });
        return docs.map(normalizeDoc);
      },
      async findById(id) {
        return normalizeDoc(await LeadModel.findById(id));
      },
      async findDuplicate({ phone, email, excludeId }) {
        const normPhone = normalizePhone(phone);
        const normEmail = String(email || '').trim().toLowerCase();
        const all = await LeadModel.find({});
        const match = all.find((l) => {
          if (excludeId && String(l._id) === String(excludeId)) return false;
          const phoneMatch = normPhone && normPhone.length >= 7 && normalizePhone(l.phone) === normPhone;
          const emailMatch = normEmail && l.email && l.email.toLowerCase() === normEmail;
          return Boolean(phoneMatch || emailMatch);
        });
        return normalizeDoc(match);
      },
      async create(data) {
        return normalizeDoc(await LeadModel.create(data));
      },
      async update(id, data) {
        return normalizeDoc(await LeadModel.findByIdAndUpdate(id, data, { new: true }));
      },
      async delete(id) {
        const res = await LeadModel.findByIdAndDelete(id);
        return Boolean(res);
      },
      async count() {
        return LeadModel.countDocuments();
      },
    };
  }

  get calls() {
    return {
      async findAll(filter = {}) {
        const query = {};
        if (filter.status && filter.status !== 'all') query.status = filter.status;
        if (filter.sentiment && filter.sentiment !== 'all') query.sentiment = filter.sentiment;
        if (filter.leadId) query.leadId = filter.leadId;
        if (filter.search) {
          const rx = new RegExp(filter.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          query.$or = [{ callerName: rx }, { summary: rx }, { callerPhone: rx }];
        }
        const docs = await CallModel.find(query).sort({ startedAt: -1 });
        return docs.map(normalizeDoc);
      },
      async findById(id) {
        return normalizeDoc(await CallModel.findById(id));
      },
      async create(data) {
        return normalizeDoc(await CallModel.create(data));
      },
      async update(id, data) {
        return normalizeDoc(await CallModel.findByIdAndUpdate(id, data, { new: true }));
      },
      async delete(id) {
        const res = await CallModel.findByIdAndDelete(id);
        return Boolean(res);
      },
      async count() {
        return CallModel.countDocuments();
      },
    };
  }

  get appointments() {
    return {
      async findAll(filter = {}) {
        const query = {};
        if (filter.status && filter.status !== 'all') query.status = filter.status;
        if (filter.date) query.date = filter.date;
        if (filter.leadId) query.leadId = filter.leadId;
        const docs = await AppointmentModel.find(query).sort({ date: 1, time: 1 });
        return docs.map(normalizeDoc);
      },
      async findById(id) {
        return normalizeDoc(await AppointmentModel.findById(id));
      },
      async findConflict({ date, time, excludeId }) {
        const query = { date, time, status: { $ne: 'Cancelled' } };
        if (excludeId) query._id = { $ne: excludeId };
        return normalizeDoc(await AppointmentModel.findOne(query));
      },
      async create(data) {
        return normalizeDoc(await AppointmentModel.create(data));
      },
      async update(id, data) {
        return normalizeDoc(await AppointmentModel.findByIdAndUpdate(id, data, { new: true }));
      },
      async delete(id) {
        const res = await AppointmentModel.findByIdAndDelete(id);
        return Boolean(res);
      },
      async count() {
        return AppointmentModel.countDocuments();
      },
    };
  }

  get knowledge() {
    return {
      async findAll() {
        const docs = await KnowledgeModel.find({}).sort({ createdAt: -1 });
        return docs.map(normalizeDoc);
      },
      async findById(id) {
        return normalizeDoc(await KnowledgeModel.findById(id));
      },
      async create(data) {
        return normalizeDoc(await KnowledgeModel.create(data));
      },
      async delete(id) {
        const res = await KnowledgeModel.findByIdAndDelete(id);
        return Boolean(res);
      },
      async count() {
        return KnowledgeModel.countDocuments();
      },
    };
  }
}

class DatabaseManager {
  constructor() {
    this.repo = null;
    this.engine = 'uninitialized';
    this.details = '';
  }

  async connect() {
    if (this.repo) return this.repo;

    if (env.dbMode !== 'sqlite') {
      try {
        await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 2500 });
        this.repo = new MongoRepository();
        this.engine = 'mongodb';
        this.details = 'Connected to MongoDB via Mongoose';
        logger.info('Database connected: MongoDB (Mongoose)');
        return this.repo;
      } catch (err) {
        if (env.dbMode === 'mongo') {
          throw err;
        }
        logger.warn(
          `MongoDB unavailable (${err.message}). Activating persistent SQLite fallback at ${env.sqlitePath}`
        );
      }
    }

    this.repo = new SqliteRepository(env.sqlitePath);
    this.engine = 'sqlite';
    this.details = `Persistent SQLite repository (${path.basename(env.sqlitePath)})`;
    logger.info(`Database connected: SQLite persistent fallback (${env.sqlitePath})`);
    return this.repo;
  }

  getStatus() {
    return {
      engine: this.engine,
      connected: Boolean(this.repo),
      details: this.details,
    };
  }

  get users() {
    return this.repo.users;
  }
  get leads() {
    return this.repo.leads;
  }
  get calls() {
    return this.repo.calls;
  }
  get appointments() {
    return this.repo.appointments;
  }
  get knowledge() {
    return this.repo.knowledge;
  }
}

const db = new DatabaseManager();
module.exports = db;
