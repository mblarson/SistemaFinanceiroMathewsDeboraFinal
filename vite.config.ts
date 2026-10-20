
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import gastosHandler from './api/gastos';

function apiGastosPlugin(): Plugin {
  return {
    name: 'api-gastos-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url === '/api/gastos' || url === '/api/gastos/') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            if (body) {
              try { 
                (req as any).body = JSON.parse(body); 
              } catch { 
                (req as any).body = body; 
              }
            }
            const mockRes = {
              statusCode: 200,
              setHeader(name: string, value: string) { res.setHeader(name, value); },
              status(code: number) { this.statusCode = code; res.statusCode = code; return this; },
              json(data: any) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = this.statusCode;
                res.end(JSON.stringify(data));
              },
              end(data?: any) {
                res.statusCode = this.statusCode;
                res.end(data);
              }
            };
            try {
              await gastosHandler(req, mockRes);
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ sucesso: false, erro: err.message }));
            }
          });
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), apiGastosPlugin()],
  server: {
    host: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
