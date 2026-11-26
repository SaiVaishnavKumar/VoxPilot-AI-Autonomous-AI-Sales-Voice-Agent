# VoxPilot AI — Autonomous Sales Voice Agent

**Project report for technical evaluation**

## Business problem and solution

Sales teams spend time repeating product information, collecting incomplete enquiry details, and arranging follow-ups. VoxPilot is an individual MVP for guiding an inbound property enquiry from first conversation to qualified lead and consultation booking. Staff can review the saved call and recommended next action in one dashboard.

## System and end-to-end workflow

The React/Vite web app accepts microphone speech or typed messages. Browser speech recognition and text-to-speech provide voice interaction where supported; optional Gemini generates responses and transcribes uploaded audio. A Node.js/Express API maintains call history and customer details, retrieves relevant snippets from knowledge documents using chunking and keyword/IDF ranking, and supplies those facts to the AI. A deterministic 0–100 rubric scores budget, timeline, intent, requirement clarity, and appointment willingness. The internal CRM stores leads; the booking service checks conflicts before saving an appointment. Ending a call saves a summary and next action; dashboard pages show leads, calls, bookings, and sales metrics.

**Demo:** Start a call → share property type, location, budget, timeline, and contact details → ask a question from the sample knowledge base → request an open appointment slot → review the saved lead and booking → end the call and show its summary and analytics.

## Current scope

English and Hindi are configured, with call-level (not cross-call) memory. This is an internal CRM, not a third-party CRM integration; retrieval is lexical, not embedding/vector based; speech runs in the browser, not over telephone/PSTN. Gemini is optional; text chat has a deterministic fallback. Sample records are synthetic. The MVP **has not been load-tested for 100,000 users**.

## Security, deployment, scale, and costs

Password hashing, JWT authentication, Helmet, CORS, and API rate limiting are present. Before real customer use, replace demo credentials and development secrets, enforce HTTPS, restrict production CORS, set consent and data-retention/deletion rules, and configure encrypted backups and monitoring. Deploy the static client to a web host and the persistent API to a Node.js host with a managed database; local SQLite is not for ephemeral serverless storage.

For 100,000 **registered** users, first define peak concurrent calls and calls per minute. A scale-up plan is stateless API instances behind a load balancer, queued AI/transcription work with bounded concurrency, managed indexed storage, object storage, caching, monitoring, and realistic load/recovery tests. This is a roadmap, not a capacity claim.

Costs depend on traffic, audio minutes, model usage, region, retention, and availability targets. Budget web/API hosting, database/backups, AI tokens, transcription/audio, monitoring, and support. Local demo mode can avoid paid AI. Estimate production spend using current provider quotes and a measured pilot, then compare cost per qualified lead/booking against staff time saved and conversion value.

**Diagram and checklist:** [Architecture](ARCHITECTURE.md). **Setup and checks:** `npm run install:all`, `npm run dev`, `npm run build`, and `npm run test:api`; see [README](../README.md) and [deployment guide](../DEPLOYMENT.md).
