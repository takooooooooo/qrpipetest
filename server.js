const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os'); // osモジュールを追加
const WebSocket = require('ws');

const PORT = 8080;

// HTTPサーバー: 静的ファイルの配信
const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './' || filePath === './transmitter.html') {
        filePath = './transmitter.html';
    } else if (filePath.startsWith('./receiver.html')) {
        filePath = './receiver.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                // jsQRライブラリのパスを解決
                if (req.url === '/jsqr/jsQR.js') {
                    const jsqrPath = path.join(__dirname, 'node_modules', 'jsqr', 'dist', 'jsQR.js');
                    fs.readFile(jsqrPath, (err, cont) => {
                        if (err) {
                            res.writeHead(404); res.end('jsQR not found');
                        } else {
                            res.writeHead(200, { 'Content-Type': 'text/javascript' });
                            res.end(cont, 'utf-8');
                        }
                    });
                    return;
                }
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('404 Not Found', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// WebSocketサーバー
const wss = new WebSocket.Server({ server });

const rooms = {};

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const { type, payload } = data;

            switch (type) {
                case 'create_room': {
                    const roomId = Math.random().toString(36).substring(2, 8);
                    rooms[roomId] = { transmitter: ws, receiver: null };
                    ws.roomId = roomId; // ソケットにルームIDを紐付け
                    ws.send(JSON.stringify({ type: 'room_created', payload: { roomId } }));
                    console.log(`Room created: ${roomId}`);
                    break;
                }
                case 'join_room': {
                    const { roomId } = payload;
                    if (rooms[roomId]) {
                        rooms[roomId].receiver = ws;
                        ws.roomId = roomId;
                        if(rooms[roomId].transmitter) {
                            rooms[roomId].transmitter.send(JSON.stringify({ type: 'receiver_joined', payload: { roomId } }));
                            console.log(`Receiver joined room: ${roomId}`);
                        } else {
                             console.log(`Transmitter not found for room: ${roomId}`);
                        }
                    } else {
                        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Room not found' } }));
                    }
                    break;
                }
                case 'feedback':
                case 'complete': {
                    const { roomId } = payload;
                    if (rooms[roomId]) {
                        const transmitter = rooms[roomId].transmitter;
                        const receiver = rooms[roomId].receiver;
                        if (ws === transmitter && receiver) {
                            receiver.send(JSON.stringify(data));
                        } else if (ws === receiver && transmitter) {
                            transmitter.send(JSON.stringify(data));
                        }
                    }
                    break;
                }
            }
        } catch (e) {
            console.error('Failed to parse message or handle client message', e);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        const { roomId } = ws;
        if (roomId && rooms[roomId]) {
            delete rooms[roomId];
            console.log(`Room closed: ${roomId}`);
        }
    });
});

// サーバー起動とIPアドレス表示
server.listen(PORT, () => {
    console.log(`\nServer is listening on port ${PORT}`);
    console.log('----------------------------------------');
    console.log('Access URLs:');
    console.log(`  Local:   http://localhost:${PORT}`);

    const interfaces = os.networkInterfaces();
    Object.keys(interfaces).forEach((devName) => {
        interfaces[devName].forEach((iface) => {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`  Network: http://${iface.address}:${PORT}`);
            }
        });
    });
    console.log('----------------------------------------');
    console.log('Waiting for clients...');
});
