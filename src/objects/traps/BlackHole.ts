import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * 黑洞工具：吸引周围玩家，玩家被吸入后死亡
 */
export class BlackHole {
  public mesh: THREE.Group;
  public body: CANNON.Body;
  private rotationSpeed: number = 5; // 快速旋转
  private pullRadius: number = 8; // 吸引范围
  private pullForce: number = 15; // 吸引力强度
  private killRadius: number = 0.8; // 死亡半径（被吸入）
  public owner: string;

  constructor(
    mesh: THREE.Group,
    body: CANNON.Body,
    _world: CANNON.World, // 保留参数以便未来扩展
    owner: string = "local"
  ) {
    this.mesh = mesh;
    this.body = body;
    this.owner = owner;

    // 设置标签
    (this.body as any).userData = { 
      tag: "black_hole", 
      owner: owner 
    };
    (this.body as any).meshReference = this.mesh;
  }

  /**
   * 更新黑洞状态
   * @param dt 时间间隔
   * @param playerBodies 所有玩家的物理body
   */
  public update(dt: number, playerBodies: CANNON.Body[]): void {
    // 快速横向旋转
    this.mesh.rotation.y += this.rotationSpeed * dt;

    // 对周围玩家施加吸引力
    const holePos = this.body.position;
    
    for (const playerBody of playerBodies) {
      const playerPos = playerBody.position;
      const dx = holePos.x - playerPos.x;
      const dy = holePos.y - playerPos.y;
      const dz = holePos.z - playerPos.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance < this.pullRadius && distance > 0.01) {
        // 计算吸引力方向（指向黑洞）
        const dirX = dx / distance;
        const dirY = dy / distance;
        const dirZ = dz / distance;

        // 吸引力随距离减小而增大（平方反比，但有最大值限制）
        const forceMagnitude = Math.min(
          this.pullForce * (1 / Math.max(distance * distance, 0.5)),
          this.pullForce * 2
        );

        // 施加力
        playerBody.applyForce(
          new CANNON.Vec3(
            dirX * forceMagnitude,
            dirY * forceMagnitude * 0.5 + 2.0, // Y方向增加微小向上力，使玩家稍微离地，从而打破地面摩擦
            dirZ * forceMagnitude
          ),
          playerBody.position
        );

        // 标记玩家受到外部强力影响，使其进入"滑行"模式（类似冰面），从而让力能生效
        (playerBody as any).userData.externalForceActive = true;
      }
    }
  }

  /**
   * 检查玩家是否在死亡范围内
   */
  public isPlayerInKillZone(playerPos: CANNON.Vec3): boolean {
    const holePos = this.body.position;
    const dx = holePos.x - playerPos.x;
    const dy = holePos.y - playerPos.y;
    const dz = holePos.z - playerPos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return distance < this.killRadius;
  }

  /**
   * 获取黑洞位置
   */
  public getPosition(): CANNON.Vec3 {
    return this.body.position;
  }

  /**
   * 清理黑洞
   */
  public cleanup(): void {
    // 清理逻辑（如果需要）
  }
}
