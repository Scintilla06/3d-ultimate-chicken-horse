import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { PlaceholderGenerator } from "../utils/PlaceholderGenerator";
import { Resources } from "../core/Resources";
import { listCharacterAppearances } from "../objects/character/CharacterRegistry";
import { ChatSystem } from "./components/ChatSystem";
import { ScoreScreen, ScoreData } from "./components/ScoreScreen";
import { WinScreen } from "./components/WinScreen";
import { MapSelector } from "./components/MapSelector";

/**
 * Lobby character model data
 */
interface LobbyCharacterData {
  root: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  nameLabel: THREE.Sprite | null;
  charNameLabel: THREE.Sprite | null;
}

/**
 * UI Manager: Manages game UI interface
 */
export class UIManager {
  private uiLayer: HTMLElement;

  // 3D UI
  private scene: THREE.Scene | null = null;
  private camera: THREE.Camera | null = null;
  private raycaster: THREE.Raycaster | null = null;
  private uiRoot3D: THREE.Group | null = null;
  private pointerNDC: THREE.Vector2 = new THREE.Vector2();

  // Character selection 3D models
  private lobbyCharacterModels: Map<string, LobbyCharacterData> = new Map();
  private resources: Resources | null = null;

  // UI components
  private chatSystem: ChatSystem;
  private scoreScreen: ScoreScreen;
  private winScreen: WinScreen;
  private mapSelector: MapSelector;

  constructor() {
    this.uiLayer = document.getElementById("ui-layer") as HTMLElement;
    this.chatSystem = new ChatSystem();
    this.scoreScreen = new ScoreScreen(this.uiLayer);
    this.winScreen = new WinScreen(this.uiLayer);
    this.mapSelector = new MapSelector();
  }

  // ========== 聊天系统代理方法 ==========

  public setChatCallback(callback: (message: string) => void): void {
    this.chatSystem.setCallback(callback);
  }

  public openChatInput(): void {
    this.chatSystem.open();
  }

  public closeChatInput(): void {
    this.chatSystem.close();
  }

  public isChatInputOpen(): boolean {
    return this.chatSystem.isOpen();
  }

  public addChatMessage(nickname: string, message: string, color?: string): void {
    this.chatSystem.addMessage(nickname, message, color);
  }

  // ========== 资源和场景 ==========

  public setResources(resources: Resources): void {
    this.resources = resources;
    this.winScreen.setResources(resources);
  }

  public attachScene(
    scene: THREE.Scene,
    camera: THREE.Camera,
    raycaster: THREE.Raycaster
  ): void {
    this.scene = scene;
    this.camera = camera;
    this.raycaster = raycaster;

    if (!this.uiRoot3D) {
      this.uiRoot3D = new THREE.Group();
      this.uiRoot3D.name = "UIRoot3D";
      this.scene.add(this.uiRoot3D);
    }
  }

  // ========== 消息显示 ==========

  public showMessage(message: string): void {
    const msgDiv = document.createElement("div");
    msgDiv.className = "ui-message";
    msgDiv.innerText = message;
    this.uiLayer.appendChild(msgDiv);
    setTimeout(() => {
      this.uiLayer.removeChild(msgDiv);
    }, 3000);
  }

  // ========== 3D UI 交互 ==========

  public updatePointerFromMouse(
    clientX: number,
    clientY: number,
    width: number,
    height: number
  ): void {
    this.pointerNDC.x = (clientX / width) * 2 - 1;
    this.pointerNDC.y = -(clientY / height) * 2 + 1;
  }

  public handleClick(): boolean {
    if (!this.scene || !this.camera || !this.raycaster || !this.uiRoot3D)
      return false;

    this.raycaster.setFromCamera(this.pointerNDC, this.camera as THREE.Camera);
    const intersects = this.raycaster.intersectObjects(
      this.uiRoot3D!.children,
      true
    );
    if (intersects.length === 0) return false;

    const obj = intersects[0].object as any;
    let target: any = obj;
    while (target && !target.userData?.type) {
      target = target.parent;
    }
    if (
      target &&
      target.userData.type === "button" &&
      typeof target.userData.onClick === "function"
    ) {
      target.userData.onClick();
      return true;
    }
    return false;
  }

