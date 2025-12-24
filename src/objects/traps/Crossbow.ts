import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Arrow } from './Arrow';

export class Crossbow {
  public mesh: THREE.Group;
  public body: CANNON.Body;
  private fireRate: number = 0.5; // 1 arrow every 2 seconds
  private timeSinceLastFire: number = 0;
  private arrowModel: THREE.Group;
  private arrows: Arrow[] = [];
  private scene: THREE.Scene;
  private world: CANNON.World;

  public onFire?: () => void;
  public onArrowHit?: (info: { tag?: string }) => void;

  constructor(
    mesh: THREE.Group,
    body: CANNON.Body,
    arrowModel: THREE.Group,
    scene: THREE.Scene,
    world: CANNON.World
  ) {
    this.mesh = mesh;
    this.body = body;
    this.arrowModel = arrowModel;
    this.scene = scene;
    this.world = world;

    // Tag
    (this.body as any).userData = { tag: "block" };
  }

  public update(dt: number) {
    this.timeSinceLastFire += dt;
    if (this.timeSinceLastFire >= 1 / this.fireRate) {
      this.fire();
      this.timeSinceLastFire = 0;
    }

    // Update arrows
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const arrow = this.arrows[i];
      arrow.update(dt);
      if (arrow.shouldRemove) {
        this.removeArrow(arrow);
        this.arrows.splice(i, 1);
      }
    }
  }

  private fire() {
    // Calculate direction from body rotation
    const rotation = new THREE.Quaternion();
    rotation.copy(this.body.quaternion as any);

    // Assuming the model faces +Z, but user wants reverse speed
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(rotation);

    // Spawn position: slightly in front
    const position = new THREE.Vector3();
    position.copy(this.body.position as any);
    // Model is 2x larger, so we need to spawn arrow further out to avoid clipping
    // Original offset 0.6 -> New offset 1.2
    position.add(direction.clone().multiplyScalar(1.2));

    const arrow = new Arrow(this.arrowModel, position, direction);
    arrow.onHit = (info) => this.onArrowHit?.(info);
    arrow.setWorld(this.world); // 传递 world 引用给箭矢
    this.scene.add(arrow.mesh);
    this.world.addBody(arrow.body);
    this.arrows.push(arrow);

    this.onFire?.();
  }

  private removeArrow(arrow: Arrow) {
    this.scene.remove(arrow.mesh);
    this.world.removeBody(arrow.body);
  }

  public cleanup() {
    this.arrows.forEach((arrow) => this.removeArrow(arrow));
    this.arrows = [];
  }
}
