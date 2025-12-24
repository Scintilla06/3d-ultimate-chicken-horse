import * as THREE from "three";
import * as CANNON from "cannon-es";

export class Arrow {
  public mesh: THREE.Group;
  public body: CANNON.Body;
  private speed: number = 8;
  private lifeTime: number = 3; // Seconds
  private age: number = 0;
  public shouldRemove: boolean = false;
  private stuck: boolean = false; // 是否已经插入道具
  private direction: THREE.Vector3;
  private world: CANNON.World | null = null;

  public onHit?: (info: { tag?: string }) => void;

  constructor(
    mesh: THREE.Group,
    position: THREE.Vector3,
    direction: THREE.Vector3
  ) {
    this.mesh = mesh.clone();
    this.mesh.position.copy(position);
    this.direction = direction.clone().normalize();

    // Rotate mesh to face direction
    // Assuming arrow model points along +Z. We look at the target point.
    const target = position.clone().add(direction);
    this.mesh.lookAt(target);

    // Save rotation for body (which aligns with flight direction Z)
    const bodyQuat = this.mesh.quaternion.clone();

    // Apply visual correction: Rotate 90 degrees left (around Y)
    this.mesh.rotateY(Math.PI / 2);

    // Create Body
    // Arrow shape: Box (Long in Z)
    // Model scaled 2x, so physics body should be larger
    // Original: 0.1, 0.1, 0.4 -> New: 0.2, 0.2, 0.8
    const shape = new CANNON.Box(new CANNON.Vec3(0.2, 0.2, 0.8));
    this.body = new CANNON.Body({
      mass: 1,
      type: CANNON.Body.KINEMATIC,
      shape: shape,
    });
    this.body.position.set(position.x, position.y, position.z);

    // Set velocity
    this.body.velocity.set(
      direction.x * this.speed,
      direction.y * this.speed,
      direction.z * this.speed
    );

    // Set rotation
    // Cannon body quaternion needs to match direction (Z-aligned)
    this.body.quaternion.set(bodyQuat.x, bodyQuat.y, bodyQuat.z, bodyQuat.w);

    // Tag for player collision
    (this.body as any).userData = { tag: "trap" };
    (this.body as any).meshReference = this.mesh;

    // Make it a sensor so it doesn't physically push things?
    // If it's Kinematic, it pushes Dynamic bodies.
    // If we want it to just kill, maybe set collisionResponse = false
    this.body.collisionResponse = false;
  }

  public setWorld(world: CANNON.World) {
    this.world = world;
  }

  public update(dt: number) {
    this.age += dt;
    if (this.age > this.lifeTime) {
      this.shouldRemove = true;
    }

    // 如果已经插入道具，不再移动
    if (this.stuck) return;

    // 检测前方是否有障碍物（使用射线检测）
    if (this.world) {
      const rayStart = new CANNON.Vec3(
        this.body.position.x,
        this.body.position.y,
        this.body.position.z
      );
      const rayEnd = new CANNON.Vec3(
        this.body.position.x + this.direction.x * this.speed * dt * 2,
        this.body.position.y + this.direction.y * this.speed * dt * 2,
        this.body.position.z + this.direction.z * this.speed * dt * 2
      );

      const result = new CANNON.RaycastResult();
      this.world.raycastClosest(
        rayStart,
        rayEnd,
        { skipBackfaces: true },
        result
      );

      if (result.hasHit) {
        const hitBody = result.body;
        const tag = (hitBody as any).userData?.tag;

        // 如果碰到的是 block 或 ground，箭矢停止
        if (tag === "block" || tag === "ground") {
          this.stuck = true;
          this.body.velocity.set(0, 0, 0);
          this.onHit?.({ tag });
          // 将箭矢位置设置到碰撞点稍前的位置
          this.body.position.set(
            result.hitPointWorld.x - this.direction.x * 0.3,
            result.hitPointWorld.y - this.direction.y * 0.3,
            result.hitPointWorld.z - this.direction.z * 0.3
          );
        }
      }
    }

    // Sync mesh with body
    this.mesh.position.copy(this.body.position as any);
    // Copy body quaternion then apply visual rotation correction
    this.mesh.quaternion.copy(this.body.quaternion as any);
    this.mesh.rotateY(Math.PI / 2);
  }
}
