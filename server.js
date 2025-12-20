// server.js - Complete updated file

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const game = require('./game');

// Create the Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' folder with correct MIME types
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Store active game rooms
const rooms = {};

// Helper function to start a new round (used for initial start and subsequent rounds)
function startNewRound(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    // Deal the cards
    const { hands, nest } = game.dealCards();
    room.hands = hands;
    room.nest = nest;

    // Reset bidding state
    room.currentBid = 0;
    room.highBidder = null;
    room.highBidderPosition = null;
    room.currentBidder = (room.dealer + 1) % 4; // Left of dealer bids first
    room.passedPlayers = [];
    room.biddingComplete = false;
    room.trumpSelected = false;
    room.discardComplete = false;
    room.trump = null;

    // Reset trick-taking state
    room.trick = [];
    room.ledColor = null;
    room.tricksPlayed = 0;
    room.teamTricks = [[], []];
    room.currentPlayer = 0;
    room.trickLeader = 0;

    // Reset player passed flags
    room.players.forEach(p => p.hasPassed = false);

    // Prepare nest info - one card face up per game rules
    const nestInfo = {
        count: nest.length,
        faceUpCard: game.GAME_CONFIG.flipOneCardInNest ? nest[nest.length - 1] : null
    };

    // Get initial bid options
    const bidOptions = game.getBidOptions(0);

    // Send each player their hand (only their own cards)
    room.players.forEach((player, index) => {
        const playerSocket = io.sockets.sockets.get(player.id);
        if (playerSocket) {
            playerSocket.emit('new-round', {
                hand: hands[index],
                position: index,
                players: room.players.map(p => ({
                    name: p.name,
                    position: p.position
                })),
                nest: nestInfo,
                bidOptions: bidOptions,
                currentBidder: room.currentBidder,
                currentBid: room.currentBid,
                dealer: room.dealer,
                teamScores: room.teamScores,
                gameConfig: {
                    minBid: game.GAME_CONFIG.minOpeningBid,
                    maxBid: game.GAME_CONFIG.maxBid,
                    bidIncrement: game.GAME_CONFIG.bidIncrement
                }
            });
        }
    });

    console.log(`New round started in room ${roomCode}. Dealer: Player ${room.dealer}`);
}

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
                gameStarted: false,
                hands: [],
                nest: [],
                currentBid: 0,
                highBidder: null,
                highBidderPosition: null,
                currentBidder: 0,
                passedPlayers: [],
                trump: null,
                dealer: 0,
                currentPlayer: 0,
                trick: [],
                trickLeader: 0,
                ledColor: null,
                tricksPlayed: 0,
                teamTricks: [[], []], // Cards won by each team (for scoring)
                teamScores: [0, 0],   // Running game scores
                biddingComplete: false,
                trumpSelected: false,
                discardComplete: false
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
            position: room.players.length, // 0, 1, 2, or 3
            tricksWon: [],
            hasPassed: false
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

        // Deal the cards
        const { hands, nest } = game.dealCards();
        room.hands = hands;
        room.nest = nest;

        // Reset bidding state
        room.currentBid = 0;
        room.highBidder = null;
        room.highBidderPosition = null;
        room.currentBidder = (room.dealer + 1) % 4; // Left of dealer bids first
        room.passedPlayers = [];
        room.biddingComplete = false;
        room.trumpSelected = false;
        room.discardComplete = false;
        room.trump = null;

        // Reset trick-taking state
        room.trick = [];
        room.ledColor = null;
        room.tricksPlayed = 0;
        room.teamTricks = [[], []];

        // Reset player passed flags
        room.players.forEach(p => p.hasPassed = false);

        // Prepare nest info - one card face up per game rules
        const nestInfo = {
            count: nest.length,
            faceUpCard: game.GAME_CONFIG.flipOneCardInNest ? nest[nest.length - 1] : null
        };

        // Get initial bid options
        const bidOptions = game.getBidOptions(0);

        // Send each player their hand (only their own cards)
        room.players.forEach((player, index) => {
            const playerSocket = io.sockets.sockets.get(player.id);
            if (playerSocket) {
                playerSocket.emit('game-started', {
                    hand: hands[index],
                    position: index,
                    players: room.players.map(p => ({
                        name: p.name,
                        position: p.position
                    })),
                    nest: nestInfo,
                    bidOptions: bidOptions,
                    currentBidder: room.currentBidder,
                    currentBid: room.currentBid,
                    gameConfig: {
                        minBid: game.GAME_CONFIG.minOpeningBid,
                        maxBid: game.GAME_CONFIG.maxBid,
                        bidIncrement: game.GAME_CONFIG.bidIncrement
                    }
                });
            }
        });

        console.log(`Game started in room ${roomCode}`);
    });

    // Handle a player placing a bid
    socket.on('place-bid', (data) => {
        const { bidAmount } = data;
        const roomCode = socket.roomCode;
        const room = rooms[roomCode];

        if (!room || !room.gameStarted || room.biddingComplete) return;

        // Find the player
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        // Verify it's this player's turn to bid
        if (player.position !== room.currentBidder) {
            socket.emit('error-message', 'It is not your turn to bid.');
            return;
        }

        // Verify the player hasn't already passed
        if (player.hasPassed) {
            socket.emit('error-message', 'You have already passed.');
            return;
        }

        // Verify the bid is valid
        const minBid = room.currentBid === 0 ? game.GAME_CONFIG.minOpeningBid : room.currentBid + game.GAME_CONFIG.bidIncrement;
        if (bidAmount < minBid || bidAmount > game.GAME_CONFIG.maxBid) {
            socket.emit('error-message', `Bid must be between ${minBid} and ${game.GAME_CONFIG.maxBid}.`);
            return;
        }

        // Place the bid
        room.currentBid = bidAmount;
        room.highBidder = player.id;
        room.highBidderPosition = player.position;

        console.log(`${player.name} bid ${bidAmount} in room ${roomCode}`);

        // Count how many players have passed
        const passedCount = room.players.filter(p => p.hasPassed).length;

        // Check if bidding is complete (3 players have passed)
        if (passedCount === 3) {
            room.biddingComplete = true;

            console.log(`*** BIDDING COMPLETE in room ${roomCode}. Winner: ${player.name} with ${room.currentBid} ***`);

            // Notify all players of the bid first
            io.to(roomCode).emit('bid-update', {
                bidder: player.name,
                bidderPosition: player.position,
                bidAmount: bidAmount,
                currentBid: room.currentBid,
                currentBidder: -1,
                bidOptions: []
            });

            // Notify all players that bidding is complete
            io.to(roomCode).emit('bidding-complete', {
                winner: player.name,
                winnerPosition: player.position,
                winningBid: room.currentBid
            });

            // Add nest cards to winner's hand on server side
            room.hands[player.position] = room.hands[player.position].concat(room.nest);
            game.sortHand(room.hands[player.position]);

            // Send nest cards to the winner
            socket.emit('receive-nest', {
                nestCards: room.nest
            });
            console.log(`Sent nest cards to ${player.name}. Hand now has ${room.hands[player.position].length} cards.`);

            return;
        }

        // Get new bid options for next bidder
        const newBidOptions = game.getBidOptions(room.currentBid);

        // Move to next bidder
        room.currentBidder = (room.currentBidder + 1) % 4;

        // Skip players who have passed
        let attempts = 0;
        while (room.players[room.currentBidder].hasPassed && attempts < 4) {
            room.currentBidder = (room.currentBidder + 1) % 4;
            attempts++;
        }

        // Broadcast bid update to all players
        io.to(roomCode).emit('bid-update', {
            bidder: player.name,
            bidderPosition: player.position,
            bidAmount: bidAmount,
            currentBid: room.currentBid,
            currentBidder: room.currentBidder,
            bidOptions: newBidOptions
        });
    });

    // Handle a player passing
    socket.on('pass-bid', () => {
        const roomCode = socket.roomCode;
        const room = rooms[roomCode];

        if (!room || !room.gameStarted || room.biddingComplete) return;

        // Find the player
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        // Verify it's this player's turn
        if (player.position !== room.currentBidder) {
            socket.emit('error-message', 'It is not your turn to bid.');
            return;
        }

        // Verify the player hasn't already passed
        if (player.hasPassed) {
            socket.emit('error-message', 'You have already passed.');
            return;
        }

        // Mark player as passed
        player.hasPassed = true;

        // Count how many players have passed
        const passedCount = room.players.filter(p => p.hasPassed).length;

        console.log(`${player.name} passed in room ${roomCode}. Total passed: ${passedCount}`);

        // Check if 3 players have passed without anyone bidding (force the 4th player to bid minimum)
        if (passedCount === 3 && room.highBidder === null) {
            // Find the player who hasn't passed
            const forcedBidder = room.players.find(p => !p.hasPassed);

            console.log(`*** 3 PASSES in room ${roomCode}. ${forcedBidder.name} is FORCED to bid ${game.GAME_CONFIG.minOpeningBid} ***`);

            // Force the minimum bid
            room.currentBid = game.GAME_CONFIG.minOpeningBid;
            room.highBidder = forcedBidder.id;
            room.highBidderPosition = forcedBidder.position;
            room.biddingComplete = true;

            // Broadcast the pass first
            io.to(roomCode).emit('pass-update', {
                passer: player.name,
                passerPosition: player.position,
                currentBidder: -1,
                bidOptions: []
            });

            // Notify all players about the forced bid
            io.to(roomCode).emit('forced-bid', {
                bidder: forcedBidder.name,
                bidderPosition: forcedBidder.position,
                bidAmount: game.GAME_CONFIG.minOpeningBid
            });

            // Notify all players that bidding is complete
            io.to(roomCode).emit('bidding-complete', {
                winner: forcedBidder.name,
                winnerPosition: forcedBidder.position,
                winningBid: game.GAME_CONFIG.minOpeningBid
            });

            // Add nest cards to winner's hand on server side
            room.hands[forcedBidder.position] = room.hands[forcedBidder.position].concat(room.nest);
            game.sortHand(room.hands[forcedBidder.position]);

            // Send nest cards to the forced bidder
            const forcedBidderSocket = io.sockets.sockets.get(forcedBidder.id);
            if (forcedBidderSocket) {
                forcedBidderSocket.emit('receive-nest', {
                    nestCards: room.nest
                });
                console.log(`Sent nest cards to ${forcedBidder.name}. Hand now has ${room.hands[forcedBidder.position].length} cards.`);
            }

            return;
        }

        // Check if bidding is over (3 players have passed after at least one bid)
        if (passedCount === 3 && room.highBidder !== null) {
            // Broadcast this final pass to all players
            io.to(roomCode).emit('pass-update', {
                passer: player.name,
                passerPosition: player.position,
                currentBidder: -1,
                bidOptions: []
            });

            room.biddingComplete = true;

            // Find the high bidder
            const highBidderPlayer = room.players.find(p => p.id === room.highBidder);

            console.log(`*** BIDDING COMPLETE in room ${roomCode}. Winner: ${highBidderPlayer.name} with ${room.currentBid} ***`);

            // Notify all players that bidding is complete
            io.to(roomCode).emit('bidding-complete', {
                winner: highBidderPlayer.name,
                winnerPosition: highBidderPlayer.position,
                winningBid: room.currentBid
            });

            // Add nest cards to winner's hand on server side
            room.hands[highBidderPlayer.position] = room.hands[highBidderPlayer.position].concat(room.nest);
            game.sortHand(room.hands[highBidderPlayer.position]);

            // Send nest cards to the winner
            const winnerSocket = io.sockets.sockets.get(room.highBidder);
            if (winnerSocket) {
                winnerSocket.emit('receive-nest', {
                    nestCards: room.nest
                });
                console.log(`Sent nest cards to ${highBidderPlayer.name}. Hand now has ${room.hands[highBidderPlayer.position].length} cards.`);
            }

            return;
        }

        // Move to next bidder
        room.currentBidder = (room.currentBidder + 1) % 4;

        // Skip players who have passed
        let attempts = 0;
        while (room.players[room.currentBidder].hasPassed && attempts < 4) {
            room.currentBidder = (room.currentBidder + 1) % 4;
            attempts++;
        }

        // Get bid options for next bidder
        const newBidOptions = game.getBidOptions(room.currentBid);

        // Broadcast pass update to all players
        io.to(roomCode).emit('pass-update', {
            passer: player.name,
            passerPosition: player.position,
            currentBidder: room.currentBidder,
            bidOptions: newBidOptions
        });
    });

    // Handle trump selection
    socket.on('select-trump', (data) => {
        const { trumpColor } = data;
        const roomCode = socket.roomCode;
        const room = rooms[roomCode];

        if (!room || !room.gameStarted || !room.biddingComplete || room.trumpSelected) return;

        // Find the player
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        // Verify this is the high bidder
        if (player.id !== room.highBidder) {
            socket.emit('error-message', 'Only the bid winner can select trump.');
            return;
        }

        // Verify trump color is valid
        if (!game.COLORS.includes(trumpColor)) {
            socket.emit('error-message', 'Invalid trump color.');
            return;
        }

        // Set the trump
        room.trump = trumpColor;
        room.trumpSelected = true;

        console.log(`*** ${player.name} selected ${trumpColor} as trump in room ${roomCode} ***`);

        // Notify all players of the trump selection
        io.to(roomCode).emit('trump-selected', {
            trump: trumpColor,
            declarer: player.name,
            declarerPosition: player.position
        });
    });

    // Handle discarding cards (from bid winner)
    socket.on('discard-cards', (data) => {
        const { cards } = data;
        const roomCode = socket.roomCode;
        const room = rooms[roomCode];

        if (!room || !room.gameStarted || !room.trumpSelected) return;

        // Find the player
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        // Verify this is the high bidder
        if (player.id !== room.highBidder) {
            socket.emit('error-message', 'Only the bid winner can discard.');
            return;
        }

        // Verify exactly 5 cards
        if (!cards || cards.length !== 5) {
            socket.emit('error-message', 'You must discard exactly 5 cards.');
            return;
        }

        // Get the player's current hand
        const playerIndex = player.position;
        const playerHand = room.hands[playerIndex];

        // Verify all cards are in the player's hand
        const cardIds = cards.map(c => c.id);
        const handIds = playerHand.map(c => c.id);
        
        for (const cardId of cardIds) {
            if (!handIds.includes(cardId)) {
                socket.emit('error-message', 'Invalid card selection.');
                return;
            }
        }

        // Remove discarded cards from hand and add to nest
        room.hands[playerIndex] = playerHand.filter(c => !cardIds.includes(c.id));
        room.nest = cards; // Replace nest with discarded cards
        room.discardComplete = true;

        console.log(`*** ${player.name} discarded 5 cards in room ${roomCode} ***`);
        console.log(`    New hand size: ${room.hands[playerIndex].length}`);

        // Send updated hand to the declarer
        socket.emit('hand-updated', {
            hand: room.hands[playerIndex]
        });

        // Notify all players that discarding is complete
        io.to(roomCode).emit('discard-complete', {
            declarer: player.name,
            declarerPosition: player.position
        });

        // Set up for trick play - declarer leads first
        room.currentPlayer = room.highBidderPosition;
        room.trickLeader = room.highBidderPosition;
        room.trick = [];
        room.ledColor = null;

        console.log(`    ${player.name} will lead the first trick`);

        // Notify all players that trick play is starting
        io.to(roomCode).emit('trick-play-start', {
            currentPlayer: room.currentPlayer,
            trickNumber: 1
        });
    });

    // Handle playing a card
    socket.on('play-card', (data) => {
        const { card } = data;
        const roomCode = socket.roomCode;
        const room = rooms[roomCode];

        if (!room || !room.gameStarted || !room.discardComplete) return;

        // Find the player
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        // Verify it's this player's turn
        if (player.position !== room.currentPlayer) {
            socket.emit('error-message', 'It is not your turn to play.');
            return;
        }

        // Get the player's hand
        const playerHand = room.hands[player.position];

        // Verify the card is in the player's hand
        const cardIndex = playerHand.findIndex(c => c.id === card.id);
        if (cardIndex === -1) {
            socket.emit('error-message', 'You do not have that card.');
            return;
        }

        // Determine led color (if this is the first card of the trick)
        const ledColor = room.trick.length === 0 ? 
            (card.color === 'Rook' ? room.trump : card.color) : 
            room.ledColor;

        // Verify the play is legal (must follow suit if able)
        if (!game.canPlayCard(card, playerHand, room.trump, ledColor)) {
            socket.emit('error-message', 'You must follow suit if able.');
            return;
        }

        // Remove card from player's hand
        room.hands[player.position].splice(cardIndex, 1);

        // Set led color if this is the first card
        if (room.trick.length === 0) {
            room.ledColor = card.color === 'Rook' ? room.trump : card.color;
        }

        // Add card to trick
        room.trick.push({
            card: card,
            playerPosition: player.position,
            playerName: player.name
        });

        console.log(`${player.name} played ${card.color} ${card.number} in room ${roomCode}`);

        // Broadcast the played card to all players
        io.to(roomCode).emit('card-played', {
            card: card,
            playerPosition: player.position,
            playerName: player.name,
            cardsInTrick: room.trick.length
        });

        // Check if trick is complete (4 cards played)
        if (room.trick.length === 4) {
            // Determine the winner
            const winnerPosition = game.getTrickWinner(room.trick, room.trump, room.ledColor);
            const winner = room.players.find(p => p.position === winnerPosition);

            // Determine which team won (positions 0,2 = team 0; positions 1,3 = team 1)
            const winningTeam = winnerPosition % 2;

            // Add trick cards to winning team's pile
            room.trick.forEach(t => {
                room.teamTricks[winningTeam].push(t.card);
            });

            room.tricksPlayed++;

            console.log(`*** Trick ${room.tricksPlayed} won by ${winner.name} (Team ${winningTeam}) ***`);

            // Check if this was the last trick
            if (room.tricksPlayed === 10) {
                // Add nest to the winning team's cards (winner of last trick gets nest)
                room.nest.forEach(c => {
                    room.teamTricks[winningTeam].push(c);
                });

                console.log(`*** Last trick! Team ${winningTeam} gets the nest ***`);

                // Calculate round scores
                const team0Points = game.calculatePoints(room.teamTricks[0]);
                const team1Points = game.calculatePoints(room.teamTricks[1]);

                console.log(`    Team 0 points: ${team0Points}, Team 1 points: ${team1Points}`);

                // Determine if declarer made their bid
                const declarerTeam = room.highBidderPosition % 2;
                const declarerPoints = declarerTeam === 0 ? team0Points : team1Points;
                const madeContract = declarerPoints >= room.currentBid;

                // Update game scores
                if (madeContract) {
                    // Declarer's team gets their points
                    room.teamScores[declarerTeam] += declarerPoints;
                    // Opponents get their points
                    room.teamScores[1 - declarerTeam] += (declarerTeam === 0 ? team1Points : team0Points);
                } else {
                    // Declarer's team goes "set" - loses bid amount
                    room.teamScores[declarerTeam] -= room.currentBid;
                    // Opponents get their points
                    room.teamScores[1 - declarerTeam] += (declarerTeam === 0 ? team1Points : team0Points);
                }

                console.log(`    Declarer team ${declarerTeam} ${madeContract ? 'MADE' : 'SET'} (needed ${room.currentBid}, got ${declarerPoints})`);
                console.log(`    Game scores: Team 0 = ${room.teamScores[0]}, Team 1 = ${room.teamScores[1]}`);

                // Notify all players of trick completion
                io.to(roomCode).emit('trick-complete', {
                    winnerPosition: winnerPosition,
                    winnerName: winner.name,
                    winningTeam: winningTeam,
                    trickNumber: room.tricksPlayed,
                    isLastTrick: true
                });

                // Small delay then send round complete
                setTimeout(() => {
                    io.to(roomCode).emit('round-complete', {
                        team0Points: team0Points,
                        team1Points: team1Points,
                        declarerTeam: declarerTeam,
                        bid: room.currentBid,
                        madeContract: madeContract,
                        teamScores: room.teamScores,
                        highBidderPosition: room.highBidderPosition
                    });

                    // Check for game winner
                    if (room.teamScores[0] >= 500 || room.teamScores[1] >= 500) {
                        const gameWinner = room.teamScores[0] >= 500 ? 0 : 1;
                        io.to(roomCode).emit('game-over', {
                            winningTeam: gameWinner,
                            finalScores: room.teamScores
                        });
                        console.log(`*** GAME OVER! Team ${gameWinner} wins! ***`);
                    } else {
                        // No winner yet - start a new round after a delay
                        console.log(`    Starting new round in 5 seconds...`);
                        
                        // Rotate the dealer for the next round
                        room.dealer = (room.dealer + 1) % 4;
                        
                        setTimeout(() => {
                            startNewRound(roomCode);
                        }, 5000); // 5 second delay to read scores before new round
                    }
                }, 2000);

            } else {
                // More tricks to play - winner leads next trick
                room.currentPlayer = winnerPosition;
                room.trickLeader = winnerPosition;

                // Notify all players of trick completion
                io.to(roomCode).emit('trick-complete', {
                    winnerPosition: winnerPosition,
                    winnerName: winner.name,
                    winningTeam: winningTeam,
                    trickNumber: room.tricksPlayed,
                    isLastTrick: false,
                    nextPlayer: room.currentPlayer
                });

                // Clear trick for next round (after brief delay for clients to see result)
                setTimeout(() => {
                    room.trick = [];
                    room.ledColor = null;

                    // Notify players to start next trick
                    io.to(roomCode).emit('next-trick', {
                        currentPlayer: room.currentPlayer,
                        trickNumber: room.tricksPlayed + 1
                    });
                }, 2000); // 2 second delay to see the completed trick
            }
        } else {
            // Move to next player
            room.currentPlayer = (room.currentPlayer + 1) % 4;

            // Notify all players whose turn it is
            io.to(roomCode).emit('turn-update', {
                currentPlayer: room.currentPlayer
            });
        }
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