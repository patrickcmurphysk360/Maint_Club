import React, { useState, useEffect, useRef } from 'react';
import { aiInsightsAPI } from '../services/api';

interface Message {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
}

interface AIInsightsChatProps {
  userId?: number;
  isOpen: boolean;
  onClose: () => void;
}

const AIInsightsChat: React.FC<AIInsightsChatProps> = ({ userId, isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      checkAIStatus();
      if (messages.length === 0) {
        addSystemMessage('👋 Hi! I can help you analyze performance data and answer questions about your metrics. Try asking something like "How did I perform this month?" or "What areas need improvement?"');
      }
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const checkAIStatus = async () => {
    try {
      const response = await aiInsightsAPI.getHealth();
      console.log('AI Health Response:', response);
      setAiStatus(response.ollama_available ? 'available' : 'unavailable');
      setAvailableModels(response.models || []);
      if (response.models?.length > 0 && !selectedModel) {
        setSelectedModel(response.models[0]);
      }
    } catch (error: any) {
      console.error('AI Health Check Error:', error);
      setAiStatus('unavailable');
      const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
      addSystemMessage(`⚠️ AI service unavailable: ${errorMsg}`);
    }
  };

  const addSystemMessage = (content: string) => {
    const message: Message = {
      id: Date.now().toString(),
      type: 'system',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  const addUserMessage = (content: string) => {
    const message: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  const addAIMessage = (content: string, model?: string) => {
    const message: Message = {
      id: Date.now().toString(),
      type: 'ai',
      content,
      timestamp: new Date(),
      model
    };
    setMessages(prev => [...prev, message]);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || aiStatus !== 'available') return;

    const userQuery = inputValue.trim();
    setInputValue('');
    addUserMessage(userQuery);
    setIsLoading(true);

    try {
      const response = await aiInsightsAPI.chat(userQuery, userId, selectedModel);
      addAIMessage(response.response, response.model_used);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Sorry, I encountered an error. Please try again.';
      addAIMessage(`❌ ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const generateInsights = async (type: string) => {
    if (aiStatus !== 'available') return;

    if (!userId) {
      addSystemMessage('❌ User ID not available. Please refresh the page.');
      return;
    }

    setIsLoading(true);
    addSystemMessage(`🔍 Generating ${type} insights...`);

    try {
      const response = await aiInsightsAPI.getAdvisorInsights(userId, type, selectedModel);
      addAIMessage(response.insights, response.model_used);
    } catch (error: any) {
      console.error('Insights error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to generate insights.';
      addAIMessage(`❌ ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">🤖 AI Performance Insights</h2>
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${
                aiStatus === 'available' ? 'bg-green-400' : 
                aiStatus === 'unavailable' ? 'bg-red-400' : 'bg-yellow-400'
              }`}></span>
              <span className="text-sm">
                {aiStatus === 'available' ? 'AI Ready' : 
                 aiStatus === 'unavailable' ? 'AI Unavailable' : 'Checking...'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {availableModels.length > 0 && (
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="text-black text-sm rounded px-2 py-1"
              >
                {availableModels.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            )}
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        {aiStatus === 'available' && (
          <div className="p-3 border-b bg-gray-50">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => generateInsights('general')}
                disabled={isLoading}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 disabled:opacity-50"
              >
                📊 General Insights
              </button>
              <button
                onClick={() => generateInsights('goals')}
                disabled={isLoading}
                className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm hover:bg-green-200 disabled:opacity-50"
              >
                🎯 Goal Analysis
              </button>
              <button
                onClick={() => generateInsights('trends')}
                disabled={isLoading}
                className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm hover:bg-purple-200 disabled:opacity-50"
              >
                📈 Trends
              </button>
              <button
                onClick={() => generateInsights('coaching')}
                disabled={isLoading}
                className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm hover:bg-orange-200 disabled:opacity-50"
              >
                💡 Coaching Tips
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.type === 'ai'
                    ? 'bg-gray-100 text-gray-800'
                    : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                <div className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                  {message.model && ` • ${message.model}`}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  AI is thinking...
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                aiStatus === 'available'
                  ? "Ask about your performance... (e.g., 'How am I doing with oil changes this month?')"
                  : "AI service is not available"
              }
              disabled={isLoading || aiStatus !== 'available'}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading || aiStatus !== 'available'}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIInsightsChat;