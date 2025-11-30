import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { NetworkManager } from '../network/NetworkManager';
import { Packet, PacketType, PlayerInfo, SnapshotPayload } from '../network/Protocol';
import { Resources } from './Resources';
import { Loop } from './Loop';
import { UIManager } from '../ui/UIManager';
import { InputManager } from './InputManager';
import { Player } from '../objects/Player';
import { BodyFactory } from '../physics/BodyFactory';
import { PlaceholderGenerator } from '../utils/PlaceholderGenerator';

export enum GameState {
    TITLE,
    LOBBY,
    PICK,
    BUILD_VIEW,
    BUILD_PLACE,
    COUNTDOWN,
    RUN,
    SCORE,
    GAME_OVER
}

export class Game {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private physicsWorld: PhysicsWorld;
  private networkManager: NetworkManager;
  private resources: Resources;
  private loop: Loop;
  private uiManager: UIManager;
  private inputManager: InputManager;
  private players: Map<string, Player> = new Map();

  // Multiplayer
  private lobbyPlayers: PlayerInfo[] = [];
  private playersFinishedTurn: Set<string> = new Set();
  private myPlayerInfo: PlayerInfo = {
    id: "",
    nickname: "Player",
    character: "",
    isHost: false,
    isReady: false,
  };

  private state: GameState = -1 as GameState; // Start with invalid state to ensure first transition works
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mouse: THREE.Vector2 = new THREE.Vector2();
  private ghostObject: THREE.Group | null = null;
  private selectedItem: string | null = null;
  private bombRangeIndicator: THREE.Mesh | null = null;
  private highlightedMeshes: Map<THREE.Mesh, number> = new Map(); // Mesh -> Original Hex Color

  // Build System
  private buildGridPos: THREE.Vector3 = new THREE.Vector3();
  private buildHeight: number = 0;
  private buildRotation: number = 0; // 0, 1, 2, 3 (* PI/2)
  private gridHighlight: THREE.Mesh;
  private gridHelper: THREE.GridHelper;
  private buildCameraAngle: number = 0;

  // Countdown
  private countdownTimer: number = 0;

  // Camera Control
  private cameraAngleY: number = 0; // Horizontal angle (Yaw)
  private cameraAngleX: number = 0.3; // Vertical angle (Pitch)
  private cameraDistance: number = 10;

  // Camera Tween
  private cameraLerpActive: boolean = false;
  private cameraLerpStart: THREE.Vector3 = new THREE.Vector3();
  private cameraLerpEnd: THREE.Vector3 = new THREE.Vector3();
  private cameraLerpT: number = 0;
  private cameraLerpDuration: number = 0.8; // seconds

  private readonly GOAL_SCORE = 50;

  // Party Box
  private partyBoxRoot: THREE.Group = new THREE.Group();

  // Environment
  private clouds: THREE.Group[] = [];
  private partyBoxItems: THREE.Group[] = [];
  private availableItems: Set<string> = new Set(); // Track available items by ID (or index?)
  // Since items are objects, we need a unique ID for each spawned item instance.
  // Let's use index in partyBoxItems array for simplicity.

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document
      .getElementById("game-container")
      ?.appendChild(this.renderer.domElement);

    this.physicsWorld = new PhysicsWorld();
    this.networkManager = new NetworkManager();
    this.resources = new Resources();
    this.uiManager = new UIManager();
    this.inputManager = new InputManager();
    this.loop = new Loop(this.update.bind(this));

    // 将 3D 场景引用传给 UI 管理器，用于 3D UI 面板
    this.uiManager.attachScene(this.scene, this.camera, this.raycaster);

