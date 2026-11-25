import React, { useEffect, useState } from 'react';
import { AlertCircle, BookOpen, FileText, Loader2, Search, Trash2, Upload } from 'lucide-react';
import { api } from '../services/api';
import { formatDateTime } from '../utils/formatters';

export default function KnowledgePage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const loadDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.listKnowledge();
      setDocuments(response.documents || []);
    } catch (err) {
      setError(err.message || 'Failed to load knowledge documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const addTextDocument = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.addKnowledgeText({ title, content });
      setTitle('');
      setContent('');
      await loadDocuments();
    } catch (err) {
      setError(err.message || 'Failed to add this document.');
    } finally {
      setSaving(false);
    }
  };

  const uploadDocument = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const form = event.currentTarget;
    try {
      const formData = new FormData(form);
      await api.uploadKnowledgeFile(formData);
      form.reset();
      await loadDocuments();
    } catch (err) {
      setError(err.message || 'Failed to upload this document.');
    } finally {
      setSaving(false);
    }
  };

  const searchKnowledge = async (event) => {
    event.preventDefault();
    setSearching(true);
    setError('');
    try {
      setResults(await api.queryKnowledge(query));
    } catch (err) {
      setError(err.message || 'Knowledge search failed.');
    } finally {
      setSearching(false);
    }
  };

  const deleteDocument = async (document) => {
    if (!window.confirm(`Delete "${document.title}" from the knowledge base?`)) return;
    setError('');
    try {
      await api.deleteKnowledge(document.id);
      await loadDocuments();
    } catch (err) {
      setError(err.message || 'Failed to delete this document.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        Add business facts and policies here so the voice agent can retrieve grounded answers.
        Supported uploads: PDF and text files.
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={addTextDocument} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <FileText className="h-4 w-4 text-blue-600" />
            Add text knowledge
          </h2>
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Document title"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            required
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Enter verified business information..."
            rows={5}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save knowledge'}
          </button>
        </form>

        <form onSubmit={uploadDocument} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Upload className="h-4 w-4 text-violet-600" />
            Upload a document
          </h2>
          <input
            type="text"
            name="title"
            placeholder="Optional document title"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="file"
            name="file"
            accept=".pdf,.txt,.md,.csv"
            required
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Uploading...' : 'Upload file'}
          </button>
        </form>
      </div>

      <form onSubmit={searchKnowledge} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
        <input
          required
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Test what the voice agent can find..."
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={searching}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          <Search className="h-4 w-4" />
          {searching ? 'Searching...' : 'Test knowledge'}
        </button>
      </form>

      {results && (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">
            {results.hasRelevantFacts ? 'Matching knowledge' : 'No matching facts found'}
          </h2>
          {(results.chunks || []).map((chunk) => (
            <article key={chunk.chunkId} className="rounded-xl bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-800">{chunk.docTitle}</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-600">{chunk.content}</p>
            </article>
          ))}
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 p-5">
          <BookOpen className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-900">Knowledge documents</h2>
          <span className="ml-auto text-xs text-slate-500">{documents.length} documents</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <p className="p-12 text-center text-sm text-slate-500">No documents added yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {documents.map((document) => (
              <li key={document.id} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{document.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {document.category} · {document.sourceType} · {document.chunkCount || 0} chunks
                    {document.createdAt ? ` · ${formatDateTime(document.createdAt)}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteDocument(document)}
                  aria-label={`Delete ${document.title}`}
                  className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
