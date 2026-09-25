import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function SmsChat({ customerId, customerPhone }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [workerPhone, setWorkerPhone] = useState(null);
  
  // MMS State
  const [attachment, setAttachment] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Reaction State
  const [activeReactMsgId, setActiveReactMsgId] = useState(null);

  // Add Contact State
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: customerPhone || '', email: '', address: '' });
  const [savingContact, setSavingContact] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const currentUser = localStorage.getItem('argus_user') || 'Jason'; 

  useEffect(() => {
    setMessages([]);
    if (customerPhone) {
      setNewContact(prev => ({ ...prev, phone: customerPhone }));
      fetchMessages();
      fetchWorkerPhone();
      const interval = setInterval(() => fetchMessages(false), 10000); 
      return () => clearInterval(interval);
    }
  }, [customerPhone]);

  const fetchWorkerPhone = async () => {
    try {
      const { data } = await supabase.from('team_members').select('phone').eq('name', currentUser).single();
      if (data?.phone) setWorkerPhone(data.phone);
    } catch (e) { console.error("Worker phone fetch error:", e); }
  };

  const fetchMessages = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      
      const safePhone = customerPhone ? String(customerPhone) : '';
      const digits = safePhone.replace(/\D/g, '');
      const coreNumber = (digits.length === 11 && digits.startsWith('1')) ? digits.slice(1) : digits;
      
      if (!coreNumber) {
        if (showLoading) setLoading(false);
        return;
      }

      const phoneFormats = [`+1${coreNumber}`, `+${coreNumber}`, coreNumber, `1${coreNumber}`, safePhone];
      if (coreNumber.length === 10) {
        phoneFormats.push(`(${coreNumber.slice(0, 3)}) ${coreNumber.slice(3, 6)}-${coreNumber.slice(6, 10)}`);
        phoneFormats.push(`${coreNumber.slice(0, 3)}-${coreNumber.slice(3, 6)}-${coreNumber.slice(6, 10)}`);
      }

      const { data, error } = await supabase.from('messages').select('*').in('customer_phone', phoneFormats).order('created_at', { ascending: true });
      if (!error && data) {
        setMessages(data);
        const unreadIds = data.filter(msg => msg.direction === 'inbound' && !msg.is_read).map(msg => msg.id);
        if (unreadIds.length > 0) await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
      }
      
      if (showLoading) setLoading(false);
      scrollToBottom();
    } catch (e) {
      console.error("Message Fetch Error:", e);
      if (showLoading) setLoading(false);
    }
  };

  const scrollToBottom = () => setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

  const handleClickToCall = async () => {
    if (!customerPhone) return alert("No customer phone number saved.");
    if (!workerPhone) return alert(`We could not find a phone number for ${currentUser}.`);
    
    const safeCustomer = String(customerPhone);
    const safeWorker = String(workerPhone);
    
    const cCore = safeCustomer.replace(/\D/g, '').slice(-10);
    const wCore = safeWorker.replace(/\D/g, '').slice(-10);

    try {
      const res = await fetch('/api/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerNumber: `+1${cCore}`, workerNumber: `+1${wCore}` })
      });
      if (!res.ok) throw new Error("Call failed to initiate");
      alert(`📞 Calling your cell now!`);
    } catch (err) { alert(err.message); }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAttachment(file);
    const reader = new FileReader();
    reader.onload = (event) => setAttachmentPreview(event.target.result);
    reader.readAsDataURL(file);
  };

  const clearAttachment = () => {
    setAttachment(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendOutbound = async (text, mediaUrl = null) => {
    const safePhone = customerPhone ? String(customerPhone) : '';
    const coreNumber = safePhone.replace(/\D/g, '').slice(-10);
    const response = await fetch('/api/outbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: `+1${coreNumber}`, body: text, sender_name: currentUser, mediaUrl })
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to send message via Twilio API');
    }
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !attachment) return;

    setSending(true);
    const textToSend = newMessage;
    setNewMessage(''); 
    let uploadedMediaUrl = null;

    try {
      if (attachment) {
        setUploadingImage(true);
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
        const { error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, attachment);
        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from('chat_media').getPublicUrl(fileName);
        uploadedMediaUrl = data.publicUrl;
      }

      await sendOutbound(textToSend, uploadedMediaUrl);
      clearAttachment();
      await fetchMessages(false);
    } catch (error) {
      console.error("Detailed Send Error:", error);
      alert("Error: " + (error.message || "Unknown error"));
      setNewMessage(textToSend); 
    } finally {
      setSending(false);
      setUploadingImage(false);
    }
  };

  const handleReact = async (msg, emoji) => {
    setActiveReactMsgId(null);
    setSending(true);
    try {
      await sendOutbound(emoji, null);
      await fetchMessages(false);
    } catch (err) {
      alert("Failed to send reaction.");
    } finally {
      setSending(false);
    }
  };

  // Save new contact function (Syncs to Supabase & Wave)
  const handleSaveContact = async () => {
    setSavingContact(true);
    try {
      // 1. Save to Supabase
      const { error: dbError } = await supabase.from('customers').insert([{
        name: newContact.name,
        phone: newContact.phone,
        email: newContact.email || null,
        address: newContact.address || null
      }]);
      
      if (dbError) throw dbError;

      // 2. Sync to Wave in the background
      await fetch('/api/waveCustomer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newContact.name,
          phone: newContact.phone,
          email: newContact.email,
          address: newContact.address
        })
      });
      
      setShowSaveModal(false);
      window.location.reload(); 
    } catch (err) {
      alert("Error saving contact: " + err.message);
      setSavingContact(false);
    }
  };

  const handleTextareaChange = (e) => {
    setNewMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const formatTime = (dStr) => {
    try { return new Date(dStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } 
    catch (e) { return ''; }
  };
  
  const formatDate = (dStr) => {
    try { return new Date(dStr).toLocaleDateString([], { month: 'short', day: 'numeric' }); } 
    catch (e) { return ''; }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    marginBottom: 12,
    borderRadius: 8,
    border: '1px solid var(--border-color)',
    background: 'var(--bg-input)',
    color: 'var(--text-main)',
    fontSize: 15,
    boxSizing: 'border-box'
  };

  if (loading) return <div style={{ padding: 20, color: 'var(--text-muted)' }}>Loading chat history...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      
      {/* HEADER */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', zIndex: 10 }}>
        <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: 16 }}>{customerPhone || 'Unknown Contact'}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          
          {(!customerId || customerId === 'unsaved') && (
            <button onClick={() => setShowSaveModal(true)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              ➕ Save
            </button>
          )}

          <button onClick={handleClickToCall} style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>📞 Call</button>
        </div>
      </div>

      {/* CHAT THREAD */}
      <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>No messages yet.</div>
        ) : (
          messages.map((msg) => {
            if (!msg) return null;
            const isOutbound = msg.direction === 'outbound';
            const bgColor = isOutbound ? (msg.sender_name === 'Edwin' ? '#3b82f6' : '#eab308') : 'var(--bg-input)';
            const textColor = isOutbound ? (msg.sender_name === 'Edwin' ? '#ffffff' : '#000000') : 'var(--text-main)';

            return (
              <div key={msg.id || Math.random()} style={{ display: 'flex', flexDirection: 'column', alignItems: isOutbound ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: 12, fontSize: 14, lineHeight: '1.4', background: bgColor, color: textColor, border: isOutbound ? 'none' : '1px solid var(--border-color)', borderBottomRightRadius: isOutbound ? 2 : 12, borderBottomLeftRadius: isOutbound ? 12 : 2 }}>
                  
                  {msg.body && typeof msg.body === 'string' && (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.body}</div>
                  )}
                  
                  {msg.media_url && typeof msg.media_url === 'string' && (
                    msg.media_url.includes('Recordings') ? 
                      <audio controls src={msg.media_url} style={{ width: '100%', maxWidth: '250px', height: '35px', marginTop: '10px', borderRadius: '4px' }} />
                    : 
                      <a href={msg.media_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: msg.body ? '10px' : '0' }}>
                        <img src={msg.media_url} alt="Media" style={{ width: '100%', maxWidth: '250px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.2)' }} />
                      </a>
                  )}
                </div>
                
                {/* METADATA & REACTION BUTTON */}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isOutbound && <span style={{ fontWeight: 'bold' }}>{msg.sender_name || 'System'}</span>}
                  <span>{formatDate(msg.created_at)} at {formatTime(msg.created_at)}</span>
                  
                  {!isOutbound && (
                    <div style={{ position: 'relative' }}>
                      <button onClick={() => setActiveReactMsgId(activeReactMsgId === msg.id ? null : msg.id)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 11, fontWeight: 'bold', padding: '0 4px' }}>
                        React
                      </button>
                      {activeReactMsgId === msg.id && (
                        <div style={{ position: 'absolute', top: -35, left: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 20, padding: '4px 8px', display: 'flex', gap: 8, boxShadow: '0 4px 6px rgba(0,0,0,0.3)', zIndex: 10 }}>
                          {['👍', '❤️', '😂', '‼️'].map(emoji => (
                            <span key={emoji} onClick={() => handleReact(msg, emoji)} style={{ cursor: 'pointer', fontSize: 16 }}>{emoji}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA WITH MMS */}
      <div style={{ padding: 12, borderTop: '1.5px solid var(--border-color)', background: 'var(--bg-card)' }}>
        
        {attachmentPreview && (
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 10 }}>
            <img src={attachmentPreview} alt="Preview" style={{ height: 80, borderRadius: 8, border: '2px solid var(--primary)' }} />
            <button onClick={clearAttachment} style={{ position: 'absolute', top: -8, right: -8, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: 12, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
          </div>
        )}

        <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', width: '100%', boxSizing: 'border-box' }}>
          <label style={{ cursor: 'pointer', padding: '10px', background: 'var(--bg-input)', borderRadius: 8, border: '1.5px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '46px', boxSizing: 'border-box', flexShrink: 0 }}>
            📎
            <input type="file" accept="image/*" onChange={handleFileSelect} ref={fileInputRef} style={{ display: 'none' }} />
          </label>

          <textarea
            value={newMessage}
            onChange={handleTextareaChange}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
            placeholder="Text message"
            disabled={sending || uploadingImage}
            rows={1}
            style={{ flex: 1, padding: '12px 14px', borderRadius: 8, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15, resize: 'none', minHeight: '20px', maxHeight: '120px', overflowY: 'auto', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          
          <button 
            type="submit" 
            disabled={sending || uploadingImage || (!newMessage.trim() && !attachment)}
            style={{ background: 'var(--success)', color: '#fff', border: 'none', height: '46px', padding: '0 16px', borderRadius: 8, fontSize: 15, fontWeight: 'bold', cursor: (sending || uploadingImage || (!newMessage.trim() && !attachment)) ? 'not-allowed' : 'pointer', opacity: (sending || uploadingImage || (!newMessage.trim() && !attachment)) ? 0.6 : 1, flexShrink: 0 }}
          >
            {sending || uploadingImage ? '...' : 'Send'}
          </button>
        </form>
      </div>

      {/* SAVE CONTACT MODAL OVERLAY */}
      {showSaveModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 12, width: '100%', maxWidth: 400, border: '1px solid var(--border-color)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-main)' }}>Save New Contact</h3>
            
            <input placeholder="Full Name *" required value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} style={inputStyle} />
            <input placeholder="Phone *" required value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} style={inputStyle} />
            <input placeholder="Email (Optional)" value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} style={inputStyle} />
            <input placeholder="Address (Optional)" value={newContact.address} onChange={e => setNewContact({...newContact, address: e.target.value})} style={inputStyle} />
            
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button onClick={() => setShowSaveModal(false)} style={{ flex: 1, padding: '12px', background: 'var(--bg-input)', color: 'var(--text-main)', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveContact} disabled={!newContact.name || !newContact.phone || savingContact} style={{ flex: 1, padding: '12px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: (!newContact.name || !newContact.phone || savingContact) ? 'not-allowed' : 'pointer', opacity: (!newContact.name || !newContact.phone) ? 0.5 : 1 }}>
                {savingContact ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