  public handlePointerDown(): boolean {
    if (!this.scene || !this.camera || !this.raycaster || !this.uiRoot3D)
      return false;

    this.raycaster.setFromCamera(this.pointerNDC, this.camera as THREE.Camera);
    const intersects = this.raycaster.intersectObjects(
      this.uiRoot3D!.children,
      true
    );
    if (intersects.length === 0) return false;

    const obj = intersects[0].object as any;
    let target: any = obj;
    while (target && !target.userData?.type) {
      target = target.parent;
    }
    if (target && target.userData.type === "button") {
      if (typeof target.userData.__pressEffect === "function") {
        target.userData.__pressEffect();
      }
      return true;
    }
    return false;
  }

  // ========== UI 辅助方法 ==========

  private createButtonPlane(
    width: number,
    height: number,
    label: string,
    onClick: () => void
  ): THREE.Mesh {
    const mesh = PlaceholderGenerator.createUIBoardButton(width, height, label);
    mesh.userData.onClick = onClick;
    mesh.userData.label = label;
    mesh.userData.__pressEffect = () => {
      const original = mesh.scale.clone();
      mesh.scale.set(original.x * 0.9, original.y * 0.9, original.z);
      setTimeout(() => {
        mesh.scale.copy(original);
      }, 80);
    };
    return mesh;
  }

  private createPanel(width: number, height: number): THREE.Mesh {
    const geom = new THREE.PlaneGeometry(width, height);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf0e6d2 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData.type = "panel";
    return mesh;
  }

  private createTextSprite(text: string, color: string): THREE.Sprite {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    canvas.width = 256;
    canvas.height = 64;

    context.fillStyle = "rgba(0, 0, 0, 0.5)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.font = "bold 32px Arial";
    context.fillStyle = color;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    return new THREE.Sprite(material);
  }

  // ========== 标题界面 ==========

  public showTitleScreen(
    onHost: (nickname: string) => void,
    onJoin: (nickname: string, hostId: string) => void
  ): void {
    this.uiLayer.innerHTML = "";

    if (!this.scene || !this.camera || !this.uiRoot3D) {
      const nickname = "Player" + Math.floor(Math.random() * 1000);
      const hostId =
        window.prompt("Enter Host ID to join (leave empty to host):", "") || "";
      if (hostId) {
        onJoin(nickname, hostId);
      } else {
        onHost(nickname);
      }
      return;
    }

    this.uiRoot3D.clear();

    const panel = this.createPanel(8, 4.5);
    panel.position.set(0, 1.8, -10);
    this.uiRoot3D.add(panel);

    // Logo 图片替代标题文字
    const logoImg = document.createElement("img");
    logoImg.src = import.meta.env.BASE_URL + "logo.png";
    logoImg.className = "ui-title-logo";
    logoImg.alt = "Ultimate Chicken Horse 3D";
    this.uiLayer.appendChild(logoImg);

    let nickname = "Player" + Math.floor(Math.random() * 1000);

    const nameHint = document.createElement("div");
    nameHint.className = "ui-name-hint ui-element";
    nameHint.innerText = `Nickname: ${nickname} (click to edit)`;
    nameHint.onclick = () => {
      const next = window.prompt("Enter your nickname", nickname) || nickname;
      nickname = next.trim() || nickname;
      nameHint.innerText = `Nickname: ${nickname} (click to edit)`;
    };
    this.uiLayer.appendChild(nameHint);

    const hostBtn = this.createButtonPlane(2.4, 0.9, "HOST", () => {
      onHost(nickname);
    });
    hostBtn.position.set(-2.4, 1.2, -9.9);
    this.uiRoot3D.add(hostBtn);

    const joinBtn = this.createButtonPlane(2.4, 0.9, "JOIN", () => {
      const hostId = window.prompt("Enter Host ID:", "") || "";
      if (!hostId) return;
      onJoin(nickname, hostId);
    });
    joinBtn.position.set(2.4, 1.2, -9.9);
    this.uiRoot3D.add(joinBtn);
  }

