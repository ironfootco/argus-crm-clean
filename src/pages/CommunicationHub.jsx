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

  useEffect(() => {
    fetchThreads();
  }, []);

  const fetchThreads = async () => {
    setLoading(true);
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('customer_phone, customer_id, created_at, body, direction')
      .order('created_at', { ascending: false });

    const { data: customers, error: custError } = await supabase
      .from('customers')
      .select('id, first_name, last_name, phone');

    if (msgError || custError) {
      console.error("Error fetching data:", msgError || custError);
      setLoading(false);
      return;
    }

    const customerMap = {};
    customers.forEach(c => {
      const tenDigit = getTenDigitPhone(c.phone);
      if (tenDigit) customerMap[tenDigit] = c;
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
          matchedCustomer: matchedCustomer
        });
      }
    });

    setThreads(uniqueThreads);
    // On desktop, auto-select the newest thread. On mobile, let them view the list first.
    if (uniqueThreads.length > 0 && window.innerWidth > 768) {
      setActiveThread(uniqueThreads[0]);
    }
    setLoading(false);
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

  return (
    <>
      {/* Mobile Responsive CSS */}
      <style>{`
        .inbox-wrapper { display: flex; gap: 20px; height: calc(100vh - 180px); min-height: 500px; }
        .inbox-sidebar { width: 35%; display: flex; flex-direction: column; background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 10px; overflow: hidden; }
        .inbox-main { flex: 1; display: flex; flex-direction: column; background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 10px; overflow: hidden; }
        .mobile-back-btn { display: none; }
        
        @media (max-width: 768px) {
          .inbox-wrapper { flex-direction: column; height: calc(100vh - 120px); min-height: 0; gap: 0; }
          .inbox-sidebar { width: 100%; height: 100%; border-radius: 8px; display: ${activeThread ? 'none' : 'flex'}; }
          .inbox-main { width: 100%; height: 100%; border-radius: 8px; display: ${activeThread ? 'flex' : 'none'}; }
          .mobile-back-btn { display: inline-flex; align-items: center; justify-content: center; background: var(--bg-input); border: 1.5px solid var(--border-color); color: var(--text-main); padding: 6px 10px; border-radius: 6px; font-weight: bold; font-size: 13px; margin-right: 10px; cursor: pointer; }
        }
      `}</style>
      
      <div className="inbox-wrapper">
        {/* Sidebar: Thread List */}
        <div className="inbox-sidebar">
          <div style={{ padding: '16px', borderBottom: '1.5px solid var(--border-color)', background: 'var(--bg-input)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text-main)' }}>Inbox</h2>
            <span style={{ fontSize: 11, fontWeight: 'bold', background: 'var(--primary)', color: 'var(--primary-text)', padding: '4px 8px', borderRadius: 12 }}>SMS / Text</span>
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
                    onClick={() => setActiveThread(thread)}
                    style={{ 
                      padding: 16, 
                      borderBottom: '1px solid var(--border-color)', 
                      cursor: 'pointer', 
                      background: isActive ? 'var(--bg-input)' : 'transparent',
                      borderLeft: isActive ? '4px solid var(--primary)' : '4px solid transparent'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: 15 }}>
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

        {/* Main Content: Active Chat */}
        <div className="inbox-main">
          {activeThread ? (
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

                {/* Action Buttons */}
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
