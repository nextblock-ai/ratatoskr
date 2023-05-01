const blessed = require('blessed');

// Create a terminal UI screen
const screen = blessed.screen({
  smartCSR: true,
  title: 'Pong Game'
});

// Create game object
const game = {
  width: screen.width,
  height: screen.height,
  aiMode: false,
  player1: {
    x: 1,
    y: Math.floor(screen.height / 2),
    score: 0
  },
  player2: {
    x: screen.width - 2,
    y: Math.floor(screen.height / 2),
    score: 0
  },
  ball: {
    x: Math.floor(screen.width / 2),
    y: Math.floor(screen.height / 2),
    dx: 1,
    dy: 1
  }
};

// Draw paddles and ball
function draw() {
  screen.fill(game.player1.x, game.player1.y - 1, 1, 3, '|');
  screen.fill(game.player2.x, game.player2.y - 1, 1, 3, '|');
  screen.fill(game.ball.x, game.ball.y, 1, 1, 'o');
  screen.render();
}

// Handle input for single-player
function handleInput() {
  screen.on('keypress', (ch, key) => {
    if (key.name === 'q' || key.name === 'escape') process.exit(0);
    if (key.name === 'w') game.player1.y -= 2;
    if (key.name === 's') game.player1.y += 2;
    if (key.name === 'i') game.player2.y -= 2;
    if (key.name === 'k') game.player2.y += 2;
    if (key.name === 'a') game.aiMode = !game.aiMode;
  });
}

// Implement AI for single-player and AI to AI
function updateAI() {
  if (!game.aiMode) {
    if (game.ball.y < game.player2.y) game.player2.y -= 2;
    if (game.ball.y > game.player2.y) game.player2.y += 2;
  } else {
    if (game.ball.y < game.player1.y) game.player1.y -= 2;
    if (game.ball.y > game.player1.y) game.player1.y += 2;
    if (game.ball.y < game.player2.y) game.player2.y -= 2;
    if (game.ball.y > game.player2.y) game.player2.y += 2;
  }
}

// Detect collisions
function detectCollisions() {
  // Ball collision with top and bottom
  if (game.ball.y <= 0 || game.ball.y >= screen.height) {
    game.ball.dy *= -1;
  }

  // Ball collision with paddles
  if (
    (game.ball.x === game.player1.x && game.ball.y >= game.player1.y - 1 && game.ball.y <= game.player1.y + 1) ||
    (game.ball.x === game.player2.x && game.ball.y >= game.player2.y - 1 && game.ball.y <= game.player2.y + 1)
  ) {
    game.ball.dx *= -1;
  }

  // Ball goes out of bounds
  if (game.ball.x <= 0) {
    game.player2.score++;
    game.ball.x = Math.floor(screen.width / 2);
  }
  if (game.ball.x >= screen.width) {
    game.player1.score++;
    game.ball.x = Math.floor(screen.width / 2);
  }
}

// Update the game state
function updateGameState() {
  game.ball.x += game.ball.dx;
  game.ball.y += game.ball.dy;
}

// Implement game loop
function gameLoop() {
  draw();
  handleInput();
  updateAI();
  detectCollisions();
  updateGameState();
  setTimeout(gameLoop, 100);
}

// Start the game loop
gameLoop();
