import * as THREE from "three";
import * as CANNON from "cannon-es";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { NetworkManager } from "../network/NetworkManager";
import {
  Packet,
  PacketType,
  PlayerInfo,
  SnapshotPayload,
  ChatPayload,
} from "../network/Protocol";
import { Resources } from "./Resources";
import { Loop } from "./Loop";
import { UIManager } from "../ui/UIManager";
import { InputManager } from "./InputManager";
import { Player } from "../objects/Player";
import { CharacterRig } from "../objects/character/CharacterRig";
import { getCharacterAppearance } from "../objects/character/CharacterRegistry";
import { BodyFactory } from "../physics/BodyFactory";
import { CameraController } from "./CameraController";
import { BuildSystem } from "./BuildSystem";
import { ScoreManager } from "./ScoreManager";
import { LevelManager } from "./LevelManager";
import { PartyBoxManager } from "./PartyBoxManager";
import { Crossbow } from "../objects/traps/Crossbow";
import { AudioManager } from "../audio/AudioManager";
import {
  AUDIO_MANIFEST,
  AudioId as AudioIds,
  type AudioId,
} from "../audio/AudioManifest";

export enum GameState {
  TITLE,
  LOBBY,
  PICK,
  BUILD_VIEW,
  BUILD_PLACE,
  COUNTDOWN,
  RUN,
  SCORE,
  GAME_OVER,
}

export class Game {
  // 核心组件
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private physicsWorld: PhysicsWorld;
  private networkManager: NetworkManager;
  private resources: Resources;
  private loop: Loop;
  private uiManager: UIManager;
  private inputManager: InputManager;

  private audio: AudioManager;
  private audioPrimed: boolean = false;
  private localDeathSoundPlayed: boolean = false;

  // 新增管理器
  private cameraController: CameraController;
  private buildSystem: BuildSystem;
  private scoreManager: ScoreManager;
  private levelManager!: LevelManager;
  private partyBoxManager!: PartyBoxManager;

  // 玩家和十字弓
  private players: Map<string, Player> = new Map();

  // 多人游戏
  private lobbyPlayers: PlayerInfo[] = [];
  private playersFinishedTurn: Set<string> = new Set();
  private myPlayerInfo: PlayerInfo = {
    id: "",
    nickname: "Player",
    character: "",
    isHost: false,
    isReady: false,
  };

  // 游戏状态
  private state: GameState = -1 as GameState;
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mouse: THREE.Vector2 = new THREE.Vector2();

  // 倒计时
  private countdownTimer: number = 0;

  constructor() {
    // 初始化渲染器
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

    // 初始化核心组件
    this.physicsWorld = new PhysicsWorld();
    this.networkManager = new NetworkManager();
    this.resources = new Resources();
    this.uiManager = new UIManager();
    this.inputManager = new InputManager();
    this.loop = new Loop(this.update.bind(this));

    // 音频（本地）
    this.audio = new AudioManager();
    (Object.keys(AUDIO_MANIFEST) as AudioId[]).forEach((id) => {
      this.audio.register(id, AUDIO_MANIFEST[id]);
    });

    // 初始化管理器
    this.cameraController = new CameraController(this.camera);
    this.buildSystem = new BuildSystem(
      this.scene,
      this.physicsWorld,
      this.resources
    );
    this.scoreManager = new ScoreManager();

    // 将 3D 场景引用传给 UI 管理器
    this.uiManager.attachScene(this.scene, this.camera, this.raycaster);

    // 加载资源
    this.resources.loadDefaultPlaceholders();

    this.resources.onReady(() => {
      this.uiManager.setResources(this.resources);

      // 初始化关卡管理器（需要资源加载完成）
      this.levelManager = new LevelManager(
        this.scene,
        this.physicsWorld,
        this.resources
      );
      this.levelManager.initScene();

      // 初始化 Party Box 管理器
      this.partyBoxManager = new PartyBoxManager(
        this.resources,
        this.levelManager.getPartyBoxRoot()
      );

      this.setupChatSystem();
      this.init();
      this.setupEvents();
      this.setupNetworkHandlers();
      this.setState(GameState.TITLE);
    });

    // 窗口大小调整
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // ========== 初始化 ==========

  private init(): void {
    // 创建本地玩家
    const appearance = getCharacterAppearance("chicken");
    const rig = CharacterRig.createFromAppearance(this.resources, appearance);
    this.scene.add(rig.root);

    const playerBody = BodyFactory.createPlayerBody(
      0.4,
      1.2,
      1,
      new CANNON.Vec3(0, 5, 0),
      this.physicsWorld.playerMaterial
    );
    (playerBody as any).userData = { tag: "player" };
    this.physicsWorld.world.addBody(playerBody);

    const player = new Player(rig, playerBody);
    player.onJumpStart = () => {
      this.audio.playSfx(AudioIds.Jump);
    };
    player.onCoinCollect = () => {
      this.audio.playSfx(AudioIds.Coin);
    };
    player.onGoal = () => {
      this.audio.playSfx(AudioIds.Goal);
    };
    player.onDeath = () => {
      if (!this.localDeathSoundPlayed) {
        this.localDeathSoundPlayed = true;
        this.audio.playSfx(AudioIds.Death);
      }
    };
    this.players.set("local", player);

    this.loop.start();
  }

  private setupChatSystem(): void {
    this.uiManager.setChatCallback((message: string) => {
      const chatPayload: ChatPayload = {
        nickname: this.myPlayerInfo.nickname,
        message: message,
      };

      this.uiManager.addChatMessage(chatPayload.nickname, chatPayload.message);
      this.networkManager.send({
        t: PacketType.CHAT,
        p: chatPayload,
      });
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !this.uiManager.isChatInputOpen()) {
        if (this.state !== GameState.TITLE) {
          e.preventDefault();
          this.uiManager.openChatInput();
        }
      }
    });
  }

