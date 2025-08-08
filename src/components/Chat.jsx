import { useState, useRef, useEffect } from 'react';

export default function Chat() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text:
        "Ask me questions about your files. I’ll retrieve the most relevant snippets and answer using only those. If something isn’t in your docs, I’ll say so.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;

    setMessages((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setLoading(true);

    try {
      const res = await window.electron.invoke('rag-answer', q);
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: res?.answer || 'Sorry, something went wrong.',
          sources: res?.sources || [],
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: `Error: ${e.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-[70vh] bg-white rounded-2xl shadow p-4">
      {/* Messages */}
      <div
        ref={listRef}
        className="flex-1 overflow-auto space-y-3 pr-2"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${
              m.role === 'user'
                ? 'ml-auto bg-indigo-600 text-white'
                : 'mr-auto bg-gray-100 text-gray-900'
            }`}
          >
            <div className="whitespace-pre-wrap">{m.text}</div>

            {/* Sources */}
            {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
              <div className="mt-2 text-xs text-gray-700">
                <div className="font-semibold mb-1">Sources</div>
                <ul className="list-disc ml-4 space-y-1">
                  {m.sources.map((s) => (
                    <li key={s.idx}>
                      <span className="font-mono mr-1">[{s.idx}]</span>
                      <span className="font-medium">{s.docName}</span>
                      <span className="ml-2 text-gray-500">score {s.score}</span>
                      <div className="italic text-gray-500">
                        {s.preview}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="mr-auto bg-gray-100 text-gray-900 rounded-2xl p-3 shadow-sm">
            Thinking…
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="mt-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about your documents…"
          className="flex-1 border rounded-2xl p-3 resize-none h-14 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-2xl shadow hover:bg-indigo-700 disabled:bg-gray-400"
        >
          Send
        </button>
      </div>
    </div>
  );
}
