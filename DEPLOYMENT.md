# Netlify deployment

This repository contains a Vite/React frontend and a separate Express API. Netlify can host the frontend, but it does not run `server/server.js` as a persistent API server. The Netlify build settings are in `netlify.toml`; the SPA fallback keeps direct links such as `/voice-agent` from returning 404.

## Deploy the frontend

1. Connect the GitHub repository to Netlify. The checked-in `netlify.toml` supplies the build command and publish directory (`client/dist`).
2. Deploy the Express API separately on a Node.js host that supports a persistent Express process and configure its production environment variables. Use MongoDB Atlas (set `DB_MODE=mongo` and `MONGODB_URI`) for durable production data; the local SQLite fallback is not suitable for ephemeral serverless filesystems.
3. In Netlify, set `VITE_API_URL` to the absolute API base URL ending in `/api`, for example `https://your-api.example.com/api`, then trigger a new frontend deploy. Vite embeds this value at build time.
4. On the API host, set `CLIENT_URL` to the deployed Netlify site URL, plus secure production values for `JWT_SECRET`, `MONGODB_URI`, and `GEMINI_API_KEY` as needed. Never put server secrets in Netlify `VITE_*` variables.

The frontend defaults to `/api` for local development, where Vite proxies requests to the local Express server. A Netlify deploy without `VITE_API_URL` will send API requests back to Netlify, where no API exists, so login and live AI calls will fail even if the page itself loads.

## Diagnosing production errors

- A 404 on a client route is fixed by the SPA fallback in `netlify.toml`.
- `FUNCTION_INVOCATION_FAILED` is returned when a deployed function throws or fails to initialize. This repository does not define a Netlify Function; check the Netlify function logs and make sure API requests point to the separately hosted Express API.
- Check `https://your-api.example.com/api/health` first. It should return JSON with `status: "healthy"`. If this endpoint fails, inspect the API host's logs and environment variables. If health works but browser calls fail, check the Netlify build's `VITE_API_URL` and the API's `CLIENT_URL` CORS setting.
