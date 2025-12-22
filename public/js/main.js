// main.js - Complete updated file

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

// Game elements
const yourHand = document.getElementById('your-hand');
const partnerCards = document.getElementById('partner-cards');
const leftPlayerCards = document.getElementById('left-player-cards');
const rightPlayerCards = document.getElementById('right-player-cards');
const partnerName = document.getElementById('partner-name');
const leftPlayerName = document.getElementById('left-player-name');
const rightPlayerName = document.getElementById('right-player-name');
const yourName = document.getElementById('your-name');
const trumpSuit = document.getElementById('trump-suit');
const nestCards = document.getElementById('nest-cards');

// Trick area elements
const trickCardYou = document.getElementById('trick-card-you');
const trickCardPartner = document.getElementById('trick-card-partner');
const trickCardLeft = document.getElementById('trick-card-left');
const trickCardRight = document.getElementById('trick-card-right');

// Bid elements
const bidSelect = document.getElementById('bid-select');
const bidBtn = document.getElementById('bid-btn');
const passBtn = document.getElementById('pass-btn');
const trumpSelect = document.getElementById('trump-select');
const trumpBtn = document.getElementById('trump-btn');
const discardBtn = document.getElementById('discard-btn');
const helpBidValue = document.getElementById('help-bid-value');

// Bid labels
const partnerBid = document.getElementById('partner-bid');
const leftPlayerBid = document.getElementById('left-player-bid');
const rightPlayerBid = document.getElementById('right-player-bid');

// Score labels
const teamHumanScore = document.getElementById('team-human-score');
const teamAiScore = document.getElementById('team-ai-score');
const teamHumanName = document.getElementById('team-human-name');
const teamAiName = document.getElementById('team-ai-name');

// Store local player info
let myPlayerId = null;
let myPosition = null;
let isHost = false;
let myHand = [];
let selectedCard = null;
let gameConfig = null;
let currentBidAmount = 0;
let relativePositions = null;
let currentTrump = null;

// Discard mode tracking
let discardMode = false;
let selectedCards = [];

// Trick play tracking
let trickPlayMode = false;
let isMyTurn = false;

// ------------------------------------------------
// RESPONSIVE SCALING - Improved Implementation
// ------------------------------------------------

const BASE_WIDTH = 1200;
const BASE_HEIGHT = 1200;
const MIN_SCALE = 0.4;  // Prevent game from becoming too small
const MAX_SCALE = 1.2;  // Prevent excessive enlargement
const VERTICAL_PADDING = 20;  // Padding at top and bottom (in pixels)

let resizeTimeout = null;

function scaleGame() {
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer || gameScreen.classList.contains('hidden')) return;
    
    // Get available space (subtract padding from height)
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight - (VERTICAL_PADDING * 2);
    
    // Calculate scale to fit while maintaining aspect ratio
    const scaleX = windowWidth / BASE_WIDTH;
    const scaleY = windowHeight / BASE_HEIGHT;
    
    // Use the smaller scale to ensure it fits in both dimensions
    let scale = Math.min(scaleX, scaleY);
    
    // Clamp scale to min/max bounds
    scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
    
    // Apply the scale transform
    gameContainer.style.transform = `scale(${scale})`;
    
    // Adjust container position to center properly after scaling
    // This accounts for the fact that transform doesn't affect layout
    const scaledWidth = BASE_WIDTH * scale;
    const scaledHeight = BASE_HEIGHT * scale;
    
    gameContainer.style.left = `${(window.innerWidth - scaledWidth) / 2}px`;
    gameContainer.style.top = `${VERTICAL_PADDING + (windowHeight - scaledHeight) / 2}px`;
}

// Debounced resize handler
function handleResize() {
    if (resizeTimeout) {
        clearTimeout(resizeTimeout);
    }
    resizeTimeout = setTimeout(scaleGame, 100);
}

// Scale on window resize (debounced)
window.addEventListener('resize', handleResize);

// Initial scale when page loads
window.addEventListener('load', scaleGame);

