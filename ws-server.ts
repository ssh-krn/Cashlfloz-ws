// server.ts (To be hosted on Koyeb)
import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';

const PORT = process.env.PORT || 8080;

// 1. Create a basic HTTP Server
const server = http.createServer((req, res) => {
  // Listen for POST requests from your Next.js Vercel app
  if (req.method === 'POST' && req.url === '/broadcast-trade') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString() });
    req.on('end', () => {
      try {
        const tradeData = JSON.parse(body);
        const payload = JSON.stringify({ type: 'trade', data: tradeData });
        
        // Broadcast the trade to every connected browser
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
          }
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400);
        res.end("Invalid JSON");
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

// 2. Attach WebSocket Server to the HTTP Server
const wss = new WebSocketServer({ server });

console.log(`🚀 Cashfloz Custom WS/HTTP Server starting on port ${PORT}`);

let currentPrice = 64231.50;
const dailyOpenPrice = 64000.00;
const symbol = "BTC/USD";

function generateNextPrice(price: number) {
  const volatility = 0.0005;
  const changePercent = 2 * volatility * Math.random() - volatility;
  return parseFloat((price + price * changePercent).toFixed(2));
}

// 3. The 1-Second Ticker Loop
setInterval(() => {
  currentPrice = generateNextPrice(currentPrice);
  const percentChange = ((currentPrice - dailyOpenPrice) / dailyOpenPrice) * 100;

  const payload = JSON.stringify({
    type: 'ticker', // Tagging this as a ticker update
    data: {
      symbol,
      price: currentPrice,
      value: currentPrice,
      time: Math.floor(Date.now() / 1000),
      change: `${percentChange >= 0 ? "+" : ""}${percentChange.toFixed(2)}%`,
      isPositive: percentChange >= 0
    }
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}, 1000);

// 4. Handle initial connection
wss.on('connection', (ws) => {
  console.log('📈 Trader connected');
  ws.on('close', () => console.log('📉 Trader disconnected'));
});

// Start listening
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
