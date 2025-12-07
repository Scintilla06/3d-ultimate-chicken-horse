import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { PlaceholderGenerator } from "../utils/PlaceholderGenerator";
import { Resources } from "../core/Resources";
import { listCharacterAppearances } from "../objects/character/CharacterRegistry";

export class UIManager {
  private uiLayer: HTMLElement;

  // 3D UI
  private scene: THREE.Scene | null = null;
  private camera: THREE.Camera | null = null;
  private raycaster: THREE.Raycaster | null = null;
  private uiRoot3D: THREE.Group | null = null;
  private pointerNDC: THREE.Vector2 = new THREE.Vector2();

  // 角色选择 3D 模型
  private lobbyCharacterModels: Map<string, { 
    root: THREE.Group; 
    mixer: THREE.AnimationMixer | null;
    nameLabel: THREE.Sprite | null;
    charNameLabel: THREE.Sprite | null;
  }> = new Map();
  private resources: Resources | null = null;

  // 聊天系统
  private chatContainer: HTMLElement | null = null;
  private chatHistory: HTMLElement | null = null;
  private chatInputContainer: HTMLElement | null = null;
  private chatInput: HTMLInputElement | null = null;
  private isChatOpen: boolean = false;
  private onChatSend: ((message: string) => void) | null = null;

  constructor() {
    this.uiLayer = document.getElementById("ui-layer") as HTMLElement;
    this.initChat();
  }

  private initChat() {
    // 创建聊天容器
    this.chatContainer = document.createElement("div");
    this.chatContainer.className = "chat-container";

    // 聊天历史
    this.chatHistory = document.createElement("div");
    this.chatHistory.className = "chat-history";
    this.chatContainer.appendChild(this.chatHistory);

    // 输入容器
    this.chatInputContainer = document.createElement("div");
    this.chatInputContainer.className = "chat-input-container";

    this.chatInput = document.createElement("input");
    this.chatInput.type = "text";
    this.chatInput.className = "chat-input";
    this.chatInput.placeholder = "输入消息...";
    this.chatInput.maxLength = 200;

    this.chatInput.addEventListener("keydown", (e) => {
      e.stopPropagation(); // 防止触发游戏按键
      if (e.key === "Enter") {
        this.sendChatMessage();
      } else if (e.key === "Escape") {
        this.closeChatInput();
      }
    });

    this.chatInputContainer.appendChild(this.chatInput);
    this.chatContainer.appendChild(this.chatInputContainer);

    document.body.appendChild(this.chatContainer);
  }

  public setChatCallback(callback: (message: string) => void) {
    this.onChatSend = callback;
  }

  public openChatInput() {
    if (this.isChatOpen) return;
    this.isChatOpen = true;
    this.chatInputContainer?.classList.add("active");
    this.chatInput?.focus();
  }

  public closeChatInput() {
    this.isChatOpen = false;
    this.chatInputContainer?.classList.remove("active");
    if (this.chatInput) {
      this.chatInput.value = "";
      this.chatInput.blur();
    }
  }

  public isChatInputOpen(): boolean {
    return this.isChatOpen;
  }

  private sendChatMessage() {
    if (!this.chatInput || !this.chatInput.value.trim()) {
      this.closeChatInput();
      return;
    }

    const message = this.chatInput.value.trim();
    if (this.onChatSend) {
      this.onChatSend(message);
    }
    this.closeChatInput();
  }

  public addChatMessage(nickname: string, message: string) {
    if (!this.chatHistory) return;

    const msgDiv = document.createElement("div");
    msgDiv.className = "chat-message";

    const nickSpan = document.createElement("span");
    nickSpan.className = "nickname";
    nickSpan.textContent = nickname + ":";
    msgDiv.appendChild(nickSpan);

    const textSpan = document.createElement("span");
    textSpan.textContent = message;
    msgDiv.appendChild(textSpan);

    this.chatHistory.appendChild(msgDiv);

    // 滚动到底部
    this.chatHistory.scrollTop = this.chatHistory.scrollHeight;

    // 限制历史消息数量
    while (this.chatHistory.children.length > 50) {
      this.chatHistory.removeChild(this.chatHistory.firstChild!);
    }
  }