  // ========== 大厅界面 ==========

  public showLobbyScreen(
    myId: string,
    players: any[],
    isHost: boolean,
    onCharacterSelect: (charId: string) => void,
    onStart: () => void,
    onNicknameChange?: (newNickname: string) => void
  ): void {
    this.uiLayer.innerHTML = "";

    // Keep signature in sync with Game.ts; currently lobby UI doesn't expose nickname editing.
    void onNicknameChange;

    if (!this.scene || !this.camera || !this.uiRoot3D || !this.resources) {
      const fallback = document.createElement("div");
      fallback.className = "ui-fallback";
      fallback.innerText = "Lobby (fallback)";
      this.uiLayer.appendChild(fallback);
      return;
    }

    this.cleanupLobbyCharacters();
    this.uiRoot3D.clear();

    // Host ID display
    if (isHost) {
      const hostInfo = document.createElement("div");
      hostInfo.className = "ui-host-info ui-element";

      const idSpan = document.createElement("span");
      idSpan.className = "ui-host-id-text";
      idSpan.innerText = myId ? `Host ID: ${myId}` : "Connecting...";
      hostInfo.appendChild(idSpan);

      const copyBtn = document.createElement("button");
      copyBtn.className = "ui-host-copy";
      copyBtn.innerText = "Copy";
      copyBtn.onclick = async () => {
        if (!myId) return;
        try {
          await navigator.clipboard.writeText(myId);
          copyBtn.innerText = "Copied";
          setTimeout(() => (copyBtn.innerText = "Copy"), 1500);
        } catch {
          copyBtn.innerText = "Failed";
          setTimeout(() => (copyBtn.innerText = "Copy"), 1500);
        }
      };
      hostInfo.appendChild(copyBtn);
      this.uiLayer.appendChild(hostInfo);
    }

    // 角色选择
    const chars = listCharacterAppearances();
    const spacing = 2.2;
    const startX = -((chars.length - 1) * spacing) / 2;
    const charZ = -2;

    chars.forEach((charAppearance, index) => {
      const charId = charAppearance.id;
      const xPos = startX + index * spacing;

      const selectedBy = players.find((p) => p.character === charId);
      const isTaken = selectedBy !== undefined;
      const isMySelection = selectedBy && selectedBy.id === myId;

      const originalModel = this.resources!.models.get(charAppearance.modelKey);
      const animations = this.resources!.modelAnimations.get(
        charAppearance.modelKey
      );

      if (originalModel) {
        const charModel = SkeletonUtils.clone(originalModel) as THREE.Group;
        charModel.position.set(xPos, 0, charZ);
        charModel.rotation.y = 0;

        let mixer: THREE.AnimationMixer | null = null;
        if (animations && animations.length > 0) {
          mixer = new THREE.AnimationMixer(charModel);
          let clipToPlay: THREE.AnimationClip | undefined;
          if (isTaken) {
            clipToPlay = animations.find((a) =>
              a.name.toLowerCase().includes("dance")
            );
          }
          if (!clipToPlay) {
            clipToPlay = animations.find((a) =>
              a.name.toLowerCase().includes("idle")
            );
          }
          if (clipToPlay) {
            const action = mixer.clipAction(clipToPlay);
            action.play();
          }
        }

        if (isTaken && !isMySelection) {
          charModel.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
              const mat = child.material.clone();
              if (mat.color) {
                mat.color.multiplyScalar(0.5);
              }
              child.material = mat;
            }
          });
        }

        this.scene!.add(charModel);

        let nameLabel: THREE.Sprite | null = null;
        if (selectedBy) {
          nameLabel = this.createTextSprite(
            selectedBy.nickname,
            isMySelection ? "#00ff00" : "#ff6600"
          );
          nameLabel.position.set(xPos, 2.2, charZ);
          nameLabel.scale.set(2, 0.5, 1);
          this.scene!.add(nameLabel);
        }

        const charNameLabel = this.createTextSprite(
          charId.toUpperCase(),
          "#ffffff"
        );
        charNameLabel.position.set(xPos, -0.3, charZ);
        charNameLabel.scale.set(1.5, 0.4, 1);
        this.scene!.add(charNameLabel);

        const clickArea = new THREE.Mesh(
          new THREE.BoxGeometry(2, 3, 1),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        clickArea.position.set(xPos, 1, charZ);
        clickArea.userData.type = "button";
        clickArea.userData.charId = charId;
        clickArea.userData.onClick = () => {
          if (!isTaken || isMySelection) {
            onCharacterSelect(charId);
          }
        };
        this.uiRoot3D!.add(clickArea);

        this.lobbyCharacterModels.set(charId, {
          root: charModel,
          mixer,
          nameLabel,
          charNameLabel,
        });
      }
    });

    // 开始按钮
    if (isHost) {
      const startBtn = this.createButtonPlane(2.5, 0.9, "START", () => {
        onStart();
      });
      startBtn.position.set(0, 4.5, -9.9);
      this.uiRoot3D?.add(startBtn);
    } else {
      const waitDiv = document.createElement("div");
      waitDiv.className = "ui-wait-msg";
      waitDiv.innerText = "Waiting for host to start...";
      this.uiLayer.appendChild(waitDiv);
    }
  }

  public cleanupLobbyCharacters(): void {
    this.lobbyCharacterModels.forEach(({ root, nameLabel, charNameLabel }) => {
      if (this.scene) {
        this.scene.remove(root);
        if (nameLabel) this.scene.remove(nameLabel);
        if (charNameLabel) this.scene.remove(charNameLabel);
      }
    });
    this.lobbyCharacterModels.clear();

    if (this.uiRoot3D) {
      this.uiRoot3D.clear();
    }
  }

  public updateLobbyAnimations(dt: number): void {
    this.lobbyCharacterModels.forEach(({ mixer }) => {
      if (mixer) {
        mixer.update(dt);
      }
    });
  }

  // ========== 分数和胜利界面 ==========

  public showScoreScreen(
    scores: ScoreData[],
    goalScore: number,
    onComplete: () => void
  ): void {
    this.scoreScreen.show(scores, goalScore, onComplete);
  }

  public showWinScreen(
    winnerName: string,
    winnerCharacter: string,
    onBackToLobby: () => void
  ): void {
    this.winScreen.show(winnerName, winnerCharacter, onBackToLobby);
  }

  // ========== 其他 ==========

  public updateScore(scores: { [id: string]: number }): void {
    console.log(scores);
  }

  public createItemPicker(onSelect: (itemId: string) => void): void {
    const container = document.createElement("div");
    container.id = "item-picker";
    container.style.position = "absolute";
    container.style.bottom = "20px";
    container.style.left = "50%";
    container.style.transform = "translateX(-50%)";
    container.style.display = "flex";
    container.style.gap = "10px";
    container.style.pointerEvents = "auto";

    const items = [
      { id: "box_wood", label: "Wood Box" },
      { id: "spikes", label: "Spikes" },
    ];

    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.innerText = item.label;
      btn.style.padding = "10px 20px";
      btn.style.fontSize = "16px";
      btn.style.cursor = "pointer";
      btn.onclick = () => {
        onSelect(item.id);
        container.style.display = "none";
      };
      container.appendChild(btn);
    });

    this.uiLayer.appendChild(container);
  }

  public showItemPicker(show: boolean): void {
    const picker = document.getElementById("item-picker");
    if (picker) {
      picker.style.display = show ? "flex" : "none";
    }
  }

  // ========== 地图选择 ==========

  public showMapSelector(
    onSelect: (mapId: string) => void,
    currentSelection?: string
  ): void {
    this.mapSelector.show(this.uiLayer, onSelect, currentSelection);
  }

  public hideMapSelector(): void {
    this.mapSelector.hide();
  }

  public updateMapVotes(votes: { [playerId: string]: string }): void {
    this.mapSelector.updateVotes(votes);
  }

  public getSelectedMapId(): string {
    return this.mapSelector.getSelectedMapId();
  }

  public clearUI(): void {
    this.uiLayer.innerHTML = "";
  }
}