  // ========== 事件处理 ==========

  private setupEvents(): void {
    window.addEventListener("mousemove", (event) => {
      this.uiManager.updatePointerFromMouse(
        event.clientX,
        event.clientY,
        window.innerWidth,
        window.innerHeight
      );

      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      if (this.state === GameState.BUILD_VIEW) {
        this.cameraController.updateBuildViewCamera(event.movementX);
      } else if (
        this.state === GameState.RUN &&
        !this.playersFinishedTurn.has(this.networkManager.getMyId())
      ) {
        if (event.buttons === 1 || event.buttons === 2) {
          this.cameraController.handleFreeLook(
            event.movementX,
            event.movementY
          );
        }
      } else if (this.state === GameState.BUILD_PLACE) {
        this.buildSystem.updateGhostPositionFromMouse(
          this.raycaster,
          this.mouse,
          this.camera
        );
        this.buildSystem.updateBombIndicator();
      }
    });

    window.addEventListener("wheel", (event) => {
      if (this.state === GameState.BUILD_PLACE) {
        this.buildSystem.adjustHeight(event.deltaY > 0 ? -1 : 1);
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (this.state === GameState.BUILD_PLACE) {
          this.setState(GameState.BUILD_VIEW);
        }
      } else if (event.code === "KeyQ") {
        if (this.state === GameState.BUILD_PLACE) {
          this.buildSystem.rotate();
          this.buildSystem.updateGhostPositionFromMouse(
            this.raycaster,
            this.mouse,
            this.camera
          );
        }
      }
    });

    window.addEventListener("mousedown", () => {
      void this.primeAudioFromGesture();
      this.uiManager.handlePointerDown();
    });

    window.addEventListener("click", () => {
      void this.primeAudioFromGesture().then(() => {
        this.audio.playSfx(AudioIds.UiClick);
      });
      const consumed = this.uiManager.handleClick();
      if (consumed) return;

      if (this.state === GameState.PICK) {
        this.handlePickClick();
      } else if (this.state === GameState.BUILD_VIEW) {
        this.setState(GameState.BUILD_PLACE);
      } else if (this.state === GameState.BUILD_PLACE) {
        this.handleBuildPlaceClick();
      } else if (
        this.state === GameState.RUN ||
        this.state === GameState.COUNTDOWN
      ) {
        document.body.requestPointerLock();
      }
    });
  }

  private async primeAudioFromGesture(): Promise<void> {
    await this.audio.unlock();
    if (this.audioPrimed) return;
    this.audioPrimed = true;

    // 预加载常用音效（不阻塞游戏逻辑）
    void this.audio.preload([
      AudioIds.BgmMain,
      AudioIds.UiClick,
      AudioIds.BuildPlace,
      AudioIds.BuildInvalid,
      AudioIds.Jump,
      AudioIds.Coin,
      AudioIds.Death,
      AudioIds.Goal,
      AudioIds.Win,
      AudioIds.Boom,
      AudioIds.CrossbowFire,
      AudioIds.ArrowHit,
    ]);
  }

  private handlePickClick(): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.partyBoxManager.getItems(),
      true
    );

    if (intersects.length > 0) {
      this.audio.playSfx(AudioIds.UiClick);
      let target = intersects[0].object;
      while (target.parent && !target.userData.itemId) {
        target = target.parent;
      }

      if (target.userData.itemId) {
        const index = this.partyBoxManager.findItemIndex(target);
        if (index !== -1) {
          if (this.networkManager.isHostUser()) {
            this.processPickRequest(index, this.networkManager.getMyId());
          } else {
            this.networkManager.send({
              t: PacketType.PICK_ITEM,
              p: { index: index },
            });
          }
        }
      }
    }
  }

  private handleBuildPlaceClick(): void {
    if (this.buildSystem.ghostObject && this.buildSystem.selectedItem) {
      if (
        this.buildSystem.isValidPlacement(
          this.buildSystem.selectedItem,
          this.buildSystem.ghostObject.position
        )
      ) {
        const crossbow = this.buildSystem.placeObject(
          this.buildSystem.selectedItem,
          this.buildSystem.ghostObject.position,
          this.buildSystem.rotation
        );

        if (crossbow) this.attachCrossbowAudio(crossbow);

        this.audio.playSfx(AudioIds.BuildPlace);

        this.playersFinishedTurn.add(this.networkManager.getMyId());

        this.networkManager.send({
          t: PacketType.EVENT_PLACE,
          p: {
            itemId: this.buildSystem.selectedItem,
            pos: {
              x: this.buildSystem.ghostObject.position.x,
              y: this.buildSystem.ghostObject.position.y,
              z: this.buildSystem.ghostObject.position.z,
            },
            rot: this.buildSystem.rotation,
            playerId: this.networkManager.getMyId(),
          },
        });

        this.checkAllPlayersFinished();

        if (this.state === GameState.BUILD_PLACE) {
          this.uiManager.showMessage("Waiting for other players...");
          this.buildSystem.removeGhost();
          this.buildSystem.setHighlightVisible(false);
        }
      } else {
        this.audio.playSfx(AudioIds.BuildInvalid);
        this.uiManager.showMessage("Invalid Placement!");
      }
    }
  }

  private attachCrossbowAudio(crossbow: Crossbow): void {
    crossbow.onFire = () => {
      this.audio.playSfx(AudioIds.CrossbowFire);
    };
    crossbow.onArrowHit = () => {
      this.audio.playSfx(AudioIds.ArrowHit);
    };
  }

  // ========== 网络处理 ==========

  private setupNetworkHandlers(): void {
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
          this.handleJoinPacket(packet, senderId);
          break;
        case PacketType.WELCOME:
          this.handleWelcomePacket(packet);
          break;
        case PacketType.LOBBY_UPDATE:
          this.handleLobbyUpdatePacket(packet);
          break;
        case PacketType.CHARACTER_SELECT:
          this.handleCharacterSelectPacket(packet, senderId);
          break;
        case PacketType.START_GAME:
          if (!this.networkManager.isHostUser()) this.startGame();
          break;
        case PacketType.SNAPSHOT:
          this.handleSnapshot(packet.p);
          if (this.networkManager.isHostUser()) {
            this.networkManager.send(packet);
          }
          break;
        case PacketType.EVENT_PLACE:
          this.handleEventPlacePacket(packet, senderId);
          break;
        case PacketType.PARTY_BOX_UPDATE:
          this.partyBoxManager.spawnItems(packet.p);
          break;
        case PacketType.PICK_ITEM:
          if (this.networkManager.isHostUser()) {
            this.processPickRequest(packet.p.index, senderId);
          }
          break;
        case PacketType.ITEM_PICKED:
          this.handleItemPicked(packet.p.index, packet.p.playerId);
          break;
        case PacketType.PLAYER_FINISHED_RUN:
          this.handlePlayerFinishedRun(packet, senderId);
          break;
        case PacketType.SHOW_SCORE:
          if (!this.networkManager.isHostUser()) {
            this.setState(GameState.SCORE);
            this.uiManager.showScoreScreen(
              packet.p.scores,
              ScoreManager.GOAL_SCORE,
              () => {}
            );
          }
          break;
        case PacketType.GAME_WIN:
          if (!this.networkManager.isHostUser()) {
            this.audio.playSfx(AudioIds.Win);
            this.uiManager.showWinScreen(
              packet.p.nickname,
              packet.p.character,
              () => {
                this.lobbyPlayers.forEach((p) => {
                  (p as any).totalScore = 0;
                });
                this.setState(GameState.LOBBY);
              }
            );
          }
          break;
        case PacketType.CHAT:
          const chatPayload = packet.p as ChatPayload;
          this.uiManager.addChatMessage(
            chatPayload.nickname,
            chatPayload.message
          );
          if (this.networkManager.isHostUser()) {
            this.networkManager.send(packet);
          }
          break;
      }
    };
  }

  private handleJoinPacket(packet: Packet, senderId: string): void {
    if (!this.networkManager.isHostUser()) return;
    if (this.lobbyPlayers.some((p) => p.id === senderId)) return;

    const newPlayer: PlayerInfo = {
      id: senderId,
      nickname: packet.p.nickname,
      character: "",
      isHost: false,
      isReady: false,
    };
    this.lobbyPlayers.push(newPlayer);

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

    this.broadcastLobbyUpdate();
  }

  private handleWelcomePacket(packet: Packet): void {
    this.lobbyPlayers = packet.p.players;
    this.myPlayerInfo.id = this.networkManager.getMyId();

    const myProfile = this.lobbyPlayers.find(
      (p) => p.id === this.myPlayerInfo.id
    );
    if (myProfile && myProfile.character) {
      this.updateLocalPlayerModel(myProfile.character);
    }

    this.setState(GameState.LOBBY);
  }

  private handleLobbyUpdatePacket(packet: Packet): void {
    this.lobbyPlayers = packet.p;
    const me = this.lobbyPlayers.find(
      (p) => p.id === this.networkManager.getMyId()
    );
    if (me && me.character) {
      this.updateLocalPlayerModel(me.character);
    }
    this.refreshLobbyUI();
  }

  private handleCharacterSelectPacket(packet: Packet, senderId: string): void {
    if (!this.networkManager.isHostUser()) return;

    const requestedChar = packet.p.charId;
    const sender = this.lobbyPlayers.find((pl) => pl.id === senderId);

    if (sender) {
      const isTaken = this.lobbyPlayers.some(
        (p) => p.character === requestedChar && p.id !== senderId
      );

      if (!isTaken) {
        sender.character = requestedChar;
      }
      this.broadcastLobbyUpdate();
    }
  }

  private handleEventPlacePacket(packet: Packet, _senderId: string): void {
    if (packet.p.playerId === this.networkManager.getMyId()) return;

    const crossbow = this.buildSystem.placeObject(
      packet.p.itemId,
      new THREE.Vector3(packet.p.pos.x, packet.p.pos.y, packet.p.pos.z),
      packet.p.rot || 0
    );

    if (crossbow) this.attachCrossbowAudio(crossbow);

    this.playersFinishedTurn.add(packet.p.playerId);
    this.checkAllPlayersFinished();

    if (this.networkManager.isHostUser()) {
      this.networkManager.send(packet);
    }
  }

  private handlePlayerFinishedRun(packet: Packet, senderId: string): void {
    if (!this.networkManager.isHostUser()) return;
    if (senderId === this.networkManager.getMyId()) return;

    this.playersFinishedTurn.add(senderId);

    if (packet.p.won) {
      this.scoreManager.recordFinish(senderId);
    }

    if (packet.p.killedBy && packet.p.killedBy !== senderId) {
      this.scoreManager.recordTrapKill(packet.p.killedBy);
    }

    if (this.playersFinishedTurn.size >= this.lobbyPlayers.length) {
      this.setState(GameState.SCORE);
    }
  }

  private handleSnapshot(data: SnapshotPayload): void {
    if (data.id === this.networkManager.getMyId()) return;
    const player = this.players.get(data.id);
    if (player) {
      player.body.position.set(data.pos[0], data.pos[1], data.pos[2]);
      player.body.quaternion.set(
        data.rot[0],
        data.rot[1],
        data.rot[2],
        data.rot[3]
      );
      player.rig.updateFromBody(player.body);
    }
  }

  // ========== 游戏逻辑 ==========

  private updateLocalPlayerModel(characterId: string): void {
    const localPlayer = this.players.get("local");
    if (!localPlayer) return;

    const appearance = getCharacterAppearance(characterId);
    this.scene.remove(localPlayer.rig.root);

    const newRig = CharacterRig.createFromAppearance(
      this.resources,
      appearance
    );
    this.scene.add(newRig.root);

    if (this.state === GameState.LOBBY) {
      newRig.root.visible = false;
    }

    localPlayer.rig = newRig;
    newRig.updateFromBody(localPlayer.body);
  }

  private broadcastLobbyUpdate(): void {
    this.networkManager.send({
      t: PacketType.LOBBY_UPDATE,
      p: this.lobbyPlayers,
    });
    this.refreshLobbyUI();
  }

  private refreshLobbyUI(): void {
    if (this.state === GameState.LOBBY) {
      this.uiManager.showLobbyScreen(
        this.networkManager.getMyId(),
        this.lobbyPlayers,
        this.networkManager.isHostUser(),
        (charId) => {
          if (this.networkManager.isHostUser()) {
            const isTaken = this.lobbyPlayers.some(
              (p) => p.character === charId && p.id !== this.myPlayerInfo.id
            );
            if (!isTaken) {
              this.myPlayerInfo.character = charId;
              const me = this.lobbyPlayers.find(
                (p) => p.id === this.myPlayerInfo.id
              );
              if (me) me.character = charId;
              this.updateLocalPlayerModel(charId);
              this.broadcastLobbyUpdate();
            }
          } else {
            this.networkManager.send({
              t: PacketType.CHARACTER_SELECT,
              p: { charId: charId },
            });
          }
        },
        () => {
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

  private startGame(): void {
    this.uiManager.cleanupLobbyCharacters();
    this.uiManager.clearUI();

    if (this.myPlayerInfo.character) {
      this.updateLocalPlayerModel(this.myPlayerInfo.character);
    }

    this.lobbyPlayers.forEach((p) => {
      if (p.id !== this.myPlayerInfo.id && !this.players.has(p.id)) {
        this.spawnRemotePlayer(p);
      }
    });

    this.setState(GameState.PICK);
  }

  private spawnRemotePlayer(info: PlayerInfo): void {
    const appearance = getCharacterAppearance(info.character);
    const rig = CharacterRig.createFromAppearance(this.resources, appearance);
    this.scene.add(rig.root);

    const playerBody = BodyFactory.createPlayerBody(
      0.4,
      1.2,
      0,
      new CANNON.Vec3(0, 5, 0)
    );
    playerBody.type = CANNON.Body.KINEMATIC;
    playerBody.collisionFilterGroup = 2;
    playerBody.collisionFilterMask = 1;
    (playerBody as any).userData = { tag: "player" };

    this.physicsWorld.world.addBody(playerBody);

    const player = new Player(rig, playerBody);
    this.players.set(info.id, player);
  }

  private checkAllPlayersFinished(): void {
    if (this.playersFinishedTurn.size >= this.lobbyPlayers.length) {
      this.setState(GameState.COUNTDOWN);
    }
  }

  private resetPlayers(): void {
    const playerCount = this.players.size;
    if (playerCount === 0) return;

    const spacing = Math.min(1.6 / Math.max(playerCount - 1, 1), 0.8);
    let index = 0;
    this.players.forEach((player) => {
      const offsetX =
        playerCount === 1 ? 0 : (index - (playerCount - 1) / 2) * spacing;
      const offsetZ = (index % 2) * 0.3 - 0.15;
      player.resetPosition(new CANNON.Vec3(offsetX, 2, offsetZ));
      player.rig.updateFromBody(player.body);
      index++;
    });
  }

  private processPickRequest(index: number, senderId: string): void {
    if (this.partyBoxManager.isItemAvailable(index)) {
      this.partyBoxManager.markItemPicked(index);

      this.networkManager.send({
        t: PacketType.ITEM_PICKED,
        p: { index: index, playerId: senderId },
      });

      this.handleItemPicked(index, senderId);
    }
  }

  private handleItemPicked(index: number, playerId: string): void {
    this.partyBoxManager.markItemPicked(index);

    if (playerId === this.networkManager.getMyId()) {
      const itemId = this.partyBoxManager.getItemId(index);
      if (itemId) {
        this.buildSystem.selectedItem = itemId;
        this.setState(GameState.BUILD_VIEW);
      }
    }
  }

  private generatePartyBoxItems(): void {
    const items = this.partyBoxManager.generateItems(this.lobbyPlayers.length);
    this.partyBoxManager.spawnItems(items);

    this.networkManager.send({
      t: PacketType.PARTY_BOX_UPDATE,
      p: items,
    });
  }

  // ========== 状态管理 ==========

  private setState(newState: GameState): void {
    if (this.state === newState) return;

    this.state = newState;
    this.uiManager.showMessage(`State: ${GameState[newState]}`);

    switch (newState) {
      case GameState.TITLE:
        this.onEnterTitle();
        break;
      case GameState.LOBBY:
        this.onEnterLobby();
        break;
      case GameState.PICK:
        this.onEnterPick();
        break;
      case GameState.BUILD_VIEW:
        this.onEnterBuildView();
        break;
      case GameState.BUILD_PLACE:
        this.onEnterBuildPlace();
        break;
      case GameState.COUNTDOWN:
        this.onEnterCountdown();
        break;
      case GameState.SCORE:
        this.onEnterScore();
        break;
    }

    // 非建造状态清理
    if (
      newState !== GameState.BUILD_VIEW &&
      newState !== GameState.BUILD_PLACE
    ) {
      this.buildSystem.removeGhost();
      this.buildSystem.hideBombIndicator();
    }
  }

  private onEnterTitle(): void {
    void this.audio.playBgm(AudioIds.BgmMain);

    this.cameraController.cancelTween();
    this.cameraController.setPosition(0, 4, 4);
    this.cameraController.lookAt(0, 4, -10);

    this.uiManager.clearUI();
    document.exitPointerLock();

    this.partyBoxManager.resetRoundCount();
    this.scoreManager.resetAll(this.lobbyPlayers);
    this.levelManager.clearPlacedObjects();
    this.buildSystem.clearCrossbows();

    this.localDeathSoundPlayed = false;

    // 重置玩家
    this.players.forEach((player, id) => {
      if (id !== "local") {
        this.scene.remove(player.rig.root);
        this.physicsWorld.world.removeBody(player.body);
      } else {
        player.resetPosition(new CANNON.Vec3(0, 5, 0));
        player.score = 0;
      }
    });

    const localPlayer = this.players.get("local");
    this.players.clear();
    if (localPlayer) {
      this.players.set("local", localPlayer);
    }

    this.uiManager.showTitleScreen(
      (nickname) => {
        this.myPlayerInfo.nickname = nickname;
        this.myPlayerInfo.isHost = true;
        this.myPlayerInfo.id = this.networkManager.getMyId();
        this.networkManager.setHost(true);
        this.lobbyPlayers = [this.myPlayerInfo];
        this.setState(GameState.LOBBY);
      },
      (nickname, hostId) => {
        this.myPlayerInfo.nickname = nickname;
        this.myPlayerInfo.isHost = false;
        this.networkManager.connectToHost(hostId);

        this.networkManager.onPeerConnected = () => {
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
  }

  private onEnterLobby(): void {
    this.cameraController.cancelTween();
    this.cameraController.setPosition(0, 1.5, 6);
    this.cameraController.lookAt(0, 1, 0);

    this.levelManager.setMapVisible(false);
    this.players.forEach((player) => {
      player.rig.root.visible = false;
    });

    this.uiManager.clearUI();
    this.levelManager.clearPlacedObjects();
    this.refreshLobbyUI();
  }

  private onEnterPick(): void {
    this.levelManager.setMapVisible(true);
    this.players.forEach((player) => {
      player.rig.root.visible = true;
    });

    this.uiManager.clearUI();
    document.exitPointerLock();
    this.resetPlayers();

    this.buildSystem.setHighlightVisible(false);
    this.buildSystem.setGridHelperVisible(false);
    this.levelManager.setPartyBoxVisible(true);

    this.playersFinishedTurn.clear();
    this.buildSystem.selectedItem = null;
    this.buildSystem.rotation = 0;

    // 相机平移动画
    this.cameraController.cancelTween();
    this.cameraController.setPosition(0, 4, 4);
    this.cameraController.lookAt(0, 4, -10);
    this.cameraController.tweenTo(new THREE.Vector3(11, 4, 4), 1.0);
    this.cameraController.lookAt(0, 4, -10);

    if (this.networkManager.isHostUser()) {
      this.generatePartyBoxItems();
    }

    this.localDeathSoundPlayed = false;
  }

  private onEnterBuildView(): void {
    this.levelManager.setPartyBoxVisible(false);
    document.exitPointerLock();

    this.buildSystem.setHighlightVisible(false);
    this.buildSystem.setGridHelperVisible(false);
    this.buildSystem.createGhost();

    this.cameraController.cancelTween();
    this.cameraController.initBuildViewCamera();
  }

  private onEnterBuildPlace(): void {
    this.buildSystem.setHighlightVisible(true);
    this.buildSystem.height = 8;
  }

  private onEnterCountdown(): void {
    this.levelManager.setPartyBoxVisible(false);
    this.buildSystem.setHighlightVisible(false);
    this.buildSystem.hideBombIndicator();

    // 执行炸弹爆炸
    const bombCount = this.levelManager.explodeBombs();
    if (bombCount > 0) {
      this.audio.playSfx(AudioIds.Boom);
      this.uiManager.showMessage("BOOM!");
    }

    this.countdownTimer = 3.0;
    document.body.requestPointerLock();
    this.uiManager.showMessage("Get Ready! 3");

    this.cameraController.cancelTween();
    this.cameraController.setPosition(0, 25, -15);
    this.cameraController.lookAt(0, 1, 12.5);

    this.playersFinishedTurn.clear();
    this.scoreManager.resetRound();

    this.localDeathSoundPlayed = false;
  }

  private onEnterScore(): void {
    document.exitPointerLock();

    this.cameraController.setPosition(8, 6, 22);
    this.cameraController.lookAt(0, 2, 25);

    this.players.forEach((player) => {
      player.rig.root.visible = true;
    });

    setTimeout(() => {
      if (this.networkManager.isHostUser()) {
        const scores = this.scoreManager.calculateScores(
          this.lobbyPlayers,
          this.networkManager.getMyId(),
          (id) => {
            if (id === this.networkManager.getMyId()) {
              return this.players.get("local");
            }
            return this.players.get(id);
          }
        );

        this.networkManager.send({
          t: PacketType.SHOW_SCORE,
          p: { scores: scores },
        });

        this.uiManager.showScoreScreen(scores, ScoreManager.GOAL_SCORE, () => {
          const winner = this.scoreManager.checkWinner(scores);

          if (winner) {
            const winnerPlayer = this.lobbyPlayers.find(
              (p) => p.nickname === winner.nickname
            );
            const winnerCharacter = winnerPlayer?.character || "chicken";

            this.networkManager.send({
              t: PacketType.GAME_WIN,
              p: { nickname: winner.nickname, character: winnerCharacter },
            });

            this.audio.playSfx(AudioIds.Win);
            this.uiManager.showWinScreen(
              winner.nickname,
              winnerCharacter,
              () => {
                this.scoreManager.resetAll(this.lobbyPlayers);
                this.setState(GameState.LOBBY);
              }
            );
          } else {
            this.networkManager.send({ t: PacketType.START_GAME, p: {} });
            this.startGame();
          }
        });
      }
    }, 2000);
  }

  // ========== 游戏循环 ==========

  private update(): void {
    this.physicsWorld.step(1 / 60);

    // 更新十字弓（统一从 BuildSystem 获取，避免重复更新）
    this.buildSystem.getCrossbows().forEach((crossbow) => {
      crossbow.update(1 / 60);
    });

    // 更新玩家
    this.players.forEach((player) => {
      player.update(1 / 60);
    });

    // 更新相机平滑过渡
    this.cameraController.updateTween(1 / 60);

    // 更新云朵
    this.levelManager.updateClouds();

    // 更新大厅动画
    if (this.state === GameState.LOBBY) {
      this.uiManager.updateLobbyAnimations(1 / 60);
    }

    // 更新 Party Box 物品旋转
    if (this.state === GameState.PICK) {
      this.partyBoxManager.updateItemsRotation();
    }

    // 倒计时逻辑
    if (this.state === GameState.COUNTDOWN) {
      this.updateCountdown();
    }

    // 玩家控制
    if (this.state === GameState.RUN || this.state === GameState.COUNTDOWN) {
      this.updatePlayerControl();
    } else if (
      this.state === GameState.BUILD_VIEW ||
      this.state === GameState.BUILD_PLACE
    ) {
      if (this.state === GameState.BUILD_PLACE) {
        this.buildSystem.updateGhostValidityColor();
      }
    }

    // 发送快照
    if (this.state === GameState.RUN || this.state === GameState.COUNTDOWN) {
      this.sendSnapshot();
    }

    this.renderer.render(this.scene, this.camera);
  }

  private updateCountdown(): void {
    this.countdownTimer -= 1 / 60;
    if (this.countdownTimer <= 0) {
      this.setState(GameState.RUN);
    } else {
      this.uiManager.showMessage(
        `Get Ready! ${Math.ceil(this.countdownTimer)}`
      );

      const localPlayer = this.players.get("local");
      if (localPlayer) {
        if (localPlayer.body.position.x < -1) localPlayer.body.position.x = -1;
        if (localPlayer.body.position.x > 1) localPlayer.body.position.x = 1;
        if (localPlayer.body.position.z < -1) localPlayer.body.position.z = -1;
        if (localPlayer.body.position.z > 1) localPlayer.body.position.z = 1;
      }
    }
  }

  private updatePlayerControl(): void {
    const localPlayer = this.players.get("local");
    if (!localPlayer) return;

    // 观战模式
    if (
      this.state === GameState.RUN &&
      this.playersFinishedTurn.has(this.networkManager.getMyId())
    ) {
      this.cameraController.updateFreeCamera(
        this.inputManager.isKeyPressed("KeyW"),
        this.inputManager.isKeyPressed("KeyS"),
        this.inputManager.isKeyPressed("KeyA"),
        this.inputManager.isKeyPressed("KeyD"),
        this.inputManager.isKeyPressed("Space"),
        this.inputManager.isKeyPressed("ShiftLeft")
      );
    } else {
      // 正常控制
      const mouseDelta = this.inputManager.getMouseDelta();
      if (document.pointerLockElement) {
        this.cameraController.handleMouseRotation(mouseDelta.x, mouseDelta.y);
      }

      const input = {
        x: this.inputManager.getAxis("KeyA", "KeyD"),
        y: this.inputManager.getAxis("KeyW", "KeyS"),
        jump: this.inputManager.isKeyPressed("Space"),
        sprint:
          this.inputManager.isKeyPressed("ShiftLeft") ||
          this.inputManager.isKeyPressed("ShiftRight"),
      };
      localPlayer.setInput(input, this.cameraController.angleY);

      const targetPos = new THREE.Vector3();
      localPlayer.rig.root.getWorldPosition(targetPos);
      this.cameraController.updateOrbitCamera(targetPos);
    }

    // 检测死亡/胜利
    if (this.state === GameState.RUN) {
      if (!this.playersFinishedTurn.has(this.networkManager.getMyId())) {
        if (localPlayer.checkDeath() || localPlayer.hasWon) {
          this.playersFinishedTurn.add(this.networkManager.getMyId());
          this.uiManager.showMessage(localPlayer.hasWon ? "GOAL!" : "DIED!");

          // 掉落死亡不会触发 collide，补一声
          if (!localPlayer.hasWon && !this.localDeathSoundPlayed) {
            this.localDeathSoundPlayed = true;
            this.audio.playSfx(AudioIds.Death);
          }

          if (localPlayer.hasWon) {
            localPlayer.setAnimState("dance");
          }

          this.networkManager.send({
            t: PacketType.PLAYER_FINISHED_RUN,
            p: {
              won: localPlayer.hasWon,
              killedBy: localPlayer.lastHitBy,
            },
          });

          if (this.networkManager.isHostUser()) {
            if (localPlayer.hasWon) {
              this.scoreManager.recordFinish(this.networkManager.getMyId());
            }
            if (
              localPlayer.lastHitBy &&
              localPlayer.lastHitBy !== this.networkManager.getMyId()
            ) {
              this.scoreManager.recordTrapKill(localPlayer.lastHitBy);
            }
          }

          const delay = localPlayer.hasWon ? 0 : 2000;
          setTimeout(() => {
            document.exitPointerLock();
            this.cameraController.setPosition(8, 6, 22);
            this.cameraController.lookAt(0, 2, 25);

            if (this.networkManager.isHostUser()) {
              if (this.playersFinishedTurn.size >= this.lobbyPlayers.length) {
                this.setState(GameState.SCORE);
              }
            }
          }, delay);
        }
      }
    }
  }

  private sendSnapshot(): void {
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
}
