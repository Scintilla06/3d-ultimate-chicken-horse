import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * 金币工具：第一个捡到的玩家在回合结束后获得额外分数
 */
export class GoldCoin {
  public mesh: THREE.Group;
  public body: CANNON.Body;
  private rotationSpeed: number = 1; // 缓慢旋转
  private collectRadius: number = 1.2; // 收集范围
  public isCollected: boolean = false;
  public collectedBy: string | null = null;
  public owner: string;

  public onCollect?: (playerId: string) => void;

  constructor(
    mesh: THREE.Group,
    body: CANNON.Body,
    owner: string = "local"
  ) {
    this.mesh = mesh;
    this.body = body;
    this.owner = owner;

    // 设置标签
    (this.body as any).userData = { 
      tag: "gold_coin", 
      owner: owner,
      collected: false
    };
    (this.body as any).meshReference = this.mesh;
    
    // 金币不需要碰撞响应（玩家可以穿过它）
    this.body.collisionResponse = false;
  }

  /**
   * 更新金币状态
   * @param dt 时间间隔
   */
  public update(dt: number): void {
    if (this.isCollected) return;
    
    // 缓慢横向旋转
    this.mesh.rotation.y += this.rotationSpeed * dt;
  }

  /**
   * 检查并处理玩家收集
   * @param playerId 玩家ID
   * @param playerPos 玩家位置
   * @returns 是否被收集
   */
  public checkAndCollect(playerId: string, playerPos: CANNON.Vec3): boolean {
    if (this.isCollected) return false;

    const coinPos = this.body.position;
    const dx = coinPos.x - playerPos.x;
    const dy = coinPos.y - playerPos.y;
    const dz = coinPos.z - playerPos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance < this.collectRadius) {
      this.collect(playerId);
      return true;
    }
    return false;
  }

  /**
   * 收集金币
   */
  private collect(playerId: string): void {
    this.isCollected = true;
    this.collectedBy = playerId;
    this.mesh.visible = false;
    (this.body as any).userData.collected = true;
    this.onCollect?.(playerId);
  }

  /**
   * 获取金币位置
   */
  public getPosition(): CANNON.Vec3 {
    return this.body.position;
  }

  /**
   * 重置金币状态（新回合时）
   */
  public reset(): void {
    this.isCollected = false;
    this.collectedBy = null;
    this.mesh.visible = true;
    (this.body as any).userData.collected = false;
  }

  /**
   * 清理金币
   */
  public cleanup(): void {
    // 清理逻辑（如果需要）
  }
}
