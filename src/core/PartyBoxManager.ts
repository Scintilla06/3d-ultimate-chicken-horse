import * as THREE from "three";
import { Resources } from "./Resources";

/**
 * Party Box 物品数据
 */
export interface PartyBoxItemData {
  id: string;
  pos: number[];
  rot: number;
}

/**
 * Party Box 管理器：管理物品生成、选择和显示
 */
export class PartyBoxManager {
  private resources: Resources;
  private partyBoxRoot: THREE.Group;

  // 可用物品列表
  private static readonly ALL_ITEMS = ["wood_block_321", "spikes", "crossbow"];

  // 当前物品
  private items: THREE.Group[] = [];
  private availableItems: Set<string> = new Set();

  // 回合计数
  private currentRound: number = 0;

  constructor(resources: Resources, partyBoxRoot: THREE.Group) {
    this.resources = resources;
    this.partyBoxRoot = partyBoxRoot;
  }

  /**
   * 生成 Party Box 物品
   */
  public generateItems(playerCount: number): PartyBoxItemData[] {
    const numItems = playerCount + 2;
    const selectedItems: PartyBoxItemData[] = [];
    const boxPos = new THREE.Vector3(12, 0, -6);

    this.currentRound++;

    // 第一轮保证至少有一个木块
    let guaranteedBlock = false;
    if (this.currentRound === 1) {
      const xOffset = (Math.random() - 0.5) * 10;
      const zOffset = (Math.random() - 0.5) * 6;
      const yRot = Math.random() * Math.PI * 2;
      selectedItems.push({
        id: "wood_block_321",
        pos: [boxPos.x + xOffset, boxPos.y + 0.5, boxPos.z + zOffset],
        rot: yRot,
      });
      guaranteedBlock = true;
    }

    const remainingItems = guaranteedBlock ? numItems - 1 : numItems;
    for (let i = 0; i < remainingItems; i++) {
      const id =
        PartyBoxManager.ALL_ITEMS[
          Math.floor(Math.random() * PartyBoxManager.ALL_ITEMS.length)
        ];
      const xOffset = (Math.random() - 0.5) * 10;
      const zOffset = (Math.random() - 0.5) * 6;
      const yRot = Math.random() * Math.PI * 2;

      selectedItems.push({
        id: id,
        pos: [boxPos.x + xOffset, boxPos.y + 0.5, boxPos.z + zOffset],
        rot: yRot,
      });
    }

    return selectedItems;
  }

  /**
   * 生成物品并显示
   */
  public spawnItems(itemsData: PartyBoxItemData[]): void {
    this.clearItems();

    itemsData.forEach((data, index) => {
      const mesh = this.resources.models.get(data.id)?.clone();
      if (mesh) {
        const container = new THREE.Group();
        container.add(mesh);
        container.position.set(data.pos[0], data.pos[1], data.pos[2]);
        container.rotation.y = data.rot;
        container.userData = { itemId: data.id };

        this.partyBoxRoot.add(container);
        this.items.push(container);
        this.availableItems.add(index.toString());
      }
    });
  }

  /**
   * 清理所有物品
   */
  public clearItems(): void {
    this.items.forEach((item) => this.partyBoxRoot.remove(item));
    this.items = [];
    this.availableItems.clear();
  }

  /**
   * 更新物品旋转动画
   */
  public updateItemsRotation(): void {
    this.items.forEach((item) => {
      item.rotation.y += 0.01;
    });
  }

  /**
   * 检查物品是否可用
   */
  public isItemAvailable(index: number): boolean {
    return this.availableItems.has(index.toString());
  }

  /**
   * 标记物品已被选择
   */
  public markItemPicked(index: number): void {
    this.availableItems.delete(index.toString());
    if (this.items[index]) {
      this.items[index].visible = false;
    }
  }

  /**
   * 获取物品的 itemId
   */
  public getItemId(index: number): string | null {
    const item = this.items[index];
    return item?.userData?.itemId || null;
  }

  /**
   * 获取物品列表
   */
  public getItems(): THREE.Group[] {
    return this.items;
  }

  /**
   * 在指定索引处查找物品
   */
  public findItemIndex(target: THREE.Object3D): number {
    return this.items.indexOf(target as THREE.Group);
  }

  /**
   * 重置回合计数
   */
  public resetRoundCount(): void {
    this.currentRound = 0;
  }

  /**
   * 获取当前回合
   */
  public getCurrentRound(): number {
    return this.currentRound;
  }
}
