import * as THREE from "three";
import * as CANNON from "cannon-es";
import { Resources } from "./Resources";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { BodyFactory } from "../physics/BodyFactory";
import { PlaceholderGenerator } from "../utils/PlaceholderGenerator";

/**
 * 关卡管理器：管理场景初始化、云朵、平台等
 */
export class LevelManager {
  private scene: THREE.Scene;
  private physicsWorld: PhysicsWorld;
  private resources: Resources;

  // 场景元素
  private mapRoot: THREE.Group;
  private clouds: THREE.Group[] = [];
  private partyBoxRoot: THREE.Group;

  constructor(
    scene: THREE.Scene,
    physicsWorld: PhysicsWorld,
    resources: Resources
  ) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.resources = resources;

    this.mapRoot = new THREE.Group();
    this.scene.add(this.mapRoot);

    this.partyBoxRoot = new THREE.Group();
    this.scene.add(this.partyBoxRoot);
    this.partyBoxRoot.visible = false;
  }

  /**
   * 初始化场景
   */
  public initScene(): void {
    // 天空颜色
    this.scene.background = new THREE.Color(0x6fb1ff);
    this.scene.fog = new THREE.Fog(0x8fd2ff, 60, 140);

    // 创建云朵
    this.createClouds();

    // 创建灯光
    this.createLights();

    // 创建关卡
    this.createLevel();

    // 创建 Party Box 区域
    this.createPartyBoxArea();
  }

  /**
   * 创建云朵
   */
  private createClouds(): void {
    const cloudModel = this.resources.models.get("cloud");

    for (let i = 0; i < 15; i++) {
      let cloud: THREE.Group;
      if (cloudModel) {
        cloud = cloudModel.clone();
      } else {
        cloud = PlaceholderGenerator.createCloud();
      }

      cloud.position.set(
        (Math.random() - 0.5) * 100,
        -10 + Math.random() * 5,
        (Math.random() - 0.5) * 60
      );

      cloud.rotation.y = Math.random() * Math.PI * 2;
      cloud.rotation.z = (Math.random() - 0.5) * 0.2;

      const scale = 0.8 + Math.random() * 1.2;
      cloud.scale.set(
        scale * (0.8 + Math.random() * 0.4),
        scale * (0.8 + Math.random() * 0.4),
        scale * (0.8 + Math.random() * 0.4)
      );

      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  /**
   * 创建灯光
   */
  private createLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
    directionalLight.position.set(20, 15, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.bias = -0.0005;
    this.scene.add(directionalLight);
  }

  /**
   * 创建关卡
   */
  private createLevel(): void {
    // 1. 起点平台
    const startPlatBody = BodyFactory.createBox(
      10,
      2,
      10,
      0,
      new CANNON.Vec3(0, -1, 0)
    );
    (startPlatBody as any).userData = { tag: "ground" };
    this.physicsWorld.world.addBody(startPlatBody);

    const platformModel = this.resources.models.get("platform");
    let startPlatMesh: THREE.Object3D;

    if (platformModel) {
      startPlatMesh = platformModel.clone();
      startPlatMesh.position.set(0, -0.45, 0);
    } else {
      const startPlatGeo = new THREE.BoxGeometry(10, 2, 10);
      const startPlatMat = new THREE.MeshStandardMaterial({
        map: this.resources.textures.get("default_grid"),
        color: 0x888888,
      });
      startPlatMesh = new THREE.Mesh(startPlatGeo, startPlatMat);
      startPlatMesh.position.y = -1;
    }

    startPlatMesh.receiveShadow = true;
    this.mapRoot.add(startPlatMesh);
    (startPlatBody as any).meshReference = startPlatMesh;

    // 2. 终点平台
    const goalPlatBody = BodyFactory.createBox(
      10,
      2,
      10,
      0,
      new CANNON.Vec3(0, 1, 25)
    );
    (goalPlatBody as any).userData = { tag: "ground" };
    this.physicsWorld.world.addBody(goalPlatBody);

    let goalPlatMesh: THREE.Object3D;
    if (platformModel) {
      goalPlatMesh = platformModel.clone();
      goalPlatMesh.position.set(0, 1.55, 25);
    } else {
      const goalPlatGeo = new THREE.BoxGeometry(10, 2, 10);
      const goalPlatMat = new THREE.MeshStandardMaterial({
        map: this.resources.textures.get("default_grid"),
        color: 0x888888,
      });
      goalPlatMesh = new THREE.Mesh(goalPlatGeo, goalPlatMat);
      goalPlatMesh.position.set(0, 1, 25);
    }

    goalPlatMesh.receiveShadow = true;
    this.mapRoot.add(goalPlatMesh);
    (goalPlatBody as any).meshReference = goalPlatMesh;

    // 3. 起点区域（蓝色）
    const startZone = PlaceholderGenerator.createZone(2, 2, 2, 0x0000ff);
    startZone.position.set(0, 1, 0);
    this.mapRoot.add(startZone);

    // 4. 终点区域（红色）
    const goalZone = PlaceholderGenerator.createZone(2, 2, 2, 0xff0000);
    goalZone.position.set(0, 3, 25);
    this.mapRoot.add(goalZone);

    // 5. 终点旗帜
    const flagGroup = PlaceholderGenerator.createFlag();
    flagGroup.position.set(0, 2, 25);
    this.mapRoot.add(flagGroup);

    // 6. 终点物理触发器
    const goalBody = BodyFactory.createBox(
      1,
      2,
      1,
      0,
      new CANNON.Vec3(0, 3, 25)
    );
    goalBody.isTrigger = true;
    (goalBody as any).userData = { tag: "goal" };
    this.physicsWorld.world.addBody(goalBody);
  }

  /**
   * 创建 Party Box 区域
   */
  private createPartyBoxArea(): void {
    const boxPos = new THREE.Vector3(12, 0, -6);
    const openBox = PlaceholderGenerator.createOpenBox();
    openBox.position.copy(boxPos);
    this.partyBoxRoot.add(openBox);
  }

  /**
   * 更新云朵动画
   */
  public updateClouds(): void {
    this.clouds.forEach((cloud) => {
      cloud.position.x += 0.02;
      if (cloud.position.x > 60) {
        cloud.position.x = -60;
      }
    });
  }

  /**
   * 显示/隐藏地图
   */
  public setMapVisible(visible: boolean): void {
    this.mapRoot.visible = visible;
  }

  /**
   * 显示/隐藏 Party Box
   */
  public setPartyBoxVisible(visible: boolean): void {
    this.partyBoxRoot.visible = visible;
  }

  /**
   * 获取 Party Box 根节点
   */
  public getPartyBoxRoot(): THREE.Group {
    return this.partyBoxRoot;
  }

  /**
   * 清理已放置的物品
   */
  public clearPlacedObjects(): void {
    const objectsToRemove: CANNON.Body[] = [];
    this.physicsWorld.world.bodies.forEach((b) => {
      const tag = (b as any).userData?.tag;
      if (tag && tag !== "ground" && tag !== "goal" && tag !== "player") {
        objectsToRemove.push(b);
      }
    });

    objectsToRemove.forEach((b) => {
      this.physicsWorld.world.removeBody(b);
      const mesh = (b as any).meshReference;
      if (mesh) this.scene.remove(mesh);
    });
  }

  /**
   * 执行炸弹爆炸
   */
  public explodeBombs(): number {
    const bombs: CANNON.Body[] = [];
    this.physicsWorld.world.bodies.forEach((b) => {
      if ((b as any).userData?.tag === "bomb") {
        bombs.push(b);
      }
    });

    bombs.forEach((bomb) => {
      const range = 3;
      const toRemove: CANNON.Body[] = [];
      this.physicsWorld.world.bodies.forEach((b) => {
        if (b !== bomb && b.position.distanceTo(bomb.position) < range) {
          const userData = (b as any).userData;
          const tag = userData ? userData.tag : undefined;
          if (tag !== "ground" && tag !== "player" && tag !== "goal") {
            toRemove.push(b);
          }
        }
      });

      toRemove.forEach((b) => {
        this.physicsWorld.world.removeBody(b);
        const mesh = (b as any).meshReference;
        if (mesh) this.scene.remove(mesh);
      });

      this.physicsWorld.world.removeBody(bomb);
      const bombMesh = (bomb as any).meshReference;
      if (bombMesh) this.scene.remove(bombMesh);
    });

    return bombs.length;
  }
}