// Use ResizeObserver for more reliable detection
if (typeof ResizeObserver !== 'undefined') {
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(document.body);
}

// ------------------------------------------------
// END RESPONSIVE SCALING
// ------------------------------------------------

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
socket.on('game-started', (data) => {
    const { hand, position, players, nest, bidOptions, currentBidder, currentBid, gameConfig: config } = data;

    myHand = hand;
    myPosition = position;
    gameConfig = config;
    currentBidAmount = currentBid;

    // Reset all mode states
    discardMode = false;
    selectedCards = [];
    trickPlayMode = false;
    isMyTurn = false;
    currentTrump = null; 

    // Switch to game screen
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    // Set up player names based on position
    relativePositions = getRelativePositions(position, players);
    yourName.textContent = relativePositions.you.name + ' (You)';
    partnerName.textContent = relativePositions.partner.name + ' (Partner)';
    leftPlayerName.textContent = relativePositions.left.name;
    rightPlayerName.textContent = relativePositions.right.name;

    // Update team names in score box
    teamHumanName.textContent = `${relativePositions.you.name} & ${relativePositions.partner.name}`;
    teamAiName.textContent = `${relativePositions.left.name} & ${relativePositions.right.name}`;

    // Clear bid labels
    partnerBid.textContent = '';
    leftPlayerBid.textContent = '';
    rightPlayerBid.textContent = '';

    // Clear trick area
    clearTrickArea();

    // Reset trump display
    trumpSuit.textContent = 'None';

    // Render the nest
    renderNest(nest);

    // Render your hand
    renderHand();

    // Render other players' card backs
    renderCardBacks(partnerCards, 10, 'horizontal');
    renderCardBacks(leftPlayerCards, 10, 'vertical');
    renderCardBacks(rightPlayerCards, 10, 'vertical');

    // Populate bid dropdown
    populateBidOptions(bidOptions);

    // Reset control states
    trumpSelect.disabled = true;
    trumpBtn.disabled = true;
    discardBtn.disabled = true;

    // Update bidding UI
    updateBiddingUI(currentBidder, currentBid);

    // Scale the game after DOM updates
    requestAnimationFrame(scaleGame);
});

// Handle new round (after first round)
socket.on('new-round', (data) => {
    const { hand, position, players, nest, bidOptions, currentBidder, currentBid, dealer, teamScores, gameConfig: config } = data;

    console.log(`New round starting! Dealer is position ${dealer}`);

    myHand = hand;
    myPosition = position;
    gameConfig = config;
    currentBidAmount = currentBid;

    // Reset all mode states
    discardMode = false;
    selectedCards = [];
    trickPlayMode = false;
    isMyTurn = false;
    currentTrump = null;

    // Update relative positions (in case needed)
    relativePositions = getRelativePositions(position, players);

    // Clear bid labels
    partnerBid.textContent = '';
    leftPlayerBid.textContent = '';
    rightPlayerBid.textContent = '';

    // Clear trick area
    clearTrickArea();

    // Reset trump display
    trumpSuit.textContent = 'None';

    // Remove any turn indicators
    yourName.classList.remove('current-turn');
    partnerName.classList.remove('current-turn');
    leftPlayerName.classList.remove('current-turn');
    rightPlayerName.classList.remove('current-turn');

    // Update scores display - my team's score goes in "You & Partner" row
    const myTeam = myPosition % 2;
    teamHumanScore.textContent = teamScores[myTeam];
    teamAiScore.textContent = teamScores[1 - myTeam];

    // Render the nest
    renderNest(nest);

    // Render your hand
    renderHand();

    // Render other players' card backs (all back to 10)
    renderCardBacks(partnerCards, 10, 'horizontal');
    renderCardBacks(leftPlayerCards, 10, 'vertical');
    renderCardBacks(rightPlayerCards, 10, 'vertical');

    // Populate bid dropdown
    populateBidOptions(bidOptions);

    // Reset control states
    trumpSelect.disabled = true;
    trumpBtn.disabled = true;
    discardBtn.disabled = true;
    bidSelect.disabled = false;

    // Update bidding UI
    updateBiddingUI(currentBidder, currentBid);

    // Show new round message
    const dealerName = getPlayerNameByPosition(dealer);
    helpBidValue.textContent = `New round! ${dealerName} dealt.`;
    
    // After a moment, switch to normal bidding message
    setTimeout(() => {
        if (currentBidder === myPosition) {
            helpBidValue.textContent = 'Opening bid:';
        } else {
            helpBidValue.textContent = `Waiting for ${getPlayerNameByPosition(currentBidder)} to bid...`;
        }
    }, 2000);

    // Scale the game after DOM updates
    requestAnimationFrame(scaleGame);
});

