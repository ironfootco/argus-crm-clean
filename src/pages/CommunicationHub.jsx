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
    
    // Fetch all messages to find unique recent conversations
    const { data, error } = await supabase
      .from('messages')
      .select('customer_phone, customer_id, created_at, body, direction')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching threads:", error);
      setLoading(false);
      return;
    }

    // Group by phone number to create a unique list of recent threads
    const uniqueThreads = [];
    const seenPhones = new Set();

    data.forEach((msg) => {
      if (!seenPhones.has(msg.customer_phone)) {
        seenPhones.add(msg.customer_phone);
        uniqueThreads.push(msg);
      }
    });

    setThreads(uniqueThreads);
    if (uniqueThreads.length > 0) {
      setActiveThread(uniqueThreads[0]);
    }
    setLoading(false);
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6">
      {/* Sidebar: Thread List */}
      <div className="w-1/3 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
          <h2 className="font-bold text-lg text-gray-800">Inbox</h2>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold">SMS / Text</span>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-gray-500">Loading messages...</div>
          ) : threads.length === 0 ? (
            <div className="p-4 text-gray-500">No conversations yet.</div>
          ) : (
            threads.map((thread) => (
              <div
                key={thread.customer_phone}
                onClick={() => setActiveThread(thread)}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                  activeThread?.customer_phone === thread.customer_phone ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                }`}
              >
                <div className="font-bold text-gray-800">
                  {thread.customer_phone}
                </div>
                <div className="text-sm text-gray-500 truncate mt-1">
                  {thread.direction === 'outbound' ? 'You: ' : ''}{thread.body}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content: Active Chat */}
      <div className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
        {activeThread ? (
          <>
            <div className="p-4 border-b bg-gray-50">
              <h2 className="font-bold text-lg text-gray-800">{activeThread.customer_phone}</h2>
              <p className="text-xs text-gray-500 mt-1">Voice call logs and transcripts will integrate here in a future update.</p>
            </div>
            <div className="flex-1 p-4">
              <SmsChat 
                customerId={activeThread.customer_id} 
                customerPhone={activeThread.customer_phone} 
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Select a conversation to view details
          </div>
        )}
      </div>
    </div>
  );
}
