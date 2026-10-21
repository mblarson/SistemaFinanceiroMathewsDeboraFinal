import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import gastosHandler from './api/gastos';
import applePayHandler from './api/apple-pay';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(cors());
app.use(express.json());

// Roteamento oficial da API Gastos (usando o mesmo handler defensivo da Vercel)
app.all('/api/gastos', (req, res) => gastosHandler(req, res));
app.all('/api/gastos/adicionar', (req, res) => gastosHandler(req, res));
app.all('/api/gastos/status', (req, res) => gastosHandler(req, res));

// Endpoints oficiais de integração Apple Pay (iOS Atalhos)
app.all('/api/apple-pay', (req, res) => applePayHandler(req, res));
app.all('/api/gastos/apple-pay', (req, res) => applePayHandler(req, res));
app.all('/api/financeiro/despesas/apple-pay', (req, res) => applePayHandler(req, res));

// Setup Vite Dev Server ou Produção
const startServer = async () => {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}`);
  });
};

startServer().catch(err => {
  console.error("Erro ao iniciar servidor:", err);
});