// Calculate relative positions (who is partner, left, right)
function getRelativePositions(myPos, players) {
    const partnerPos = (myPos + 2) % 4;
    const leftPos = (myPos + 1) % 4;
    const rightPos = (myPos + 3) % 4;

    return {
        you: players.find(p => p.position === myPos),
        partner: players.find(p => p.position === partnerPos),
        left: players.find(p => p.position === leftPos),
        right: players.find(p => p.position === rightPos)
    };
}

// Render the nest
function renderNest(nest) {
    nestCards.innerHTML = '';

    // Match the CSS variable --card-overlap-nest (12px)
    const OVERLAP = 12;

    // Get card width from CSS variable, fallback to 100
    const CARD_W = parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('--card-width')) || 100;

    // Make the container wide enough for however many cards are in the nest
    const count = nest.count ?? 0;
    nestCards.style.width = count > 0 ? `${CARD_W + OVERLAP * (count - 1)}px` : `${CARD_W}px`;

    // Render card backs for hidden cards
    const hiddenCount = nest.faceUpCard ? nest.count - 1 : nest.count;
    for (let i = 0; i < hiddenCount; i++) {
        const cardBack = document.createElement('div');
        cardBack.className = 'card-back';
        cardBack.style.left = (i * OVERLAP) + 'px';
        nestCards.appendChild(cardBack);
    }

    // Render face-up card if there is one
    if (nest.faceUpCard) {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.left = (hiddenCount * OVERLAP) + 'px';

        const img = document.createElement('img');
        img.src = `images/${nest.faceUpCard.image}`;
        img.alt = `${nest.faceUpCard.color} ${nest.faceUpCard.number}`;
        card.appendChild(img);

        nestCards.appendChild(card);
    }
}

// Render the player's hand
function renderHand() {
    yourHand.innerHTML = '';

    myHand.forEach((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        cardDiv.dataset.index = index;

        const img = document.createElement('img');
        img.src = `images/${card.image}`;
        img.alt = `${card.color} ${card.number}`;

        cardDiv.appendChild(img);
        cardDiv.addEventListener('click', () => handleCardClick(index));

        // If in discard mode and this card is selected, add the discard-selected class
        if (discardMode && selectedCards.includes(index)) {
            cardDiv.classList.add('discard-selected');
        }

        yourHand.appendChild(cardDiv);
    });
}

// Handle card click - routes to appropriate selection mode
function handleCardClick(index) {
    if (discardMode) {
        toggleDiscardSelection(index);
    } else if (trickPlayMode && isMyTurn) {
        playCard(index);
    }
    // During bidding or when not your turn, clicking does nothing
}

// Toggle a card's selection for discard (multi-select)
function toggleDiscardSelection(index) {
    const cardDiv = yourHand.querySelectorAll('.card')[index];

    if (selectedCards.includes(index)) {
        // Deselect: remove from array
        selectedCards = selectedCards.filter(i => i !== index);
        cardDiv.classList.remove('discard-selected');
    } else {
        // Select: add to array
        selectedCards.push(index);
        cardDiv.classList.add('discard-selected');
    }

    // Update discard button state and help text
    updateDiscardButtonState();
}

// Update discard button enabled state based on selection count
function updateDiscardButtonState() {
    const count = selectedCards.length;
    
    if (count === 5) {
        discardBtn.disabled = false;
        helpBidValue.textContent = `5 cards selected. Click Discard to continue.`;
    } else {
        discardBtn.disabled = true;
        helpBidValue.textContent = `Select 5 cards to discard (${count} selected)`;
    }
}

