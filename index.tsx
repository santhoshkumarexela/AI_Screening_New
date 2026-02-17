import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";

// --- Icons ---
const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
);

const GitHubIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
);

const BotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
);

// --- Constants ---
const MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash (Fast)' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro (Reasoning)' },
];

const SYSTEM_INSTRUCTION = `You are an expert software engineer and developer assistant. 
You provide clean, efficient, and well-documented code examples. 
When asked about GitHub, you help users understand workflows, actions, and repository management.`;

// --- Components ---

interface MessageItemProps {
  role: 'user' | 'model';
  text: string;
}

function MessageItem({ role, text }: MessageItemProps) {
  const isUser = role === 'user';
  
  // Basic formatting for code blocks (simple heuristic)
  const formatText = (content: string) => {
    return content.split('```').map((part, index) => {
      if (index % 2 === 1) {
        // Code block
        return (
          <div key={index} className="bg-slate-900 p-3 rounded-md my-2 overflow-x-auto border border-slate-700 font-mono text-sm text-blue-300">
            <pre>{part.trim()}</pre>
          </div>
        );
      }
      return <span key={index} className="whitespace-pre-wrap">{part}</span>;
    });
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-blue-600' : 'bg-emerald-600'}`}>
          {isUser ? <UserIcon /> : <BotIcon />}
        </div>
        <div className={`p-4 rounded-2xl ${
          isUser 
            ? 'bg-blue-600/20 text-blue-50 border border-blue-500/30 rounded-tr-sm' 
            : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-sm'
        }`}>
          <div className="leading-relaxed">
            {formatText(text)}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<MessageItemProps[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [error, setError] = useState<string | null>(null);
  
  const chatRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);

  useEffect(() => {
    // Initialize AI client
    if (process.env.API_KEY) {
      aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } else {
      setError("API Key not found. Please set process.env.API_KEY.");
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startNewChat = () => {
    if (!aiRef.current) return;
    
    chatRef.current = aiRef.current.chats.create({
      model: selectedModel,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      }
    });
    setMessages([]);
    setError(null);
  };

  // Start chat on mount or model change
  useEffect(() => {
    startNewChat();
  }, [selectedModel]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || !chatRef.current) return;

    const userMessage = input;
    setInput('');
    setIsLoading(true);
    setError(null);

    // Optimistic update
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);

    try {
      // Create a placeholder for the model response
      setMessages(prev => [...prev, { role: 'model', text: '' }]);
      
      const result = await chatRef.current.sendMessageStream({ message: userMessage });
      
      let fullText = '';
      
      for await (const chunk of result) {
        const text = chunk.text;
        if (text) {
            fullText += text;
            // Update the last message with accumulated text
            setMessages(prev => {
                const newMessages = [...prev];
                const lastIndex = newMessages.length - 1;
                if (lastIndex >= 0) {
                    const lastMsg = newMessages[lastIndex];
                    if (lastMsg.role === 'model') {
                        newMessages[lastIndex] = { ...lastMsg, text: fullText };
                    }
                }
                return newMessages;
            });
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while generating the response.");
      // Remove the empty placeholder if it failed completely
      setMessages(prev => {
        if (prev.length > 0 && prev[prev.length - 1].role === 'model' && prev[prev.length - 1].text === '') {
            return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (error && !aiRef.current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-red-400">
        <div className="p-4 border border-red-800 bg-red-900/20 rounded-lg">
          <h2 className="text-lg font-bold mb-2">Configuration Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto bg-slate-950 shadow-2xl overflow-hidden border-x border-slate-800">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-lg">
            <GitHubIcon /> 
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">DevAssistant</h1>
            <p className="text-xs text-slate-400">Powered by Google Gemini</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <select 
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-sm text-slate-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button 
            onClick={startNewChat}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            title="Clear Chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto p-6 space-y-2 bg-slate-950">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
            <GitHubIcon />
            <p className="mt-4 text-lg">Ready to code.</p>
            <p className="text-sm">Ask about your repository, debug code, or generate new features.</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <MessageItem key={idx} role={msg.role} text={msg.text} />
          ))
        )}
        {isLoading && messages[messages.length - 1]?.role !== 'model' && (
          <div className="flex items-center gap-2 text-slate-500 ml-12">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-75"></span>
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-150"></span>
          </div>
        )}
        {error && (
            <div className="mx-auto w-full max-w-2xl bg-red-900/20 border border-red-800 text-red-300 p-3 rounded text-sm text-center mb-4">
                {error}
            </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-slate-900 border-t border-slate-800">
        <div className="relative max-w-3xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message here... (Shift+Enter for new line)"
            className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-700 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none max-h-48 shadow-inner"
            rows={1}
            style={{ minHeight: '52px' }}
          />
          <button
            onClick={() => handleSubmit()}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 bottom-2.5 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <SendIcon />
          </button>
        </div>
        <div className="text-center mt-2">
            <p className="text-[10px] text-slate-600">
                Gemini may display inaccurate info, including about people, so double-check its responses.
            </p>
        </div>
      </footer>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);