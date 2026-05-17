import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { exec } from 'child_process'
import util from 'util'

const execAsync = util.promisify(exec)

const localSyncPlugin = () => ({
  name: 'local-sync-plugin',
  configureServer(server) {
    server.middlewares.use('/_api/sync', async (req, res) => {
      // Add a naive 5 min timeout to prevent browser timeout if possible
      req.setTimeout(300000); 
      res.setHeader('Content-Type', 'application/json');
      try {
        const { stdout } = await execAsync('node sync_local.cjs', { maxBuffer: 1024 * 1024 * 10 }); // 10MB buffer
        res.end(JSON.stringify({ success: true, output: stdout }));
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    localSyncPlugin()
  ],
})
