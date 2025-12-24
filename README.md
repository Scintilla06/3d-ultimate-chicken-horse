# 3D Ultimate Chicken Horse

A 3D multiplayer platformer game inspired by "Ultimate Chicken Horse", built with Three.js, Cannon-es, and PeerJS.

## Features

*   **Multiplayer:** Host and Join games using PeerJS (P2P connection).
*   **Lobby System:** Character selection (Chicken, Horse, Raccoon) and player list.
*   **Build Phase:** Players pick items from a "Party Box" and place them in the level to help themselves or hinder opponents.
*   **Run Phase:** Platforming gameplay with jumping, sprinting, and physics-based interactions.
*   **Items:**
    *   **Wood Block:** Standard building block.
    *   **Spikes:** Deadly trap.
    *   **Spring:** Bounces players high in the air.
    *   **Black Hole:** Sucks players in.
    *   **Turret:** Shoots projectiles.
    *   **Coin:** Bonus points.
    *   **Conveyor:** Pushes players.
    *   **Bomb:** Destroys nearby objects.
*   **Scoring:** Points for reaching the goal, collecting coins, and winning.

## Controls

### General
*   **Mouse:** Look around / Aim
*   **Left Click:** Interact / Place Item

### Run Phase (Platforming)
*   **W / A / S / D:** Move
*   **Space:** Jump (Hold for higher jump)
*   **Shift:** Sprint

### Build Phase
*   **Mouse Wheel:** Adjust object height
*   **Q:** Rotate object
*   **Left Click:** Place object
*   **Escape:** Cancel placement / Return to view mode

### Spectator Mode
*   **W / A / S / D:** Move camera
*   **Space:** Move camera up
*   **Shift:** Move camera down

## Installation & Setup

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    Open the link provided in the terminal (usually `http://localhost:5173`) in your browser.

3.  **Build for Production:**
    ```bash
    npm run build
    ```

## How to Play

1.  **Start the Game:** Open the game in a browser.
2.  **Host:** Enter a nickname and click "Host Game". Share your "Host ID" with friends.
3.  **Join:** Enter a nickname, paste the "Host ID" from the host, and click "Join Game".
4.  **Lobby:** Select your character. The host starts the game when everyone is ready.
5.  **Pick Phase:** Click on an item in the Party Box to select it.
6.  **Build Phase:** Place your selected item in the level. Try to create a path to the goal while making it difficult for others!
7.  **Run Phase:** Try to reach the goal flag without dying.
8.  **Score:** Points are awarded based on who finishes and what items were used. The game continues until a player reaches the goal score.

## Technologies Used

*   **[Three.js](https://threejs.org/):** 3D Rendering
*   **[Cannon-es](https://github.com/pmndrs/cannon-es):** Physics Engine
*   **[PeerJS](https://peerjs.com/):** WebRTC Networking
*   **[Vite](https://vitejs.dev/):** Build Tool
*   **TypeScript:** Programming Language

## Audio

This project plays audio locally only (no network sync). Audio playback unlocks after the first user gesture (click/mousedown) due to browser autoplay policies.
