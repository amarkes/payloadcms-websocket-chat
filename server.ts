// Custom Next.js server with WebSocket support.
// Run with: pnpm dev:ws
// This wraps Next.js in a plain Node.js HTTP server so we can attach a WebSocket server.

import 'dotenv/config'
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { WebSocketServer } from 'ws'
import { setupWebSocket } from './src/websocket/handler.js'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

await app.prepare()
const handleUpgrade = app.getUpgradeHandler()

const httpServer = createServer(async (req, res) => {
  try {
    const parsedUrl = parse(req.url!, true)
    await handle(req, res, parsedUrl)
  } catch (err) {
    console.error('Error handling request', req.url, err)
    res.statusCode = 500
    res.end('internal server error')
  }
})

// Only intercept WebSocket upgrades on /ws — everything else gets destroyed.
const wss = new WebSocketServer({ noServer: true })

httpServer.on('upgrade', async (req, socket, head) => {
  const { pathname } = parse(req.url || '/')
  if (pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req)
    })
  } else {
    await handleUpgrade(req, socket, head)
  }
})

await setupWebSocket(wss)

httpServer.listen(port, hostname, () => {
  console.log(`> Ready on http://${hostname}:${port}`)
  console.log(`> WebSocket ready on ws://${hostname}:${port}/ws`)
})
