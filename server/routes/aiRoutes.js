import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

// Initialize Gemini AI with API key from environment
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// AI Scheduling endpoint
router.post('/schedule', async (req, res) => {
  try {
    const { prompt, tasks } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    // Check if Gemini API key is configured
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ 
        message: 'Gemini API key is not configured. Please add GEMINI_API_KEY to your .env file.' 
      });
    }

    // Format tasks information for the AI
    const tasksContext = tasks && tasks.length > 0 
      ? `\n\nCurrent tasks:\n${tasks.map((task, index) => {
          return `${index + 1}. ${task.title} (Priority: ${task.priority || 'medium'}, Due: ${task.dueDate || 'not set'}, Status: ${task.completed ? 'completed' : 'pending'})`;
        }).join('\n')}`
      : '\n\nNo tasks currently available.';

    // Create the full prompt with context
    const fullPrompt = `You are a helpful AI scheduling assistant for ChronoSync, a task management application. 
Your role is to help users organize and schedule their tasks effectively.

User's question/request: ${prompt}
${tasksContext}

Please provide a helpful, actionable response. Consider:
- Task priorities and due dates
- Time management best practices
- Work-life balance
- Practical scheduling suggestions
- Break times and focus blocks when relevant

IMPORTANT FORMATTING INSTRUCTIONS:
- Use clear paragraph breaks (double line breaks) between different sections or ideas
- Start each major point or time block on a new line
- Use numbered lists for schedules (1., 2., 3., etc.)
- Use bullet points with proper line breaks for suggestions
- Add spacing between different task blocks
- Make your response easy to read with clear visual separation

Keep your response concise, clear, and actionable with proper formatting.`;

    // Get the generative model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Generate content
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    res.json({ 
      response: text,
      tasksAnalyzed: tasks?.length || 0
    });

  } catch (error) {
    console.error('Error generating AI response:', error);
    
    // Check for specific API errors
    if (error.message?.includes('API_KEY_INVALID')) {
      return res.status(500).json({ 
        message: 'Invalid Gemini API key. Please check your .env configuration.' 
      });
    }
    
    res.status(500).json({ 
      message: 'Error generating AI response',
      error: error.message 
    });
  }
});

export default router;
