const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');

const PORT = 8080;

// HTTPサーバー: 静的ファイルの配信
const server = http.createServer((req, res) => {
    let filePath = '.' + req.url.split('?')[0]; // クエリパラメータを無視
    if (filePath === './') {
        filePath = './transmitter.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
    };
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // qr-scannerのファイルを配信
    if (filePath.includes('qr-scanner')) {
        filePath = path.join(__dirname, req.url.split('?')[0]);
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
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
            const { roomId } = payload || {};

            switch (type) {
                case 'create_room': {
                    const newRoomId = Math.random().toString(36).substring(2, 8);
                    rooms[newRoomId] = { transmitter: ws, receiver: null };
                    ws.roomId = newRoomId;
                    ws.send(JSON.stringify({ type: 'room_created', payload: { roomId: newRoomId } }));
                    console.log(`Room created: ${newRoomId}`);
                    break;
                }
                case 'join_room': {
                    if (rooms[roomId]) {
                        rooms[roomId].receiver = ws;
                        ws.roomId = roomId;
                        if (rooms[roomId].transmitter) {
                            rooms[roomId].transmitter.send(JSON.stringify({ type: 'receiver_joined', payload: { roomId } }));
                            console.log(`Receiver joined room: ${roomId}`);
                        }
                    } else {
                        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Room not found' } }));
                    }
                    break;
                }
                // 受信側からのメッセージを送信側に中継
                case 'request_chunk':
                case 'complete': {
                    if (roomId && rooms[roomId] && rooms[roomId].transmitter) {
                        rooms[roomId].transmitter.send(JSON.stringify(data));
                    }
                    break;
                }
                // 送信側からのメッセージを受信側に中継
                case 'chunk_displayed': {
                    if (roomId && rooms[roomId] && rooms[roomId].receiver) {
                        rooms[roomId].receiver.send(JSON.stringify(data));
                    }
                    break;
                }
            }
        } catch (e) {
            console.error('Failed to parse or handle message', e);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        const { roomId } = ws;
        if (roomId && rooms[roomId]) {
            // TODO: ルームの片方が切断したことをもう一方に通知するロジック
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
