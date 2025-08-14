import { useMessageStream, type Event, type Message } from "@flux0-ai/react";
import { useCallback, useEffect, useRef, useState } from "react";

const AGENT_ID = import.meta.env.VITE_AGENT_ID;
if (!AGENT_ID) {
  throw new Error("VITE_AGENT_ID environment variable is not set");
}

function getSessionIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/sessions\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function createSession(): Promise<string> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: AGENT_ID,
      title: "new session",
    }),
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
  const json = await res.json().catch(() => ({} as unknown));
  return json.id;
}

const MessageView = ({ message }: { message: Message }) => {
  return (
    <div className="rounded-lg bg-neutral-800 flex flex-row gap-2 p-2">
      <div className="text-base text-neutral-400">{message.source}:</div>
      <div className="text-base">
        {Array.isArray(message.tool_calls) && message.tool_calls.length > 0 ? (
          <div>
            {message.tool_calls.map((tool) => (
              <div key={tool.tool_call_id} className="mb-2">
                <div className="font-semibold">Tool Call:</div>
                <pre className="bg-neutral-900 rounded p-2 text-xs overflow-x-auto">
                  {JSON.stringify(tool, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        ) : Array.isArray(message.content) ? (
          message.content.join(" ")
        ) : (
          String(message.content)
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(() =>
    getSessionIdFromPath(window.location.pathname)
  );

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [loadedEvents, setLoadedEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [input, setInput] = useState("");

  useEffect(() => {
    const onPop = () =>
      setSessionId(getSessionIdFromPath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setLoadedEvents([]);
      return;
    }
    setLoadingEvents(true);
    fetch(`/api/sessions/${encodeURIComponent(sessionId)}/events`)
      .then((res) => res.json())
      .then((data) =>
        setLoadedEvents(Array.isArray(data?.data) ? data.data : [])
      )
      .catch((error) => {
        console.error("Failed to fetch initial events:", error);
      })
      .finally(() => setLoadingEvents(false));
  }, [sessionId]);

  const {
    messages,
    streaming,
    error,
    processing,
    startStreaming,
    stopStreaming,
    emittedEvents,
    resetEvents,
    resetMessages,
  } = useMessageStream({ events: loadedEvents });

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (sessionId) {
        startStreaming(sessionId, trimmed);
        return;
      }

      const newId = await createSession();
      const newPath = `/sessions/${encodeURIComponent(newId)}`;
      window.history.pushState({}, "", newPath);
      setSessionId(newId);
      startStreaming(newId, trimmed);
    },
    [sessionId, startStreaming]
  );

  const onKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = input;
      setInput("");
      try {
        await sendMessage(text);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const onSubmit: React.FormEventHandler = async (e) => {
    e.preventDefault();
    const text = input;
    setInput("");
    try {
      await sendMessage(text);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-neutral-950 text-neutral-100">
      <div className="sticky top-0 z-50 w-full border-b border-neutral-800 bg-neutral-900/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/60">
        <div className="mx-auto flex  max-w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
          <div className="text-sm">
            Session ID:&nbsp;
            {sessionId ?? (
              <span className="italic text-neutral-400">none (on /)</span>
            )}
          </div>
          <div className="text-sm">
            Loaded Events: {loadedEvents.length}{" "}
            {loadingEvents && "(Loading...)"}
          </div>
          <div className="text-sm">Emitted Events: {emittedEvents.length}</div>
          <div className="text-sm">{streaming ? "Streaming..." : "Idle"}</div>
          <div className="text-sm">
            {error ? `Error: ${JSON.stringify(error.message)}` : "No errors"}
          </div>
          <button
            type="button"
            onClick={() => {
              window.history.pushState({}, "", "/");
              setSessionId(null);
              resetEvents();
              resetMessages();
            }}
            className="rounded border border-neutral-700 px-4 text-sm font-medium shadow disabled:opacity-40 hover:bg-neutral-800"
          >
            New Session
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="mx-auto w-full max-w-3xl grow overflow-auto px-4 pb-28 pt-4"
      >
        <div className="space-y-3">
          {messages.map((m) => (
            <MessageView message={m} key={m.id} />
          ))}
        </div>

        {processing && (
          <div className="w-full max-w-3xl px-4 py-2 text-center">
            {processing}
          </div>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="pointer-events-auto sticky bottom-0 z-40 mx-auto w-full max-w-3xl border-t border-neutral-800 bg-neutral-900/90 p-3 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/60"
      >
        <div className="flex items-end gap-2">
          <textarea
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
            className="min-h-[44px] max-h-40 grow resize-y rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm shadow-inner outline-none placeholder:text-neutral-500 focus:ring-1 focus:ring-neutral-700"
          />
          <button
            type="submit"
            className="h-[44px] shrink-0 rounded-2xl border border-neutral-700 px-4 text-sm font-medium shadow disabled:opacity-40"
          >
            Send
          </button>
          <button
            type="button"
            onClick={() => {
              stopStreaming();
              setInput("");
            }}
            className="h-[44px] shrink-0 rounded-2xl border border-neutral-700 px-4 text-sm font-medium shadow disabled:opacity-40"
            disabled={!streaming}
          >
            Stop
          </button>
        </div>
      </form>
    </div>
  );
}
