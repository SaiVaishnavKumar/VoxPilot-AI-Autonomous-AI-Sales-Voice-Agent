const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'agent', 'demo'], default: 'agent' },
    company: { type: String, default: 'Horizon Crest Realty' },
  },
  { timestamps: true }
);

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true, index: true },
    email: { type: String, default: '', lowercase: true, trim: true, index: true },
    preferredLocation: { type: String, default: '' },
    budget: { type: Number, default: 0 },
    budgetLabel: { type: String, default: '' },
    propertyType: { type: String, default: '' },
    purchaseTimeline: { type: String, default: '' },
    leadScore: { type: Number, default: 0, min: 0, max: 100 },
    scoreBreakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
    qualificationStatus: {
      type: String,
      enum: ['New', 'Qualified', 'Unqualified', 'Follow-Up', 'Converted'],
      default: 'New',
      index: true,
    },
    qualified: { type: Boolean, default: false, index: true },
    sentiment: { type: String, enum: ['Positive', 'Neutral', 'Negative'], default: 'Neutral' },
    intent: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
    source: { type: String, default: 'AI Voice Agent' },
    industry: { type: String, default: 'real-estate' },
    followUpDate: { type: String, default: '' },
    notes: { type: String, default: '' },
    lastCallId: { type: String, default: '' },
  },
  { timestamps: true }
);

const transcriptEntrySchema = new mongoose.Schema(
  {
    speaker: { type: String, enum: ['customer', 'ai', 'system'], required: true },
    text: { type: String, required: true },
    timestamp: { type: String, default: () => new Date().toISOString() },
    language: { type: String, default: 'en' },
    retrievedSources: [{ type: String }],
  },
  { _id: false }
);

const callSchema = new mongoose.Schema(
  {
    callerName: { type: String, default: 'Prospect Visitor' },
    callerPhone: { type: String, default: '' },
    leadId: { type: String, default: '', index: true },
    language: { type: String, default: 'en' },
    industry: { type: String, default: 'real-estate' },
    mode: { type: String, enum: ['gemini', 'demo'], default: 'demo' },
    status: {
      type: String,
      enum: ['Active', 'Completed', 'Dropped'],
      default: 'Active',
      index: true,
    },
    startedAt: { type: String, default: () => new Date().toISOString() },
    endedAt: { type: String, default: '' },
    durationSeconds: { type: Number, default: 0 },
    transcript: [transcriptEntrySchema],
    extractedInfo: { type: mongoose.Schema.Types.Mixed, default: {} },
    sentiment: { type: String, enum: ['Positive', 'Neutral', 'Negative'], default: 'Neutral' },
    intent: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
    leadScore: { type: Number, default: 0 },
    qualified: { type: Boolean, default: false },
    summary: { type: String, default: '' },
    recommendedNextAction: { type: String, default: '' },
    appointmentBookedId: { type: String, default: '' },
  },
  { timestamps: true }
);

const appointmentSchema = new mongoose.Schema(
  {
    leadId: { type: String, default: '', index: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, default: '' },
    customerEmail: { type: String, default: '' },
    date: { type: String, required: true, index: true },
    time: { type: String, required: true, index: true },
    purpose: { type: String, required: true, trim: true },
    location: { type: String, default: 'Horizon Crest Experience Center' },
    status: {
      type: String,
      enum: ['Scheduled', 'Completed', 'Cancelled'],
      default: 'Scheduled',
      index: true,
    },
    source: { type: String, default: 'CRM' },
    callId: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

const knowledgeChunkSchema = new mongoose.Schema(
  {
    chunkId: { type: String, required: true },
    index: { type: Number, required: true },
    content: { type: String, required: true },
    keywords: [{ type: String }],
  },
  { _id: false }
);

const knowledgeDocumentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, default: 'General' },
    industry: { type: String, default: 'real-estate' },
    sourceType: { type: String, enum: ['txt', 'pdf', 'text'], default: 'text' },
    fileName: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    content: { type: String, required: true },
    chunks: [knowledgeChunkSchema],
    chunkCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = {
  UserModel: mongoose.models.User || mongoose.model('User', userSchema),
  LeadModel: mongoose.models.Lead || mongoose.model('Lead', leadSchema),
  CallModel: mongoose.models.Call || mongoose.model('Call', callSchema),
  AppointmentModel: mongoose.models.Appointment || mongoose.model('Appointment', appointmentSchema),
  KnowledgeModel:
    mongoose.models.KnowledgeDocument || mongoose.model('KnowledgeDocument', knowledgeDocumentSchema),
};