// Play a card (during trick-taking)
function playCard(index) {
    const card = myHand[index];
    
    console.log(`Playing card: ${card.color} ${card.number}`);
    
    // Send to server for validation
    socket.emit('play-card', { card: card });
}

// Render card backs for other players
function renderCardBacks(container, count, orientation) {
    container.innerHTML = '';

    for (let i = 0; i < count; i++) {
        const cardBack = document.createElement('div');
        cardBack.className = 'card-back';
        container.appendChild(cardBack);
    }
}

// Populate bid dropdown options
function populateBidOptions(options) {
    bidSelect.innerHTML = '';

    if (options.length === 0) {
        bidSelect.disabled = true;
    } else {
        options.forEach(bid => {
            const option = document.createElement('option');
            option.value = bid;
            option.textContent = bid;
            bidSelect.appendChild(option);
        });
        bidSelect.disabled = false;
    }
}

// Update the bidding UI based on whose turn it is
function updateBiddingUI(currentBidder, currentBid) {
    currentBidAmount = currentBid;

    // Update help text
    if (currentBid === 0) {
        helpBidValue.textContent = 'Opening bid:';
    } else {
        helpBidValue.textContent = `Current bid: ${currentBid}`;
    }

    // Enable/disable bid and pass buttons based on whose turn it is
    const isMyTurnToBid = currentBidder === myPosition;
    bidBtn.disabled = !isMyTurnToBid;
    passBtn.disabled = !isMyTurnToBid;

    // Highlight current bidder
    highlightCurrentBidder(currentBidder);
}

// Highlight the label of the current bidder
function highlightCurrentBidder(bidderPosition) {
    // Remove all highlights
    partnerBid.textContent = partnerBid.textContent.replace(' *', '');
    leftPlayerBid.textContent = leftPlayerBid.textContent.replace(' *', '');
    rightPlayerBid.textContent = rightPlayerBid.textContent.replace(' *', '');

    // Add highlight to current bidder
    if (relativePositions) {
        if (bidderPosition === relativePositions.partner.position) {
            partnerBid.textContent = (partnerBid.textContent || 'Bidding') + ' *';
        } else if (bidderPosition === relativePositions.left.position) {
            leftPlayerBid.textContent = (leftPlayerBid.textContent || 'Bidding') + ' *';
        } else if (bidderPosition === relativePositions.right.position) {
            rightPlayerBid.textContent = (rightPlayerBid.textContent || 'Bidding') + ' *';
        }
    }
}

// Select a card from hand (single-select mode for trick play - not currently used)
function selectCard(index) {
    const cards = yourHand.querySelectorAll('.card');

    // Deselect previous
    if (selectedCard !== null && cards[selectedCard]) {
        cards[selectedCard].classList.remove('selected');
    }

    // Select new (or deselect if same)
    if (selectedCard === index) {
        selectedCard = null;
    } else {
        selectedCard = index;
        cards[index].classList.add('selected');
    }
}

// Bid button click handler
bidBtn.addEventListener('click', () => {
    const bidAmount = parseInt(bidSelect.value);

    if (isNaN(bidAmount)) {
        alert('Please select a valid bid amount.');
        return;
    }

    // Send bid to server
    socket.emit('place-bid', { bidAmount });
});

// Pass button click handler
passBtn.addEventListener('click', () => {
    // Send pass to server
    socket.emit('pass-bid');
});

// Trump button click handler
trumpBtn.addEventListener('click', () => {
    const trumpColor = trumpSelect.value;

    if (!trumpColor) {
        alert('Please select a trump color.');
        return;
    }

    // Send trump selection to server
    socket.emit('select-trump', { trumpColor });
});

// Discard button click handler
discardBtn.addEventListener('click', () => {
    // Validate exactly 5 cards selected
    if (selectedCards.length !== 5) {
        alert('Please select exactly 5 cards to discard.');
        return;
    }

    // Get the actual card objects (not just indices) to send to server
    const cardsToDiscard = selectedCards.map(index => myHand[index]);

    // Send discard to server
    socket.emit('discard-cards', { cards: cardsToDiscard });

    // Disable button while waiting for server response
    discardBtn.disabled = true;
    helpBidValue.textContent = 'Discarding...';
});

