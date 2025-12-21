import * as THREE from "three";
import * as CANNON from "cannon-es";
import { Resources } from "../core/Resources";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { Crossbow } from "../objects/traps/Crossbow";

/**
 * 物品尺寸信息
 */
interface ItemSize {
  x: number;
  y: number;
  z: number;
}

/**
 * 建造系统：管理物品放置、预览、网格高亮等
 */
export class BuildSystem {
  private scene: THREE.Scene;
  private physicsWorld: PhysicsWorld;
  private resources: Resources;

  // 网格高亮
  private gridHighlightY: THREE.Mesh;
  private gridHighlightX: THREE.Mesh;
  private gridHighlightZ: THREE.Mesh;
  private gridHelper: THREE.GridHelper;

  // 建造状态
  public gridPos: THREE.Vector3 = new THREE.Vector3();
  public height: number = 0;
  public rotation: number = 0; // 0, 1, 2, 3 (* PI/2)
  public selectedItem: string | null = null;

  // 幽灵对象（预览）
  public ghostObject: THREE.Group | null = null;

  // 炸弹范围指示器
  private bombRangeIndicator: THREE.Mesh | null = null;
  private highlightedMeshes: Map<THREE.Mesh, number> = new Map();

  // 存储创建的十字弓引用（用于清理）
  private crossbows: Crossbow[] = [];

  constructor(
    scene: THREE.Scene,
    physicsWorld: PhysicsWorld,
    resources: Resources
  ) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.resources = resources;

