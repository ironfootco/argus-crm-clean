import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient'; 

// Helper to format timestamps nicely (e.g., "Sep 17 at 10:30 AM")
const formatTime = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' at ' + 
         d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export default function SmsChat({ customerId, customerPhone }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetchMessages();
  }, [customerPhone]);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('customer_phone', customerPhone)
      .order('created_at', { ascending: true });
    
    if (data) setMessages(data);
    if (error) console.error("Error fetching messages:", error);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setIsSending(true);

    try {
      const res = await fetch('/api/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: customerPhone,
          body: newMessage,
          customerId: customerId
        })
      });

      if (res.ok) {
        setNewMessage('');
        fetchMessages(); 
      }
    } catch (error) {
      console.error("Failed to send:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '350px', background: 'var(--bg-input)', border: '1.5px solid var(--border-color)', borderRadius: 10, padding: 16 }}>
      {/* Messages Area */}
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messages.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 20, fontSize: 14 }}>No messages yet.</div>
        ) : (
          messages.map((msg) => {
            const isOutbound = msg.direction === 'outbound';
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOutbound ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                <div style={{
                  maxWidth: '75%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  fontSize: 14,
                  lineHeight: '1.4',
                  background: isOutbound ? 'var(--primary)' : 'var(--bg-card)',
                  color: isOutbound ? 'var(--primary-text)' : 'var(--text-main)',
                  border: isOutbound ? 'none' : '1px solid var(--border-color)',
                  borderBottomRightRadius: isOutbound ? 2 : 12,
                  borderBottomLeftRadius: isOutbound ? 12 : 2
                }}>
                  {msg.body}
                </div>
                {/* Timestamp added here */}
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, padding: '0 4px' }}>
                  {formatTime(msg.created_at)}
                </span>
              </div>
            );
          })
        )}
      </div>
      
      {/* Input Area */}
      <form onSubmit={handleSend} style={{ display: 'flex', gap: 10 }}>
        <input 
          type="text" 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..." 
          style={{ flex: 1, padding: '10px 14px', borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 14 }}
          disabled={isSending}
        />
        <button 
          type="submit" 
          disabled={isSending}
          style={{ background: 'var(--success)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 14, opacity: isSending ? 0.6 : 1 }}
        >
          {isSending ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
