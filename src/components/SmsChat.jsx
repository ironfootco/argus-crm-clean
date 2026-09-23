import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function SmsChat({ customerId, customerPhone }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const currentUser = localStorage.getItem('argus_user') || 'Jason'; 

  useEffect(() => {
    if (customerPhone) {
      fetchMessages();
      
      const interval = setInterval(() => {
        fetchMessages(false);
      }, 10000); 
      
      return () => clearInterval(interval);
    }
  }, [customerPhone]);

  const fetchMessages = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    
    // Normalize the phone number to its core 10 digits
    const digits = customerPhone ? customerPhone.replace(/\D/g, '') : '';
    const tenDigit = (digits.length === 11 && digits.startsWith('1')) ? digits.slice(1) : digits;

    if (!tenDigit || tenDigit.length !== 10) {
      setLoading(false);
      return;
    }

    // Build every possible format the database might have saved over time
    const twilioFormat = `+1${tenDigit}`;
    const rawFormat = tenDigit;
    const waveFormat = `(${tenDigit.slice(0, 3)}) ${tenDigit.slice(3, 6)}-${tenDigit.slice(6, 10)}`;
    const dashFormat = `${tenDigit.slice(0, 3)}-${tenDigit.slice(3, 6)}-${tenDigit.slice(6, 10)}`;

    // Query Supabase for ALL formats to unify the thread
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`customer_phone.eq.${twilioFormat},customer_phone.eq.${rawFormat},customer_phone.eq.${waveFormat},customer_phone.eq.${dashFormat}`)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
    } else {
      console.error("Error fetching messages:", error);
    }
    
    if (showLoading) setLoading(false);
    scrollToBottom();
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    const textToSend = newMessage;
    setNewMessage(''); 

    try {
      // Force outbound texts to always use the strict Twilio format
      const digits = customerPhone.replace(/\D/g, '');
      const tenDigit = (digits.length === 11 && digits.startsWith('1')) ? digits.slice(1) : digits;
      const formattedTwilio = `+1${tenDigit}`;

      const response = await fetch('/api/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: formattedTwilio,
          body: textToSend,
          sender_name: currentUser
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      await fetchMessages(false);
    } catch (error) {
      console.error("Send Error:", error);
      alert("Failed to send message. Please try again.");
      setNewMessage(textToSend); 
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (loading) return <div style={{ padding: 20, color: 'var(--text-muted)' }}>Loading chat history...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => {
            const isOutbound = msg.direction === 'outbound';
            
            let bgColor = 'var(--bg-input)';
            let textColor = 'var(--text-main)';
            
            if (isOutbound) {
              if (msg.sender_name === 'Edwin') {
                bgColor = '#3b82f6'; 
                textColor = '#ffffff';
              } else {
                bgColor = '#eab308'; 
                textColor = '#000000';
              }
            }

            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOutbound ? 'flex-end' : 'flex-start' }}>
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
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.body}</div>
                  
                  {msg.media_url && (
                    <audio 
                      controls 
                      src={msg.media_url} 
                      style={{ 
                        width: '100%', 
                        maxWidth: '250px', 
                        height: '35px', 
                        marginTop: '10px', 
                        borderRadius: '4px' 
                      }} 
                    />
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 6 }}>
                  {isOutbound && <span style={{ fontWeight: 'bold' }}>{msg.sender_name || 'System'}</span>}
                  <span>{formatDate(msg.created_at)} at {formatTime(msg.created_at)}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: 16, borderTop: '1.5px solid var(--border-color)', background: 'var(--bg-card)' }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: 10 }}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Text ${customerPhone}...`}
            disabled={sending}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 8,
              border: '1.5px solid var(--border-color)',
              background: 'var(--bg-input)',
              color: 'var(--text-main)',
              fontSize: 15
            }}
          />
          <button 
            type="submit" 
            disabled={sending || !newMessage.trim()}
            style={{
              background: 'var(--success)',
              color: '#fff',
              border: 'none',
              padding: '0 24px',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 'bold',
              cursor: sending || !newMessage.trim() ? 'not-allowed' : 'pointer',
              opacity: sending || !newMessage.trim() ? 0.6 : 1
            }}
          >
            {sending ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
