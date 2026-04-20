const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = 8080;

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

// Reasonable starting prices and daily opens
const assets = {
  "BTC/USD": { current: 64231.50, open: 64000.00, volatility: 0.0005 },
  "ETH/USD": { current: 3450.20, open: 3420.00, volatility: 0.0007 },
  "SOL/USD": { current: 145.60, open: 142.50, volatility: 0.0012 }
};

function generateNextPrice(assetKey) {
  const asset = assets[assetKey];
  const changePercent = 2 * asset.volatility * Math.random() - asset.volatility;
  asset.current = parseFloat((asset.current + asset.current * changePercent).toFixed(2));
  return asset.current;
}

// 3. The 1-Second Ticker Loop (Sends updates for ALL assets)
setInterval(() => {
  Object.keys(assets).forEach(symbol => {
    const asset = assets[symbol];
    const currentPrice = generateNextPrice(symbol);
    const percentChange = ((currentPrice - asset.open) / asset.open) * 100;

    const payload = JSON.stringify({
      type: 'ticker',
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
