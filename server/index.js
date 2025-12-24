import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(express.json());

// CORREÇÃO: Caminho absoluto para servir arquivos estáticos
app.use(express.static(join(__dirname, '../dist')));

// Catch-all route - deve ser a ÚLTIMA rota
app.get(/(.*)/, (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Genesis rodando em http://localhost:${PORT}`);
});