    // Y 方向激光高亮
    this.gridHighlightY = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 100, 0.1),
      new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.5,
      })
    );
    this.scene.add(this.gridHighlightY);
    this.gridHighlightY.visible = false;

    // X 方向激光高亮
    this.gridHighlightX = new THREE.Mesh(
      new THREE.BoxGeometry(100, 0.1, 0.1),
      new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.5,
      })
    );
    this.scene.add(this.gridHighlightX);
    this.gridHighlightX.visible = false;

    // Z 方向激光高亮
    this.gridHighlightZ = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 100),
      new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.5,
      })
    );
    this.scene.add(this.gridHighlightZ);
    this.gridHighlightZ.visible = false;

    // 网格辅助线
    this.gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0x444444);
    this.gridHelper.position.y = 0.01;
    this.scene.add(this.gridHelper);
    this.gridHelper.visible = false;
  }

  /**
   * 获取物品的 Y 轴偏移
   */
  public getItemYShift(itemId: string): number {
    if (itemId === "spikes") {
      return -0.25;
    }
    return 0;
  }

  /**
   * 获取物品尺寸
   */
  public getItemSize(itemId: string, rotationIndex: number): ItemSize {
    if (itemId === "wood_block_321") {
      if (rotationIndex % 2 === 0) {
        return { x: 3, y: 1, z: 2 };
      } else {
        return { x: 2, y: 1, z: 3 };
      }
    } else if (itemId === "spikes") {
      return { x: 1, y: 1, z: 1 };
    }
    return { x: 1, y: 1, z: 1 };
  }

  /**
   * 从鼠标位置更新幽灵对象位置
   */
  public updateGhostPositionFromMouse(
    raycaster: THREE.Raycaster,
    mouse: THREE.Vector2,
    camera: THREE.Camera
  ): void {
    raycaster.setFromCamera(mouse, camera);
    const planeHeight = 8;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeHeight);
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, target);

    const size = this.getItemSize(this.selectedItem || "", this.rotation);

    // 对齐网格
    const snapX =
      size.x % 2 === 0 ? Math.round(target.x) : Math.floor(target.x) + 0.5;
    const snapZ =
      size.z % 2 === 0 ? Math.round(target.z) : Math.floor(target.z) + 0.5;

    this.gridPos.set(snapX, this.height + 0.5, snapZ);
    this.updateLaserHighlights();

    if (this.ghostObject && this.selectedItem) {
      this.ghostObject.position.copy(this.gridPos);
      this.ghostObject.position.y += this.getItemYShift(this.selectedItem);
    }
  }

  /**
   * 更新激光高亮（带遮挡检测）
   */
  private updateLaserHighlights(): void {
    const pos = this.gridPos;
    const rayOrigin = new CANNON.Vec3(pos.x, pos.y, pos.z);

    // Y 方向激光
    let yPosHit = 50,
      yNegHit = -50;
    const rayYPos = new CANNON.RaycastResult();
    const rayYNeg = new CANNON.RaycastResult();

    this.physicsWorld.world.raycastClosest(
      rayOrigin,
      new CANNON.Vec3(pos.x, pos.y + 50, pos.z),
      { skipBackfaces: true },
      rayYPos
    );
    if (rayYPos.hasHit) yPosHit = rayYPos.hitPointWorld.y - pos.y;

    this.physicsWorld.world.raycastClosest(
      rayOrigin,
      new CANNON.Vec3(pos.x, pos.y - 50, pos.z),
      { skipBackfaces: true },
      rayYNeg
    );
    if (rayYNeg.hasHit) yNegHit = rayYNeg.hitPointWorld.y - pos.y;

    const yLength = yPosHit - yNegHit;
    const yCenter = pos.y + (yPosHit + yNegHit) / 2;
    this.gridHighlightY.scale.y = yLength / 100;
    this.gridHighlightY.position.set(pos.x, yCenter, pos.z);
    this.gridHighlightY.visible = true;

    // X 方向激光
    let xPosHit = 50,
      xNegHit = -50;
    const rayXPos = new CANNON.RaycastResult();
    const rayXNeg = new CANNON.RaycastResult();

    this.physicsWorld.world.raycastClosest(
      rayOrigin,
      new CANNON.Vec3(pos.x + 50, pos.y, pos.z),
      { skipBackfaces: true },
      rayXPos
    );
    if (rayXPos.hasHit) xPosHit = rayXPos.hitPointWorld.x - pos.x;

    this.physicsWorld.world.raycastClosest(
      rayOrigin,
      new CANNON.Vec3(pos.x - 50, pos.y, pos.z),
      { skipBackfaces: true },
      rayXNeg
    );
    if (rayXNeg.hasHit) xNegHit = rayXNeg.hitPointWorld.x - pos.x;

    const xLength = xPosHit - xNegHit;
    const xCenter = pos.x + (xPosHit + xNegHit) / 2;
    this.gridHighlightX.scale.x = xLength / 100;
    this.gridHighlightX.position.set(xCenter, pos.y, pos.z);
    this.gridHighlightX.visible = true;

    // Z 方向激光
    let zPosHit = 50,
      zNegHit = -50;
    const rayZPos = new CANNON.RaycastResult();
    const rayZNeg = new CANNON.RaycastResult();

    this.physicsWorld.world.raycastClosest(
      rayOrigin,
      new CANNON.Vec3(pos.x, pos.y, pos.z + 50),
      { skipBackfaces: true },
      rayZPos
    );
    if (rayZPos.hasHit) zPosHit = rayZPos.hitPointWorld.z - pos.z;

    this.physicsWorld.world.raycastClosest(
      rayOrigin,
      new CANNON.Vec3(pos.x, pos.y, pos.z - 50),
      { skipBackfaces: true },
      rayZNeg
    );
    if (rayZNeg.hasHit) zNegHit = rayZNeg.hitPointWorld.z - pos.z;

    const zLength = zPosHit - zNegHit;
    const zCenter = pos.z + (zPosHit + zNegHit) / 2;
    this.gridHighlightZ.scale.z = zLength / 100;
    this.gridHighlightZ.position.set(pos.x, pos.y, zCenter);
    this.gridHighlightZ.visible = true;
  }

  /**
   * 显示/隐藏高亮
   */
  public setHighlightVisible(visible: boolean): void {
    this.gridHighlightY.visible = visible;
    this.gridHighlightX.visible = visible;
    this.gridHighlightZ.visible = visible;
  }

  /**
   * 显示/隐藏网格辅助线
   */
  public setGridHelperVisible(visible: boolean): void {
    this.gridHelper.visible = visible;
  }

  /**
   * 调整建造高度
   */
  public adjustHeight(delta: number): void {
    this.height += delta;
    this.height = Math.max(0, Math.min(15, this.height));
    this.gridPos.y = this.height + 0.5;

    if (this.ghostObject && this.selectedItem) {
      this.ghostObject.position.copy(this.gridPos);
      this.ghostObject.position.y += this.getItemYShift(this.selectedItem);
    }
    this.updateLaserHighlights();
  }

  /**
   * 旋转物品
   */
  public rotate(): void {
    this.rotation = (this.rotation + 1) % 4;
    if (this.ghostObject) {
      this.updateGhostRotation();
    }
  }

  /**
   * 更新幽灵对象旋转
   */
  public updateGhostRotation(): void {
    if (!this.ghostObject || !this.selectedItem) return;

    this.ghostObject.rotation.set(0, 0, 0);
    const q = new THREE.Quaternion();
    q.setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      (this.rotation * Math.PI) / 2
    );
    this.ghostObject.applyQuaternion(q);
  }

  /**
   * 创建幽灵对象
   */
  public createGhost(): void {
    if (!this.selectedItem) return;

    if (this.ghostObject) {
      this.scene.remove(this.ghostObject);
    }

    this.ghostObject =
      this.resources.models.get(this.selectedItem)?.clone() || null;

    if (this.ghostObject) {
      this.updateGhostRotation();
      this.ghostObject.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = child.material.clone();
          child.material.transparent = true;
          child.material.opacity = 0.5;
        }
      });
      this.scene.add(this.ghostObject);
    }
  }

  /**
   * 移除幽灵对象
   */
  public removeGhost(): void {
    if (this.ghostObject) {
      this.scene.remove(this.ghostObject);
      this.ghostObject = null;
    }
  }

  /**
   * 验证放置是否有效
   */
  public isValidPlacement(itemId: string, position: THREE.Vector3): boolean {
    // 1. AABB 重叠检测
    let halfExtents = new CANNON.Vec3(0.45, 0.45, 0.45);

    if (itemId === "wood_block_321") {
      if (this.rotation % 2 === 0) {
        halfExtents.set(1.45, 0.45, 0.95);
      } else {
        halfExtents.set(0.95, 0.45, 1.45);
      }
    } else if (itemId === "spikes") {
      halfExtents.set(0.45, 0.24, 0.45);
    } else if (itemId === "crossbow") {
      halfExtents.set(0.45, 0.45, 0.45);
    }

    const placeAABB = new CANNON.AABB({
      lowerBound: new CANNON.Vec3(
        position.x - halfExtents.x,
        position.y - halfExtents.y,
        position.z - halfExtents.z
      ),
      upperBound: new CANNON.Vec3(
        position.x + halfExtents.x,
        position.y + halfExtents.y,
        position.z + halfExtents.z
      ),
    });

    let overlap = false;
    this.physicsWorld.world.bodies.forEach((b) => {
      if (placeAABB.overlaps(b.aabb)) {
        overlap = true;
      }
    });
    if (overlap) return false;

    // 2. 支撑检测
    if (itemId === "wood_block_321" || itemId === "crossbow") return true;

    if (itemId === "spikes") {
      const start = new CANNON.Vec3(position.x, position.y, position.z);
      const end = new CANNON.Vec3(position.x, position.y - 1.0, position.z);

      const result = new CANNON.RaycastResult();
      this.physicsWorld.world.raycastClosest(
        start,
        end,
        { collisionFilterMask: -1, skipBackfaces: true },
        result
      );

      return result.hasHit;
    }

    return false;
  }

  /**
   * 放置物品
   */
  public placeObject(
    itemId: string,
    position: THREE.Vector3,
    rotationIndex: number = 0
  ): Crossbow | null {
    let mesh: THREE.Group | undefined;
    let body: CANNON.Body | undefined;
    let shape: CANNON.Shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
    let offset = new CANNON.Vec3(0, 0, 0);
    let mass = 0;
    let tag = "block";

    if (itemId === "wood_block_321") {
      mesh = this.resources.models.get("wood_block_321")?.clone();
      if (rotationIndex % 2 === 0) {
        shape = new CANNON.Box(new CANNON.Vec3(1.5, 0.5, 1.0));
      } else {
        shape = new CANNON.Box(new CANNON.Vec3(1.0, 0.5, 1.5));
      }
    } else if (itemId === "spikes") {
      mesh = this.resources.models.get("spikes")?.clone();
      shape = new CANNON.Box(new CANNON.Vec3(0.45, 0.25, 0.45));
      tag = "trap";
    } else if (itemId === "crossbow") {
      mesh = this.resources.models.get("crossbow")?.clone();
      shape = new CANNON.Box(new CANNON.Vec3(1.0, 1.0, 1.0));
      tag = "block";
    }

    if (mesh) {
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.material) {
            child.material = child.material.clone();
          }
        }
      });

      mesh.position.copy(position);
      mesh.rotation.set(0, 0, 0);

      const q = new THREE.Quaternion();
      q.setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        (rotationIndex * Math.PI) / 2
      );
      mesh.applyQuaternion(q);

      body = new CANNON.Body({ mass: mass });

      if (itemId === "crossbow") {
        body.quaternion.set(q.x, q.y, q.z, q.w);
      }

      let bodyY = mesh.position.y;
      body.addShape(shape, offset);
      body.position.set(mesh.position.x, bodyY, mesh.position.z);

      console.log(
        `Placed ${itemId} at mesh.y=${mesh.position.y.toFixed(
          3
        )}, body.y=${body.position.y.toFixed(3)}, halfHeight=${
          (shape as CANNON.Box).halfExtents.y
        }`
      );

      if (tag) (body as any).userData = { tag: tag, owner: "local" };
      (body as any).meshReference = mesh;
      body.material = this.physicsWorld.world.defaultMaterial;

      this.scene.add(mesh);
      this.physicsWorld.world.addBody(body);

      if (itemId === "crossbow") {
        const arrowModel = this.resources.models.get("arrow");
        if (arrowModel) {
          const crossbow = new Crossbow(
            mesh,
            body,
            arrowModel,
            this.scene,
            this.physicsWorld.world
          );
          this.crossbows.push(crossbow);
          return crossbow;
        }
      }
    }

    return null;
  }

  /**
   * 更新幽灵对象的有效性颜色
   */
  public updateGhostValidityColor(): void {
    if (!this.ghostObject || !this.selectedItem) return;

    const isValid = this.isValidPlacement(
      this.selectedItem,
      this.ghostObject.position
    );

    this.ghostObject.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if ((child.material as any).color) {
          (child.material as any).color.setHex(isValid ? 0xffffff : 0xff0000);
        }
      }
    });
  }

  /**
   * 更新炸弹范围指示器和高亮目标
   */
  public updateBombIndicator(): void {
    if (!this.ghostObject || !this.selectedItem) return;

    if (this.selectedItem === "bomb") {
      if (!this.bombRangeIndicator) {
        this.bombRangeIndicator = new THREE.Mesh(
          new THREE.SphereGeometry(3, 16, 16),
          new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.3,
            wireframe: true,
          })
        );
        this.scene.add(this.bombRangeIndicator);
      }
      this.bombRangeIndicator.position.copy(this.ghostObject.position);
      this.bombRangeIndicator.visible = true;

      // 清除旧的高亮
      this.highlightedMeshes.forEach((color, mesh) => {
        if ((mesh.material as any).color) {
          (mesh.material as any).color.setHex(color);
        }
      });
      this.highlightedMeshes.clear();

      // 查找新的目标
      const range = 3;
      this.physicsWorld.world.bodies.forEach((b) => {
        if (
          b.position.distanceTo(
            new CANNON.Vec3(
              this.ghostObject!.position.x,
              this.ghostObject!.position.y,
              this.ghostObject!.position.z
            )
          ) < range
        ) {
          const userData = (b as any).userData;
          if (
            userData &&
            userData.tag !== "ground" &&
            userData.tag !== "player" &&
            userData.tag !== "goal"
          ) {
            const mesh = (b as any).meshReference as THREE.Mesh;
            if (mesh) {
              mesh.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                  if (!this.highlightedMeshes.has(child)) {
                    this.highlightedMeshes.set(
                      child,
                      (child.material as any).color.getHex()
                    );
                    (child.material as any).color.setHex(0xff0000);
                  }
                }
              });
            }
          }
        }
      });
    } else {
      this.hideBombIndicator();
    }
  }

  /**
   * 隐藏炸弹范围指示器
   */
  public hideBombIndicator(): void {
    if (this.bombRangeIndicator) {
      this.bombRangeIndicator.visible = false;
    }
    this.highlightedMeshes.forEach((color, mesh) => {
      if ((mesh.material as any).color) {
        (mesh.material as any).color.setHex(color);
      }
    });
    this.highlightedMeshes.clear();
  }

  /**
   * 重置建造状态
   */
  public reset(): void {
    this.selectedItem = null;
    this.rotation = 0;
    this.height = 0;
    this.removeGhost();
    this.setHighlightVisible(false);
    this.hideBombIndicator();
  }

  /**
   * 获取所有十字弓
   */
  public getCrossbows(): Crossbow[] {
    return this.crossbows;
  }

  /**
   * 清理所有十字弓
   */
  public clearCrossbows(): void {
    this.crossbows.forEach((c) => c.cleanup());
    this.crossbows = [];
  }
}
