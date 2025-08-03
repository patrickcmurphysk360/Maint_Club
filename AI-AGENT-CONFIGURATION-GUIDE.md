# 🤖 AI Agent Configuration Guide

## Overview
The Maintenance Club AI agent is built on your local Ollama infrastructure and provides performance insights through natural language conversations. This guide explains how to configure and customize the AI's behavior, prompts, and responses.

## Architecture

```
User Query → Frontend Chat → API Routes → OllamaService → Ollama Models → Formatted Response
                                      ↑
                               Configuration Files
                               (/config/aiPrompts.js)
```

## Configuration Files

### 1. Main Configuration: `/api/config/aiPrompts.js`

This file contains all AI behavior settings:

#### **A. Model Configuration**
```javascript
models: {
  default: 'llama3.2:latest',        // Primary model to use
  fallback: 'llama3.2:latest',       // Backup if primary fails
  options: ['llama3.2:latest', 'gemma2:2b', 'qwen2.5:3b']  // Available models
}
```

#### **B. Generation Parameters**
```javascript
generation: {
  temperature: 0.1,    // 0.0-2.0 (0.1 = focused, 1.0 = creative)
  top_k: 10,          // Limits vocabulary to top K tokens
  top_p: 0.3,         // Nucleus sampling threshold  
  num_predict: 2048,  // Max response length in tokens
  timeout: 120000     // Request timeout (2 minutes)
}
```

#### **C. System Prompts**
Define the AI's core personality and behavior:

- **Base Prompt**: Core identity as automotive service coach
- **Role-Specific Prompts**: Different behavior for advisors vs managers
- **Response Guidelines**: Tone, format, and content requirements

## Prompt Templates

### 1. Chat Conversations (`PROMPT_TEMPLATES.chat`)
Template for natural language Q&A:
```
System Identity + Role-Specific Behavior + User Context + Performance Data + User Question
```

### 2. Automated Insights (`PROMPT_TEMPLATES.insights`)
Four types of automated analysis:

- **General**: Overall performance summary (3 key insights)
- **Goals**: Goal vs actual performance comparison
- **Trends**: Pattern identification and trend analysis  
- **Coaching**: Specific improvement recommendations

## Customization Guide

### 1. **Modifying AI Personality**

Edit `SYSTEM_PROMPTS.base` in `/api/config/aiPrompts.js`:

```javascript
base: `You are an AI performance coach for automotive service advisors.

CORE IDENTITY:
- [Your custom identity here]
- [Specific expertise areas]
- [Communication style preferences]

RESPONSE STYLE:
- [Custom formatting rules]
- [Tone guidelines]
- [Length preferences]
```

### 2. **Adjusting Response Behavior**

**For More Creative Responses:**
```javascript
generation: {
  temperature: 0.7,  // Increase for more varied responses
  top_p: 0.8,        // Broader vocabulary selection
}
```

**For More Focused/Factual Responses:**
```javascript
generation: {
  temperature: 0.1,  // Decrease for consistent responses
  top_k: 5,          // Limit to most likely words
}
```

### 3. **Custom Prompt Templates**

Add new insight types in `PROMPT_TEMPLATES.insights`:

```javascript
weekly_review: `${SYSTEM_PROMPTS.base}

WEEKLY PERFORMANCE REVIEW FOR: {userName}

{performanceData}

TASK: Provide a comprehensive weekly review with specific action items.

FORMAT YOUR RESPONSE AS:
📊 **Week Overview:**
• [Key metric 1]
• [Key metric 2]

🎯 **This Week's Focus:**
• [Priority 1]
• [Priority 2]

📈 **Next Week Goals:**
• [Specific targets]
`
```

### 4. **Role-Based Customization**

Modify `DATA_FORMATTERS.getRolePrompt()` for role-specific behavior:

```javascript
case 'store_manager':
  return `You are providing store management insights. Focus on:
  - Team performance optimization
  - Operational efficiency
  - Individual advisor development
  - Customer satisfaction metrics`;
