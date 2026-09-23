import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import SmsChat from '../components/SmsChat';

const getTenDigitPhone = (phone) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return (digits.length === 11 && digits.startsWith('1')) ? digits.slice(1) : digits;
};

const formatPhone = (phone) => {
  const ten = getTenDigitPhone(phone);
  if (ten.length === 10) return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6, 10)}`;
  return phone;
};

export default function CommunicationHub() {
  const navigate = useNavigate();
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [allCustomers, setAllCustomers] = useState([]);
  const [isComposing, setIsComposing] = useState(false);
  const [composeInput, setComposeInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false); // Controls the custom dropdown

  useEffect(() => {
    fetchThreads();
  }, []);

  const fetchThreads = async () => {
    setLoading(true);
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('customer_phone, customer_id, created_at, body, direction, is_read')
      .order('created_at', { ascending: false });

    // Added explicit ordering by first_name
    const { data: customers, error: custError } = await supabase
      .from('customers')
      .select('id, first_name, last_name, phone')
      .order('first_name', { ascending: true });

    if (msgError || custError) {
      console.error("Error fetching data:", msgError || custError);
      setLoading(false);
      return;
    }

    setAllCustomers(customers || []);

    const customerMap = {};
    customers.forEach(c => {
      const tenDigit = getTenDigitPhone(c.phone);
      if (tenDigit) customerMap[tenDigit] = c;
    });

    const unreadMap = {};
    messages.forEach((msg) => {
      const tenDigit = getTenDigitPhone(msg.customer_phone);
      if (msg.direction === 'inbound' && msg.is_read === false) {
        unreadMap[tenDigit] = true;
      }
    });

    const uniqueThreads = [];
    const seenPhones = new Set();

    messages.forEach((msg) => {
      const tenDigitMsgPhone = getTenDigitPhone(msg.customer_phone);
      if (!seenPhones.has(tenDigitMsgPhone)) {
        seenPhones.add(tenDigitMsgPhone);
        const matchedCustomer = customerMap[tenDigitMsgPhone] || null;
        uniqueThreads.push({
          ...msg,
          displayPhone: formatPhone(msg.customer_phone),
          displayName: matchedCustomer ? `${matchedCustomer.first_name || ''} ${matchedCustomer.last_name || ''}`.trim() : null,
          matchedCustomer: matchedCustomer,
          hasUnread: unreadMap[tenDigitMsgPhone] || false 
        });
      }
    });

    setThreads(uniqueThreads);
    
    if (!activeThread && !isComposing && uniqueThreads.length > 0 && window.innerWidth > 768) {
      setActiveThread(uniqueThreads[0]);
    }
    setLoading(false);
  };

  const handleThreadClick = (thread) => {
    setActiveThread(thread);
    setIsComposing(false);
    
    setThreads(prevThreads => 
      prevThreads.map(t => 
        t.customer_phone === thread.customer_phone ? { ...t, hasUnread: false } : t
      )
    );
  };

  const handleDeleteThread = async () => {
    if (!window.confirm(`Are you sure you want to delete all messages with ${activeThread.displayPhone}? This cannot be undone.`)) return;
    
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('customer_phone', activeThread.customer_phone);
      
    if (!error) {
      setActiveThread(null);
      fetchThreads(); 
    } else {
      alert("Failed to delete thread.");
      console.error(error);
    }
  };

  const handleStartCompose = () => {
    setActiveThread(null);
    setIsComposing(true);
    setComposeInput('');
    setShowDropdown(false);
  };

  // Separated the routing logic so the custom dropdown can instantly trigger it
  const processCompose = (phoneTarget) => {
    const tenDigit = getTenDigitPhone(phoneTarget);
    
    if (tenDigit.length !== 10) {
      alert("Please enter or select a valid 10-digit phone number.");
      return;
    }

    const formattedTwilio = `+1${tenDigit}`;
    const existingThread = threads.find(t => getTenDigitPhone(t.customer_phone) === tenDigit);

    if (existingThread) {
      handleThreadClick(existingThread);
    } else {
      const matchedCustomer = allCustomers.find(c => getTenDigitPhone(c.phone) === tenDigit);
      setActiveThread({
        customer_phone: formattedTwilio,
        displayPhone: formatPhone(formattedTwilio),
        displayName: matchedCustomer ? `${matchedCustomer.first_name || ''} ${matchedCustomer.last_name || ''}`.trim() : null,
        matchedCustomer: matchedCustomer || null
      });
    }
    setIsComposing(false);
  };

  const handleComposeSubmit = (e) => {
    e.preventDefault();
    processCompose(composeInput);
  };

  return (
    <>
      <style>{`
        .inbox-wrapper { display: flex; gap: 20px; height: calc(100vh - 180px); min-height: 500px; }
        .inbox-sidebar { width: 35%; display: flex; flex-direction: column; background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 10px; overflow: hidden; }
        .inbox-main { flex: 1; display: flex; flex-direction: column; background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 10px; overflow: hidden; }
        .mobile-back-btn { display: none; }
        
        /* Custom scrollbar for the dropdown */
        .custom-dropdown::-webkit-scrollbar { width: 8px; }
        .custom-dropdown::-webkit-scrollbar-track { background: var(--bg-card); border-radius: 4px; }
        .custom-dropdown::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 4px; }

        @media (max-width: 768px) {
          .inbox-wrapper { flex-direction: column; height: calc(100vh - 120px); min-height: 0; gap: 0; }
          .inbox-sidebar { width: 100%; height: 100%; border-radius: 8px; display: ${activeThread || isComposing ? 'none' : 'flex'}; }
          .inbox-main { width: 100%; height: 100%; border-radius: 8px; display: ${activeThread || isComposing ? 'flex' : 'none'}; }
          .mobile-back-btn { display: inline-flex; align-items: center; justify-content: center; background: var(--bg-input); border: 1.5px solid var(--border-color); color: var(--text-main); padding: 6px 10px; border-radius: 6px; font-weight: bold; font-size: 13px; margin-right: 10px; cursor: pointer; }
        }
      `}</style>
      
      <div className="inbox-wrapper">
        <div className="inbox-sidebar">
          <div style={{ padding: '16px', borderBottom: '1.5px solid var(--border-color)', background: 'var(--bg-input)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text-main)' }}>Inbox</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 'bold', background: 'var(--primary)', color: 'var(--primary-text)', padding: '6px 10px', borderRadius: 12 }}>SMS / Text</span>
              <button 
                onClick={handleStartCompose}
                style={{ background: 'var(--success)', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 'bold', cursor: 'pointer' }}
              >
                + New
              </button>
            </div>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 20, color: 'var(--text-muted)' }}>Loading messages...</div>
            ) : threads.length === 0 ? (
              <div style={{ padding: 20, color: 'var(--text-muted)' }}>No conversations yet.</div>
            ) : (
              threads.map((thread) => {
                const isActive = activeThread?.customer_phone === thread.customer_phone;
                return (
                  <div
                    key={thread.customer_phone}
                    onClick={() => handleThreadClick(thread)}
                    style={{ 
                      padding: 16, 
                      borderBottom: '1px solid var(--border-color)', 
                      cursor: 'pointer', 
                      background: isActive ? 'var(--bg-input)' : 'transparent',
                      borderLeft: isActive ? '4px solid var(--primary)' : '4px solid transparent'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {thread.hasUnread && (
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 }}></span>
                      )}
                      {thread.displayName || thread.displayPhone}
                    </div>
                    {thread.displayName && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {thread.displayPhone}
                      </div>
                    )}
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {thread.direction === 'outbound' ? 'You: ' : ''}{thread.body}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="inbox-main">
          {isComposing ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1.5px solid var(--border-color)', paddingBottom: 16 }}>
                <button onClick={() => setIsComposing(false)} className="mobile-back-btn" style={{ display: 'inline-flex' }}>🔙 Back</button>
                <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text-main)' }}>New Message</h2>
              </div>
              
              <form onSubmit={handleComposeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--text-main)' }}>To: (Search Name or Enter Number)</label>
                <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
                  
                  {/* Custom Autocomplete Input */}
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input 
                      type="text"
                      value={composeInput}
                      onChange={(e) => {
                        setComposeInput(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                      placeholder="e.g. Jason Foote or 7815551234"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: 15 }}
                      autoFocus
                    />
                    
                    {/* The Custom Dropdown Menu */}
                    {showDropdown && composeInput && (
                      <ul className="custom-dropdown" style={{ 
                        position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', 
                        border: '1.5px solid var(--border-color)', borderRadius: 6, zIndex: 10, 
                        maxHeight: 250, overflowY: 'auto', margin: '4px 0 0 0', padding: 0, listStyle: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                      }}>
                        {allCustomers
                          .filter(c => `${c.first_name} ${c.last_name} ${c.phone}`.toLowerCase().includes(composeInput.toLowerCase()))
                          .map(c => (
                            <li 
                              key={c.id} 
                              onMouseDown={() => processCompose(c.phone)} // Instantly loads chat on click
                              style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                              <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{c.first_name} {c.last_name}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatPhone(c.phone)}</span>
                            </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <button 
                    type="submit"
                    style={{ background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', padding: '10px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Start Chat
                  </button>
                </div>
              </form>
            </div>
          ) : activeThread ? (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1.5px solid var(--border-color)', background: 'var(--bg-input)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button onClick={() => setActiveThread(null)} className="mobile-back-btn">
                    🔙 Back
                  </button>
                  <div>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: 16, color: 'var(--text-main)' }}>
                      {activeThread.displayName || activeThread.displayPhone}
                    </h2>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                      {activeThread.displayName ? activeThread.displayPhone : 'Unsaved Contact'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {activeThread.matchedCustomer && (
                    <button 
                      onClick={() => navigate(`/customers/${activeThread.matchedCustomer.id}`)}
                      style={{ background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 12 }}
                    >
                      👤 Profile
                    </button>
                  )}
                  <button 
                    onClick={handleDeleteThread}
                    style={{ background: '#ef4444', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 12 }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
              
              <div style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <SmsChat 
                  customerId={activeThread.matchedCustomer?.id || null} 
                  customerPhone={activeThread.customer_phone} 
                />
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Select a conversation to view details
            </div>
          )}
        </div>
      </div>
    </>
  );
}
