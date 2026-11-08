import React, { useState } from 'react';
import { Send, Image as ImageIcon, Mic, HardHat } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

export default function ColeSandbox() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'cole', content: "Hey. I'm online and ready. What are we estimating today?" }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (!apiKey) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: input.trim() },
        { role: 'cole', content: "VITE_GEMINI_API_KEY is missing. Add it to your Vercel Environment Variables to activate my brain." }
      ]);
      setInput('');
      return;
    }

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setIsLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-pro",
        systemInstruction: `You are Cole, Iron Foot Company's AI estimating assistant and lead carpenter. You communicate in a direct, pragmatic, brotherly tone. 
          
          CORE ESTIMATING RULES:
          1. Materials: 70% markup on all retail/local supply prices to cover procurement.
          2. Labor: Jason is $120/hr. Edwin is $55/hr. Crew rate is $175/hr. Always enforce a 1-hour minimum charge for small service calls.
          3. Time Buffer: Apply a 1.25x to 1.3x multiplier to estimated labor hours to absorb hidden rot and site friction.
          4. Contingency: Bake a 20% buffer (of total labor + materials) directly into the line items.
          5. Deposit: A mandatory 1/3 deposit is required for any material costs >= $1,000.
          6. Disposal (Scituate Transfer Station): Minor bag cleanup is a $50 flat fee. A full pickup bed (~1,000 lbs) anchors at $300-$350. Freon/TVs are $20/ea, Mattresses $75/ea. Suggest a dumpster for anything over 2.5 cubic yards.
          7. Unknown Rot/Structure: If framing is hidden, do NOT guess. Quote a flat-fee "Stage 1 Exploratory Demo Scope" to open it up before writing the real repair estimate.
          
          Always draft a clear, high-anchor total price so Iron Foot is protected.`
      });

      const result = await model.generateContent(userMessage);
      const reply = result.response.text();

      setMessages((prev) => [...prev, { role: 'cole', content: reply }]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev, 
        { role: 'cole', content: "Hit a snag generating the estimate: " + (error.message || "Unknown error") }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      <header className="bg-slate-900 text-white p-4 flex items-center shadow-md">
        <HardHat className="w-6 h-6 mr-3 text-amber-500" />
        <div>
          <h1 className="text-lg font-bold">Cole</h1>
          <p className="text-xs text-slate-400">Iron Foot AI Estimator (Sandbox)</p>
        </div>
      </header>

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
            <div className="bg-white border border-slate-200 text-slate-500 rounded-xl p-4 text-sm shadow-sm animate-pulse">
              Cole is calculating...
            </div>
          </div>
        )}
      </div>

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
