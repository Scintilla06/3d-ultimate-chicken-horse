import * as THREE from "three";
import * as CANNON from "cannon-es";
import { Resources } from "./Resources";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { PlaceholderGenerator } from "../utils/PlaceholderGenerator";
import { MapBuilder, MapDefinition, getMapBuilder, getMapDefinition, MAP_LIST } from "./maps/MapDefinition";

/**
 * 关卡管理器：管理场景初始化、云朵、平台等
 * 支持多地图系统
 */
export class LevelManager {
  private scene: THREE.Scene;
  private physicsWorld: PhysicsWorld;
  private resources: Resources;

  // 场景元素
  private mapRoot: THREE.Group;
  private clouds: THREE.Group[] = [];
  private partyBoxRoot: THREE.Group;
  
  // 当前地图构建器
  private currentMapBuilder: MapBuilder | null = null;
  private currentMapId: string = "enchanted_forest"; // 默认地图

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
   * 初始化场景 - 标题页使用白色背景
   */
  public initSceneForTitle(): void {
    // 白色背景
    this.scene.background = new THREE.Color(0xffffff);
    this.scene.fog = null;
    
    // 基础灯光
    this.createLights();
    
    // 创建云朵背景
    this.createClouds();
    
    // 创建 Party Box 区域
    this.createPartyBoxArea();
  }

  /**
   * 初始化场景 - 加载指定地图
   */
  public async initScene(mapId?: string): Promise<void> {
    const targetMapId = mapId || this.currentMapId;
    
    // 获取地图定义
    const mapDef = getMapDefinition(targetMapId);
    if (!mapDef) {
      console.error(`Map not found: ${targetMapId}`);
      return;
    }
    
    // 设置天空和雾
    this.scene.background = new THREE.Color(mapDef.skyColor);
    this.scene.fog = new THREE.Fog(mapDef.fogColor, mapDef.fogNear, mapDef.fogFar);

    // 创建云朵
    this.createClouds();

    // 创建灯光
    this.createLights();

    // 加载地图
    await this.loadMap(targetMapId);

    // 创建 Party Box 区域
    this.createPartyBoxArea();
  }
  
  /**
   * 加载指定地图
   */
  public async loadMap(mapId: string): Promise<void> {
    // 清理当前地图
    this.clearMap();
    
    // 获取地图构建器
    const builder = await getMapBuilder(mapId);
    if (!builder) {
      console.error(`Map builder not found: ${mapId}`);
      return;
    }
    
    this.currentMapBuilder = builder;
    this.currentMapId = mapId;
    
    // 更新场景设置
    const def = builder.definition;
    this.scene.background = new THREE.Color(def.skyColor);
    this.scene.fog = new THREE.Fog(def.fogColor, def.fogNear, def.fogFar);
    
    // 构建地图
    builder.build(this.scene, this.physicsWorld, this.resources, this.mapRoot);
  }
  
  /**
   * 清理当前地图
   */
  public clearMap(): void {
    // 清理地图构建器
    if (this.currentMapBuilder?.cleanup) {
      this.currentMapBuilder.cleanup();
    }
    this.currentMapBuilder = null;
    
    // 清理 mapRoot 中的所有对象
    while (this.mapRoot.children.length > 0) {
      const child = this.mapRoot.children[0];
      this.mapRoot.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
      if ((child as any).material) {
        const mat = (child as any).material;
        if (Array.isArray(mat)) {
          mat.forEach((m: THREE.Material) => m.dispose());
        } else {
          mat.dispose();
        }
      }
    }
    
    // 清理物理世界中的地图相关物体
    const bodiesToRemove: CANNON.Body[] = [];
    this.physicsWorld.world.bodies.forEach((b) => {
      const tag = (b as any).userData?.tag;
      if (tag === "ground" || tag === "goal") {
        bodiesToRemove.push(b);
      }
    });
    bodiesToRemove.forEach((b) => {
      this.physicsWorld.world.removeBody(b);
    });
  }
  
  /**
   * 获取当前地图ID
   */
  public getCurrentMapId(): string {
    return this.currentMapId;
  }
  
  /**
   * 获取所有可用地图
   */
  public getAvailableMaps(): MapDefinition[] {
    return MAP_LIST;
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
    // 环境光 - 明亮的森林氛围
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // 主方向光 - 阳光
    const directionalLight = new THREE.DirectionalLight(0xfff8e0, 1.2);
    directionalLight.position.set(20, 30, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.bias = -0.0005;
    this.scene.add(directionalLight);
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
   * 更新地图动画（萤火虫、雪花等）
   */
  public updateMap(time: number): void {
    if (this.currentMapBuilder?.update) {
      this.currentMapBuilder.update(time);
    }
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
