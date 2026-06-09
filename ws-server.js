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

// 🛡️ THE FIX: Synchronized with app/api/trade/candles/route.ts base prices
// to ensure no "severe gaps" between historical and live data.
const assets = {
  "BTC/USD": { current: 102165.50, open: 102165.00, volatility: 0.0002, symbol: "BTC" },
  "ETH/USD": { current: 5866.20, open: 5840.00, volatility: 0.0003, symbol: "ETH" },
  "SOL/USD": { current: 250.60, open: 245.00, volatility: 0.0005, symbol: "SOL" }
};

function generateNextPrice(assetKey) {
  const asset = assets[assetKey];
  
  // 1. Random Walk (Standard market noise)
  const randomChange = (Math.random() - 0.5) * 2 * asset.volatility;
  
  // 2. Mean Reversion (Gravity)
  // Calculates how far the current price has drifted from the daily open
  const distanceFromOpen = (asset.open - asset.current) / asset.open;
  
  // The stronger this number, the harder the price is pulled back to the open
  const reversionStrength = 0.05; 
  const gravity = distanceFromOpen * reversionStrength;

  // 3. Combine them. The price wanders randomly, but is tethered to reality.
  const totalChangePercent = randomChange + gravity;
  
  asset.current = parseFloat((asset.current + asset.current * totalChangePercent).toFixed(2));
  return asset.current;
}

// Order Book Generator logic (copied logic from api/trade/orderbook/route.ts)
function generateOrderBook(symbol, basePrice) {
  const mid = basePrice + (Math.random() - 0.5) * (basePrice * 0.0001);

  const rawAsks = Array.from({ length: 15 }, (_, i) => {
    const price = parseFloat((mid + (basePrice * 0.0005) + Math.random() * (basePrice * 0.001) + i * (basePrice * 0.002)).toFixed(2));
    const size  = parseFloat((Math.random() * (symbol === "BTC" ? 2 : 20) + 0.1).toFixed(3));
    return { price, size: size.toFixed(3), depth: Math.random() * 100 };
  });

  const rawBids = Array.from({ length: 15 }, (_, i) => {
    const price = parseFloat((mid - (basePrice * 0.0005) - Math.random() * (basePrice * 0.001) - i * (basePrice * 0.002)).toFixed(2));
    const size  = parseFloat((Math.random() * (symbol === "BTC" ? 2 : 20) + 0.1).toFixed(3));
    return { price, size: size.toFixed(3), depth: Math.random() * 100 };
  });

  const asks = rawAsks.sort((a, b) => b.price - a.price);
  const bids = rawBids.sort((a, b) => b.price - a.price);

  const bestAsk = asks[asks.length - 1].price;
  const bestBid = bids[0].price;
  const spread = parseFloat((bestAsk - bestBid).toFixed(2));

  return { bids, asks, spread, midPrice: parseFloat(mid.toFixed(2)), symbol };
}

// Recent Trades Generator logic (to simulate "market" trades when price moves)
function generateMockTrade(symbol, price) {
  const type = Math.random() > 0.5 ? "buy" : "sell";
  const amount = (Math.random() * (symbol === "BTC" ? 0.5 : 10) + 0.01).toFixed(3);
  const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return { type, price: price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), amount, time, symbol };
}

// 3. The 1-Second Update Loop
setInterval(() => {
  Object.keys(assets).forEach(symbolKey => {
    const asset = assets[symbolKey];
    const currentPrice = generateNextPrice(symbolKey);
    const percentChange = ((currentPrice - asset.open) / asset.open) * 100;
    const symbol = asset.symbol;

    // Ticker Payload
    const tickerPayload = JSON.stringify({
      type: 'ticker',
      data: {
        symbol: symbolKey,
        price: currentPrice,
        value: currentPrice,
        time: Math.floor(Date.now() / 1000),
        change: `${percentChange >= 0 ? "+" : ""}${percentChange.toFixed(2)}%`,
        isPositive: percentChange >= 0
      }
    });

    // Orderbook Payload
    const orderbookPayload = JSON.stringify({
      type: 'orderbook',
      data: generateOrderBook(symbol, currentPrice)
    });

    // Mock Trade Payload (occasional trades)
    let tradePayload = null;
    if (Math.random() > 0.7) {
      tradePayload = JSON.stringify({
        type: 'trade',
        data: generateMockTrade(symbol, currentPrice)
      });
    }

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(tickerPayload);
        client.send(orderbookPayload);
        if (tradePayload) client.send(tradePayload);
      }
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