    // Build Grid Highlight (Column)
    this.gridHighlight = new THREE.Mesh(
      new THREE.BoxGeometry(1, 20, 1), // Tall column
      new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.2,
      })
    );
    this.gridHighlight.position.y = 10; // Center at y=10 so it covers 0-20
    this.scene.add(this.gridHighlight);
    this.gridHighlight.visible = false;

    // Grid Helper
    this.gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0x444444);
    this.gridHelper.position.y = 0.01; // Slightly above ground
    this.scene.add(this.gridHelper);
    this.gridHelper.visible = false;

    // Party Box Root
    this.scene.add(this.partyBoxRoot);
    this.partyBoxRoot.visible = false;

    // Load resources
    this.resources.loadDefaultPlaceholders();

    // Wait for resources to load before initializing
    this.resources.onReady(() => {
      // Ensure character models exist (using placeholders for now if not replaced)
      ["chicken", "penguin", "robot"].forEach((charId) => {
        if (!this.resources.models.has(charId)) {
          const group = new THREE.Group();
          // Simple placeholder: Sphere + Cone (Beak)
          const bodyGeo = new THREE.SphereGeometry(0.4, 16, 16);
          const bodyMat = new THREE.MeshStandardMaterial({
            color:
              charId === "chicken"
                ? 0xffffff
                : charId === "penguin"
                ? 0x000000
                : 0x888888,
          });
          const body = new THREE.Mesh(bodyGeo, bodyMat);
          body.position.y = 0.4;
          group.add(body);

          const headGeo = new THREE.SphereGeometry(0.25, 16, 16);
          const head = new THREE.Mesh(headGeo, bodyMat);
          head.position.y = 0.9;
          group.add(head);

          const beakGeo = new THREE.ConeGeometry(0.05, 0.1, 8);
          const beakMat = new THREE.MeshStandardMaterial({ color: 0xffa500 });
          const beak = new THREE.Mesh(beakGeo, beakMat);
          beak.position.set(0, 0.9, 0.2);
          beak.rotation.x = Math.PI / 2;
          group.add(beak);

          this.resources.models.set(charId, group);
        }
      });

      this.init();
      this.setupEvents();
      this.setupNetworkHandlers();
      this.setState(GameState.TITLE);
    });

    // Handle Window Resize
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  private setupNetworkHandlers() {
    this.networkManager.onIdAssigned = (id) => {
      this.myPlayerInfo.id = id;
      if (this.state === GameState.LOBBY) {
        this.refreshLobbyUI();
      }
    };

    this.networkManager.onPacketReceived = (
      packet: Packet,
      senderId: string
    ) => {
      switch (packet.t) {
        case PacketType.JOIN:
          // Host receives Join request
          if (this.networkManager.isHostUser()) {
            // Prevent duplicate joins
            if (this.lobbyPlayers.some((p) => p.id === senderId)) return;

            const newPlayer: PlayerInfo = {
              id: senderId,
              nickname: packet.p.nickname,
              character: "", // Default
              isHost: false,
              isReady: false,
            };
            this.lobbyPlayers.push(newPlayer);

            // Send Welcome packet with current state
            this.networkManager.send(
              {
                t: PacketType.WELCOME,
                p: {
                  players: this.lobbyPlayers,
                  state: this.state,
                },
              },
              senderId
            );

            // Broadcast new player list
            this.broadcastLobbyUpdate();
          }
          break;

        case PacketType.WELCOME:
          // Client receives Welcome
          this.lobbyPlayers = packet.p.players;
          this.myPlayerInfo.id = this.networkManager.getMyId();
          this.setState(GameState.LOBBY);
          break;

        case PacketType.LOBBY_UPDATE:
          this.lobbyPlayers = packet.p;
          this.refreshLobbyUI();
          break;

        case PacketType.CHARACTER_SELECT:
          if (this.networkManager.isHostUser()) {
            const requestedChar = packet.p.charId;
            const sender = this.lobbyPlayers.find((pl) => pl.id === senderId);

            if (sender) {
              // Check if taken by anyone else
              const isTaken = this.lobbyPlayers.some(
                (p) => p.character === requestedChar && p.id !== senderId
              );

              if (!isTaken) {
                sender.character = requestedChar;
                this.broadcastLobbyUpdate();
              } else {
                // If taken, we might want to send an update anyway to ensure client is in sync
                // (e.g. if they missed the previous update)
                this.broadcastLobbyUpdate();
              }
            }
          }
          break;

        case PacketType.START_GAME:
          if (this.networkManager.isHostUser()) return;
          this.startGame();
          break;

        case PacketType.SNAPSHOT:
          this.handleSnapshot(packet.p);
          // If Host, relay to others (excluding sender)
          if (this.networkManager.isHostUser()) {
            this.networkManager.send(packet, undefined); // Broadcast to all?
            // Wait, broadcast sends to everyone including sender?
            // NetworkManager.send iterates all connections.
            // We should probably filter sender.
            // But for now, sending back is fine (confirmation), or we can ignore it on client side if id matches self.
          }
          break;

        case PacketType.EVENT_PLACE:
          // Check if I am the original sender (to avoid duplicate placement)
          if (packet.p.playerId === this.networkManager.getMyId()) return;

          this.placeObject(
            packet.p.itemId,
            new THREE.Vector3(packet.p.pos.x, packet.p.pos.y, packet.p.z),
            packet.p.rot || 0
          );
          // Track turn using the original sender ID
          this.playersFinishedTurn.add(packet.p.playerId);
          this.checkAllPlayersFinished();

          // If Host, relay
          if (this.networkManager.isHostUser()) {
            this.networkManager.send(packet);
          }
          break;

        case PacketType.PARTY_BOX_UPDATE:
          this.spawnPartyBoxItems(packet.p);
          break;

        case PacketType.PICK_ITEM:
          // Host receives Pick Request
          if (this.networkManager.isHostUser()) {
            this.processPickRequest(packet.p.index, senderId);
          }
          break;

        case PacketType.ITEM_PICKED:
          this.handleItemPicked(packet.p.index, packet.p.playerId);
          break;

        case PacketType.PLAYER_FINISHED_RUN:
          // Host tracks finished players
          if (this.networkManager.isHostUser()) {
            // If I am the sender, I already handled this in update()
            if (senderId === this.networkManager.getMyId()) return;

            this.playersFinishedTurn.add(senderId);
            // Store score/result if needed (packet.p.score)

            if (this.playersFinishedTurn.size >= this.lobbyPlayers.length) {
              // All finished -> Show Score
              this.setState(GameState.SCORE);
            }
          }
          break;

        case PacketType.SHOW_SCORE:
          if (this.networkManager.isHostUser()) return;
          this.setState(GameState.SCORE);
          this.uiManager.showScoreScreen(
            packet.p.scores,
            this.GOAL_SCORE,
            () => {
              // Only Host triggers next round, but this callback might be useful for local cleanup
            }
          );
          break;
      }
    };
  }

  private checkAllPlayersFinished() {
    if (this.playersFinishedTurn.size >= this.lobbyPlayers.length) {
      this.setState(GameState.COUNTDOWN);
    }
  }

  private broadcastLobbyUpdate() {
    this.networkManager.send({
      t: PacketType.LOBBY_UPDATE,
      p: this.lobbyPlayers,
    });
    this.refreshLobbyUI();
  }

  private refreshLobbyUI() {
    if (this.state === GameState.LOBBY) {
      this.uiManager.showLobbyScreen(
        this.networkManager.getMyId(),
        this.lobbyPlayers,
        this.networkManager.isHostUser(),
        (charId) => {
          if (this.networkManager.isHostUser()) {
            // Host Logic
            const isTaken = this.lobbyPlayers.some(
              (p) => p.character === charId && p.id !== this.myPlayerInfo.id
            );
            if (!isTaken) {
              this.myPlayerInfo.character = charId;
              const me = this.lobbyPlayers.find(
                (p) => p.id === this.myPlayerInfo.id
              );
              if (me) me.character = charId;
              this.broadcastLobbyUpdate();
            }
          } else {
            // Client Logic
            this.networkManager.send({
              t: PacketType.CHARACTER_SELECT,
              p: { charId: charId },
            });
          }
        },
        () => {
          // Start Game (Host)
          const allReady = this.lobbyPlayers.every(
            (p) => p.character && p.character !== ""
          );
          if (allReady) {
            this.networkManager.send({ t: PacketType.START_GAME, p: {} });
            this.startGame();
          } else {
            this.uiManager.showMessage("All players must select a character!");
          }
        }
      );
    }
  }

  private startGame() {
    // Spawn all players
    this.lobbyPlayers.forEach((p) => {
      if (p.id !== this.myPlayerInfo.id) {
        this.spawnRemotePlayer(p);
      } else {
        // Update local player model if needed
        // For now, we just assume local is 'local'
        // But we should probably update the model based on selection
        this.updateLocalPlayerModel(p.character);
      }
    });

    this.setState(GameState.PICK);
  }

  private spawnRemotePlayer(info: PlayerInfo) {
    const playerGroup =
      this.resources.models.get(info.character)?.clone() || new THREE.Group();
    this.scene.add(playerGroup);

    // Remote players are kinematic or just visual updates?
    // For simplicity, we'll make them kinematic bodies controlled by snapshots
    const playerBody = BodyFactory.createPlayerBody(
      0.4,
      1.2,
      0,
      new CANNON.Vec3(0, 5, 0)
    );
    playerBody.type = CANNON.Body.KINEMATIC;

    // No collision with local player to avoid lag issues?
    // Or keep collision? Let's keep collision but make it soft?
    // Actually, for P2P, usually you don't collide with ghosts to prevent jitter.
    playerBody.collisionFilterGroup = 2;
    playerBody.collisionFilterMask = 1; // Collide with environment but maybe not other players?

    (playerBody as any).userData = { tag: "player" };

    this.physicsWorld.world.addBody(playerBody);

    const player = new Player(playerGroup, playerBody);
    this.players.set(info.id, player);
  }

  private updateLocalPlayerModel(charId: string) {
    const localPlayer = this.players.get("local");
    if (localPlayer) {
      // Remove old mesh
      this.scene.remove(localPlayer.mesh);
      // Add new mesh
      const newMesh =
        this.resources.models.get(charId)?.clone() || new THREE.Group();
      localPlayer.mesh = newMesh;
      this.scene.add(newMesh);
    }
  }

  private handleSnapshot(data: SnapshotPayload) {
    if (data.id === this.networkManager.getMyId()) return;
    const player = this.players.get(data.id);
    if (player) {
      // Interpolate? For now, just set
      player.body.position.set(data.pos[0], data.pos[1], data.pos[2]);
      player.body.quaternion.set(
        data.rot[0],
        data.rot[1],
        data.rot[2],
        data.rot[3]
      );
      // Update mesh
      player.mesh.position.copy(player.body.position as any);
      player.mesh.quaternion.copy(player.body.quaternion as any);
    }
  }

  private getItemYShift(itemId: string): number {
    // All items are now placed at their correct visual position (surface or center)
    // by the mousemove logic. No additional shift needed.
    if (itemId === "spikes") {
      return -0.25; // Shift down to sit on floor (assuming height 0.5)
    }
    return 0;
  }

  private getItemSize(itemId: string, rotationIndex: number): THREE.Vector3 {
    if (itemId === "wood_block_321") {
      // Rotation 0: 3x1x2
      // Rotation 1: 2x1x3
      if (rotationIndex % 2 === 0) {
        return new THREE.Vector3(3, 1, 2);
      } else {
        return new THREE.Vector3(2, 1, 3);
      }
    } else if (itemId === "spikes") {
      return new THREE.Vector3(1, 1, 1);
    }
    return new THREE.Vector3(1, 1, 1);
  }

  private updateGhostPositionFromMouse() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const planeHeight = 8;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeHeight);
    const target = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(plane, target);

    const size = this.getItemSize(this.selectedItem || "", this.buildRotation);

    // Snap to grid
    // If size is even, snap to integer (Round)
    // If size is odd, snap to half-integer (Floor + 0.5)
    const snapX =
      size.x % 2 === 0 ? Math.round(target.x) : Math.floor(target.x) + 0.5;
    const snapZ =
      size.z % 2 === 0 ? Math.round(target.z) : Math.floor(target.z) + 0.5;

    this.buildGridPos.set(snapX, this.buildHeight + 0.5, snapZ);

    this.gridHighlight.position.set(
      this.buildGridPos.x,
      10,
      this.buildGridPos.z
    );
    this.gridHighlight.visible = true;

    if (this.ghostObject && this.selectedItem) {
      this.ghostObject.position.copy(this.buildGridPos);
      this.ghostObject.position.y += this.getItemYShift(this.selectedItem);
    }
  }

  private setupEvents() {
    window.addEventListener("mousemove", (event) => {
      // 更新 3D UI 的鼠标坐标
      this.uiManager.updatePointerFromMouse(
        event.clientX,
        event.clientY,
        window.innerWidth,
        window.innerHeight
      );
      // Update mouse coordinates for Raycasting
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      if (this.state === GameState.BUILD_VIEW) {
        // Rotate Camera with Mouse X
        this.buildCameraAngle -= event.movementX * 0.005;
        const radius = 25;
        this.camera.position.x = Math.sin(this.buildCameraAngle) * radius;
        this.camera.position.z = Math.cos(this.buildCameraAngle) * radius;
        this.camera.lookAt(0, 0, 0);
      } else if (
        this.state === GameState.RUN &&
        this.playersFinishedTurn.has(this.networkManager.getMyId())
      ) {
        // Spectator Free Look (Drag to rotate)
        if (event.buttons === 1 || event.buttons === 2) {
          const euler = new THREE.Euler(0, 0, 0, "YXZ");
          euler.setFromQuaternion(this.camera.quaternion);
          euler.y -= event.movementX * 0.002;
          euler.x -= event.movementY * 0.002;
          euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
          this.camera.quaternion.setFromEuler(euler);
        }
      } else if (this.state === GameState.BUILD_PLACE) {
        this.updateGhostPositionFromMouse();

        if (this.ghostObject && this.selectedItem) {
          // Bomb Range Indicator
          if (this.selectedItem === "bomb") {
            if (!this.bombRangeIndicator) {
              this.bombRangeIndicator = new THREE.Mesh(
                new THREE.SphereGeometry(3, 16, 16),
                new THREE.MeshBasicMaterial({
                  color: 0xff0000,
                  transparent: true,
                  opacity: 0.3,
                  wireframe: true,
                })
              );
              this.scene.add(this.bombRangeIndicator);
            }
            this.bombRangeIndicator.position.copy(this.ghostObject.position);
            this.bombRangeIndicator.visible = true;

            // Highlight targets
            // Restore old highlights
            this.highlightedMeshes.forEach((color, mesh) => {
              if ((mesh.material as any).color)
                (mesh.material as any).color.setHex(color);
            });
            this.highlightedMeshes.clear();

            // Find new targets
            const range = 3;
            this.physicsWorld.world.bodies.forEach((b) => {
              if (
                b.position.distanceTo(
                  new CANNON.Vec3(
                    this.ghostObject!.position.x,
                    this.ghostObject!.position.y,
                    this.ghostObject!.position.z
                  )
                ) < range
              ) {
                const userData = (b as any).userData;
                if (
                  userData &&
                  userData.tag !== "ground" &&
                  userData.tag !== "player" &&
                  userData.tag !== "goal"
                ) {
                  const mesh = (b as any).meshReference as THREE.Mesh; // We attached meshReference in placeObject
                  if (mesh) {
                    // Traverse if group
                    mesh.traverse((child) => {
                      if (child instanceof THREE.Mesh) {
                        if (!this.highlightedMeshes.has(child)) {
                          this.highlightedMeshes.set(
                            child,
                            (child.material as any).color.getHex()
                          );
                          (child.material as any).color.setHex(0xff0000);
                        }
                      }
                    });
                  }
                }
              }
            });
          } else {
            if (this.bombRangeIndicator)
              this.bombRangeIndicator.visible = false;
            // Clear highlights
            this.highlightedMeshes.forEach((color, mesh) => {
              if ((mesh.material as any).color)
                (mesh.material as any).color.setHex(color);
            });
            this.highlightedMeshes.clear();
          }
        }
      }
    });

    window.addEventListener("wheel", (event) => {
      if (this.state === GameState.BUILD_PLACE) {
        // Adjust height
        this.buildHeight += event.deltaY > 0 ? -1 : 1;
        // Clamp between 0 and 15
        this.buildHeight = Math.max(0, Math.min(15, this.buildHeight));

        this.buildGridPos.y = this.buildHeight + 0.5;

        if (this.ghostObject && this.selectedItem) {
          this.ghostObject.position.copy(this.buildGridPos);
          this.ghostObject.position.y += this.getItemYShift(this.selectedItem);
        }
        // Update highlight
        this.gridHighlight.position.set(
          this.buildGridPos.x,
          10,
          this.buildGridPos.z
        );
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (this.state === GameState.BUILD_PLACE) {
          this.setState(GameState.BUILD_VIEW);
        }
      } else if (event.code === "KeyQ") {
        if (this.state === GameState.BUILD_PLACE) {
          this.buildRotation = (this.buildRotation + 1) % 4;
          if (this.ghostObject) {
            this.updateGhostRotation();
            this.updateGhostPositionFromMouse();
          }
        }
      }
    });

    window.addEventListener("mousedown", () => {
      // 让 3D UI 在按下时做视觉反馈（不阻止后续 click）
      this.uiManager.handlePointerDown();
    });

    window.addEventListener("click", () => {
      // 优先让 3D UI 处理点击
      const consumed = this.uiManager.handleClick();
      if (consumed) return;

      if (this.state === GameState.PICK) {
        // Raycast for Party Box Items
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(
          this.partyBoxItems,
          true
        );

        if (intersects.length > 0) {
          // Find the root group of the clicked item
          let target = intersects[0].object;
          while (target.parent && !target.userData.itemId) {
            target = target.parent;
          }

          if (target.userData.itemId) {
            // Request Pick
            // Find index
            const index = this.partyBoxItems.indexOf(target as THREE.Group);
            if (index !== -1) {
              if (this.networkManager.isHostUser()) {
                // Host processes directly
                this.processPickRequest(index, this.networkManager.getMyId());
              } else {
                // Client sends request
                this.networkManager.send({
                  t: PacketType.PICK_ITEM,
                  p: { index: index },
                }); // Broadcasts to host
              }
            }
          }
        }
      } else if (this.state === GameState.BUILD_VIEW) {
        // Confirm View, move to Place
        this.setState(GameState.BUILD_PLACE);
      } else if (this.state === GameState.BUILD_PLACE) {
        // Confirm Placement
        if (this.ghostObject && this.selectedItem) {
          // Validate Placement for Surfaces
          if (
            this.isValidPlacement(this.selectedItem, this.ghostObject.position)
          ) {
            this.placeObject(
              this.selectedItem,
              this.ghostObject.position,
              this.buildRotation
            );

            // Track Turn
            this.playersFinishedTurn.add(this.networkManager.getMyId());

            // Send Network Event
            this.networkManager.send({
              t: PacketType.EVENT_PLACE,
              p: {
                itemId: this.selectedItem,
                pos: {
                  x: this.ghostObject.position.x,
                  y: this.ghostObject.position.y,
                  z: this.ghostObject.position.z,
                },
                rot: this.buildRotation,
                playerId: this.networkManager.getMyId(),
              },
            });

            // Check if everyone finished
            this.checkAllPlayersFinished();

            // If not finished, maybe show "Waiting for others..."
            // Note: state might have changed to COUNTDOWN inside checkAllPlayersFinished
            if (this.state === GameState.BUILD_PLACE) {
              this.uiManager.showMessage("Waiting for other players...");
              // Hide ghost
              if (this.ghostObject) {
                this.scene.remove(this.ghostObject);
                this.ghostObject = null;
              }
              // Hide highlight
              this.gridHighlight.visible = false;
            }
          } else {
            this.uiManager.showMessage("Invalid Placement!");
          }
        }
      } else if (
        this.state === GameState.RUN ||
        this.state === GameState.COUNTDOWN
      ) {
        // Request pointer lock for camera control
        document.body.requestPointerLock();
      }
      // Note: SCORE state transition is handled by UIManager callback, not by click event
    });
  }

  private updateGhostRotation() {
    if (!this.ghostObject || !this.selectedItem) return;

    // Reset rotation
    this.ghostObject.rotation.set(0, 0, 0);

    // Apply User Rotation (Y-axis)
    const q = new THREE.Quaternion();
    q.setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      (this.buildRotation * Math.PI) / 2
    );
    this.ghostObject.applyQuaternion(q);
  }

  private isValidPlacement(itemId: string, position: THREE.Vector3): boolean {
    // 1. Check for Overlap using AABB
    // Determine size based on item type to avoid false positives with floor
    let halfExtents = new CANNON.Vec3(0.45, 0.45, 0.45);

    if (itemId === "wood_block_321") {
      // 3x2x1 (X=3, Z=2, Y=1)
      if (this.buildRotation % 2 === 0) {
        halfExtents.set(1.45, 0.45, 0.95);
      } else {
        halfExtents.set(0.95, 0.45, 1.45);
      }
    } else if (itemId === "spikes") {
      // Spikes are shorter (0.5 height), so we reduce the check box
      // Use 0.24 to avoid floating point overlap with floor at y=0
      halfExtents.set(0.45, 0.24, 0.45);
    }

    const placeAABB = new CANNON.AABB({
      lowerBound: new CANNON.Vec3(
        position.x - halfExtents.x,
        position.y - halfExtents.y,
        position.z - halfExtents.z
      ),
      upperBound: new CANNON.Vec3(
        position.x + halfExtents.x,
        position.y + halfExtents.y,
        position.z + halfExtents.z
      ),
    });

    let overlap = false;
    this.physicsWorld.world.bodies.forEach((b) => {
      if (placeAABB.overlaps(b.aabb)) {
        overlap = true;
      }
    });
    if (overlap) return false;

    // 2. Check Support (Raycast)
    // Wood blocks can be placed in air
    if (itemId === "wood_block_321") return true;

    if (itemId === "spikes") {
      // Check if there is a body directly below
      // Raycast down from center
      const start = new CANNON.Vec3(position.x, position.y, position.z);
      const end = new CANNON.Vec3(position.x, position.y - 1.0, position.z);

      const result = new CANNON.RaycastResult();
      this.physicsWorld.world.raycastClosest(
        start,
        end,
        {
          collisionFilterMask: -1,
          skipBackfaces: true,
        },
        result
      );

      return result.hasHit;
    }

    return false;
  }

  private setState(newState: GameState) {
    if (this.state === newState) return;

    this.state = newState;
    this.uiManager.showMessage(`State: ${GameState[newState]}`);

    if (newState === GameState.TITLE) {
      // TITLE：相机正对抬高后的 UI 面板，距离适中
      this.cameraLerpActive = false;
      this.camera.position.set(0, 4, 4);
      this.camera.lookAt(0, 4, -10);

      this.uiManager.clearUI();
      document.exitPointerLock();

      // Reset scores
      this.lobbyPlayers.forEach((p) => {
        (p as any).totalScore = 0;
      });

      this.clearLevel();

      // Reset players
      this.players.forEach((player, id) => {
        if (id !== "local") {
          this.scene.remove(player.mesh);
          this.physicsWorld.world.removeBody(player.body);
        } else {
          // Reset local player position and state
          player.resetPosition(new CANNON.Vec3(0, 5, 0));
          player.score = 0;
        }
      });
      // Clear remote players but keep local
      const localPlayer = this.players.get("local");
      this.players.clear();
      if (localPlayer) {
        this.players.set("local", localPlayer);
      }

      this.uiManager.showTitleScreen(
        (nickname) => {
          // Host
          this.myPlayerInfo.nickname = nickname;
          this.myPlayerInfo.isHost = true;
          this.myPlayerInfo.id = this.networkManager.getMyId();
          this.networkManager.setHost(true);

          // Add self to lobby
          this.lobbyPlayers = [this.myPlayerInfo];

          this.setState(GameState.LOBBY);
        },
        (nickname, hostId) => {
          // Join
          this.myPlayerInfo.nickname = nickname;
          this.myPlayerInfo.isHost = false;
          this.networkManager.connectToHost(hostId);

          // Wait for connection...
          this.networkManager.onPeerConnected = (_conn) => {
            // Send Join Packet
            this.networkManager.send(
              {
                t: PacketType.JOIN,
                p: { nickname: nickname },
              },
              hostId
            );
          };
        }
      );
    } else if (newState === GameState.LOBBY) {
      // LOBBY：同样使用正对 UI 面板的视角
      this.cameraLerpActive = false;
      this.camera.position.set(0, 4, 4);
      this.camera.lookAt(0, 4, -10);

      this.uiManager.clearUI();
      this.clearLevel(); // Ensure level is cleared when returning to lobby
      this.refreshLobbyUI();
    } else if (newState === GameState.PICK) {
      this.uiManager.clearUI();
      document.exitPointerLock();
      this.resetPlayers();
      this.gridHighlight.visible = false;
      this.gridHelper.visible = false;
      this.partyBoxRoot.visible = true; // Show Party Box (一直可见直到 BUILD_VIEW)

      // Reset Turn Tracking
      this.playersFinishedTurn.clear();

      // Reset selected item for new round
      this.selectedItem = null;
      this.buildRotation = 0;

      // 从 TITLE/LOBBY 的机位 (0,4,4) 平移到更右侧一点，保持视角不变，只是把工具区放在 UI 右边
      this.cameraLerpActive = false;
      const titlePos = new THREE.Vector3(0, 4, 4);
      const pickPos = new THREE.Vector3(11, 4, 4); // 再多向右平移一点

      // 如果当前不是标题机位，就先瞬移过去，以避免奇怪的后撤
      this.camera.position.copy(titlePos);
      this.camera.lookAt(0, 4, -10);

      // 再用 tween 做从 titlePos 到 pickPos 的平移
      this.tweenCameraTo(pickPos, 1.0);
      // 视线始终看向 UI 木牌中心，工具区自然出现在右侧
      this.camera.lookAt(0, 4, -10);

      // Host generates items
      if (this.networkManager.isHostUser()) {
        this.generatePartyBoxItems();
      }
    } else if (newState === GameState.BUILD_VIEW) {
      this.partyBoxRoot.visible = false; // Hide Party Box
      document.exitPointerLock();
      this.gridHighlight.visible = false;
      this.gridHelper.visible = false; // No grid helper
      // this.gridHelper.position.y = 8; // Move grid up

      // Create Ghost
      if (this.selectedItem) {
        if (this.ghostObject) this.scene.remove(this.ghostObject);
        this.ghostObject =
          this.resources.models.get(this.selectedItem)?.clone() || null;
        if (this.ghostObject) {
          this.updateGhostRotation();

          this.ghostObject.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.material = child.material.clone();
              child.material.transparent = true;
              child.material.opacity = 0.5;
            }
          });
          this.scene.add(this.ghostObject);
        }
      }

      // Side-Top View：恢复为相对适中的建造俯视视角
      this.buildCameraAngle = 0;
      this.cameraLerpActive = false;
      this.camera.position.set(0, 15, 25);
      this.camera.lookAt(0, 0, 0);
    } else if (newState === GameState.BUILD_PLACE) {
      // Keep camera where it was in BUILD_VIEW
      // Enable grid highlight
      this.gridHighlight.visible = true;

      this.buildHeight = 8; // Start from top
    } else if (newState === GameState.COUNTDOWN) {
      this.partyBoxRoot.visible = false;
      this.gridHighlight.visible = false; // Hide highlight
      if (this.bombRangeIndicator) this.bombRangeIndicator.visible = false;

      // Explode Bombs
      const bombs: CANNON.Body[] = [];
      this.physicsWorld.world.bodies.forEach((b) => {
        if ((b as any).userData?.tag === "bomb") {
          bombs.push(b);
        }
      });

      bombs.forEach((bomb) => {
        const range = 3;
        const toRemove: CANNON.Body[] = [];
        this.physicsWorld.world.bodies.forEach((b) => {
          if (b !== bomb && b.position.distanceTo(bomb.position) < range) {
            const userData = (b as any).userData;
            // If no userData, assume it's a prop and remove it
            // If userData exists, check tag
            const tag = userData ? userData.tag : undefined;

            if (tag !== "ground" && tag !== "player" && tag !== "goal") {
              toRemove.push(b);
            }
          }
        });

        toRemove.forEach((b) => {
          this.physicsWorld.world.removeBody(b);
          const mesh = (b as any).meshReference;
          if (mesh) this.scene.remove(mesh);
        });

        // Remove bomb itself
        this.physicsWorld.world.removeBody(bomb);
        const bombMesh = (bomb as any).meshReference;
        if (bombMesh) this.scene.remove(bombMesh);
      });

      if (bombs.length > 0) this.uiManager.showMessage("BOOM!");

      this.countdownTimer = 3.0;
      document.body.requestPointerLock();
      this.uiManager.showMessage("Get Ready! 3");

      // 倒计时阶段：同样使用更高的俯视角，保证菜单不被 Start Zone 顶边影响
      this.cameraLerpActive = false;
      this.camera.position.set(0, 38, -32);
      this.camera.lookAt(0, 10, 10);

      this.playersFinishedTurn.clear(); // Reuse for RUN finished tracking
    } else if (newState === GameState.SCORE) {
      document.exitPointerLock();

      // Show all players again
      this.players.forEach((player) => {
        player.mesh.visible = true;
      });

      // Host calculates and sends scores
      if (this.networkManager.isHostUser()) {
        const scores = this.calculateScores();

        // Send scores to all clients first
        this.networkManager.send({
          t: PacketType.SHOW_SCORE,
          p: { scores: scores },
        });

        // Show locally with callback to check win condition AFTER display
        this.uiManager.showScoreScreen(scores, this.GOAL_SCORE, () => {
          // Check Win Condition AFTER the score animation completes
          const winner = scores.find((s) => s.current >= this.GOAL_SCORE);

          if (winner) {
            // Game Over - Show Win Screen
            this.uiManager.showWinScreen(winner.nickname, () => {
              // Back to Lobby - Reset scores but keep players
              this.lobbyPlayers.forEach((p) => {
                (p as any).totalScore = 0;
              });
              this.setState(GameState.LOBBY);
            });
          } else {
            // Continue to next round
            this.networkManager.send({ t: PacketType.START_GAME, p: {} });
            this.startGame();
          }
        });
      }
    }

    if (
      newState !== GameState.BUILD_VIEW &&
      newState !== GameState.BUILD_PLACE
    ) {
      if (this.ghostObject) {
        this.scene.remove(this.ghostObject);
        this.ghostObject = null;
      }
      if (this.bombRangeIndicator) {
        this.bombRangeIndicator.visible = false;
      }
      // Clear highlights
      this.highlightedMeshes.forEach((color, mesh) => {
        if ((mesh.material as any).color)
          (mesh.material as any).color.setHex(color);
      });
      this.highlightedMeshes.clear();
    }
  }

  private clearLevel() {
    const objectsToRemove: CANNON.Body[] = [];
    this.physicsWorld.world.bodies.forEach((b) => {
      const tag = (b as any).userData?.tag;
      // Remove everything except ground, goal, and player
      if (tag && tag !== "ground" && tag !== "goal" && tag !== "player") {
        objectsToRemove.push(b);
      }
    });
    objectsToRemove.forEach((b) => {
      this.physicsWorld.world.removeBody(b);
      const mesh = (b as any).meshReference;
      if (mesh) this.scene.remove(mesh);
    });
  }

  private resetPlayers() {
    this.players.forEach((player) => {
      player.resetPosition(new CANNON.Vec3(0, 5, 0));
    });
  }

  private placeObject(
    itemId: string,
    position: THREE.Vector3,
    rotationIndex: number = 0
  ) {
    let mesh: THREE.Group | undefined;
    let body: CANNON.Body | undefined;

    // Default Box Shape
    let shape: CANNON.Shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
    let offset = new CANNON.Vec3(0, 0, 0);
    let mass = 0;
    let tag = "block";

    if (itemId === "wood_block_321") {
      mesh = this.resources.models.get("wood_block_321")?.clone();
      // 3x2x1
      if (rotationIndex % 2 === 0) {
        shape = new CANNON.Box(new CANNON.Vec3(1.5, 0.5, 1.0));
      } else {
        shape = new CANNON.Box(new CANNON.Vec3(1.0, 0.5, 1.5));
      }
    } else if (itemId === "spikes") {
      mesh = this.resources.models.get("spikes")?.clone();
      // Spikes: 1x1 base, height approx 0.5?
      // Let's use a box that is slightly smaller than 1x1 to avoid clipping issues
      // Half extents: 0.45, 0.25, 0.45 -> Size 0.9, 0.5, 0.9
      shape = new CANNON.Box(new CANNON.Vec3(0.45, 0.25, 0.45));
      tag = "trap";
      // Adjust mesh position: The model might be centered.
      // If we want it to sit on the floor, and position.y is center of grid cell (e.g. 0.5, 1.5)
      // We might need to lower it if the model origin is at the bottom.
      // But let's assume standard center origin for now.
      // If the spikes are short, we might want to lower the body center.
      // Grid cell center y=0.5. Floor is y=0.
      // If body height is 0.5 (half 0.25), body center should be at y=0.25.
      // So we might need to offset the body relative to the grid position.
      // But placeObject uses mesh.position as base.
      // Let's adjust mesh.position.y in the logic below if needed.
      // Actually, let's just let it float at center for now, or adjust bodyY.
    }

    if (mesh) {
      // Clone materials to ensure unique instances for highlighting
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.material) {
            child.material = child.material.clone();
          }
        }
      });

      // Position is already final (includes yShift from ghost object)
      // Note: position is Visual Position (y=0 for patches)
      mesh.position.copy(position);

      // Apply Rotations
      mesh.rotation.set(0, 0, 0);

      // User Rotation
      const q = new THREE.Quaternion();
      q.setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        (rotationIndex * Math.PI) / 2
      );
      mesh.applyQuaternion(q);

      body = new CANNON.Body({ mass: mass });

      // Calculate Body Position
      // If patch, Body center should be at Visual + halfHeight
      let bodyY = mesh.position.y;

      body.addShape(shape, offset);
      body.position.set(mesh.position.x, bodyY, mesh.position.z);

      console.log(
        `Placed ${itemId} at mesh.y=${mesh.position.y.toFixed(
          3
        )}, body.y=${body.position.y.toFixed(3)}, halfHeight=${
          (shape as CANNON.Box).halfExtents.y
        }`
      );

      if (tag) (body as any).userData = { tag: tag, owner: "local" }; // Assign owner

      // Attach mesh reference to body for easy removal
      (body as any).meshReference = mesh;

      // Set material
      body.material = this.physicsWorld.world.defaultMaterial;

      this.scene.add(mesh);
      this.physicsWorld.world.addBody(body);
    }
  }

  private calculateScores() {
    const results: any[] = [];

    this.lobbyPlayers.forEach((p) => {
      const player =
        p.id === this.networkManager.getMyId()
          ? this.players.get("local")
          : this.players.get(p.id);

      if (player) {
        let added = 0;
        if (player.hasWon) added += 10;
        added += player.score * 2; // Coins

        // Update total score (hacky: storing in player object or lobby info?)
        // Let's store in Player object for now, but Player object is recreated every round?
        // No, Player object is recreated in startGame.
        // We need persistent score storage.
        // Let's add 'score' to PlayerInfo in lobbyPlayers?
        // But PlayerInfo interface is in Protocol.
        // For now, let's just use the current round score as 'added' and assume total is tracked elsewhere or just accumulate in PlayerInfo if we modify it.
        // Let's modify PlayerInfo in memory to hold score.
        if (!(p as any).totalScore) (p as any).totalScore = 0;
        (p as any).totalScore += added;

        results.push({
          nickname: p.nickname,
          current: (p as any).totalScore,
          added: added,
        });
      }
    });

    return results;
  }

  // 简单的摄像机位置插值：在给定时间内从当前点平滑移动到目标点
  private tweenCameraTo(target: THREE.Vector3, duration: number = 0.8) {
    this.cameraLerpActive = true;
    this.cameraLerpStart.copy(this.camera.position);
    this.cameraLerpEnd.copy(target);
    this.cameraLerpT = 0;
    this.cameraLerpDuration = duration;
  }

  private init() {
    // Sky：改为轻微竖向渐变的卡通天空色（通过雾和环境色统一）
    this.scene.background = new THREE.Color(0x6fb1ff); // 稍深一点的卡通蓝

    // 配合淡色雾，让远处和 UI 背板的颜色更统一，不会出现上深下浅的强烈分层
    this.scene.fog = new THREE.Fog(0x8fd2ff, 60, 140);

    // Clouds
    for (let i = 0; i < 15; i++) {
      const cloud = PlaceholderGenerator.createCloud();
      cloud.position.set(
        (Math.random() - 0.5) * 100,
        -10 + Math.random() * 5, // Below player (y=-10 to -5)
        (Math.random() - 0.5) * 60
      );
      cloud.rotation.y = Math.random() * Math.PI * 2;
      const scale = 1 + Math.random() * 2;
      cloud.scale.set(scale, scale, scale);
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }

    // Lights (Brighter)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
    directionalLight.position.set(20, 15, 10); // 斜向光照：降低高度，增加水平偏移，使阴影更明显
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.bias = -0.0005;
    this.scene.add(directionalLight);

    // --- Level Setup ---

    // 1. Start Platform (Height 0, Surface 0)
    // Box Height 2 -> Center y=-1 -> Top y=0
    const startPlatBody = BodyFactory.createBox(
      10,
      2,
      10,
      0,
      new CANNON.Vec3(0, -1, 0)
    );
    (startPlatBody as any).userData = { tag: "ground" };
    this.physicsWorld.world.addBody(startPlatBody);

    const startPlatGeo = new THREE.BoxGeometry(10, 2, 10);
    const startPlatMat = new THREE.MeshStandardMaterial({
      map: this.resources.textures.get("default_grid"),
      color: 0x888888,
    });
    const startPlatMesh = new THREE.Mesh(startPlatGeo, startPlatMat);
    startPlatMesh.position.y = -1;
    startPlatMesh.receiveShadow = true;
    this.scene.add(startPlatMesh);
    (startPlatBody as any).meshReference = startPlatMesh;

    // 2. Goal Platform (Height 2, Surface 2)
    // Box Height 2 -> Center y=1 -> Top y=2
    // Offset in Z to create a gap
    const goalPlatBody = BodyFactory.createBox(
      10,
      2,
      10,
      0,
      new CANNON.Vec3(0, 1, 25)
    );
    (goalPlatBody as any).userData = { tag: "ground" };
    this.physicsWorld.world.addBody(goalPlatBody);

    const goalPlatMesh = new THREE.Mesh(startPlatGeo, startPlatMat); // Reuse geo/mat
    goalPlatMesh.position.set(0, 1, 25);
    goalPlatMesh.receiveShadow = true;
    this.scene.add(goalPlatMesh);
    (goalPlatBody as any).meshReference = goalPlatMesh;

    // 3. Gap Spikes (Removed)

    // 4. Zones
    // Start Zone (Blue)
    const startZone = PlaceholderGenerator.createZone(2, 2, 2, 0x0000ff);
    startZone.position.set(0, 1, 0); // On Start Platform (y=0) -> Zone center y=1
    this.scene.add(startZone);

    // Goal Zone (Red) - On Goal Platform
    const goalZone = PlaceholderGenerator.createZone(2, 2, 2, 0xff0000);
    goalZone.position.set(0, 3, 25); // Platform y=2 -> Zone center y=3
    this.scene.add(goalZone);

    // 5. Goal Flag
    const flagGroup = PlaceholderGenerator.createFlag();
    flagGroup.position.set(0, 2, 25);
    this.scene.add(flagGroup);

    // Goal Physics (Trigger)
    const goalBody = BodyFactory.createBox(
      1,
      2,
      1,
      0,
      new CANNON.Vec3(0, 3, 25)
    );
    goalBody.isTrigger = true;
    (goalBody as any).userData = { tag: "goal" };
    this.physicsWorld.world.addBody(goalBody);

    // --- Party Box Area（起点右前方，让空间连在一起）---
    const boxPos = new THREE.Vector3(12, 0, -6);

    // Box Container
    const openBox = PlaceholderGenerator.createOpenBox();
    openBox.position.copy(boxPos);
    this.partyBoxRoot.add(openBox); // Add to root

    // Selectable Items
    // Initial items are now handled by generatePartyBoxItems in PICK state
    // const items = ['box_wood', 'spikes', 'spring', 'honey', 'ice', 'plank', 'ramp', 'black_hole', 'turret', 'coin', 'bomb', 'conveyor'];
    // items.forEach((id) => { ... });

    // --- Player ---
    const playerGroup =
      this.resources.models.get("chicken")?.clone() || new THREE.Group();
    this.scene.add(playerGroup);

    // Use Capsule (Two Spheres) for better collision (Head + Feet)
    // Radius 0.4, Height 1.2 (approx character height)
    const playerBody = BodyFactory.createPlayerBody(
      0.4,
      1.2,
      1,
      new CANNON.Vec3(0, 5, 0),
      this.physicsWorld.playerMaterial
    );
    (playerBody as any).userData = { tag: "player" };
    this.physicsWorld.world.addBody(playerBody);

    const player = new Player(playerGroup, playerBody);
    this.players.set("local", player);

    this.loop.start();
  }

  private update() {
    this.physicsWorld.step(1 / 60);

    // Camera tween（只影响位置，不改朝向）
    if (this.cameraLerpActive) {
      this.cameraLerpT += 1 / 60;
      const t = Math.min(this.cameraLerpT / this.cameraLerpDuration, 1);
      this.camera.position.lerpVectors(
        this.cameraLerpStart,
        this.cameraLerpEnd,
        t
      );
      if (t >= 1) this.cameraLerpActive = false;
    }

    // Update Clouds
    this.clouds.forEach((cloud) => {
      cloud.position.x += 0.02;
      if (cloud.position.x > 60) {
        cloud.position.x = -60;
      }
    });

    // Rotate Party Box Items
    if (this.state === GameState.PICK) {
      this.partyBoxItems.forEach((item) => {
        item.rotation.y += 0.01;
      });
    }

    // Countdown Logic
    if (this.state === GameState.COUNTDOWN) {
      this.countdownTimer -= 1 / 60;
      if (this.countdownTimer <= 0) {
        this.setState(GameState.RUN);
      } else {
        this.uiManager.showMessage(
          `Get Ready! ${Math.ceil(this.countdownTimer)}`
        );
        // Clamp Player to Start Zone
        const localPlayer = this.players.get("local");
        if (localPlayer) {
          // Start Zone is at 0,1,0 with size 2x2x2. Bounds: x[-1,1], z[-1,1]
          if (localPlayer.body.position.x < -1)
            localPlayer.body.position.x = -1;
          if (localPlayer.body.position.x > 1) localPlayer.body.position.x = 1;
          if (localPlayer.body.position.z < -1)
            localPlayer.body.position.z = -1;
          if (localPlayer.body.position.z > 1) localPlayer.body.position.z = 1;
        }
      }
    }

    // Handle Input for Local Player
    if (this.state === GameState.RUN || this.state === GameState.COUNTDOWN) {
      const localPlayer = this.players.get("local");
      if (localPlayer) {
        // Check if spectating
        if (
          this.state === GameState.RUN &&
          this.playersFinishedTurn.has(this.networkManager.getMyId())
        ) {
          // Spectator Mode Controls
          const speed = 0.5;
          const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
            this.camera.quaternion
          );
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
            this.camera.quaternion
          );

          // Flatten for movement (optional, but free cam usually allows 3D movement)
          // Let's keep it free 3D movement

          if (this.inputManager.isKeyPressed("KeyW"))
            this.camera.position.add(forward.multiplyScalar(speed));
          if (this.inputManager.isKeyPressed("KeyS"))
            this.camera.position.sub(forward.multiplyScalar(speed));
          if (this.inputManager.isKeyPressed("KeyD"))
            this.camera.position.add(right.multiplyScalar(speed));
          if (this.inputManager.isKeyPressed("KeyA"))
            this.camera.position.sub(right.multiplyScalar(speed));
          if (this.inputManager.isKeyPressed("Space"))
            this.camera.position.y += speed;
          if (this.inputManager.isKeyPressed("ShiftLeft"))
            this.camera.position.y -= speed;

          // Rotation is handled by mousemove event updating buildCameraAngle?
          // Wait, in setupEvents, mousemove updates buildCameraAngle ONLY if state is BUILD_VIEW or (RUN && finished).
          // But buildCameraAngle logic there is:
          // this.camera.position.x = Math.sin(this.buildCameraAngle) * radius;
          // This is ORBIT logic. We want FREE LOOK logic for spectator.

          // We need to change the mousemove handler to support free look for spectator.
        } else {
          // 1. Handle Camera Rotation (Mouse)
          const mouseDelta = this.inputManager.getMouseDelta();
          if (document.pointerLockElement) {
            this.cameraAngleY -= mouseDelta.x * 0.002;
            this.cameraAngleX += mouseDelta.y * 0.002;

            // Clamp vertical angle
            this.cameraAngleX = Math.max(
              -Math.PI / 3,
              Math.min(Math.PI / 3, this.cameraAngleX)
            );
          }

          // 2. Handle Movement (WASD + Jump)
          const input = {
            x: this.inputManager.getAxis("KeyA", "KeyD"),
            y: this.inputManager.getAxis("KeyW", "KeyS"),
            jump: this.inputManager.isKeyPressed("Space"),
            sprint:
              this.inputManager.isKeyPressed("ShiftLeft") ||
              this.inputManager.isKeyPressed("ShiftRight"),
          };
          localPlayer.setInput(input, this.cameraAngleY);

          // 3. Update Camera Position (Orbit around player)
          const targetPos = localPlayer.mesh.position.clone();
          targetPos.y += 1.5; // Look at head height

          const offsetX =
            Math.sin(this.cameraAngleY) *
            Math.cos(this.cameraAngleX) *
            this.cameraDistance;
          const offsetZ =
            Math.cos(this.cameraAngleY) *
            Math.cos(this.cameraAngleX) *
            this.cameraDistance;
          const offsetY = Math.sin(this.cameraAngleX) * this.cameraDistance;

          this.camera.position.set(
            targetPos.x + offsetX,
            targetPos.y + offsetY,
            targetPos.z + offsetZ
          );
          this.camera.lookAt(targetPos);
        }

        // 4. Check Death / Win (Only in RUN)
        if (this.state === GameState.RUN) {
          if (!this.playersFinishedTurn.has(this.networkManager.getMyId())) {
            if (localPlayer.checkDeath() || localPlayer.hasWon) {
              // Finished
              this.playersFinishedTurn.add(this.networkManager.getMyId());
              this.uiManager.showMessage(
                localPlayer.hasWon ? "GOAL!" : "DIED!"
              );

              // Switch to Spectator View (Unlock mouse)
              document.exitPointerLock();
              // Set initial spectator camera pos
              this.camera.position.set(0, 15, 25);
              this.camera.lookAt(0, 0, 0);

              // Send Finished Packet
              this.networkManager.send({
                t: PacketType.PLAYER_FINISHED_RUN,
                p: { won: localPlayer.hasWon },
              });

              // If Host, check if everyone finished (including self)
              if (this.networkManager.isHostUser()) {
                if (this.playersFinishedTurn.size >= this.lobbyPlayers.length) {
                  this.setState(GameState.SCORE);
                }
              }
            }
          }
        }
      }
    } else if (
      this.state === GameState.BUILD_VIEW ||
      this.state === GameState.BUILD_PLACE
    ) {
      // Ghost update handled in events
      if (
        this.state === GameState.BUILD_PLACE &&
        this.ghostObject &&
        this.selectedItem
      ) {
        const isValid = this.isValidPlacement(
          this.selectedItem,
          this.ghostObject.position
        );
        this.ghostObject.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            // Clone material if not already unique to avoid affecting other objects?
            // In setState we already cloned it: child.material = child.material.clone();
            // But we need to make sure we are setting the color on the material instance of the ghost.
            // Assuming standard material or basic material.
            if ((child.material as any).color) {
              (child.material as any).color.setHex(
                isValid ? 0xffffff : 0xff0000
              );
            }
          }
        });
      }
    }

    // Send Snapshot
    if (this.state === GameState.RUN || this.state === GameState.COUNTDOWN) {
      const localPlayer = this.players.get("local");
      if (localPlayer && this.networkManager.getMyId()) {
        this.networkManager.send({
          t: PacketType.SNAPSHOT,
          p: {
            id: this.networkManager.getMyId(),
            pos: [
              localPlayer.body.position.x,
              localPlayer.body.position.y,
              localPlayer.body.position.z,
            ],
            rot: [
              localPlayer.body.quaternion.x,
              localPlayer.body.quaternion.y,
              localPlayer.body.quaternion.z,
              localPlayer.body.quaternion.w,
            ],
            anim: "idle",
          },
        });
      }
    }

    this.players.forEach((player) => {
      player.update();
    });

    this.renderer.render(this.scene, this.camera);
  }

  private generatePartyBoxItems() {
    const allItems = ["wood_block_321", "spikes"];
    const numItems = this.lobbyPlayers.length + 2;
    const selectedItems: any[] = [];
    // 与 init 中 Party Box 所在位置保持一致
    const boxPos = new THREE.Vector3(12, 0, -6);

    for (let i = 0; i < numItems; i++) {
      const id = allItems[Math.floor(Math.random() * allItems.length)];
      const xOffset = (Math.random() - 0.5) * 10;
      const zOffset = (Math.random() - 0.5) * 6;
      const yRot = Math.random() * Math.PI * 2;

      selectedItems.push({
        id: id,
        pos: [boxPos.x + xOffset, boxPos.y + 0.5, boxPos.z + zOffset],
        rot: yRot,
      });
    }

    // Spawn locally
    this.spawnPartyBoxItems(selectedItems);

    // Broadcast
    this.networkManager.send({
      t: PacketType.PARTY_BOX_UPDATE,
      p: selectedItems,
    });
  }

  private spawnPartyBoxItems(items: any[]) {
    // Clear existing
    this.partyBoxItems.forEach((item) => this.partyBoxRoot.remove(item));
    this.partyBoxItems = [];
    this.availableItems.clear();

    items.forEach((data, index) => {
      const mesh = this.resources.models.get(data.id)?.clone();
      if (mesh) {
        const container = new THREE.Group();

        container.add(mesh);
        container.position.set(data.pos[0], data.pos[1], data.pos[2]);
        container.rotation.y = data.rot;
        container.userData = { itemId: data.id };

        this.partyBoxRoot.add(container); // Add to root
        this.partyBoxItems.push(container);
        this.availableItems.add(index.toString());
      }
    });
  }

  private processPickRequest(index: number, senderId: string) {
    if (this.availableItems.has(index.toString())) {
      // Valid Pick
      this.availableItems.delete(index.toString());

      // Broadcast to everyone (including self if loopback supported, but here we handle self manually)
      this.networkManager.send({
        t: PacketType.ITEM_PICKED,
        p: { index: index, playerId: senderId },
      });

      // Handle locally immediately
      this.handleItemPicked(index, senderId);
    }
  }

  private handleItemPicked(index: number, playerId: string) {
    // Remove item visually
    if (this.partyBoxItems[index]) {
      this.partyBoxItems[index].visible = false;
    }

    // If it was me
    if (playerId === this.networkManager.getMyId()) {
      // I got it!
      const item = this.partyBoxItems[index];
      if (item && item.userData.itemId) {
        this.selectedItem = item.userData.itemId;
        this.setState(GameState.BUILD_VIEW);
      }
    }
  }
}
