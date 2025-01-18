const express = require('express')

const app = express();

const http = require('http');

const { Server } = require('socket.io');//here we are importing server class

const ACTIONS = require('../src/Actions');

const server = http.createServer(app);

const io = new Server(server); // server class jo import kri uska instance  //passing http ka server io server mai

const userSocketMap = {};  //mapping socket id with uska username

app.get('/', (req, res) => res.send('Hello, Vercel!'));

function getAllConnectedClients(roomId) {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => {
        console.log('socketId:', socketId, 'username:', userSocketMap[socketId]);
        return {
            socketId,
            username: userSocketMap[socketId],
        };
    }); // this io.sokets.adapter whole thing has datatype map so that array.from is converting map to array
}


io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
        // Avoid duplicate joins for the same socket ID
        if (userSocketMap[socket.id]) {
            console.log(`User already joined: ${username}, socket: ${socket.id}`);
            return;
        }

        // Add user to the socket-user map
        userSocketMap[socket.id] = username;
        socket.join(roomId);

        console.log(`${username} joined room: ${roomId}`);

        // Get all connected clients
        let clients = getAllConnectedClients(roomId);

        // Emit updated clients list to the room
        io.in(roomId).emit(ACTIONS.CLIENTS_UPDATE, clients);

        // Notify other clients that a new user has joined
        socket.broadcast.to(roomId).emit(ACTIONS.JOINED, {
            clients,
            username,
            socketId: socket.id,
        });
    });

    socket.on('disconnect', () => {
        const username = userSocketMap[socket.id];
        if (!username) return; // Avoid duplicate disconnect events

        console.log(`User disconnected: ${username}, socket: ${socket.id}`);

        // Remove user from map
        delete userSocketMap[socket.id];

        // Notify the room about the disconnection
        const rooms = Array.from(socket.rooms);
        rooms.forEach((roomId) => {
            const clients = getAllConnectedClients(roomId);
            io.in(roomId).emit(ACTIONS.CLIENTS_UPDATE, clients);
            io.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username,
            });
        });
    });
});

// Helper function to get connected clients
function getAllConnectedClients(roomId) {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => ({
        socketId,
        username: userSocketMap[socketId],
    }));
}


const PORT = process.env.PORT || 5000; //if any port not found then we direct it to 5000 port

server.listen(PORT, () => console.log(`Listening on port, ${PORT}`));