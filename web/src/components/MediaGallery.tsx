import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../hooks/useApi';
import type { Media } from '../types';
import { Upload, Image, Film, File, X, Sparkles, Send, Loader2, History } from 'lucide-react';

interface Props {
  growId?: string;
  timepointId?: string;
}

interface AiMessage {
  role: 'user' | 'assistant';
  text: string;
  model?: string;
  duration_ms?: number;
}

function AiPanel({ media, onClose }: { media: Media; onClose: () => void }) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.ai.status().then((s: any) => setAiAvailable(s.configured && s.connected)).catch(() => setAiAvailable(false));
    api.ai.conversations({ media_id: media.id }).then(setConversations).catch(() => {});
  }, [media.id]);

  useEffect(() => {
    if (conversations.length > 0 && !conversationId) {
      loadConversation(conversations[0].id);
    }
  }, [conversations]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const loadConversation = async (id: string) => {
    try {
      const c = await api.ai.conversation(id);
      setConversationId(id);
      setMessages((c.messages || []).map((m: any) => ({
        role: m.role, text: m.content, model: m.model, duration_ms: m.duration_ms,
      })));
      setShowHistory(false);
    } catch {}
  };

  const startNew = () => {
    setConversationId(null);
    setMessages([]);
    setShowHistory(false);
  };

  const send = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: prompt }]);
    setLoading(true);
    try {
      const res = await api.ai.analyze(media.id, prompt, undefined, conversationId || undefined);
      setMessages((prev) => [...prev, { role: 'assistant', text: res.response, model: res.model, duration_ms: res.duration_ms }]);
      if (res.conversation_id) {
        setConversationId(res.conversation_id);
        api.ai.conversations({ media_id: media.id }).then(setConversations).catch(() => {});
      }
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'assistant', text: `Error: ${err.message}` }]);
    }
    setLoading(false);
  };

  if (aiAvailable === null) {
    return (
      <div className="flex items-center justify-center p-6 text-gray-500">
        <Loader2 size={16} className="animate-spin mr-2" /> Checking AI availability...
      </div>
    );
  }

  if (!aiAvailable) {
    return (
      <div className="p-4 text-center">
        <Sparkles size={20} className="mx-auto text-gray-600 mb-2" />
        <p className="text-sm text-gray-500">Ollama not connected</p>
        <p className="text-xs text-gray-600 mt-1">
          Set <code className="bg-gray-800 px-1 rounded">OLLAMA_HOST</code> in docker-compose.yml to your Ollama instance address.
        </p>
        <button onClick={onClose} className="mt-3 text-xs text-gray-500 hover:text-gray-300">Close</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Sparkles size={12} className="text-purple-400" />
          Ask AI about this image
        </div>
        <div className="flex items-center gap-1">
          {conversations.length > 0 && (
            <button onClick={() => setShowHistory(!showHistory)} className="text-gray-600 hover:text-gray-300 p-0.5" title="Chat history">
              <History size={13} />
            </button>
          )}
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300"><X size={14} /></button>
        </div>
      </div>

      {showHistory && (
        <div className="border-b border-gray-800 max-h-32 overflow-y-auto scrollbar-thin">
          <button onClick={startNew} className="w-full text-left px-3 py-1.5 text-[11px] text-purple-400 hover:bg-gray-800/50">+ New conversation</button>
          {conversations.map((c) => (
            <button key={c.id} onClick={() => loadConversation(c.id)}
              className={`w-full text-left px-3 py-1.5 text-[11px] truncate hover:bg-gray-800/50 ${c.id === conversationId ? 'text-gray-200 bg-gray-800/30' : 'text-gray-500'}`}>
              {c.title} <span className="text-gray-700">· {c.message_count}msg</span>
            </button>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 scrollbar-thin overscroll-contain">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <Sparkles size={24} className="mx-auto text-gray-700 mb-2" />
            <p className="text-xs text-gray-600">Ask a question about this image</p>
            <div className="flex flex-wrap gap-1.5 justify-center mt-3">
              {['Does this plant look healthy?', 'What deficiencies do you see?', 'Describe what you see'].map((q) => (
                <button key={q} onClick={() => { setInput(q); }} className="text-[10px] px-2 py-1 rounded-full bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`text-sm ${m.role === 'user' ? 'text-right' : ''}`}>
            <div className={`inline-block max-w-full rounded-lg px-3 py-2 ${
              m.role === 'user'
                ? 'bg-purple-600/30 text-gray-200'
                : 'bg-gray-800/80 text-gray-300'
            }`}>
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
              {m.model && (
                <p className="text-[10px] text-gray-600 mt-1">{m.model} · {((m.duration_ms || 0) / 1000).toFixed(1)}s</p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 size={14} className="animate-spin" /> Analyzing image...
          </div>
        )}
      </div>

      <div className="p-2 border-t border-gray-800">
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this image..."
            className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}

export function MediaGallery({ growId, timepointId }: Props) {
  const [media, setMedia] = useState<Media[]>([]);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<Media | null>(null);
  const [showAi, setShowAi] = useState(false);

  const load = useCallback(() => {
    const params: Record<string, string> = {};
    if (growId) params.grow_id = growId;
    if (timepointId) params.timepoint_id = timepointId;
    api.media.list(params).then(setMedia).catch(console.error);
  }, [growId, timepointId]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setUploading(true);
    try {
      const meta: Record<string, string> = {};
      if (growId) meta.grow_id = growId;
      if (timepointId) meta.timepoint_id = timepointId;
      await api.media.upload(e.target.files, meta);
      load();
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleDelete = async (id: string) => {
    await api.media.delete(id);
    load();
    if (preview?.id === id) { setPreview(null); setShowAi(false); }
  };

  const getIcon = (mime: string) => {
    if (mime.startsWith('image/')) return Image;
    if (mime.startsWith('video/')) return Film;
    return File;
  };

  const sourceLabel = (source: string) => {
    if (source === 'auto_capture') return 'Auto';
    if (source === 'upload') return 'Upload';
    return 'Manual';
  };

  const closeLightbox = () => { setPreview(null); setShowAi(false); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{media.length} file{media.length !== 1 ? 's' : ''}</span>
        <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${
          uploading ? 'bg-gray-700 text-gray-400' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
        }`}>
          <Upload size={14} />
          {uploading ? 'Uploading...' : 'Upload'}
          <input type="file" multiple className="hidden" onChange={handleUpload} accept="image/*,video/*" disabled={uploading} />
        </label>
      </div>

      {media.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-gray-800 rounded-xl">
          <Image className="w-10 h-10 text-gray-700 mb-2" />
          <p className="text-sm text-gray-500">No media uploaded yet</p>
          <p className="text-xs text-gray-600">Drag and drop or click Upload</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {media.map((m) => {
            const Icon = getIcon(m.mime_type);
            return (
              <button
                key={m.id}
                onClick={() => { setPreview(m); setShowAi(false); }}
                className="relative aspect-square bg-gray-900 rounded-lg overflow-hidden border border-gray-800 hover:border-gray-600 transition-colors group"
              >
                {m.mime_type.startsWith('image/') ? (
                  <img src={api.media.fileUrl(m.id)} alt={m.original_name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-1">
                    <Icon size={24} className="text-gray-600" />
                    <span className="text-[10px] text-gray-600 truncate max-w-[80%]">{m.original_name}</span>
                  </div>
                )}
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className={`px-1 py-0.5 rounded text-[8px] ${
                    m.source === 'auto_capture' ? 'bg-blue-500/80 text-white' : 'bg-gray-700/80 text-gray-300'
                  }`}>{sourceLabel(m.source)}</span>
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] text-gray-300 truncate block">{new Date(m.captured_at).toLocaleString()}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={closeLightbox}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white z-10" onClick={closeLightbox}>
            <X size={24} />
          </button>
          <button
            className="absolute top-4 left-4 text-red-400/70 hover:text-red-400 text-sm z-10"
            onClick={(e) => { e.stopPropagation(); handleDelete(preview.id); }}
          >
            Delete
          </button>

          <div onClick={(e) => e.stopPropagation()} className={`flex ${showAi ? 'flex-col lg:flex-row' : 'flex-col'} gap-4 max-w-6xl w-full max-h-[90vh] overflow-hidden`}>
            <div className={`flex flex-col items-center justify-center ${showAi ? 'lg:flex-1 shrink' : ''} min-h-0`}>
              {preview.mime_type.startsWith('image/') ? (
                <img src={api.media.fileUrl(preview.id)} alt={preview.original_name} className={`object-contain rounded-lg ${showAi ? 'max-h-[30vh] lg:max-h-[80vh]' : 'max-h-[75vh]'} max-w-full`} />
              ) : preview.mime_type.startsWith('video/') ? (
                <video src={api.media.fileUrl(preview.id)} controls className={`rounded-lg ${showAi ? 'max-h-[30vh] lg:max-h-[80vh]' : 'max-h-[75vh]'} max-w-full`} />
              ) : (
                <div className="text-center text-gray-400">
                  <File size={48} className="mx-auto mb-2" />
                  <p>{preview.original_name}</p>
                </div>
              )}
              <div className="flex items-center gap-3 mt-2">
                <p className="text-xs text-gray-500">
                  {preview.original_name} · {(preview.size / 1024 / 1024).toFixed(1)} MB · {new Date(preview.captured_at).toLocaleString()}
                  {preview.source === 'auto_capture' && ' · Auto-captured'}
                </p>
                {preview.mime_type.startsWith('image/') && !showAi && (
                  <button
                    onClick={() => setShowAi(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-purple-600/30 text-purple-300 hover:bg-purple-600/50 transition-colors border border-purple-500/30"
                  >
                    <Sparkles size={12} /> Ask AI
                  </button>
                )}
              </div>
            </div>

            {showAi && preview.mime_type.startsWith('image/') && (
              <div className="lg:w-96 w-full bg-gray-900/95 border border-gray-800 rounded-xl flex flex-col max-h-[50vh] lg:max-h-[80vh] min-h-0 overflow-hidden">
                <AiPanel media={preview} onClose={() => setShowAi(false)} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
