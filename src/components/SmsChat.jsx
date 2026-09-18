import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient'; 

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
  const [activeWorker, setActiveWorker] = useState('Jason');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user?.email) {
        setActiveWorker(data.session.user.email.toLowerCase().includes('edwin') ? 'Edwin' : 'Jason');
      }
    });
    fetchMessages();
  }, [customerPhone]);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('customer_phone', customerPhone)
      .order('created_at', { ascending: true });
    
    if (data) {
       setMessages(data);
       // Auto-scroll down to the newest text when you open a thread
       setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 150);
    }
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
          customerId: customerId,
          senderName: activeWorker 
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', padding: 12 }}>
      
      {/* Scrollable messages area */}
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4 }}>
        {messages.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 20, fontSize: 14 }}>No messages yet.</div>
        ) : (
          messages.map((msg) => {
            const isOutbound = msg.direction === 'outbound';
            const isEdwin = msg.sender_name === 'Edwin';
            
            const bgColor = isOutbound ? (isEdwin ? '#3b82f6' : 'var(--primary)') : 'var(--bg-card)';
            const textColor = isOutbound ? (isEdwin ? '#ffffff' : 'var(--primary-text)') : 'var(--text-main)';

            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOutbound ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  fontSize: 14,
                  lineHeight: '1.4',
                  background: bgColor,
                  color: textColor,
                  border: isOutbound ? 'none' : '1px solid var(--border-color)',
                  borderBottomRightRadius: isOutbound ? 2 : 12,
                  borderBottomLeftRadius: isOutbound ? 12 : 2
                }}>
                  {msg.body}
                </div>
                
                {/* 🔴 This is what actually forces the names to render on screen! */}
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, padding: '0 4px' }}>
                  {isOutbound ? `${msg.sender_name || 'Jason'} • ` : 'Customer • '}
                  {formatTime(msg.created_at)}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input row pinned to the bottom */}
      <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, padding: '4px 0' }}>
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
