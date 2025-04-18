const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

const AUTH_TOKEN = 'd1e864e2-cad4-4b10-b6be-49755d7175fc';
const OPENAI_URL = 'https://recruiting.adere.so/chat_completion';

app.use(cors());
app.use(express.json());

app.post('/api/chat_completion', async (req, res) => {
  try {
    const response = await axios.post(
      OPENAI_URL,
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Error in chat completion:', error);
    res.status(500).json({ error: 'Failed to process chat completion' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 