// Handle bid update from server
socket.on('bid-update', (data) => {
    const { bidder, bidderPosition, bidAmount, currentBid, currentBidder, bidOptions } = data;

    console.log(`${bidder} bid ${bidAmount}`);

    // Update the bid label for the bidder
    if (relativePositions) {
        if (bidderPosition === relativePositions.partner.position) {
            partnerBid.textContent = `Bid: ${bidAmount}`;
        } else if (bidderPosition === relativePositions.left.position) {
            leftPlayerBid.textContent = `Bid: ${bidAmount}`;
        } else if (bidderPosition === relativePositions.right.position) {
            rightPlayerBid.textContent = `Bid: ${bidAmount}`;
        } else if (bidderPosition === myPosition) {
            // My own bid - no label needed, but could add feedback
        }
    }

    // Update bid options dropdown
    populateBidOptions(bidOptions);

    // Update bidding UI for next bidder
    updateBiddingUI(currentBidder, currentBid);
});

// Handle pass update from server
socket.on('pass-update', (data) => {
    const { passer, passerPosition, currentBidder, bidOptions } = data;

    console.log(`${passer} passed`);

    // Update the bid label for the passer
    if (relativePositions) {
        if (passerPosition === relativePositions.partner.position) {
            partnerBid.textContent = 'Passed';
        } else if (passerPosition === relativePositions.left.position) {
            leftPlayerBid.textContent = 'Passed';
        } else if (passerPosition === relativePositions.right.position) {
            rightPlayerBid.textContent = 'Passed';
        } else if (passerPosition === myPosition) {
            // I passed - disable my buttons
            bidBtn.disabled = true;
            passBtn.disabled = true;
        }
    }

    // Update bid options dropdown
    populateBidOptions(bidOptions);

    // Clear dropdown for the player who passed
    if (passerPosition === myPosition) {
        bidSelect.innerHTML = '';
        bidSelect.disabled = true;
    }

    // Update bidding UI for next bidder
    updateBiddingUI(currentBidder, currentBidAmount);
});

// Handle forced bid (when 3 players pass)
socket.on('forced-bid', (data) => {
    const { bidder, bidderPosition, bidAmount } = data;

    console.log(`${bidder} was forced to bid ${bidAmount}`);

    // Update the bid label for the forced bidder
    if (relativePositions) {
        if (bidderPosition === relativePositions.partner.position) {
            partnerBid.textContent = `Forced bid: ${bidAmount}`;
        } else if (bidderPosition === relativePositions.left.position) {
            leftPlayerBid.textContent = `Forced bid: ${bidAmount}`;
        } else if (bidderPosition === relativePositions.right.position) {
            rightPlayerBid.textContent = `Forced bid: ${bidAmount}`;
        } else if (bidderPosition === myPosition) {
            // I was forced to bid
            helpBidValue.textContent = `You were forced to bid ${bidAmount}`;
        }
    }
});

// Handle bidding complete from server
socket.on('bidding-complete', (data) => {
    const { winner, winnerPosition, winningBid } = data;

    console.log(`Bidding complete! ${winner} won with ${winningBid}`);

    // Disable bidding controls
    bidBtn.disabled = true;
    passBtn.disabled = true;
    bidSelect.disabled = true;

    // Clear bid highlights
    partnerBid.textContent = partnerBid.textContent.replace(' *', '');
    leftPlayerBid.textContent = leftPlayerBid.textContent.replace(' *', '');
    rightPlayerBid.textContent = rightPlayerBid.textContent.replace(' *', '');

    // Show winner message
    helpBidValue.textContent = `${winner} won with ${winningBid}`;

    // If I'm NOT the winner, keep trump controls disabled
    if (winnerPosition !== myPosition) {
        trumpSelect.disabled = true;
        trumpBtn.disabled = true;
    }
    // If I AM the winner, wait for nest cards before enabling trump selection
});

