import { MAP_LIST, MapDefinition } from "../../core/maps/MapDefinition";

/**
 * Map Selector Component
 */
export class MapSelector {
  private container: HTMLElement | null = null;
  private selectedMapId: string = "";
  private onSelectCallback: ((mapId: string) => void) | null = null;

  constructor() {}

  /**
   * Show map selection interface
   */
  public show(
    parent: HTMLElement,
    onSelect: (mapId: string) => void,
    currentSelection?: string
  ): void {
    this.onSelectCallback = onSelect;
    this.selectedMapId = currentSelection || "";

    this.container = document.createElement("div");
    this.container.className = "map-selector ui-element";

    const title = document.createElement("h3");
    title.className = "map-selector-title";
    title.innerText = "Select Map";
    this.container.appendChild(title);

    const mapsContainer = document.createElement("div");
    mapsContainer.className = "map-selector-maps";

    MAP_LIST.forEach((mapDef) => {
      const card = this.createMapCard(mapDef);
      mapsContainer.appendChild(card);
    });

    this.container.appendChild(mapsContainer);
    parent.appendChild(this.container);

    this.updateSelection();
  }

  /**
   * 创建地图卡片
   */
  private createMapCard(mapDef: MapDefinition): HTMLElement {
    const card = document.createElement("div");
    card.className = "map-card";
    card.dataset.mapId = mapDef.id;

    // 预览颜色背景
    const preview = document.createElement("div");
    preview.className = "map-card-preview";
    preview.style.backgroundColor = `#${mapDef.previewColor.toString(16).padStart(6, "0")}`;
    card.appendChild(preview);

    // 地图名称
    const name = document.createElement("div");
    name.className = "map-card-name";
    name.innerText = mapDef.name;
    card.appendChild(name);

    // 描述
    const desc = document.createElement("div");
    desc.className = "map-card-desc";
    desc.innerText = mapDef.description;
    card.appendChild(desc);

    // 投票计数
    const voteCount = document.createElement("div");
    voteCount.className = "map-card-votes";
    voteCount.innerText = "0 votes";
    card.appendChild(voteCount);

    card.onclick = () => {
      this.selectedMapId = mapDef.id;
      this.updateSelection();
      if (this.onSelectCallback) {
        this.onSelectCallback(mapDef.id);
      }
    };

    return card;
  }

  /**
   * 更新选中状态
   */
  private updateSelection(): void {
    if (!this.container) return;

    const cards = this.container.querySelectorAll(".map-card");
    cards.forEach((card) => {
      const cardEl = card as HTMLElement;
      if (cardEl.dataset.mapId === this.selectedMapId) {
        cardEl.classList.add("selected");
      } else {
        cardEl.classList.remove("selected");
      }
    });
  }

  /**
   * 更新投票显示
   */
  public updateVotes(votes: { [playerId: string]: string }): void {
    if (!this.container) return;

    // 统计每个地图的投票数
    const voteCounts: { [mapId: string]: number } = {};
    MAP_LIST.forEach((m) => (voteCounts[m.id] = 0));

    Object.values(votes).forEach((mapId) => {
      if (voteCounts[mapId] !== undefined) {
        voteCounts[mapId]++;
      }
    });

    // 更新显示
    const cards = this.container.querySelectorAll(".map-card");
    cards.forEach((card) => {
      const cardEl = card as HTMLElement;
      const mapId = cardEl.dataset.mapId || "";
      const voteEl = cardEl.querySelector(".map-card-votes");
      if (voteEl) {
        const count = voteCounts[mapId] || 0;
        voteEl.textContent = `${count} vote${count !== 1 ? 's' : ''}`;
      }
    });
  }

  /**
   * 获取当前选择
   */
  public getSelectedMapId(): string {
    return this.selectedMapId;
  }

  /**
   * 隐藏地图选择界面
   */
  public hide(): void {
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
    this.container = null;
  }

  /**
   * 根据投票计算最终地图
   * 按照正比于选择该地图的玩家数量的概率抽取
   */
  public static chooseMapByVotes(votes: { [playerId: string]: string }): string {
    const voteCounts: { [mapId: string]: number } = {};
    MAP_LIST.forEach((m) => (voteCounts[m.id] = 0));

    Object.values(votes).forEach((mapId) => {
      if (voteCounts[mapId] !== undefined) {
        voteCounts[mapId]++;
      }
    });

    // 计算总票数
    let totalVotes = 0;
    for (const count of Object.values(voteCounts)) {
      totalVotes += count;
    }

    // 如果没有投票，随机选择
    if (totalVotes === 0) {
      const randomIndex = Math.floor(Math.random() * MAP_LIST.length);
      return MAP_LIST[randomIndex].id;
    }

    // 按概率选择
    const random = Math.random() * totalVotes;
    let cumulative = 0;

    for (const mapId of Object.keys(voteCounts)) {
      cumulative += voteCounts[mapId];
      if (random < cumulative) {
        return mapId;
      }
    }

    // 默认返回第一个
    return MAP_LIST[0].id;
  }
}
