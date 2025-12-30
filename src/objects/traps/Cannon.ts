import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * 大炮工具：玩家碰到后进入大炮，随即以45度角射出
 */
export class Cannon {
  public mesh: THREE.Group;
  public body: CANNON.Body;
  private launchSpeed: number = 25; // 发射初速度（较大）
  private launchAngle: number = Math.PI / 4; // 45度角
  private cooldown: number = 0; // 冷却时间
  private cooldownDuration: number = 0.5; // 冷却持续时间
  public owner: string;
  private rotationY: number; // 大炮朝向（用于计算发射方向）

  // 延迟发射相关
  private launchDelay: number = 0.5;
  private capturedPlayerId: string | null = null;
  private capturedPlayerBody: CANNON.Body | null = null;
  private delayTimer: number = 0;

  public onLaunch?: (playerId: string) => void;
  public onCapture?: (playerId: string) => void;

  constructor(
    mesh: THREE.Group,
    body: CANNON.Body,
    rotationY: number = 0,
    owner: string = "local"
  ) {
    this.mesh = mesh;
    this.body = body;
    this.rotationY = rotationY;
    this.owner = owner;

    // 设置标签
    (this.body as any).userData = { 
      tag: "cannon", 
      owner: owner 
    };
    (this.body as any).meshReference = this.mesh;
    
    // 大炮不需要碰撞响应（玩家可以进入）
    this.body.collisionResponse = false;
  }

  /**
   * 更新大炮状态
   * @param dt 时间间隔
   */
  public update(dt: number): void {
    if (this.cooldown > 0) {
      this.cooldown -= dt;
    }

    // 处理延迟发射
    if (this.capturedPlayerId && this.capturedPlayerBody) {
      this.delayTimer -= dt;
      
      // 将玩家固定在大炮位置（稍微抬高一点，避免穿模）
      this.capturedPlayerBody.position.set(
        this.body.position.x,
        this.body.position.y + 0.5,
        this.body.position.z
      );
      this.capturedPlayerBody.velocity.set(0, 0, 0);
      
      if (this.delayTimer <= 0) {
        this.launchPlayer(this.capturedPlayerId, this.capturedPlayerBody);
        this.capturedPlayerId = null;
        this.capturedPlayerBody = null;
      }
    }
  }

  /**
   * 检查并发射玩家（实际上是捕获玩家，延迟后发射）
   * @param playerId 玩家ID
   * @param playerBody 玩家物理body
   * @returns 是否成功捕获
   */
  public checkAndLaunch(playerId: string, playerBody: CANNON.Body): boolean {
    if (this.cooldown > 0 || this.capturedPlayerId !== null) return false;

    const cannonPos = this.body.position;
    const playerPos = playerBody.position;
    
    // 检查玩家是否在大炮范围内
    const dx = cannonPos.x - playerPos.x;
    const dy = cannonPos.y - playerPos.y;
    const dz = cannonPos.z - playerPos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance < 1.5) { // 进入大炮的范围
      // 捕获玩家
      this.capturedPlayerId = playerId;
      this.capturedPlayerBody = playerBody;
      this.delayTimer = this.launchDelay;
      
      if (this.onCapture) {
        this.onCapture(playerId);
      }
      return true;
    }
    return false;
  }

  /**
   * 发射玩家
   */
  private launchPlayer(playerId: string, playerBody: CANNON.Body): void {
    // 设置冷却
    this.cooldown = this.cooldownDuration;

    // 触发回调
    if (this.onLaunch) {
      this.onLaunch(playerId);
    }

    // 计算发射方向（基于大炮朝向和45度仰角）
    // 水平方向基于 rotationY
    const horizontalX = -Math.sin(this.rotationY);
    const horizontalZ = -Math.cos(this.rotationY);
    
    // 45度角发射，cos(45°) ≈ 0.707
    const horizontalFactor = Math.cos(this.launchAngle);
    const verticalFactor = Math.sin(this.launchAngle);

    const launchVelX = horizontalX * horizontalFactor * this.launchSpeed;
    const launchVelY = verticalFactor * this.launchSpeed;
    const launchVelZ = horizontalZ * horizontalFactor * this.launchSpeed;

    // 将玩家传送到大炮位置上方
    playerBody.position.set(
      this.body.position.x,
      this.body.position.y + 1.5,
      this.body.position.z
    );

    // 设置玩家速度
    playerBody.velocity.set(launchVelX, launchVelY, launchVelZ);
    
    // 清除角速度
    playerBody.angularVelocity.set(0, 0, 0);

    this.onLaunch?.(playerId);
  }

  /**
   * 获取大炮位置
   */
  public getPosition(): CANNON.Vec3 {
    return this.body.position;
  }

  /**
   * 获取发射方向（用于视觉效果）
   */
  public getLaunchDirection(): THREE.Vector3 {
    const horizontalX = -Math.sin(this.rotationY);
    const horizontalZ = -Math.cos(this.rotationY);
    const horizontalFactor = Math.cos(this.launchAngle);
    const verticalFactor = Math.sin(this.launchAngle);

    return new THREE.Vector3(
      horizontalX * horizontalFactor,
      verticalFactor,
      horizontalZ * horizontalFactor
    ).normalize();
  }

  /**
   * 清理大炮
   */
  public cleanup(): void {
    // 清理逻辑（如果需要）
  }
}
