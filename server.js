const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Create the Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Store active game rooms
const rooms = {};

// Handle socket connections
io.on('connection', (socket) => {
    console.log('A player connected:', socket.id);

    // Player wants to join a room
    socket.on('join-room', (data) => {
        const { playerName, roomCode } = data;
        const roomCodeUpper = roomCode.toUpperCase();

        // Create room if it doesn't exist
        if (!rooms[roomCodeUpper]) {
            rooms[roomCodeUpper] = {
                players: [],
                host: socket.id,
                gameStarted: false
            };
        }

        const room = rooms[roomCodeUpper];

        // Check if game already started
        if (room.gameStarted) {
            socket.emit('error-message', 'Game has already started.');
            return;
        }

        // Check if room is full (4 players for Rook)
        if (room.players.length >= 4) {
            socket.emit('error-message', 'Room is full.');
            return;
        }

        // Add player to room
        const player = {
            id: socket.id,
            name: playerName,
            position: room.players.length // 0, 1, 2, or 3
        };
        room.players.push(player);
        socket.join(roomCodeUpper);
        socket.roomCode = roomCodeUpper;
        socket.playerName = playerName;

        console.log(`${playerName} joined room ${roomCodeUpper}`);

        // Tell everyone in the room about the updated player list
        io.to(roomCodeUpper).emit('room-update', {
            players: room.players,
            hostId: room.host
        });
    });

    // Host starts the game
    socket.on('start-game', () => {
        const roomCode = socket.roomCode;
        const room = rooms[roomCode];

        if (!room) return;

        // Only host can start, and need 4 players
        if (socket.id !== room.host) {
            socket.emit('error-message', 'Only the host can start the game.');
            return;
        }

        if (room.players.length !== 4) {
            socket.emit('error-message', 'Need exactly 4 players to start.');
            return;
        }

        room.gameStarted = true;
        io.to(roomCode).emit('game-started');
        console.log(`Game started in room ${roomCode}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('A player disconnected:', socket.id);

        const roomCode = socket.roomCode;
        if (!roomCode || !rooms[roomCode]) return;

        const room = rooms[roomCode];

        // Remove player from room
        room.players = room.players.filter(p => p.id !== socket.id);

        // If room is empty, delete it
        if (room.players.length === 0) {
            delete rooms[roomCode];
            console.log(`Room ${roomCode} deleted (empty)`);
            return;
        }

        // If host left, assign new host
        if (room.host === socket.id) {
            room.host = room.players[0].id;
        }

        // Update remaining players
        io.to(roomCode).emit('room-update', {
            players: room.players,
            hostId: room.host
        });
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});