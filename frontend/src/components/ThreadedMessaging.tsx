import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface MessageAttachment {
  id: number;
  originalFilename: string;
  storedFilename: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  fileType: 'image' | 'document' | 'other';
  thumbnailPath?: string;
}

interface Message {
  id: number;
  threadId: number;
  parentMessageId?: number;
  authorUserId: string; // Phase 1 uses string user IDs
  authorName: string;
  authorRole: string;
  message: string;
  messageType: 'text' | 'image' | 'document';
  isRead: boolean;
  createdAt: string;
  editedAt?: string;
  reactions: Record<string, any>;
  attachments: MessageAttachment[];
}

interface MessageThread {
  threadId: number;
  advisorUserId: string; // Phase 1 uses string user IDs
  advisorName: string;
  advisorEmail: string;
  subject: string;
  lastMessageAt: string;
  messageCount: number;
  isArchived: boolean;
  lastMessage: string;
  lastMessageAuthor: string;
  unreadCount: number;
  hasAttachments: boolean;
}

interface ThreadedMessagingProps {
  selectedAdvisor: any;
}

const ThreadedMessaging: React.FC<ThreadedMessagingProps> = ({ selectedAdvisor }) => {
  const { user } = useAuth();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [currentThread, setCurrentThread] = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedAdvisor) {
      loadThreads();
    }
  }, [selectedAdvisor]);

  useEffect(() => {
    if (currentThread) {
      loadMessages(currentThread.threadId);
    }
  }, [currentThread]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadThreads = async () => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5002';
      const response = await fetch(`${apiUrl}/api/coaching/threads`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      // Ensure we have an array of threads
      const allThreads = Array.isArray(data.threads) ? data.threads : [];
      
      // Filter threads for selected advisor if admin
      let filteredThreads = allThreads;
      if (user?.role === 'administrator' && selectedAdvisor) {
        filteredThreads = allThreads.filter((t: MessageThread) => 
          t.advisorUserId === (selectedAdvisor.user_id || selectedAdvisor.mappedUserId || selectedAdvisor.id)
        );
      }
      
      setThreads(filteredThreads);
      
      // Auto-select first thread
      if (filteredThreads.length > 0) {
        setCurrentThread(filteredThreads[0]);
      }
    } catch (error) {
      console.error('Error loading threads:', error);
      setThreads([]); // Ensure we have an empty array on error
    }
  };

  const loadMessages = async (threadId: number) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5002';
      const response = await fetch(`${apiUrl}/api/coaching/threads/${threadId}/messages`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      const messagesList = Array.isArray(data.messages) ? data.messages : [];
      setMessages(messagesList);
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]); // Ensure we have an empty array on error
    }
  };

  const createNewThread = async () => {
    if (!selectedAdvisor || !newMessage.trim()) return;
    
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5002';
      const advisorUserId = selectedAdvisor.user_id || selectedAdvisor.mappedUserId || selectedAdvisor.id;
      console.log('🔍 Creating thread for advisor:', advisorUserId, selectedAdvisor);
      
      const response = await fetch(`${apiUrl}/api/coaching/threads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          advisorUserId: advisorUserId,
          subject: `Coaching - ${selectedAdvisor.first_name || selectedAdvisor.employee?.split(' ')[0]} ${selectedAdvisor.last_name || selectedAdvisor.employee?.split(' ').slice(1).join(' ')}`,
          message: newMessage
        })
      });
      
      if (response.ok) {
        setNewMessage('');
        loadThreads();
      } else {
        const errorData = await response.json();
        console.error('Thread creation failed:', response.status, errorData);
        alert(`Failed to create thread: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating thread:', error);
    }
  };

  const sendMessage = async () => {
    if (!currentThread || (!newMessage.trim() && !selectedFile)) return;
    
    setLoading(true);
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5002';
      console.log('🔍 Sending message to thread:', currentThread.threadId, 'Message:', newMessage);
      
      const formData = new FormData();
      formData.append('message', newMessage);
      if (replyTo) {
        formData.append('parentMessageId', replyTo.id.toString());
      }
      if (selectedFile) {
        formData.append('attachment', selectedFile);
      }

      const response = await fetch(`${apiUrl}/api/coaching/threads/${currentThread.threadId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      if (response.ok) {
        setNewMessage('');
        setSelectedFile(null);
        setReplyTo(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        loadMessages(currentThread.threadId);
        loadThreads(); // Refresh thread list to update last message
      } else {
        const errorData = await response.json();
        console.error('Message send failed:', response.status, errorData);
        alert(`Failed to send message: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderMessage = (message: Message) => {
    // Handle both MVP and Phase 1 user ID formats
    const currentUserId = (user as any)?.user_id || user?.id?.toString();
    const isOwnMessage = message.authorUserId === currentUserId;
    const isReply = message.parentMessageId;
    
    return (
      <div key={message.id} className={`mb-4 ${isReply ? 'ml-8' : ''}`}>
        <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
            isOwnMessage 
              ? 'bg-primary-500 text-white' 
              : 'bg-gray-200 text-gray-900'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">
                {message.authorName} 
                <span className="ml-1 text-xs opacity-75">({message.authorRole})</span>
              </span>
              <span className={`text-xs ${isOwnMessage ? 'text-primary-100' : 'text-gray-500'}`}>
                {new Date(message.createdAt).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
            </div>
            
            {message.message && (
              <p className="text-sm">{message.message}</p>
            )}
            
            {message.attachments && Array.isArray(message.attachments) && message.attachments.length > 0 && (
              <div className="mt-2 space-y-2">
                {message.attachments.map((attachment) => (
                  <div key={attachment.id} className="border rounded p-2 bg-white bg-opacity-20">
                    {attachment.fileType === 'image' ? (
                      <div>
                        <img 
                          src={`${process.env.REACT_APP_API_URL || 'http://localhost:5002'}/api/coaching/attachments/${attachment.id}/view`}
                          alt={attachment.originalFilename}
                          className="max-w-full h-auto rounded cursor-pointer"
                          onClick={() => window.open(`${process.env.REACT_APP_API_URL || 'http://localhost:5002'}/api/coaching/attachments/${attachment.id}/view`, '_blank')}
                        />
                        <p className="text-xs mt-1">{attachment.originalFilename}</p>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <div className="flex-1">
                          <p className="text-xs font-medium">{attachment.originalFilename}</p>
                          <p className="text-xs opacity-75">{formatFileSize(attachment.fileSize)}</p>
                        </div>
                        <a
                          href={`${process.env.REACT_APP_API_URL || 'http://localhost:5002'}/api/coaching/attachments/${attachment.id}`}
                          download={attachment.originalFilename}
                          className={`text-xs px-2 py-1 rounded ${
                            isOwnMessage 
                              ? 'bg-white bg-opacity-20 text-white hover:bg-opacity-30' 
                              : 'bg-primary-500 text-white hover:bg-primary-600'
                          }`}
                        >
                          Download
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {!isOwnMessage && (
              <button
                onClick={() => setReplyTo(message)}
                className={`text-xs mt-1 ${
                  isOwnMessage ? 'text-primary-100' : 'text-primary-600'
                } hover:underline`}
              >
                Reply
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!selectedAdvisor) {
    return (
      <div className="card">
        <p className="text-gray-600">Select an advisor to view and send messages.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">
          💬 Messages with {selectedAdvisor.first_name && selectedAdvisor.last_name ? 
            `${selectedAdvisor.first_name} ${selectedAdvisor.last_name}` : 
            selectedAdvisor.employee}
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96">
          {/* Thread List */}
          <div className="lg:col-span-1 border-r border-gray-200 pr-4">
            <h4 className="font-medium mb-3">Conversations</h4>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {threads && Array.isArray(threads) ? threads.map((thread) => (
                <button
                  key={thread.threadId}
                  onClick={() => setCurrentThread(thread)}
                  className={`w-full text-left p-3 rounded border transition-colors ${
                    currentThread?.threadId === thread.threadId
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-sm truncate">{thread.subject}</span>
                    {thread.unreadCount > 0 && (
                      <span className="bg-primary-500 text-white text-xs rounded-full px-2 py-1 ml-2">
                        {thread.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 truncate">{thread.lastMessage}</p>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-gray-500">{thread.lastMessageAuthor}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(thread.lastMessageAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              )) : null}
              {threads && threads.length === 0 && (
                <p className="text-sm text-gray-500">No conversations yet</p>
              )}
            </div>
          </div>
          
          {/* Messages */}
          <div className="lg:col-span-2">
            {currentThread ? (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto mb-4 max-h-64 border rounded p-3">
                  {messages && Array.isArray(messages) ? messages.map(renderMessage) : null}
                  <div ref={messagesEndRef} />
                </div>
                
                {/* Reply indicator */}
                {replyTo && (
                  <div className="mb-2 p-2 bg-gray-100 rounded text-sm">
                    <div className="flex justify-between items-start">
                      <span>Replying to: <strong>{replyTo.authorName}</strong></span>
                      <button
                        onClick={() => setReplyTo(null)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ×
                      </button>
                    </div>
                    <p className="text-gray-600 mt-1 truncate">{replyTo.message}</p>
                  </div>
                )}
                
                {/* Message input */}
                <div className="border-t pt-3">
                  <div className="flex space-x-2">
                    <div className="flex-1">
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={replyTo ? "Write a reply..." : "Type a message..."}
                        className="w-full p-2 border rounded resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        rows={2}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                      />
                      
                      {/* File input */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                            className="hidden"
                            accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
                          />
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="text-gray-500 hover:text-primary-600 transition-colors"
                            title="Attach file"
                          >
                            📎
                          </button>
                          {selectedFile && (
                            <span className="text-xs text-gray-600">
                              {selectedFile.name} ({formatFileSize(selectedFile.size)})
                            </span>
                          )}
                        </div>
                        
                        <button
                          onClick={sendMessage}
                          disabled={(!newMessage.trim() && !selectedFile) || loading}
                          className="btn btn-primary btn-sm"
                        >
                          {loading ? 'Sending...' : 'Send'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-gray-600 mb-4">No conversation selected</p>
                  <button
                    onClick={createNewThread}
                    className="btn btn-primary"
                    disabled={!newMessage.trim()}
                  >
                    Start New Conversation
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* New conversation starter */}
        {threads.length === 0 && (
          <div className="mt-4 p-4 border border-dashed border-gray-300 rounded">
            <h4 className="font-medium mb-2">Start a new conversation</h4>
            <div className="flex space-x-2">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Write your first message..."
                className="flex-1 p-2 border rounded"
                rows={2}
              />
              <button
                onClick={createNewThread}
                disabled={!newMessage.trim()}
                className="btn btn-primary"
              >
                Start
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThreadedMessaging;