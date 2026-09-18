import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import SmsChat from '../components/SmsChat';

export default function CommunicationHub() {
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchThreads();
  }, []);

  const fetchThreads = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('messages')
      .select('customer_phone, customer_id, created_at, body, direction')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching threads:", error);
      setLoading(false);
      return;
    }

    const uniqueThreads = [];
    const seenPhones = new Set();

    data.forEach((msg) => {
      if (!seenPhones.has(msg.customer_phone)) {
        seenPhones.add(msg.customer_phone);
        uniqueThreads.push(msg);
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
                    {thread.customer_phone}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
            <div style={{ padding: 16, borderBottom: '1.5px solid var(--border-color)', background: 'var(--bg-input)' }}>
              <h2 style={{ margin: '0 0 4px 0', fontSize: 18, color: 'var(--text-main)' }}>{activeThread.customer_phone}</h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Voice call logs and transcripts will integrate here in a future update.</p>
            </div>
            <div style={{ flex: 1, padding: 16 }}>
              <SmsChat 
                customerId={activeThread.customer_id} 
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
