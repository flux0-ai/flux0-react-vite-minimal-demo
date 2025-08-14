# flux0-react-vite-minimal-demo

A minimal demo showing how to use **`@flux0-ai/react`** in a Vite + React + TypeScript app with **real-time streaming**.

This example:

- Treats the **session id as a route** (`/sessions/{id}`)
- **Does not use a router** – uses `history.pushState` and `popstate`
- On **Enter** at `/`, it **creates a session**, **starts streaming**, and **pushes** `/sessions/{id}` to the URL
- If the URL is already `/sessions/{id}`, it loads prior events and continues streaming the same session
- Refreshing the page will load prior session events from the server, so the page survives refreshes
- Streams live updates from the server via `@flux0-ai/react`
- Knows how to render both **messages** and **tool calls**
- Includes a **“New Session”** button that resets state and goes back to `/`

---

## Quick Start

1. **Set your Agent ID via environment variable**
   In the root of your project, modify `.env` file and set the `VITE_AGENT_ID` variable to the ID of an existing agent in your running Flux0 server:

   ```bash
   VITE_AGENT_ID=<your-agent-id>
   ```

   The app will read this value at runtime, so you don’t need to change any code in `App.tsx`.

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run the Flux0 server**

   Ensure your `flux0-server` is running on port `8080` (the default). If you run it on another port, update `vite.config.ts` accordingly.

4. **Start the Vite dev server**

   ```bash
   npm run dev
   ```

   Open http://localhost:5173

   - Type a message on `/` and press **Enter** → a session is created, streaming starts, and the URL becomes `/sessions/{id}`
   - Click **New Session** → the app resets events and navigates to `/`
   - If you visit `/sessions/{id}` directly or refresh, the app loads prior events and continues streaming that session (refreshes survive)

---

## How It Works

- The app uses the `useMessageStream` hook from `@flux0-ai/react`:
  ```ts
  const {
    messages,
    streaming,
    error,
    processing,
    startStreaming,
    stopStreaming,
    emittedEvents,
    resetEvents,
  } = useMessageStream({ events: loadedEvents });
  ```
- **Initial events** are fetched from `GET /api/sessions/:id/events` when a session is present in the URL.
- If the user hits **Enter** on `/`, we call `POST /api/sessions` with:
  ```json
  { "agent_id": "<value from VITE_AGENT_ID>", "title": "new session" }
  ```
  and expect a response `{ id: string }`. We then push `/sessions/{id}` and call `startStreaming(id, text)`.
- The **New Session** button:
  - `history.pushState({}, "", "/")`
  - `setSessionId(null)`
  - `resetEvents()`
