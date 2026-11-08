import React, { useState } from 'react';
import { Send, Image as ImageIcon, Mic, HardHat } from 'lucide-react';

export default function ColeSandbox() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'cole', content: "Hey. I'm online and ready. What are we estimating today?" }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/cole', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await response.json();

      if (data.reply) {
        setMessages((prev) => [...prev, { role: 'cole', content: data.reply }]);
      } else {
        setMessages((prev) => [...prev, { role: 'cole', content: "Hit a snag. " + (data.error || "Unknown error.") }]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'cole', content: "Looks like the server is down or Vercel hasn't built the API route yet." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 flex items-center shadow-md">
        <HardHat className="w-6 h-6 mr-3 text-amber-500" />
        <div>
          <h1 className="text-lg font-bold">Cole</h1>
          <p className="text-xs text-slate-400">Iron Foot AI Estimator (Sandbox)</p>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[80%] rounded-xl p-4 shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white border border-slate-200 text-slate-800'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 text-slate-500 rounded-xl p-4 text-sm shadow-sm">
              Cole is calculating...
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-slate-200 p-4">
        <form onSubmit={sendMessage} className="flex items-center gap-2 max-w-4xl mx-auto">
          <button type="button" className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors">
            <ImageIcon className="w-5 h-5" />
          </button>
          <button type="button" className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors">
            <Mic className="w-5 h-5" />
          </button>
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe the job, materials, or scope..."
            className="flex-1 border border-slate-300 rounded-full px-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
