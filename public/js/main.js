// Connect to the Socket.io server
const socket = io();

// Get references to HTML elements
const joinScreen = document.getElementById('join-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const playerNameInput = document.getElementById('player-name');
const roomCodeInput = document.getElementById('room-code');
const joinBtn = document.getElementById('join-btn');
const errorMessage = document.getElementById('error-message');
const displayRoomCode = document.getElementById('display-room-code');
const playersList = document.getElementById('players');
const startBtn = document.getElementById('start-btn');
const waitingMessage = document.querySelector('.waiting-message');

// Store local player info
let myPlayerId = null;
let isHost = false;

// Join button click handler
joinBtn.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    const roomCode = roomCodeInput.value.trim();

    // Validate inputs
    if (!playerName) {
        errorMessage.textContent = 'Please enter your name.';
        return;
    }
    if (!roomCode) {
        errorMessage.textContent = 'Please enter a room code.';
        return;
    }

    // Clear any previous error
    errorMessage.textContent = '';

    // Send join request to server
    socket.emit('join-room', { playerName, roomCode });
});

// Allow pressing Enter to join
roomCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinBtn.click();
    }
});

playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        roomCodeInput.focus();
    }
});

// Handle room update from server
socket.on('room-update', (data) => {
    const { players, hostId } = data;

    // Store our player ID
    myPlayerId = socket.id;
    isHost = (socket.id === hostId);

    // Switch to lobby screen
    joinScreen.classList.add('hidden');
    lobbyScreen.classList.remove('hidden');

    // Display room code
    displayRoomCode.textContent = roomCodeInput.value.toUpperCase();

    // Update players list
    playersList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.name;
        if (player.id === hostId) {
            li.classList.add('host');
        }
        playersList.appendChild(li);
    });

    // Show/hide start button (only host sees it when 4 players are present)
    if (isHost && players.length === 4) {
        startBtn.classList.remove('hidden');
        waitingMessage.style.display = 'none';
    } else {
        startBtn.classList.add('hidden');
        if (players.length < 4) {
            waitingMessage.style.display = 'block';
            waitingMessage.textContent = `Waiting for ${4 - players.length} more player${4 - players.length !== 1 ? 's' : ''}...`;
        } else {
            waitingMessage.textContent = 'Waiting for host to start...';
        }
    }
});

// Start button click handler
startBtn.addEventListener('click', () => {
    socket.emit('start-game');
});

// Handle game started
socket.on('game-started', () => {
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
});

// Handle error messages from server
socket.on('error-message', (message) => {
    errorMessage.textContent = message;
});
