const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==================== HELPER FUNCTIONS ====================

// Fibonacci function
function generateFibonacci(n) {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('Input must be a non-negative integer');
  }
  if (n === 0) return [];
  if (n === 1) return [0];
  
  const fib = [0, 1];
  for (let i = 2; i < n; i++) {
    fib.push(fib[i - 1] + fib[i - 2]);
  }
  return fib;
}

// Check if number is prime
function isPrime(num) {
  if (num < 2) return false;
  if (num === 2) return true;
  if (num % 2 === 0) return false;
  for (let i = 3; i <= Math.sqrt(num); i += 2) {
    if (num % i === 0) return false;
  }
  return true;
}

// Filter prime numbers
function filterPrimes(arr) {
  if (!Array.isArray(arr)) {
    throw new Error('Input must be an array');
  }
  return arr.filter(num => {
    if (!Number.isInteger(num)) {
      throw new Error('All elements must be integers');
    }
    return isPrime(num);
  });
}

// Calculate GCD of two numbers
function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

// Calculate HCF of array
function calculateHCF(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error('Input must be a non-empty array');
  }
  
  return arr.reduce((acc, num) => {
    if (!Number.isInteger(num) || num <= 0) {
      throw new Error('All elements must be positive integers');
    }
    return gcd(acc, num);
  });
}

// Calculate LCM of array
function calculateLCM(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error('Input must be a non-empty array');
  }
  
  const lcm = (a, b) => (a * b) / gcd(a, b);
  
  return arr.reduce((acc, num) => {
    if (!Number.isInteger(num) || num <= 0) {
      throw new Error('All elements must be positive integers');
    }
    return lcm(acc, num);
  });
}

// AI function - Get single word response (FIXED VERSION)
async function getAIResponse(question) {
  if (typeof question !== 'string' || question.trim() === '') {
    throw new Error('Question must be a non-empty string');
  }

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        maxOutputTokens: 50,  // Increased from 10
        temperature: 0.3,      // Slightly increased for better responses
      }
    });
    
    // Improved prompt
    const prompt = `You must answer with only ONE single word. Question: ${question}\n\nAnswer (one word only):`;
    
    const result = await model.generateContent(prompt);
    const response = result.response;
    
    // Check if response exists
    if (!response) {
      throw new Error('No response from AI');
    }
    
    let text = response.text();
    
    // Debug log
    console.log('Raw AI response:', text);
    
    if (!text || text.trim() === '') {
      throw new Error('Empty response from AI');
    }
    
    // Clean the response - remove markdown, punctuation, extra whitespace
    text = text
      .replace(/\*\*/g, '')           // Remove markdown bold
      .replace(/\*/g, '')             // Remove markdown italics
      .replace(/`/g, '')              // Remove code blocks
      .replace(/[.,!?;:'"()]/g, '')   // Remove punctuation
      .trim()
      .split(/[\s\n\r]+/)[0];         // Get first word
    
    console.log('✅ Cleaned response:', text);
    
    // Final check
    if (!text || text === '') {
      throw new Error('Could not extract answer');
    }
    
    return text;
    
  } catch (error) {
    console.error('❌ AI Error:', error.message);
    throw new Error('AI API request failed');
  }
}




// Add this TEMPORARY route before your other routes to check models
app.get('/check-models', async (req, res) => {
  try {
    const models = await genAI.listModels();
    res.json({ 
      models: models.map(m => ({
        name: m.name,
        displayName: m.displayName,
        supportedMethods: m.supportedGenerationMethods
      }))
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});



// ==================== ROUTES ====================

// POST /bfhl endpoint
app.post('/bfhl', async (req, res) => {
  try {
    const body = req.body;
    
    // Validate that exactly one key is present
    const validKeys = ['fibonacci', 'prime', 'lcm', 'hcf', 'AI'];
    const providedKeys = Object.keys(body).filter(key => validKeys.includes(key));
    
    if (providedKeys.length === 0) {
      return res.status(400).json({
        is_success: false,
        official_email: process.env.OFFICIAL_EMAIL,
        error: 'Request must contain exactly one of: fibonacci, prime, lcm, hcf, AI'
      });
    }
    
    if (providedKeys.length > 1) {
      return res.status(400).json({
        is_success: false,
        official_email: process.env.OFFICIAL_EMAIL,
        error: 'Request must contain exactly one key, found multiple'
      });
    }
    
    const key = providedKeys[0];
    let data;
    
    // Process based on key
    switch (key) {
      case 'fibonacci':
        data = generateFibonacci(body.fibonacci);
        break;
        
      case 'prime':
        data = filterPrimes(body.prime);
        break;
        
      case 'lcm':
        data = calculateLCM(body.lcm);
        break;
        
      case 'hcf':
        data = calculateHCF(body.hcf);
        break;
        
      case 'AI':
        data = await getAIResponse(body.AI);
        break;
        
      default:
        return res.status(400).json({
          is_success: false,
          official_email: process.env.OFFICIAL_EMAIL,
          error: 'Invalid key provided'
        });
    }
    
    // Success response
    res.status(200).json({
      is_success: true,
      official_email: process.env.OFFICIAL_EMAIL,
      data: data
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    res.status(400).json({
      is_success: false,
      official_email: process.env.OFFICIAL_EMAIL,
      error: error.message
    });
  }
});

// GET /health endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    is_success: true,
    official_email: process.env.OFFICIAL_EMAIL
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Chitkara BFHL API is running',
    endpoints: {
      'POST /bfhl': 'Main API endpoint',
      'GET /health': 'Health check endpoint'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    is_success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
