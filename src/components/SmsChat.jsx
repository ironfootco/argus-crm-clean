import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient'; // Adjust this import to match your setup

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
        fetchMessages(); // Refresh the chat to show the new message
      }
    } catch (error) {
      console.error("Failed to send:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-96 border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex-1 overflow-y-auto mb-4 space-y-2">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-lg max-w-xs ${msg.direction === 'outbound' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
              {msg.body}
            </div>
          </div>
        ))}
      </div>
      
      <form onSubmit={handleSend} className="flex gap-2">
        <input 
          type="text" 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..." 
          className="flex-1 border rounded-md p-2 focus:outline-blue-500"
          disabled={isSending}
        />
        <button 
          type="submit" 
          disabled={isSending}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