// Handle receiving nest cards (only winner gets this)
socket.on('receive-nest', (data) => {
    const { nestCards } = data;

    console.log('Received nest cards:', nestCards);

    // Add nest cards to my hand
    myHand = myHand.concat(nestCards);

    // Sort the combined hand (use currentTrump if set)
    sortHandLocally(myHand, currentTrump);

    // Re-render hand (now shows 15 cards)
    renderHand();

    // Update nest display to show it's empty/with player
    renderNestEmpty();

    // Update help text
    helpBidValue.textContent = 'Review your cards, then select trump';

    // Enable trump selection
    trumpSelect.disabled = false;
    trumpBtn.disabled = false;
});

// Handle trump selection from server (all players receive this)
socket.on('trump-selected', (data) => {
    const { trump, declarer, declarerPosition } = data;

    console.log(`Trump selected: ${trump} by ${declarer}`);

    // Store trump globally for sorting
    currentTrump = trump;

    // Update trump display
    trumpSuit.textContent = trump;

    // Disable trump controls for everyone
    trumpSelect.disabled = true;
    trumpBtn.disabled = true;

    // Re-sort hand with ROOK in trump suit and re-render
    sortHandLocally(myHand, currentTrump);
    renderHand();

    // Update help text and enable discard mode for declarer
    if (declarerPosition === myPosition) {
        // Enter discard mode
        discardMode = true;
        selectedCards = [];
        
        helpBidValue.textContent = `Select 5 cards to discard (0 selected)`;
        // Discard button stays disabled until 5 cards are selected
        discardBtn.disabled = true;
    } else {
        helpBidValue.textContent = `Trump: ${trump}. ${declarer} is discarding...`;
    }
});

// Handle discard complete from server (all players receive this)
socket.on('discard-complete', (data) => {
    const { declarer, declarerPosition } = data;

    console.log(`${declarer} has finished discarding`);

    // Exit discard mode
    discardMode = false;
    selectedCards = [];

    // Disable discard button
    discardBtn.disabled = true;

    // Update nest to show 5 face-down cards
    renderNestFaceDown(5);

    // Update help text
    helpBidValue.textContent = `${declarer} leads the first trick.`;
});

// Handle updated hand after discard (only declarer receives this)
socket.on('hand-updated', (data) => {
    const { hand } = data;

    console.log('Hand updated after discard:', hand);

    // Clear discard mode state BEFORE re-rendering
    discardMode = false;
    selectedCards = [];

    // Replace hand with the updated 10-card hand
    myHand = hand;

    // Re-sort with current trump so ROOK is in correct position
    sortHandLocally(myHand, currentTrump);

    // Re-render hand
    renderHand();
});

// Handle trick play starting
socket.on('trick-play-start', (data) => {
    const { currentPlayer, trickNumber } = data;

    console.log(`Trick play starting! Trick ${trickNumber}, current player: ${currentPlayer}`);

    // Enter trick play mode
    trickPlayMode = true;
    isMyTurn = (currentPlayer === myPosition);

    // Update UI
    updateTurnIndicator(currentPlayer);
    
    if (isMyTurn) {
        helpBidValue.textContent = 'Your turn - click a card to play';
    } else {
        const playerName = getPlayerNameByPosition(currentPlayer);
        helpBidValue.textContent = `${playerName}'s turn`;
    }
});

// Handle a card being played
socket.on('card-played', (data) => {
    const { card, playerPosition, playerName, cardsInTrick } = data;

    console.log(`${playerName} played ${card.color} ${card.number}`);

    // Show the card in the trick area
    displayCardInTrick(card, playerPosition);

    // If it was my card, remove it from my hand
    if (playerPosition === myPosition) {
        myHand = myHand.filter(c => c.id !== card.id);
        renderHand();
    } else {
        // Update opponent's card count display
        updateOpponentCardCount(playerPosition);
    }
});

