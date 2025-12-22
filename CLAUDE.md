# Rook Game - Online Multiplayer Card Game

## Repository
https://github.com/nebrown-cam/rook-game

## Deployment
- **Platform**: Render.com
- **Service ID**: srv-d507m2e3jp1c73f2ssf0

## Project Overview
An online multiplayer implementation of the Rook card game using Node.js, Express, and Socket.io. Players can join rooms, bid on tricks, and play rounds of Rook in real-time.

## Technology Stack
- **Backend**: Node.js with Express
- **Real-time Communication**: Socket.io
- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Game Logic**: Custom implementation in game.js

## Project Structure

```
rook-game/
├── server.js           # Express server & Socket.io event handlers
├── game.js             # Core game logic and state management
├── package.json        # Node.js dependencies
├── public/
│   ├── index.html      # Main game interface
│   ├── css/
│   │   └── style.css   # Game styling
│   ├── js/
│   │   └── main.js     # Client-side game logic & UI updates
│   └── images/         # Card images (Black, Green, Red, Yellow suits + ROOK)
```

## Key Files

### Backend Files

#### `server.js` (Backend Server)
- Express server setup on port 3000
- Socket.io connection handling
- Room management and player connections
- Delegates game logic to game.js

#### `game.js` (Game Logic)
- Core Rook game rules and state management
- Handles bidding, trump selection, card playing
- Validates moves and calculates scores
- Manages game flow (bidding → trump → discard → trick-taking)

### Frontend Files

#### `public/index.html`
- Main game interface
- Three screens: join, lobby, game
- Card display areas for all 4 players
- Bidding controls, trump selection, and discard functionality

#### `public/js/main.js` (Client-Side Logic)
Main client-side JavaScript file that handles:
- **Socket.io client connection**
- **UI updates and rendering**
- **Player interaction handling**

#### `public/css/style.css`
- Game layout and card positioning
- Responsive design with CSS variables
- Card overlap and animation effects

## Game Flow

1. **Join/Lobby**
   - Players join room with name and room code
   - Host starts game when 4 players present

2. **Bidding Phase**
   - Players bid or pass in rotation
   - Minimum bid enforced if 3 players pass
   - Winner gets to pick trump and receives nest cards

3. **Trump Selection**
   - Bid winner selects trump suit
   - Receives 5 nest cards (15 total)

4. **Discard Phase**
   - Bid winner discards 5 cards back to nest
   - Hand returns to 10 cards

5. **Trick-Taking**
   - 10 tricks played
   - Follow suit rules enforced
   - Trump beats non-trump
   - Winner leads next trick

6. **Scoring**
   - Points counted from captured tricks
   - Bid winner's team must make contract or get set
   - Game continues until team reaches winning score

## Running the Project

```bash
# Install dependencies
npm install

# Start server
node server.js

# Open browser to
http://localhost:3000
```

