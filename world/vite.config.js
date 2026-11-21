import 'dotenv/config'
import restart from 'vite-plugin-restart'
import wasm from 'vite-plugin-wasm'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default {
    root: 'sources/', // Sources files (typically where index.html is)
    envDir: '../',  // Directory where the env file is located
    publicDir: '../static/', // Path from "root" to static assets (files that are served as they are)
    base: './', // Public path (what's after the domain)
    server:
    {
        // https: true,
        host: true, // Open to local network and display URL
        open: true, // Open in browser
        // Yerel test: klasik site sayfaları ayrı sunucudan (python http.server 8123)
        proxy:
        {
            '^/(anasayfa|hakkimda|projeler|blog|galeri|iletisim|komur|404|kaynak)\\.(html|txt)|^/admin/|^/(en|oyun|assets|images|media)/': 'http://localhost:8123'
        }
    },
    build:
    {
        outDir: '../dist', // Output in the dist/ folder
        emptyOutDir: true, // Empty the folder first
        sourcemap: false // Add sourcemap
    },
    plugins:
    [
        wasm(),
        restart({ restart: [ '../static/**', ] }), // Restart server on static file change
        nodePolyfills(),
        // basicSsl()
    ]
}