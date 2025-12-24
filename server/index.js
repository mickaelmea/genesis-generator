import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API = process.env.GEMINI_API_KEY || '';
const SERP_API = process.env.SERP_API_KEY || '';

app.post('/api/generate-article', async (req, res) => {
  try {
    const { topic, keywords } = req.body;
    if (!GEMINI_API) return res.status(400).json({ error: 'API key nao configurada' });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Escreva artigo sobre: ${topic}. Palavras-chave: ${keywords}` }] }]
        })
      }
    );

    const data = await response.json();
    const articleText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ success: true, article: articleText });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/serp-analysis', async (req, res) => {
  res.json({ success: true, insights: { topResults: [], relatedSearches: [] } });
});

app.post('/api/wp-posts', async (req, res) => {
  res.json({ success: true, posts: [] });
});

app.use(express.static('dist'));

// Catch-all route - deve ser a ÚLTIMA rota
app.get('/*', (req, res) => {
  res.sendFile('/app/dist/index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Genesis rodando em http://localhost:${PORT}`);
});