// Handle turn update
socket.on('turn-update', (data) => {
    const { currentPlayer } = data;

    isMyTurn = (currentPlayer === myPosition);
    updateTurnIndicator(currentPlayer);

    if (isMyTurn) {
        helpBidValue.textContent = 'Your turn - click a card to play';
    } else {
        const playerName = getPlayerNameByPosition(currentPlayer);
        helpBidValue.textContent = `${playerName}'s turn`;
    }
});

// Handle trick complete
socket.on('trick-complete', (data) => {
    const { winnerPosition, winnerName, winningTeam, trickNumber, isLastTrick, nextPlayer } = data;

    console.log(`Trick ${trickNumber} complete! Winner: ${winnerName} (Team ${winningTeam})`);

    // Show who won
    helpBidValue.textContent = `${winnerName} wins trick ${trickNumber}!`;
});

// Handle next trick starting
socket.on('next-trick', (data) => {
    const { currentPlayer, trickNumber } = data;

    console.log(`Starting trick ${trickNumber}, leader: ${currentPlayer}`);

    // Clear the trick area
    clearTrickArea();

    // Update turn
    isMyTurn = (currentPlayer === myPosition);
    updateTurnIndicator(currentPlayer);

    if (isMyTurn) {
        helpBidValue.textContent = `Trick ${trickNumber} - Your lead`;
    } else {
        const playerName = getPlayerNameByPosition(currentPlayer);
        helpBidValue.textContent = `Trick ${trickNumber} - ${playerName}'s lead`;
    }
});

// Handle round complete
socket.on('round-complete', (data) => {
    const { team0Points, team1Points, declarerTeam, bid, madeContract, teamScores, highBidderPosition } = data;

    console.log(`Round complete! Team 0: ${team0Points}, Team 1: ${team1Points}`);
    console.log(`Declarer (Team ${declarerTeam}) ${madeContract ? 'made' : 'was set on'} ${bid}`);

    // Clear trick area
    clearTrickArea();

    // Update score display - my team's score goes in "You & Partner" row
    const myTeam = myPosition % 2;
    teamHumanScore.textContent = teamScores[myTeam];
    teamAiScore.textContent = teamScores[1 - myTeam];

    // Show round summary
    const declarerName = getPlayerNameByPosition(highBidderPosition);
    if (madeContract) {
        helpBidValue.textContent = `${declarerName} made ${bid}! Next round in 5 seconds...`;
    } else {
        helpBidValue.textContent = `${declarerName} was SET on ${bid}! Next round in 5 seconds...`;
    }

    // Exit trick play mode
    trickPlayMode = false;
    isMyTurn = false;
});

// Handle game over
socket.on('game-over', (data) => {
    const { winningTeam, finalScores } = data;

    console.log(`Game over! Team ${winningTeam} wins with ${finalScores[winningTeam]} points`);

    const myTeam = myPosition % 2;
    if (winningTeam === myTeam) {
        helpBidValue.textContent = `🎉 YOU WIN! Final: ${finalScores[myTeam]} - ${finalScores[1-myTeam]}`;
    } else {
        helpBidValue.textContent = `Game Over. You lose. Final: ${finalScores[myTeam]} - ${finalScores[1-myTeam]}`;
    }

    trickPlayMode = false;
    isMyTurn = false;
});

// Helper: Display a card in the trick area
function displayCardInTrick(card, playerPosition) {
    // Map absolute position to relative position
    let trickSlot;
    if (playerPosition === myPosition) {
        trickSlot = trickCardYou;
    } else if (playerPosition === relativePositions.partner.position) {
        trickSlot = trickCardPartner;
    } else if (playerPosition === relativePositions.left.position) {
        trickSlot = trickCardLeft;
    } else {
        trickSlot = trickCardRight;
    }

    // Create and display the card image
    trickSlot.innerHTML = '';
    const img = document.createElement('img');
    img.src = `images/${card.image}`;
    img.alt = `${card.color} ${card.number}`;
    trickSlot.appendChild(img);
}

// Helper: Clear the trick area
function clearTrickArea() {
    trickCardYou.innerHTML = '';
    trickCardPartner.innerHTML = '';
    trickCardLeft.innerHTML = '';
    trickCardRight.innerHTML = '';
}

