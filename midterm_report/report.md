This markdown document summarizes all the necessary information for your Mid-term Written Report, strictly based on our previous discussions (Web-based P2P architecture, Toon Shading visual style, Blender workflow) and your specific team work distribution.

You can copy the content below and paste it into the SIGGRAPH LaTeX template.

***

# Mid-term Written Report: Ultimate Chicken Horse 3D

**Team Members:** An Yan, Zhenbang Pan
**Affiliation:** Tsinghua University
**Project Topic:** Topic 2: Interactive Game

## 1. Project Goal and Technical Points
**Project Goal:**
We aim to develop a web-based, 3D multiplayer party platformer game inspired by *Ultimate Chicken Horse*. The core gameplay loop involves two distinct phases: a **Building Phase**, where players strategically place traps and platforms to hinder opponents, and a **Running Phase**, where players compete to reach the goal using the built environment. The game features a stylized cartoon aesthetic and utilizes a P2P network architecture for online multiplayer interaction.

**Technical Points (Plan):**
Beyond the basic requirements (Red Parts) such as scene layout, kinematics animation, and basic character/camera control, we plan to implement the following advanced features (Black Parts):

*   **An Yan:**
    *   **Online multiplayer system (4pts):** Implementing a Host-Authoritative P2P architecture using WebRTC.
    *   **Customizable character appearance (2pts):** Allowing players to select different animal skins using texture atlas UV mapping.
    *   **Easy installation or online access (2pts):** Deploying via GitHub Pages with automated CI/CD.
    *   **Environment lighting (1pts):** Implementing Toon-style lighting with rim lights and shadow maps.
*   **Zhenbang Pan:**
    *   **Articulated objects (3pts):** Rigging and skinning for animal characters (e.g., Chicken, Horse, Sheep) with complex animations (Run, Jump, Die).
    *   **Fluid simulation (2pts):** Simulating non-Newtonian fluid interactions (e.g., Honey/Glue surfaces) and low-friction surfaces (Ice) using physical materials.
    *   **Additional auxiliary interfaces (2pts):** Inventory systems for trap selection and game state HUD.
    *   **User-friendly layout (1pts):** Aesthetic UI design matching the low-poly theme.
    *   **Synchronized audio (1pts):** BGM and sound effects synchronized with game events.

## 2. External Tools
*   **Rendering & Engine:** Three.js (WebGL), Vite (Build Tool).
*   **Physics Simulation:** Cannon-es (Rigid body physics).
*   **Networking:** PeerJS (WebRTC wrapper for P2P connection).
*   **Modeling & Animation:** Blender (Modeling, UV Mapping), Mixamo (Auto-rigging).
*   **Deployment:** GitHub Actions (CI/CD).

## 3. Finished Technical Aspects
We have established the core technical framework and art pipeline.

*   **Rendering Pipeline (Cartoon Style):**
    *   We rejected standard P2P rendering in favor of a stylized **Toon Shader**. We implemented `MeshToonMaterial` with a custom 5-step Gradient Map to achieve distinct light banding.
    *   Implemented **Post-processing Outline Pass** to generate edge lines for a "comic book" look.
    *   Resolved "pillow shading" artifacts on low-poly models by using **Harden Normals** in Blender and correct export settings.
*   **Asset Pipeline:**
    *   Established a **Master Palette Workflow**. Instead of individual textures, all game assets share a single 256x256 color palette texture to optimize draw calls.
    *   Completed initial modeling of core blocks (wood, metal) and traps (spikes) in Blender using the "Chamfered Box" technique for a toy-like aesthetic.
*   **Physics Engine Integration:**
    *   Integrated **Cannon-es** with Three.js. Implemented a sync mechanism where the physics body drives the visual mesh.
    *   Implemented basic collision detection logic for traps (differentiating between safe surfaces and deadly tips).
*   **Infrastructure:**
    *   Set up the **GitHub Actions** workflow. The project is automatically built and deployed to `github.io` upon pushing to the main branch, solving path resolving issues (base URL configuration).

## 4. Plan for Remaining Technical Tasks
*   **Networking (Ongoing):** Finalize the state synchronization for the "Building Phase" (syncing object placement) and "Running Phase" (interpolating player positions to handle latency).
*   **Character Animation:** Import animal models, apply rigging via Mixamo, and implement the `AnimationMixer` state machine (blending between Idle, Run, and Jump).
*   **Special Surface Interaction:** Implement the physics logic for "Honey" (high friction/viscosity) and "Ice" (zero friction) using Cannon-es `ContactMaterials`.
*   **Game Loop Logic:** Implement the turn-based logic, scoring system, and the "Replay System" (recording state snapshots for playback).
*   **Audio & Polish:** Add spatial sound effects and refine the UI interactions.

## 5. Detailed Schedule

*   **Nov 15 - Nov 30:** Project initialization, tech stack selection (Three.js + Cannon-es), and setting up the CI/CD pipeline. (Completed)
*   **Dec 1 - Dec 7:** Core Gameplay Prototype. Implementing the "Building Phase" (Raycasting for object placement) and basic "Running Phase" physics. Art style validation.
*   **Dec 8 - Dec 14:** Multiplayer Synchronization. Implementing PeerJS data channels for syncing game states and player inputs.
*   **Dec 15 - Dec 21:** Character & Animation. Importing rigged characters, setting up the animation state machine, and implementing character customization.
*   **Dec 22 - Dec 28:** Gameplay Refinement. Adding fluid/ice mechanics, audio, scoring logic, and the replay system.
*   **Dec 29 - Dec 31:** Final Polish. UI beautification, bug fixing, and preparation for the In-class Presentation.
*   **Jan 1 - Jan 14:** Final Report writing and code cleanup.

***

### Tips for your LaTeX Report:

1.  **Visuals:** Since you need to include "visual results," take a screenshot of your current game scene (even if it's just cubes). Make sure the **Toon Shading (color banding)** and **Outlines** are visible to prove you have a custom rendering style.
2.  **Length:** The text above is concise. With the header and a figure/screenshot, it should fill about 1 full column to 1.5 columns in the SIGGRAPH format, which meets the "One full page" requirement perfectly without exceeding two pages.
3.  **Formatting:** Use `\section{}` for the numbered headers and `\itemize` for the lists.