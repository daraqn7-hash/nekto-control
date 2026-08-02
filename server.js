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

const AUTH_TOKEN = 'a7e55f9e-d90a-4cf9-89cc-5a44a4306597';
const NEKTO_WS_URL = 'wss://im.nekto.me/socket.io/?EIO=4&transport=websocket';

let nektoSocket = null;
let clients = [];

function sendToNekto(command, data = '') {
    if (!nektoSocket || nektoSocket.readyState !== WebSocket.OPEN) return;
    // Отправляем в формате, который понимает Nekto Me
    const msg = JSON.stringify([command, data]);
    nektoSocket.send('42' + msg);
    console.log('[CMD]', command, data);
}

function connectToNekto() {
    nektoSocket = new WebSocket(NEKTO_WS_URL, {
        headers: {
            'Cookie': `authToken=${AUTH_TOKEN}`
        }
    });

    nektoSocket.on('open', () => {
        console.log('[⚡] Connected to Nekto Me');
        nektoSocket.send('40');
    });

    nektoSocket.on('message', (data) => {
        const msg = data.toString();
        console.log('[RAW]', msg);

        clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(msg);
            }
        });

        try {
            if (msg.startsWith('42["')) {
                const json = JSON.parse(msg.slice(2));
                const event = json[0];
                const payload = json[1];
                console.log('[EVENT]', event, payload);

                if (event === 'peer') {
                    clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                cmd: 'user_connected',
                                userId: payload.id || 'unknown'
                            }));
                        }
                    });
                }

                if (event === 'peer_left') {
                    clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({ cmd: 'user_disconnected' }));
                        }
                    });
                }
            }
        } catch (_) {}
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
    console.log('[⚡] Client connected');

    ws.on('message', (message) => {
        const msg = message.toString();
        console.log('[FROM CLIENT]', msg);
        try {
            const parsed = JSON.parse(msg);
            const cmd = parsed.cmd;

            // Для next отправляем только команду, без параметров
            if (cmd === 'next') {
                sendToNekto('next', '');
                return;
            }

            // Для остальных команд — отправляем как есть
            const param = parsed.param || '';
            sendToNekto(cmd, param);
        } catch (_) {
            console.log('[ERR] Invalid command:', msg);
        }
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