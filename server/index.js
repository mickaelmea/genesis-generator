import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(express.json());
app.use(express.static('dist'));

// ROTA CORRIGIDA - Catch-all route
app.get(/(.*)/, (req, res) => {
  res.sendFile('/app/dist/index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Genesis rodando em http://localhost:${PORT}`);
});