```

## API Endpoints for Configuration

### Admin-Only Configuration APIs:

```javascript
GET  /api/ai-config/config           // View current configuration
PUT  /api/ai-config/agent           // Update AI behavior settings  
POST /api/ai-config/test-prompt     // Test prompt templates
GET  /api/ai-config/metrics         // AI usage statistics
```

### Example: Testing a Custom Prompt
```javascript
POST /api/ai-config/test-prompt
{
  "customPrompt": "You are a sales coach. Analyze this data and provide 3 specific sales improvement tips.",
  "testContext": {
    "user": {"name": "John", "role": "advisor"},
    "performance": {"sales": 5000, "invoices": 100}
  }
}
```

## Environment Variables

Configure in Docker Compose or environment:

```bash
OLLAMA_HOST=http://ollama:11434      # Ollama service URL
OLLAMA_MODEL=llama3.2:latest         # Default model name
```

## Automotive Service Context

### Performance Metrics Available:
- **Sales Data**: Total sales, GP (Gross Profit), GP percentage
- **Service Counts**: Oil changes, alignments, brake services, etc.
- **Operational**: Invoices, labor hours, effective labor rate
- **Customer Metrics**: Average RO (Repair Order), customer satisfaction

### Industry-Specific Prompts:
The AI understands automotive terminology:
- Service advisors vs technicians
- RO (Repair Order) workflows  
- Upselling and service recommendations
- Seasonal service patterns
- Vendor/manufacturer relationships

## Best Practices

### 1. **Prompt Engineering**
- Be specific about desired output format
- Include examples in prompts when possible
- Use consistent terminology
- Set clear boundaries on what AI should/shouldn't do

### 2. **Model Selection**
- **llama3.2**: Best for general conversations and analysis
- **gemma2**: Good for structured responses
- **qwen2.5**: Strong at reasoning and problem-solving

### 3. **Performance Optimization**
- Keep context data concise but complete
- Use lower temperature for consistent business advice
- Set appropriate token limits to control response length

### 4. **Data Privacy**
- AI only sees data explicitly passed in context
- No conversation history is stored by default
- Performance data is anonymized for AI processing

## Troubleshooting

### Common Issues:

1. **AI Responses Too Vague**
   - Increase detail in prompts
   - Provide more specific context data
   - Lower temperature for focused responses

2. **Responses Too Long**
   - Reduce `num_predict` parameter
   - Add length guidelines to system prompt
   - Use bullet points in prompt formatting

3. **Model Not Available**
   - Check Ollama container status
   - Verify model is downloaded: `docker exec ollama ollama list`
   - Update `AI_AGENT_CONFIG.models.options`

## Testing Your Configuration

1. **Use the debug endpoint**: `GET /api/ai-insights/debug` (no auth)
2. **Test prompts**: Use `/api/ai-config/test-prompt` 
3. **Monitor logs**: Check container logs for AI generation details
4. **Frontend testing**: Use the chat interface with various queries

## Example Configurations

### Conservative Business Coach
```javascript
generation: {
  temperature: 0.1,
  top_k: 5,
  top_p: 0.2
}
// + Structured prompts with bullet points
```

### Creative Performance Analyst  
```javascript
generation: {
  temperature: 0.7,
  top_k: 40,
  top_p: 0.9
}
// + Open-ended prompts encouraging exploration
```

### Technical Service Expert
```javascript
// Focus prompts on specific automotive procedures
// Include detailed service terminology
// Reference manufacturer recommendations
```

---

## Next Steps

1. **Review current prompts** in `/api/config/aiPrompts.js`
2. **Test with your Ollama models** using the chat interface
3. **Customize system prompts** for your specific business needs  
4. **Monitor AI responses** and iterate on prompt effectiveness
5. **Consider adding new insight types** for specialized analysis

The AI agent is designed to be highly configurable while maintaining the automotive service industry expertise your team needs.