// Helper: Update turn indicator
function updateTurnIndicator(currentPlayer) {
    // Remove all turn indicators
    yourName.classList.remove('current-turn');
    partnerName.classList.remove('current-turn');
    leftPlayerName.classList.remove('current-turn');
    rightPlayerName.classList.remove('current-turn');

    // Add indicator to current player
    if (currentPlayer === myPosition) {
        yourName.classList.add('current-turn');
    } else if (currentPlayer === relativePositions.partner.position) {
        partnerName.classList.add('current-turn');
    } else if (currentPlayer === relativePositions.left.position) {
        leftPlayerName.classList.add('current-turn');
    } else {
        rightPlayerName.classList.add('current-turn');
    }
}

// Helper: Get player name by absolute position
function getPlayerNameByPosition(position) {
    if (position === myPosition) {
        return 'You';
    } else if (position === relativePositions.partner.position) {
        return relativePositions.partner.name;
    } else if (position === relativePositions.left.position) {
        return relativePositions.left.name;
    } else {
        return relativePositions.right.name;
    }
}

// Helper: Update opponent card count after they play
function updateOpponentCardCount(playerPosition) {
    let container;
    if (playerPosition === relativePositions.partner.position) {
        container = partnerCards;
    } else if (playerPosition === relativePositions.left.position) {
        container = leftPlayerCards;
    } else {
        container = rightPlayerCards;
    }

    // Remove one card back
    if (container.children.length > 0) {
        container.removeChild(container.lastChild);
    }
}

// Get color for trump display
function getTrumpColor(trump) {
    const colors = {
        'Black': '#000000',
        'Green': '#00AA00',
        'Red': '#CC0000',
        'Yellow': '#FFD700'
    };
    return colors[trump] || '#FFFFFF';
}

// Sort hand locally - descending order within each suit
function sortHandLocally(hand, trump = null) {
    const baseColorOrder = { 'Black': 0, 'Green': 1, 'Red': 2, 'Yellow': 3, 'Rook': 4 };

    hand.sort((a, b) => {
        // Determine effective color for each card
        let aColor = a.color;
        let bColor = b.color;
        
        // If trump is set, ROOK sorts with trump suit
        if (a.color === 'Rook' && trump) {
            aColor = trump;
        }
        if (b.color === 'Rook' && trump) {
            bColor = trump;
        }

        // Sort by color first
        if (baseColorOrder[aColor] !== baseColorOrder[bColor]) {
            return baseColorOrder[aColor] - baseColorOrder[bColor];
        }

        // Within same color, handle ROOK (highest - goes first)
        if (a.color === 'Rook') return -1;
        if (b.color === 'Rook') return 1;

        // Within same color, handle 1s (highest numbered card - goes after ROOK)
        if (a.number === 1 && b.number !== 1) return -1;
        if (b.number === 1 && a.number !== 1) return 1;

        // Descending order for remaining cards (14, 13, 12, ... 5)
        return b.number - a.number;
    });
}

// Render empty nest (or message that cards are with winner)
function renderNestEmpty() {
    nestCards.innerHTML = '';
    const message = document.createElement('div');
    message.style.cssText = 'color: white; font-size: 14px; padding: 10px; text-align: center;';
    message.textContent = 'In your hand';
    nestCards.appendChild(message);
}

// Render nest with face-down cards (after discard)
function renderNestFaceDown(count) {
    nestCards.innerHTML = '';

    const OVERLAP = 12;
    const CARD_W = parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('--card-width')) || 100;

    nestCards.style.width = count > 0 ? `${CARD_W + OVERLAP * (count - 1)}px` : `${CARD_W}px`;

    for (let i = 0; i < count; i++) {
        const cardBack = document.createElement('div');
        cardBack.className = 'card-back';
        cardBack.style.left = (i * OVERLAP) + 'px';
        nestCards.appendChild(cardBack);
    }
}

// Handle error messages from server
socket.on('error-message', (message) => {
    alert(message);
});