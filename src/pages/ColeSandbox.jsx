import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Mic, HardHat } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

export default function ColeSandbox() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'cole', content: "Hey. I'm online and ready. What are we estimating today?" }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (!apiKey) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: input.trim() },
        { role: 'cole', content: "VITE_GEMINI_API_KEY is missing. Add it to Vercel Environment Variables to activate my brain." }
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Header */}
      <header style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155', padding: '16px 24px', display: 'flex', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)' }}>
        <div style={{ backgroundColor: '#f59e0b', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
          <HardHat style={{ width: 24, height: 24, color: '#0f172a' }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '0.02em', color: '#ffffff' }}>Cole</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Iron Foot AI Estimator (Sandbox)</p>
        </div>
      </header>

      {/* Messages Scroll View */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%',
              padding: '14px 18px',
              borderRadius: 14,
              backgroundColor: msg.role === 'user' ? '#2563eb' : '#1e293b',
              color: '#f8fafc',
              border: msg.role === 'user' ? 'none' : '1px solid #334155',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap'
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              backgroundColor: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
              padding: '12px 18px',
              borderRadius: 14,
              fontSize: 14,
              fontStyle: 'italic'
            }}>
              Cole is calculating line items & markups...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Bar */}
      <div style={{ backgroundColor: '#1e293b', borderTop: '1px solid #334155', padding: '16px' }}>
        <form onSubmit={sendMessage} style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 900, margin: '0 auto' }}>
          <button type="button" title="Upload Job Photo" style={{ background: '#334155', border: 'none', borderRadius: '50%', width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8' }}>
            <ImageIcon size={20} />
          </button>
          <button type="button" title="Voice Input" style={{ background: '#334155', border: 'none', borderRadius: '50%', width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8' }}>
            <Mic size={20} />
          </button>
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe the job, materials, or scope..."
            style={{
              flex: 1,
              backgroundColor: '#0f172a',
              border: '1px solid #475569',
              borderRadius: 24,
              padding: '12px 20px',
              color: '#ffffff',
              fontSize: 14,
              outline: 'none'
            }}
          />
          
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            style={{
              backgroundColor: input.trim() && !isLoading ? '#f59e0b' : '#475569',
              border: 'none',
              borderRadius: '50%',
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              color: '#0f172a',
              transition: 'background-color 0.2s ease'
            }}
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
