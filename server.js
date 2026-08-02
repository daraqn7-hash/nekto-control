const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const NEKTO_WS_URL = 'wss://im.nekto.me/socket.io/?EIO=4&transport=websocket';
const AUTH_TOKEN = '101ca535-9527-491c-880e-0daa66b9e382';

let nektoSocket = null;
let clients = [];

function connectToNekto() {
    nektoSocket = new WebSocket(NEKTO_WS_URL, {
        headers: {
            'Cookie': `authToken=${AUTH_TOKEN}`
        }
    });

    nektoSocket.on('open', () => {
        console.log('[⚡] Connected to Nekto Me WebSocket');
        nektoSocket.send('40');
    });

    nektoSocket.on('message', (data) => {
        const msg = data.toString();
        clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(msg);
            }
        });
    });

    nektoSocket.on('close', () => {
        console.log('[⚡] Disconnected, reconnecting...');
        setTimeout(connectToNekto, 3000);
    });

    nektoSocket.on('error', (err) => {
        console.error('[⚡] WebSocket error:', err.message);
    });
}

wss.on('connection', (ws) => {
    clients.push(ws);
    console.log('[⚡] New client connected');

    ws.on('message', (message) => {
        const msg = message.toString();
        try {
            const parsed = JSON.parse(msg);
            if (nektoSocket && nektoSocket.readyState === WebSocket.OPEN) {
                // Формируем команду для Nekto Me
                const cmd = parsed.cmd;
                const param = parsed.param || '';
                nektoSocket.send(`42["${cmd}", "${param}"]`);
            }
        } catch (_) {}
    });

    ws.on('close', () => {
        clients = clients.filter(client => client !== ws);
    });
});

connectToNekto();

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[⚡] Server running on port ${PORT}`);
});