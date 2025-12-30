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

  public showMessage(message: string, duration: number = 2000): void {
    // 检查是否已经有相同的消息在显示（简单的防抖）
    const existing = document.getElementById("ui-big-message");
    if (existing) {
      if (existing.innerText === message) return; // 内容相同，忽略
      if (existing.parentNode) existing.parentNode.removeChild(existing); // 内容不同，移除旧的
    }

    const container = document.createElement("div");
    container.id = "ui-big-message";
    container.style.position = "absolute";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "center";
    container.style.pointerEvents = "none";
    container.style.zIndex = "20";

    const text = document.createElement("div");
    text.innerText = message;
    text.style.fontFamily = '"JotiOne", "Comic Sans MS", sans-serif';
    text.style.fontSize = "100px";
    text.style.color = "#FFD700"; // 金色
    text.style.textShadow = "4px 4px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 4px 4px 10px rgba(0,0,0,0.5)";
    text.style.transform = "scale(0.5)";
    text.style.opacity = "0";
    text.style.transition = "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s";

    container.appendChild(text);
    this.uiLayer.appendChild(container);

    // 动画
    requestAnimationFrame(() => {
      text.style.transform = "scale(1)";
      text.style.opacity = "1";
    });

    if (duration > 0) {
      setTimeout(() => {
        text.style.transform = "scale(1.5)";
        text.style.opacity = "0";
        setTimeout(() => {
          if (container.parentNode) container.parentNode.removeChild(container);
        }, 300);
      }, duration);
    }
  }

  public showDeathScreen(): void {
    const deathDiv = document.createElement("div");
    deathDiv.innerText = "WASTED";
    deathDiv.style.position = "absolute";
    deathDiv.style.top = "50%";
    deathDiv.style.left = "50%";
    deathDiv.style.transform = "translate(-50%, -50%) scale(0.5)";
    deathDiv.style.color = "#ff3333";
    deathDiv.style.fontFamily = '"Impact", "Arial Black", sans-serif';
    deathDiv.style.fontSize = "120px";
    deathDiv.style.fontWeight = "bold";
    deathDiv.style.textShadow = "5px 5px 0px #000";
    deathDiv.style.pointerEvents = "none";
    deathDiv.style.opacity = "0";
    deathDiv.style.transition = "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s";
    deathDiv.style.zIndex = "1000";
    
    this.uiLayer.appendChild(deathDiv);

    // Animate in
    requestAnimationFrame(() => {
      deathDiv.style.opacity = "1";
      deathDiv.style.transform = "translate(-50%, -50%) scale(1)";
    });

    // Remove after 1.5s
    setTimeout(() => {
      deathDiv.style.opacity = "0";
      setTimeout(() => {
        if (deathDiv.parentNode) {
          deathDiv.parentNode.removeChild(deathDiv);
        }
      }, 500);
    }, 1000);
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

  private createTextSprite(text: string, color: string): THREE.Sprite {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    canvas.width = 256;
    canvas.height = 64;

    context.fillStyle = "rgba(0, 0, 0, 0.5)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.font = "bold 32px JotiOne";
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

    // 创建全屏背景容器
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.alignItems = "center";
    container.style.justifyContent = "center";
    container.style.background = "linear-gradient(135deg, #f0e6d2 0%, #e8dcc8 100%)";
    container.style.fontFamily = '"JotiOne", "Comic Sans MS", sans-serif';
    this.uiLayer.appendChild(container);

    // Logo
    const logoImg = document.createElement("img");
    logoImg.src = import.meta.env.BASE_URL + "logo.png";
    logoImg.style.maxWidth = "600px";
    logoImg.style.width = "80%";
    logoImg.style.marginBottom = "40px";
    logoImg.style.animation = "logo-pop-in 1s cubic-bezier(0.34, 1.56, 0.64, 1)";
    container.appendChild(logoImg);

    // 昵称输入框
    let nickname = "Player" + Math.floor(Math.random() * 1000);
    const nameInputContainer = document.createElement("div");
    nameInputContainer.style.marginBottom = "30px";
    nameInputContainer.style.display = "flex";
    nameInputContainer.style.alignItems = "center";
    nameInputContainer.style.gap = "10px";
    
    const nameLabel = document.createElement("span");
    nameLabel.innerText = "Nickname:";
    nameLabel.style.fontSize = "24px";
    nameLabel.style.color = "#3b2b1a";
    nameInputContainer.appendChild(nameLabel);

    const nameInput = document.createElement("input");
    nameInput.value = nickname;
    nameInput.className = "ui-element";
    nameInput.style.padding = "10px 15px";
    nameInput.style.fontSize = "20px";
    nameInput.style.border = "3px solid #3b2b1a";
    nameInput.style.borderRadius = "8px";
    nameInput.style.backgroundColor = "#fff";
    nameInput.style.fontFamily = "inherit";
    nameInput.style.width = "200px";
    nameInput.onchange = (e) => {
      nickname = (e.target as HTMLInputElement).value.trim() || nickname;
    };
    nameInputContainer.appendChild(nameInput);
    container.appendChild(nameInputContainer);

    // 按钮容器
    const btnContainer = document.createElement("div");
    btnContainer.style.display = "flex";
    btnContainer.style.gap = "30px";
    container.appendChild(btnContainer);

    // HOST 按钮
    const hostBtn = document.createElement("button");
    hostBtn.innerText = "HOST GAME";
    hostBtn.className = "ui-element";
    this.styleButton(hostBtn, "#4CAF50");
    hostBtn.onclick = () => onHost(nickname);
    btnContainer.appendChild(hostBtn);

    // JOIN 按钮
    const joinBtn = document.createElement("button");
    joinBtn.innerText = "JOIN GAME";
    joinBtn.className = "ui-element";
    this.styleButton(joinBtn, "#2196F3");
    joinBtn.onclick = () => {
      const hostId = window.prompt("Enter Host ID:", "") || "";
      if (!hostId) return;
      onJoin(nickname, hostId);
    };
    btnContainer.appendChild(joinBtn);
  }

  private styleButton(btn: HTMLButtonElement, color: string): void {
    btn.style.padding = "15px 40px";
    btn.style.fontSize = "24px";
    btn.style.border = "none";
    btn.style.borderRadius = "12px";
    btn.style.backgroundColor = color;
    btn.style.color = "white";
    btn.style.cursor = "pointer";
    btn.style.fontFamily = "inherit";
    btn.style.boxShadow = "0 6px 0 rgba(0,0,0,0.2)";
    btn.style.transition = "transform 0.1s, box-shadow 0.1s";
    
    btn.onmousedown = () => {
      btn.style.transform = "translateY(4px)";
      btn.style.boxShadow = "0 2px 0 rgba(0,0,0,0.2)";
    };
    btn.onmouseup = () => {
      btn.style.transform = "translateY(0)";
      btn.style.boxShadow = "0 6px 0 rgba(0,0,0,0.2)";
    };
    btn.onmouseleave = () => {
      btn.style.transform = "translateY(0)";
      btn.style.boxShadow = "0 6px 0 rgba(0,0,0,0.2)";
    };
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
      const startBtn = this.createButtonPlane(3.0, 1.0, "START GAME", () => {
        onStart();
      });
      startBtn.position.set(0, 4.5, -9.9);
      this.uiRoot3D?.add(startBtn);
    } else {
      const waitDiv = document.createElement("div");
      waitDiv.className = "ui-wait-msg";
      waitDiv.innerText = "Waiting for host to start...";
      waitDiv.style.fontFamily = '"JotiOne", "Comic Sans MS", sans-serif';
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