  /**
   * 设置 Resources 引用，用于加载角色模型
   */
  public setResources(resources: Resources) {
    this.resources = resources;
  }

  /**
   * 初始化 3D UI 所需的场景引用和射线工具
   */
  public attachScene(
    scene: THREE.Scene,
    camera: THREE.Camera,
    raycaster: THREE.Raycaster
  ) {
    this.scene = scene;
    this.camera = camera;
    this.raycaster = raycaster;

    if (!this.uiRoot3D) {
      this.uiRoot3D = new THREE.Group();
      this.uiRoot3D.name = "UIRoot3D";
      this.scene.add(this.uiRoot3D);
    }
  }

  public showMessage(message: string) {
    const msgDiv = document.createElement("div");
    msgDiv.className = "ui-message";
    msgDiv.innerText = message;
    this.uiLayer.appendChild(msgDiv);
    setTimeout(() => {
      this.uiLayer.removeChild(msgDiv);
    }, 3000);
  }

  /**
   * 将一个按钮区域注册为 3D UI 按钮
   */
  private createButtonPlane(
    width: number,
    height: number,
    label: string,
    onClick: () => void
  ): THREE.Mesh {
    const mesh = PlaceholderGenerator.createUIBoardButton(width, height, label);
    // type 已在 PlaceholderGenerator 中设置
    mesh.userData.onClick = onClick;
    mesh.userData.label = label;
    // 简单的按下反馈：缩放一下
    mesh.userData.__pressEffect = () => {
      // 使用一个很短的动画帧，避免和角色选中缩放冲突
      const original = mesh.scale.clone();
      mesh.scale.set(original.x * 0.9, original.y * 0.9, original.z);
      setTimeout(() => {
        mesh.scale.copy(original);
      }, 80);
    };
    return mesh;
  }

  /**
   * 创建一个简单的卡通纸板面板
   */
  private createPanel(width: number, height: number): THREE.Mesh {
    const geom = new THREE.PlaneGeometry(width, height);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf0e6d2 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData.type = "panel";
    return mesh;
  }

  /**
   * 注册鼠标坐标（归一化设备坐标）用于 3D UI raycast
   */
  public updatePointerFromMouse(
    clientX: number,
    clientY: number,
    width: number,
    height: number
  ) {
    this.pointerNDC.x = (clientX / width) * 2 - 1;
    this.pointerNDC.y = -(clientY / height) * 2 + 1;
  }

  /**
   * 处理一次鼠标点击事件，返回是否被 3D UI 消费
   */
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

  /**
   * 鼠标按下时的 3D UI 反馈（不触发逻辑，只做视觉）
   */
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

