import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import SmsChat from '../components/SmsChat';

// Helper to strip country codes/formatting for bulletproof database matching
const getTenDigitPhone = (phone) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return (digits.length === 11 && digits.startsWith('1')) ? digits.slice(1) : digits;
};

// Helper to make unknown numbers look pretty
const formatPhone = (phone) => {
  const ten = getTenDigitPhone(phone);
  if (ten.length === 10) return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6, 10)}`;
  return phone; // Fallback for 5-6 digit spam shortcodes
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
    
    // 1. Fetch all messages
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('customer_phone, customer_id, created_at, body, direction')
      .order('created_at', { ascending: false });

    // 2. Fetch all customers to build a cross-reference directory
    const { data: customers, error: custError } = await supabase
      .from('customers')
      .select('id, first_name, last_name, phone');

    if (msgError || custError) {
      console.error("Error fetching data:", msgError || custError);
      setLoading(false);
      return;
    }

    // Map customers by their raw 10-digit phone number
    const customerMap = {};
    customers.forEach(c => {
      const tenDigit = getTenDigitPhone(c.phone);
      if (tenDigit) customerMap[tenDigit] = c;
    });

    // 3. Group threads and attach customer names
    const uniqueThreads = [];
    const seenPhones = new Set();

    messages.forEach((msg) => {
      const tenDigitMsgPhone = getTenDigitPhone(msg.customer_phone);
      
      if (!seenPhones.has(tenDigitMsgPhone)) {
        seenPhones.add(tenDigitMsgPhone);
        
        const matchedCustomer = customerMap[tenDigitMsgPhone] || null;
        const displayName = matchedCustomer 
          ? `${matchedCustomer.first_name || ''} ${matchedCustomer.last_name || ''}`.trim()
          : null;

        uniqueThreads.push({
          ...msg,
          displayPhone: formatPhone(msg.customer_phone),
          displayName: displayName,
          matchedCustomer: matchedCustomer
        });
      }
    });

    setThreads(uniqueThreads);
    if (uniqueThreads.length > 0) setActiveThread(uniqueThreads[0]);
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 160px)', minHeight: 500 }}>
      
      {/* Sidebar: Thread List */}
      <div style={{ width: '35%', background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
      <div style={{ flex: 1, background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeThread ? (
          <>
            <div style={{ padding: 16, borderBottom: '1.5px solid var(--border-color)', background: 'var(--bg-input)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: 18, color: 'var(--text-main)' }}>
                  {activeThread.displayName || activeThread.displayPhone}
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                  {activeThread.displayName ? activeThread.displayPhone : 'Unsaved Contact'}
                </p>
              </div>

              {/* Link directly to customer profile if matched */}
              {activeThread.matchedCustomer && (
                <button 
                  onClick={() => navigate(`/customers/${activeThread.matchedCustomer.id}`)}
                  style={{ background: 'var(--primary)', color: 'var(--primary-text)', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}
                >
                  👤 View Profile
                </button>
              )}
            </div>
            <div style={{ flex: 1, padding: 16 }}>
              {/* Ensure we pass the raw Twilio number down to the chat sender */}
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
  );
}
