import { resolve } from 'path'

const rootDir = import.meta.dirname

export default {
    root: resolve(rootDir, 'masa'),
    publicDir: false,
    base: '/',
    server: {
        host: true,
        port: 5179,
    },
    build: {
        outDir: resolve(rootDir, 'dist-masa'),
        emptyOutDir: true,
        sourcemap: false,
    },
}