  /**
   * 创建 3D 风格的标题（登录）界面
   */
  public showTitleScreen(
    onHost: (nickname: string) => void,
    onJoin: (nickname: string, hostId: string) => void
  ) {
    this.uiLayer.innerHTML = "";

    if (!this.scene || !this.camera || !this.uiRoot3D) {
      // 回退到原来的 DOM 版（防止场景未初始化时崩溃）
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

    // 清理旧的 3D UI
    this.uiRoot3D.clear();

    const panel = this.createPanel(8, 4.5);
    // 将面板整体抬高一些，方便相机从正前方看时不被起点方块挡住
    panel.position.set(0, 4.0, -10);
    this.uiRoot3D.add(panel);

    // 标题使用简单的 Sprite 文本（先用 DOM 文本代替）
    const titleDiv = document.createElement("div");
    titleDiv.className = "ui-title-overlay";
    titleDiv.innerText = "Ultimate Chicken Horse 3D";
    this.uiLayer.appendChild(titleDiv);

    let nickname = "Player" + Math.floor(Math.random() * 1000);

    // 简单昵称输入：点击标题面板上方的一条提示条弹出 prompt
    const nameHint = document.createElement("div");
    nameHint.className = "ui-name-hint ui-element";
    nameHint.innerText = `Nickname: ${nickname} (click to edit)`;
    nameHint.onclick = () => {
      const next = window.prompt("Enter your nickname", nickname) || nickname;
      nickname = next.trim() || nickname;
      nameHint.innerText = `Nickname: ${nickname} (click to edit)`;
    };
    this.uiLayer.appendChild(nameHint);

    // Host 按钮
    const hostBtn = this.createButtonPlane(2.4, 0.9, "HOST", () => {
      onHost(nickname);
    });
    hostBtn.position.set(-2.4, 3.3, -9.9);
    this.uiRoot3D.add(hostBtn);

    // Join 按钮（点击后用简单 prompt 输入 HostId）
    const joinBtn = this.createButtonPlane(2.4, 0.9, "JOIN", () => {
      const hostId = window.prompt("Enter Host ID:", "") || "";
      if (!hostId) return;
      onJoin(nickname, hostId);
    });
    joinBtn.position.set(2.4, 3.3, -9.9);
    this.uiRoot3D.add(joinBtn);
  }

  public showLobbyScreen(
    myId: string,
    players: any[],
    isHost: boolean,
    onCharacterSelect: (charId: string) => void,
    onStart: () => void
  ) {
    this.uiLayer.innerHTML = "";

    if (!this.scene || !this.camera || !this.uiRoot3D || !this.resources) {
      // 回退：简单 DOM 版本
      const fallback = document.createElement("div");
      fallback.className = "ui-fallback";
      fallback.innerText = "Lobby (fallback)";
      this.uiLayer.appendChild(fallback);
      return;
    }

    // 清理之前的角色模型
    this.cleanupLobbyCharacters();
    this.uiRoot3D.clear();

    // Host ID 区域：使用木牌样式 + 复制按钮
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

    // 获取所有角色定义
    const chars = listCharacterAppearances();
    const spacing = 2.2;
    const startX = -((chars.length - 1) * spacing) / 2;
    const charZ = -2; // 离相机更近

    // 创建角色选择区域 - 3D 模型一字排开
    chars.forEach((charAppearance, index) => {
      const charId = charAppearance.id;
      const xPos = startX + index * spacing;
      
      // 检查这个角色是否被某个玩家选中
      const selectedBy = players.find(p => p.character === charId);
      const isTaken = selectedBy !== undefined;
      const isMySelection = selectedBy && selectedBy.id === myId;

      // 创建角色 3D 模型
      const originalModel = this.resources!.models.get(charAppearance.modelKey);
      const animations = this.resources!.modelAnimations.get(charAppearance.modelKey);
      
      if (originalModel) {
        const charModel = SkeletonUtils.clone(originalModel) as THREE.Group;
        charModel.position.set(xPos, 0, charZ);
        charModel.rotation.y = 0; // 面向相机（模型默认朝向+Z）
        
        // 设置动画
        let mixer: THREE.AnimationMixer | null = null;
        if (animations && animations.length > 0) {
          mixer = new THREE.AnimationMixer(charModel);
          // 如果被选中，播放 dance 动画；否则播放 idle
          let clipToPlay: THREE.AnimationClip | undefined;
          if (isTaken) {
            clipToPlay = animations.find(a => a.name.toLowerCase().includes('dance'));
          }
          if (!clipToPlay) {
            clipToPlay = animations.find(a => a.name.toLowerCase().includes('idle'));
          }
          if (clipToPlay) {
            const action = mixer.clipAction(clipToPlay);
            action.play();
          }
        }

        // 如果被其他人选中，变灰
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

        // 创建名字标签（只有被选中时显示）
        let nameLabel: THREE.Sprite | null = null;
        if (selectedBy) {
          nameLabel = this.createTextSprite(selectedBy.nickname, isMySelection ? "#00ff00" : "#ff6600");
          nameLabel.position.set(xPos, 2.2, charZ);
          nameLabel.scale.set(2, 0.5, 1);
          this.scene!.add(nameLabel);
        }

        // 创建角色名称标签（底部）
        const charNameLabel = this.createTextSprite(charId.toUpperCase(), "#ffffff");
        charNameLabel.position.set(xPos, -0.3, charZ);
        charNameLabel.scale.set(1.5, 0.4, 1);
        this.scene!.add(charNameLabel);

        // 创建可点击区域
        const clickArea = new THREE.Mesh(
          new THREE.BoxGeometry(2, 3, 1),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        clickArea.position.set(xPos, 1, charZ);
        clickArea.userData.type = "button";
        clickArea.userData.charId = charId;
        clickArea.userData.onClick = () => {
          // 只有未被其他人选中的角色才能点击
          if (!isTaken || isMySelection) {
            onCharacterSelect(charId);
          }
        };
        this.uiRoot3D!.add(clickArea);

        // 存储模型引用以便后续更新/清理
        this.lobbyCharacterModels.set(charId, { 
          root: charModel, 
          mixer,
          nameLabel,
          charNameLabel
        });
      }
    });

    // Start / Waiting 区域
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

  private createTextSprite(text: string, color: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;
    
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.font = 'bold 32px Arial';
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    return new THREE.Sprite(material);
  }

  public cleanupLobbyCharacters() {
    this.lobbyCharacterModels.forEach(({ root, nameLabel, charNameLabel }) => {
      if (this.scene) {
        this.scene.remove(root);
        if (nameLabel) this.scene.remove(nameLabel);
        if (charNameLabel) this.scene.remove(charNameLabel);
      }
    });
    this.lobbyCharacterModels.clear();
    
    // 清理 uiRoot3D 中的所有元素
    if (this.uiRoot3D) {
      this.uiRoot3D.clear();
    }
  }

  public updateLobbyAnimations(dt: number) {
    this.lobbyCharacterModels.forEach(({ mixer }) => {
      if (mixer) {
        mixer.update(dt);
      }
    });
  }

  public updateScore(scores: { [id: string]: number }) {
    // Update score board
    console.log(scores);
  }

  public createItemPicker(onSelect: (itemId: string) => void) {
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

  public showItemPicker(show: boolean) {
    const picker = document.getElementById("item-picker");
    if (picker) {
      picker.style.display = show ? "flex" : "none";
    }
  }

  public clearUI() {
    this.uiLayer.innerHTML = "";
  }

  public showScoreScreen(
    scores: { 
      nickname: string; 
      current: number; 
      added: number;
      breakdown?: { type: string; points: number; color: string }[];
    }[],
    goalScore: number,
    onComplete: () => void
  ) {
    this.uiLayer.innerHTML = "";

    // === 核心尺寸定义（全部用 px）===
    const PX_PER_POINT = 10;              // 每 1 分 = 10px
    const MAX_POINTS = 60;                // 条条最大显示 60 分
    const BAR_WIDTH = MAX_POINTS * PX_PER_POINT; // 600px
    const GOAL_POS = goalScore * PX_PER_POINT;   // 50 分 = 500px
    const ROW_HEIGHT = 50;                // 每行高度
    const ROW_GAP = 20;                   // 行间距
    const NAME_WIDTH = 120;               // 名字区域宽度

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.top = "50%";
    container.style.left = "50%";
    container.style.transform = "translate(-50%, -50%)";
    container.style.backgroundColor = "#e8dcc8"; // 米黄色纸张背景
    container.style.padding = "40px";
    container.style.borderRadius = "0";
    container.style.color = "#333";
    container.style.fontFamily = '"Comic Sans MS", "Chalkboard SE", sans-serif';

    const title = document.createElement("h2");
    title.innerText = "Round Results";
    title.style.textAlign = "center";
    title.style.marginBottom = "30px";
    title.style.color = "#333";
    container.appendChild(title);

    // 图表容器
    const chartContainer = document.createElement("div");
    chartContainer.style.position = "relative";
    chartContainer.style.marginLeft = `${NAME_WIDTH}px`;
    chartContainer.style.width = `${BAR_WIDTH}px`;
    container.appendChild(chartContainer);

    // 刻度线（每10分一条虚线）
    for (let p = 10; p <= MAX_POINTS; p += 10) {
      const tick = document.createElement("div");
      tick.style.position = "absolute";
      tick.style.left = `${p * PX_PER_POINT}px`;
      tick.style.top = "0";
      tick.style.bottom = "0";
      tick.style.width = "1px";
      tick.style.borderLeft = "2px dashed #999";
      tick.style.zIndex = "5";
      chartContainer.appendChild(tick);

      // 刻度数字（底部）
      const label = document.createElement("div");
      label.innerText = `${p / 10}`;
      label.style.position = "absolute";
      label.style.left = `${p * PX_PER_POINT}px`;
      label.style.bottom = "-25px";
      label.style.transform = "translateX(-50%)";
      label.style.fontSize = "14px";
      label.style.color = "#666";
      chartContainer.appendChild(label);
    }

    // GOAL 线（深色粗实线）
    const goalLine = document.createElement("div");
    goalLine.style.position = "absolute";
    goalLine.style.left = `${GOAL_POS}px`;
    goalLine.style.top = "0";
    goalLine.style.bottom = "0";
    goalLine.style.width = "3px";
    goalLine.style.backgroundColor = "#333";
    goalLine.style.zIndex = "15";
    chartContainer.appendChild(goalLine);

    // 玩家基础颜色（手绘风格）
    const playerColors = ["#3b5998", "#e07020", "#2a9d4a", "#9b59b6"];

    // 收集所有得分类型用于分阶段动画
    const allScoreTypes: string[] = [];
    scores.forEach(s => {
      if (s.breakdown) {
        s.breakdown.forEach(b => {
          if (!allScoreTypes.includes(b.type)) {
            allScoreTypes.push(b.type);
          }
        });
      }
    });

    // 每个玩家的行
    scores.forEach((s, i) => {
      const rowTop = i * (ROW_HEIGHT + ROW_GAP);
      const baseColor = playerColors[i % playerColors.length];

      // 名字（左侧）
      const name = document.createElement("div");
      name.innerText = s.nickname;
      name.style.position = "absolute";
      name.style.left = `-${NAME_WIDTH}px`;
      name.style.top = `${rowTop}px`;
      name.style.width = `${NAME_WIDTH - 10}px`;
      name.style.height = `${ROW_HEIGHT}px`;
      name.style.lineHeight = `${ROW_HEIGHT}px`;
      name.style.textAlign = "right";
      name.style.fontWeight = "bold";
      name.style.fontSize = "16px";
      name.style.color = "#333";
      chartContainer.appendChild(name);

      // 基础分数条（斜线填充）- 上一轮累计的分数
      const baseScore = s.current - s.added;
      let currentLeft = 0;
      
      if (baseScore > 0) {
        const baseBar = document.createElement("div");
        baseBar.style.position = "absolute";
        baseBar.style.left = "0";
        baseBar.style.top = `${rowTop}px`;
        baseBar.style.width = `${baseScore * PX_PER_POINT}px`;
        baseBar.style.height = `${ROW_HEIGHT}px`;
        baseBar.style.backgroundColor = baseColor;
        baseBar.style.backgroundImage = `repeating-linear-gradient(
          45deg,
          transparent,
          transparent 4px,
          rgba(255,255,255,0.3) 4px,
          rgba(255,255,255,0.3) 8px
        )`;
        baseBar.style.border = `2px solid ${baseColor}`;
        baseBar.style.boxSizing = "border-box";
        chartContainer.appendChild(baseBar);
        currentLeft = baseScore * PX_PER_POINT;
      }

      // 按类型分阶段添加新增分数条
      if (s.breakdown && s.breakdown.length > 0) {
        let accumulatedLeft = currentLeft;
        
        s.breakdown.forEach((scoreItem, scoreIndex) => {
          const typeIndex = allScoreTypes.indexOf(scoreItem.type);
          const animDelay = typeIndex * 800 + 300; // 每种类型延迟 800ms
          
          const addedBar = document.createElement("div");
          addedBar.style.position = "absolute";
          addedBar.style.left = `${accumulatedLeft}px`;
          addedBar.style.top = `${rowTop}px`;
          addedBar.style.width = "0px"; // 初始为0，动画展开
          addedBar.style.height = `${ROW_HEIGHT}px`;
          addedBar.style.backgroundColor = scoreItem.color;
          addedBar.style.backgroundImage = `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 4px,
            rgba(255,255,255,0.3) 4px,
            rgba(255,255,255,0.3) 8px
          )`;
          addedBar.style.border = `2px solid ${scoreItem.color}`;
          addedBar.style.boxSizing = "border-box";
          addedBar.style.transition = "width 0.6s ease-out";
          addedBar.style.zIndex = `${10 - scoreIndex}`;
          chartContainer.appendChild(addedBar);

          // 动画展开
          setTimeout(() => {
            addedBar.style.width = `${scoreItem.points * PX_PER_POINT}px`;
          }, animDelay);

          accumulatedLeft += scoreItem.points * PX_PER_POINT;
        });
      }
    });

    // 显示得分类型标签（在动画时显示）
    const labelContainer = document.createElement("div");
    labelContainer.style.position = "relative";
    labelContainer.style.marginTop = "20px";
    labelContainer.style.textAlign = "center";
    labelContainer.style.minHeight = "30px";
    container.appendChild(labelContainer);

    allScoreTypes.forEach((type, index) => {
      setTimeout(() => {
        labelContainer.innerHTML = "";
        const typeLabel = document.createElement("span");
        typeLabel.innerText = `+ ${type}`;
        typeLabel.style.fontSize = "24px";
        typeLabel.style.fontWeight = "bold";
        // 根据类型设置颜色
        const typeColors: { [key: string]: string } = {
          "终点": "#4CAF50",
          "独行": "#2196F3", 
          "第一": "#FF9800",
          "陷阱": "#E91E63"
        };
        typeLabel.style.color = typeColors[type] || "#333";
        labelContainer.appendChild(typeLabel);
      }, index * 800 + 300);
    });

    // 设置图表容器高度
    const totalHeight = scores.length * (ROW_HEIGHT + ROW_GAP);
    chartContainer.style.height = `${totalHeight}px`;
    chartContainer.style.marginBottom = "40px";

    this.uiLayer.appendChild(container);

    // 动画完成后回调
    const totalAnimTime = allScoreTypes.length * 800 + 1500;
    setTimeout(() => {
      onComplete();
    }, totalAnimTime);
  }

  public showWinScreen(winnerName: string, onBackToLobby: () => void) {
    this.uiLayer.innerHTML = "";

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.top = "50%";
    container.style.left = "50%";
    container.style.transform = "translate(-50%, -50%)";
    container.style.backgroundColor = "rgba(0, 0, 0, 0.9)";
    container.style.padding = "60px";
    container.style.borderRadius = "15px";
    container.style.color = "white";
    container.style.textAlign = "center";
    container.style.border = "4px solid gold";
    container.style.pointerEvents = "auto"; // Enable interaction

    const title = document.createElement("h1");
    title.innerText = "WINNER!";
    title.style.fontSize = "48px";
    title.style.color = "gold";
    title.style.marginBottom = "20px";
    container.appendChild(title);

    const name = document.createElement("h2");
    name.innerText = winnerName;
    name.style.fontSize = "36px";
    name.style.marginBottom = "40px";
    container.appendChild(name);

    const btn = document.createElement("button");
    btn.innerText = "BACK TO LOBBY";
    btn.style.padding = "15px 30px";
    btn.style.fontSize = "20px";
    btn.style.cursor = "pointer";
    btn.style.backgroundColor = "#4CAF50";
    btn.style.color = "white";
    btn.style.border = "none";
    btn.style.borderRadius = "5px";
    btn.onclick = onBackToLobby;
    container.appendChild(btn);

    this.uiLayer.appendChild(container);
  }
}
