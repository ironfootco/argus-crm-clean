import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function SmsChat({ customerId, customerPhone }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [workerPhone, setWorkerPhone] = useState(null);
  const messagesEndRef = useRef(null);

  const currentUser = localStorage.getItem('argus_user') || 'Jason'; 

  useEffect(() => {
    setMessages([]);
    if (customerPhone) {
      fetchMessages();
      fetchWorkerPhone();
      
      const interval = setInterval(() => {
        fetchMessages(false);
      }, 10000); 
      
      return () => clearInterval(interval);
    }
  }, [customerPhone]);

  const fetchWorkerPhone = async () => {
    const { data: teamData } = await supabase
      .from('team_members')
      .select('phone')
      .eq('name', currentUser)
      .single();
    
    if (teamData && teamData.phone) {
      setWorkerPhone(teamData.phone);
    }
  };

  const fetchMessages = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    
    const digits = customerPhone ? customerPhone.replace(/\D/g, '') : '';
    const coreNumber = (digits.length === 11 && digits.startsWith('1')) ? digits.slice(1) : digits;

    if (!coreNumber) {
      setLoading(false);
      return;
    }

    const phoneFormats = [
      `+1${coreNumber}`, 
      `+${coreNumber}`,  
      coreNumber,        
      `1${coreNumber}`,  
      customerPhone      
    ];

    if (coreNumber.length === 10) {
      phoneFormats.push(`(${coreNumber.slice(0, 3)}) ${coreNumber.slice(3, 6)}-${coreNumber.slice(6, 10)}`);
      phoneFormats.push(`${coreNumber.slice(0, 3)}-${coreNumber.slice(3, 6)}-${coreNumber.slice(6, 10)}`);
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .in('customer_phone', phoneFormats)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);

      const unreadIds = data
        .filter(msg => msg.direction === 'inbound' && msg.is_read === false)
        .map(msg => msg.id);

      if (unreadIds.length > 0) {
        await supabase
          .from('messages')
          .update({ is_read: true })
          .in('id', unreadIds);
      }
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

  // --- TWILIO CLICK-TO-CONNECT DIALER ---
  const handleClickToCall = async () => {
    if (!customerPhone) return alert("No customer phone number saved.");
    if (!workerPhone) return alert(`We could not find a phone number for ${currentUser} in the team accounts.`);

    const cDigits = customerPhone.replace(/\D/g, '');
    const cCore = (cDigits.length === 11 && cDigits.startsWith('1')) ? cDigits.slice(1) : cDigits;
    const formattedCustomerTwilio = cCore.length === 10 ? `+1${cCore}` : cCore;

    const wDigits = workerPhone.replace(/\D/g, '');
    const wCore = (wDigits.length === 11 && wDigits.startsWith('1')) ? wDigits.slice(1) : wDigits;
    const formattedWorkerTwilio = wCore.length === 10 ? `+1${wCore}` : wCore;

    try {
      const res = await fetch('/api/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerNumber: formattedCustomerTwilio,
          workerNumber: formattedWorkerTwilio
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Call failed to initiate");
      }
      alert(`📞 Calling your cell (${formattedWorkerTwilio}) now! Answer it to connect to the customer.`);
    } catch (err) {
      alert("Error starting call: " + err.message);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    const textToSend = newMessage;
    setNewMessage(''); 

    try {
      const digits = customerPhone.replace(/\D/g, '');
      const coreNumber = (digits.length === 11 && digits.startsWith('1')) ? digits.slice(1) : digits;
      const formattedTwilio = coreNumber.length === 10 ? `+1${coreNumber}` : coreNumber;

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

  // Helper to auto-resize the textarea as the user types
  const handleTextareaChange = (e) => {
    setNewMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
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
      
      {/* HEADER WITH DIALER */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', zIndex: 10 }}>
        <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: 16 }}>
          {customerPhone}
        </div>
        <button 
          onClick={handleClickToCall} 
          style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          title="Call via Argus Business Line"
        >
          📞 Call
        </button>
      </div>

      {/* CHAT THREAD */}
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

      {/* INPUT AREA (FIXED FOR MOBILE) */}
      <div style={{ padding: 12, borderTop: '1.5px solid var(--border-color)', background: 'var(--bg-card)' }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', width: '100%', boxSizing: 'border-box' }}>
          <textarea
            value={newMessage}
            onChange={handleTextareaChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            placeholder={`Text ${customerPhone}...`}
            disabled={sending}
            rows={1}
            style={{
              flex: 1,
              padding: '12px 14px',
              borderRadius: 8,
              border: '1.5px solid var(--border-color)',
              background: 'var(--bg-input)',
              color: 'var(--text-main)',
              fontSize: 15,
              resize: 'none',
              minHeight: '20px',
              maxHeight: '120px',
              overflowY: 'auto',
              boxSizing: 'border-box',
              fontFamily: 'inherit'
            }}
          />
          <button 
            type="submit" 
            disabled={sending || !newMessage.trim()}
            style={{
              background: 'var(--success)',
              color: '#fff',
              border: 'none',
              height: '46px', // Matches the default height of the textarea
              padding: '0 16px',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 'bold',
              cursor: sending || !newMessage.trim() ? 'not-allowed' : 'pointer',
              opacity: sending || !newMessage.trim() ? 0.6 : 1,
              flexShrink: 0 // Prevents the button from getting squished on narrow screens
            }}
          >
            {sending ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
