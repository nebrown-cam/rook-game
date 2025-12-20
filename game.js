// Rook card game logic - Nate's Kentucky ROOK style

// Card colors
const COLORS = ['Black', 'Green', 'Red', 'Yellow'];

// Game style configuration for "Nate's Kentucky ROOK"
const GAME_CONFIG = {
    name: "Nate's Kentucky ROOK",
    scoreToWin: 500,
    deckSize: 45,
    nestSize: 5,
    cardsPerPlayer: 10,
    minOpeningBid: 100,
    maxBid: 180,
    bidIncrement: 5,
    onesHigh: true,
    hasRook: true,
    removeCards: [2, 3, 4],
    flipOneCardInNest: true,
    nestHasCounters: true,
    whoLeads: 'Declarer',
    shootTheMoon: false,
    declarerWinsOnTie: false,
    rookFollowsColorLed: true,
    rookIsHighestTrump: true,
    points: {
        0: 20,   // ROOK
        1: 15,   // 1s (high)
        5: 5,    // 5s
        10: 10,  // 10s
        14: 10   // 14s
    }
};

// Create a deck according to game configuration
function createDeck() {
    const deck = [];

    // Add numbered cards for each color
    for (const color of COLORS) {
        for (let number = 1; number <= 14; number++) {
            // Skip removed cards
            if (GAME_CONFIG.removeCards.includes(number)) {
                continue;
            }

            deck.push({
                id: `${color}${number.toString().padStart(2, '0')}`,
                color: color,
                number: number,
                points: GAME_CONFIG.points[number] || 0,
                image: `${color}${number.toString().padStart(2, '0')}.png`
            });
        }
    }

    // Add the Rook card if configured
    if (GAME_CONFIG.hasRook) {
        deck.push({
            id: 'ROOK',
            color: 'Rook',
            number: 0,
            points: GAME_CONFIG.points[0] || 20,
            image: 'ROOK.png'
        });
    }

    return deck;
}

// Shuffle an array in place (Fisher-Yates algorithm)
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Deal cards to players and nest
function dealCards() {
    const deck = createDeck();
    shuffle(deck);

    const hands = [[], [], [], []];
    const nest = [];

    // Deal to nest first
    for (let i = 0; i < GAME_CONFIG.nestSize; i++) {
        nest.push(deck.pop());
    }

    // Deal remaining cards to players
    let currentPlayer = 0;
    while (deck.length > 0) {
        hands[currentPlayer].push(deck.pop());
        currentPlayer = (currentPlayer + 1) % 4;
    }

    // Sort each hand
    for (const hand of hands) {
        sortHand(hand);
    }

    return { hands, nest };
}

// Sort a hand by color, then by number within color (descending: ROOK, 1, 14, 13, ... 5)
function sortHand(hand) {
    const colorOrder = { 'Black': 0, 'Green': 1, 'Red': 2, 'Yellow': 3, 'Rook': 4 };

    hand.sort((a, b) => {
        // Sort by color first
        if (colorOrder[a.color] !== colorOrder[b.color]) {
            return colorOrder[a.color] - colorOrder[b.color];
        }
        
        // Within same color, sort descending
        // 1s are highest (beat 14s), so they come first
        if (GAME_CONFIG.onesHigh) {
            if (a.number === 1 && b.number !== 1) return -1;
            if (b.number === 1 && a.number !== 1) return 1;
        }
        
        // Descending order for remaining cards (14, 13, 12, ... 5)
        return b.number - a.number;
    });
}

// Get the card rank for comparison (higher = better)
function getCardRank(card, trumpColor, ledColor) {
    // ROOK special handling
    if (card.color === 'Rook') {
        if (GAME_CONFIG.rookIsHighestTrump) {
            // ROOK is highest trump
            return 200;
        } else {
            // ROOK is lowest trump
            return 100;
        }
    }

    let rank = card.number;

    // If 1s are high, 1 beats 14
    if (GAME_CONFIG.onesHigh && card.number === 1) {
        rank = 15;
    }

    // Trump cards beat non-trump
    if (card.color === trumpColor) {
        rank += 100;
    }
    // Cards matching led color can win (if not trump)
    else if (card.color === ledColor) {
        rank += 0; // Base rank
    }
    // Off-suit, non-trump cards can't win
    else {
        rank = -1;
    }

    return rank;
}

// Determine trick winner
function getTrickWinner(trick, trumpColor, ledColor) {
    let winningIndex = 0;
    let winningRank = getCardRank(trick[0].card, trumpColor, ledColor);

    for (let i = 1; i < trick.length; i++) {
        const rank = getCardRank(trick[i].card, trumpColor, ledColor);
        if (rank > winningRank) {
            winningRank = rank;
            winningIndex = i;
        }
    }

    return trick[winningIndex].playerPosition;
}

// Check if a card can be legally played
function canPlayCard(card, hand, trumpColor, ledColor) {
    // If no card has been led yet, any card can be played
    if (!ledColor) {
        return true;
    }

    // ROOK handling
    if (card.color === 'Rook') {
        // If trump is led, ROOK can follow as highest trump
        if (ledColor === trumpColor) {
            return true;
        }
        
        // Otherwise, ROOK must follow color if configured
        if (GAME_CONFIG.rookFollowsColorLed) {
            // Can only play ROOK if you have no cards of the led color
            const hasLedColor = hand.some(c => c.color === ledColor);
            return !hasLedColor;
        }
        return true;
    }

    // If the card matches the led color, it's always legal
    if (card.color === ledColor) {
        return true;
    }

    // If the card doesn't match, check if player has any of the led color
    const hasLedColor = hand.some(c => c.color === ledColor && c.color !== 'Rook');
    return !hasLedColor;
}

// Calculate points in a set of cards
function calculatePoints(cards) {
    return cards.reduce((sum, card) => sum + card.points, 0);
}

// Generate bid options
function getBidOptions(currentBid) {
    const options = [];
    const minBid = currentBid === 0 ? GAME_CONFIG.minOpeningBid : currentBid + GAME_CONFIG.bidIncrement;
    
    for (let bid = minBid; bid <= GAME_CONFIG.maxBid; bid += GAME_CONFIG.bidIncrement) {
        options.push(bid);
    }
    
    return options;
}

// Export for use in server
module.exports = {
    COLORS,
    GAME_CONFIG,
    createDeck,
    shuffle,
    dealCards,
    sortHand,
    getCardRank,
    getTrickWinner,
    canPlayCard,
    calculatePoints,
    getBidOptions
};