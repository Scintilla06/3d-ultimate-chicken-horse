import * as THREE from "three";
import * as CANNON from "cannon-es";
import { Resources } from "./Resources";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { BodyFactory } from "../physics/BodyFactory";
import { PlaceholderGenerator } from "../utils/PlaceholderGenerator";

/**
 * 关卡管理器：管理场景初始化、云朵、平台等
 * 主题：神秘森林 (Enchanted Forest)
 */
export class LevelManager {
  private scene: THREE.Scene;
  private physicsWorld: PhysicsWorld;
  private resources: Resources;

  // 场景元素
  private mapRoot: THREE.Group;
  private clouds: THREE.Group[] = [];
  private partyBoxRoot: THREE.Group;
  
  // 森林主题纹理
  private grassTexture!: THREE.Texture;
  private stoneTexture!: THREE.Texture;
  private woodTexture!: THREE.Texture;
  
  // 萤火虫动画
  private fireflies: { mesh: THREE.Mesh; basePos: THREE.Vector3; offset: THREE.Vector3; speed: THREE.Vector3 }[] = [];

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
    
    // 初始化森林主题纹理
    this.initForestTextures();
  }
  
  /**
   * 初始化森林主题纹理
   */
  private initForestTextures(): void {
    // 草地纹理 - 绿色棋盘
    this.grassTexture = PlaceholderGenerator.createCheckerTexture("#2d5a27", "#3d7a37");
    this.grassTexture.wrapS = THREE.RepeatWrapping;
    this.grassTexture.wrapT = THREE.RepeatWrapping;
    
    // 石头纹理 - 灰色棋盘
    this.stoneTexture = PlaceholderGenerator.createCheckerTexture("#5a5a5a", "#7a7a7a");
    this.stoneTexture.wrapS = THREE.RepeatWrapping;
    this.stoneTexture.wrapT = THREE.RepeatWrapping;
    
    // 木头纹理 - 棕色棋盘
    this.woodTexture = PlaceholderGenerator.createCheckerTexture("#5c3a21", "#7a4a31");
    this.woodTexture.wrapS = THREE.RepeatWrapping;
    this.woodTexture.wrapT = THREE.RepeatWrapping;
  }

  /**
   * 初始化场景
   */
  public initScene(): void {
    // 天空颜色 - 明亮的森林天空
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x9dd5e8, 50, 120);

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
   * 创建关卡 - 神秘森林主题
   */
  private createLevel(): void {
    // ========== 1. 起点区域 - 森林入口 ==========
    this.createStartArea();
    
    // ========== 2. 第一段 - 木桩跳台 ==========
    this.createWoodStumpPlatforms();
    
    // ========== 3. 第二段 - 石头阶梯 ==========
    this.createStoneStairs();
    
    // ========== 4. 第三段 - L形树桥 ==========
    this.createTreeBridge();
    
    // ========== 5. 第四段 - 漂浮岩石 ==========
    this.createFloatingRocks();
    
    // ========== 6. 终点区域 - 森林祭坛 ==========
    this.createGoalArea();
    
    // ========== 7. 装饰物 ==========
    this.createDecorations();
  }
  
  /**
   * 创建起点区域
   */
  private createStartArea(): void {
    // 大型草地平台
    const startPlatBody = BodyFactory.createBox(
      12, 2, 12,
      0,
      new CANNON.Vec3(0, -1, 0)
    );
    (startPlatBody as any).userData = { tag: "ground" };
    this.physicsWorld.world.addBody(startPlatBody);

    const startPlatMesh = this.createPlatformMesh(12, 2, 12, this.grassTexture);
    startPlatMesh.position.set(0, -1, 0);
    this.mapRoot.add(startPlatMesh);
    (startPlatBody as any).meshReference = startPlatMesh;
    
    // 起点区域标记（蓝色）
    const startZone = PlaceholderGenerator.createZone(2, 2, 2, 0x0000ff);
    startZone.position.set(0, 1, 0);
    this.mapRoot.add(startZone);
    
    // 边缘树木（远离出生点）
    this.createTree(-7, 0, -3, 1.2);
    this.createTree(7, 0, -3, 1.0);
    this.createTree(-6, 0, 2, 0.9);
    this.createTree(6, 0, 3, 1.1);
  }
  
  /**
   * 创建木桩跳台
   */
  private createWoodStumpPlatforms(): void {
    const stumpPositions = [
      { x: 3, y: 0.5, z: 8, scale: 1.0 },
      { x: -2, y: 1.5, z: 12, scale: 0.8 },
      { x: 4, y: 2.5, z: 16, scale: 1.2 },
      { x: -1, y: 3.5, z: 20, scale: 0.9 },
    ];
    
    stumpPositions.forEach((pos) => {
      this.createWoodStump(pos.x, pos.y, pos.z, pos.scale);
    });
  }
  
  /**
   * 创建石头阶梯
   */
  private createStoneStairs(): void {
    // 主阶梯 - 从蘑菇区连接到树桥
    const stairStart = { x: 2, z: 24 };
    for (let i = 0; i < 5; i++) {
      const stepBody = BodyFactory.createBox(
        3, 0.5, 2,
        0,
        new CANNON.Vec3(stairStart.x - i * 0.5, 4 + i * 0.8, stairStart.z + i * 2.5)
      );
      (stepBody as any).userData = { tag: "ground" };
      this.physicsWorld.world.addBody(stepBody);
      
      const stepMesh = this.createPlatformMesh(3, 0.5, 2, this.stoneTexture);
      stepMesh.position.set(stairStart.x - i * 0.5, 4 + i * 0.8, stairStart.z + i * 2.5);
      this.mapRoot.add(stepMesh);
      (stepBody as any).meshReference = stepMesh;
    }
  }
  
  /**
   * 创建L形树桥
   */
  private createTreeBridge(): void {
    // L形平台的第一段（沿Z轴）- 从 z=35 到 z=45
    const bridge1Body = BodyFactory.createBox(
      4, 1, 10,
      0,
      new CANNON.Vec3(-3, 8, 40)
    );
    (bridge1Body as any).userData = { tag: "ground" };
    this.physicsWorld.world.addBody(bridge1Body);
    
    const bridge1Mesh = this.createPlatformMesh(4, 1, 10, this.woodTexture);
    bridge1Mesh.position.set(-3, 8, 40);
    this.mapRoot.add(bridge1Mesh);
    (bridge1Body as any).meshReference = bridge1Mesh;
    
    // 桥上的栏杆装饰 - 对齐到桥的边缘 (x=-5 和 x=-1)
    this.createRailing(-5, 8.5, 35, 0, 10);
    this.createRailing(-1, 8.5, 35, 0, 10);
    
    // L形平台的转角 - z=45 到 z=49
    const cornerBody = BodyFactory.createBox(
      4, 1, 4,
      0,
      new CANNON.Vec3(-3, 8, 47)
    );
    (cornerBody as any).userData = { tag: "ground" };
    this.physicsWorld.world.addBody(cornerBody);
    
    const cornerMesh = this.createPlatformMesh(4, 1, 4, this.woodTexture);
    cornerMesh.position.set(-3, 8, 47);
    this.mapRoot.add(cornerMesh);
    (cornerBody as any).meshReference = cornerMesh;
    
    // L形平台的第二段（沿X轴）- 从 x=-1 到 x=9
    const bridge2Body = BodyFactory.createBox(
      10, 1, 4,
      0,
      new CANNON.Vec3(4, 8, 47)
    );
    (bridge2Body as any).userData = { tag: "ground" };
    this.physicsWorld.world.addBody(bridge2Body);
    
    const bridge2Mesh = this.createPlatformMesh(10, 1, 4, this.woodTexture);
    bridge2Mesh.position.set(4, 8, 47);
    this.mapRoot.add(bridge2Mesh);
    (bridge2Body as any).meshReference = bridge2Mesh;
    
    // 桥上的栏杆 - 对齐到第二段桥的边缘 (z=49)
    this.createRailing(-1, 8.5, 49, Math.PI / 2, 10);
  }
  
  /**
   * 创建漂浮岩石
   */
  private createFloatingRocks(): void {
    const rockPositions = [
      { x: 12, y: 7, z: 50, size: 2.5 },
      { x: 16, y: 6, z: 54, size: 2.0 },
      { x: 13, y: 5, z: 58, size: 2.2 },
      { x: 17, y: 4.5, z: 62, size: 2.8 },
    ];
    
    rockPositions.forEach(pos => {
      this.createFloatingRock(pos.x, pos.y, pos.z, pos.size);
    });
  }
  
  /**
   * 创建终点区域 - 森林祭坛
   */
  private createGoalArea(): void {
    // 圆形祭坛平台
    const goalPlatBody = BodyFactory.createBox(
      10, 2, 10,
      0,
      new CANNON.Vec3(20, 3, 68)
    );
    (goalPlatBody as any).userData = { tag: "ground" };
    this.physicsWorld.world.addBody(goalPlatBody);
    
    // 创建圆形外观的祭坛
    const altarMesh = this.createCircularPlatform(5, 2, 0x4a6741);
    altarMesh.position.set(20, 3, 68);
    this.mapRoot.add(altarMesh);
    (goalPlatBody as any).meshReference = altarMesh;
    
    // 终点区域标记（红色）
    const goalZone = PlaceholderGenerator.createZone(2, 2, 2, 0xff0000);
    goalZone.position.set(20, 5, 68);
    this.mapRoot.add(goalZone);
    
    // 终点旗帜
    const flagGroup = this.createForestFlag();
    flagGroup.position.set(20, 4, 68);
    this.mapRoot.add(flagGroup);
    
    // 终点物理触发器
    const goalBody = BodyFactory.createBox(
      1, 2, 1,
      0,
      new CANNON.Vec3(20, 5, 68)
    );
    goalBody.isTrigger = true;
    (goalBody as any).userData = { tag: "goal" };
    this.physicsWorld.world.addBody(goalBody);
    
    // 祭坛周围的石柱 - y=4 是平台顶部
    this.createStonePillar(16, 4, 64);
    this.createStonePillar(24, 4, 64);
    this.createStonePillar(16, 4, 72);
    this.createStonePillar(24, 4, 72);
    
    // 祭坛周围的树木 - 放在平台外围，地面高度为0
    this.createTree(12, 0, 58, 1.5);
    this.createTree(28, 0, 58, 1.3);
    this.createTree(12, 0, 78, 1.4);
    this.createTree(28, 0, 78, 1.2);
  }
  
  /**
   * 创建装饰物
   */
  private createDecorations(): void {
    // 发光的萤火虫粒子效果
    this.createFireflies();
  }
  
  // ========== 辅助创建方法 ==========
  
  /**
   * 创建平台网格
   */
  private createPlatformMesh(width: number, height: number, depth: number, texture: THREE.Texture): THREE.Mesh {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const textureCopy = texture.clone();
    textureCopy.repeat.set(width / 2, depth / 2);
    textureCopy.needsUpdate = true;
    
    const mat = new THREE.MeshStandardMaterial({
      map: textureCopy,
      roughness: 0.8,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  
  /**
   * 创建圆形平台
   */
  private createCircularPlatform(radius: number, height: number, color: number): THREE.Group {
    const group = new THREE.Group();
    
    const geo = new THREE.CylinderGeometry(radius, radius + 0.5, height, 16);
    const mat = new THREE.MeshStandardMaterial({
      map: this.stoneTexture,
      color: color,
      roughness: 0.9,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    
    // 装饰边缘
    const ringGeo = new THREE.TorusGeometry(radius + 0.3, 0.15, 8, 32);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x3d5c3d });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = height / 2;
    ring.castShadow = true;
    group.add(ring);
    
    return group;
  }
  
  /**
   * 创建木桩平台
   */
  private createWoodStump(x: number, y: number, z: number, scale: number): void {
    const stumpRadius = 1.5 * scale;
    const stumpHeight = 2 * scale;
    
    // 物理碰撞体 - 圆柱形近似为方形
    const body = BodyFactory.createBox(
      stumpRadius * 2, stumpHeight, stumpRadius * 2,
      0,
      new CANNON.Vec3(x, y + stumpHeight / 2, z)
    );
    (body as any).userData = { tag: "ground" };
    this.physicsWorld.world.addBody(body);
    
    // 木桩模型
    const stump = new THREE.Group();
    
    // 木桩主体
    const stumpGeo = new THREE.CylinderGeometry(stumpRadius, stumpRadius * 1.1, stumpHeight, 12);
    const textureCopy = this.woodTexture.clone();
    textureCopy.repeat.set(2, 2);
    textureCopy.needsUpdate = true;
    const stumpMat = new THREE.MeshStandardMaterial({ 
      map: textureCopy,
      roughness: 0.9,
    });
    const stumpMesh = new THREE.Mesh(stumpGeo, stumpMat);
    stumpMesh.position.y = stumpHeight / 2;
    stumpMesh.castShadow = true;
    stumpMesh.receiveShadow = true;
    stump.add(stumpMesh);
    
    // 木桩顶部 - 年轮效果
    const topGeo = new THREE.CircleGeometry(stumpRadius, 16);
    const topMat = new THREE.MeshStandardMaterial({ 
      color: 0x8b6914,
      roughness: 0.8,
    });
    const topMesh = new THREE.Mesh(topGeo, topMat);
    topMesh.rotation.x = -Math.PI / 2;
    topMesh.position.y = stumpHeight;
    topMesh.receiveShadow = true;
    stump.add(topMesh);
    
    // 年轮装饰
    for (let i = 1; i <= 3; i++) {
      const ringGeo = new THREE.RingGeometry(stumpRadius * i * 0.25, stumpRadius * i * 0.25 + 0.05, 16);
      const ringMat = new THREE.MeshStandardMaterial({ 
        color: 0x6b4f12,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = stumpHeight + 0.01;
      stump.add(ring);
    }
    
    stump.position.set(x, y, z);
    this.mapRoot.add(stump);
    (body as any).meshReference = stump;
  }
  
  /**
   * 创建漂浮岩石
   */
  private createFloatingRock(x: number, y: number, z: number, size: number): void {
    const body = BodyFactory.createBox(
      size, 1, size,
      0,
      new CANNON.Vec3(x, y, z)
    );
    (body as any).userData = { tag: "ground" };
    this.physicsWorld.world.addBody(body);
    
    // 不规则岩石外观
    const rockGroup = new THREE.Group();
    
    const mainGeo = new THREE.DodecahedronGeometry(size / 2, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      map: this.stoneTexture,
      color: 0x6a6a6a,
      roughness: 1.0,
      flatShading: true,
    });
    const mainRock = new THREE.Mesh(mainGeo, rockMat);
    mainRock.scale.y = 0.5;
    mainRock.castShadow = true;
    mainRock.receiveShadow = true;
    rockGroup.add(mainRock);
    
    // 顶部草地
    const grassGeo = new THREE.CylinderGeometry(size / 2 - 0.2, size / 2, 0.2, 8);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x3d7a37 });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.position.y = 0.4;
    grass.receiveShadow = true;
    rockGroup.add(grass);
    
    rockGroup.position.set(x, y, z);
    this.mapRoot.add(rockGroup);
    (body as any).meshReference = rockGroup;
  }
  
  /**
   * 创建树木
   */
  private createTree(x: number, y: number, z: number, scale: number): void {
    const tree = new THREE.Group();
    
    // 树干
    const trunkGeo = new THREE.CylinderGeometry(0.3 * scale, 0.5 * scale, 3 * scale, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.5 * scale;
    trunk.castShadow = true;
    tree.add(trunk);
    
    // 树冠 - 多层圆锥
    const foliageMat = new THREE.MeshStandardMaterial({ 
      color: 0x228b22,
      roughness: 0.8,
    });
    
    for (let i = 0; i < 3; i++) {
      const radius = (2 - i * 0.4) * scale;
      const height = 2 * scale;
      const foliageGeo = new THREE.ConeGeometry(radius, height, 8);
      const foliage = new THREE.Mesh(foliageGeo, foliageMat);
      foliage.position.y = (3 + i * 1.2) * scale;
      foliage.castShadow = true;
      tree.add(foliage);
    }
    
    tree.position.set(x, y, z);
    this.mapRoot.add(tree);
  }
  
  /**
   * 创建栏杆（带物理碰撞）
   */
  private createRailing(x: number, y: number, z: number, rotation: number, length: number): void {
    const railing = new THREE.Group();
    const railMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21 });
    
    // 横杆
    const railGeo = new THREE.CylinderGeometry(0.08, 0.08, length, 8);
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.rotation.x = Math.PI / 2;
    rail.position.z = length / 2;
    rail.position.y = 0.8;
    rail.castShadow = true;
    railing.add(rail);
    
    // 立柱
    const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
    const numPosts = Math.ceil(length / 2);
    for (let i = 0; i <= numPosts; i++) {
      const post = new THREE.Mesh(postGeo, railMat);
      post.position.set(0, 0.5, i * (length / numPosts));
      post.castShadow = true;
      railing.add(post);
    }
    
    railing.position.set(x, y, z);
    railing.rotation.y = rotation;
    this.mapRoot.add(railing);
    
    // 添加物理碰撞体（简化为一个长条形碰撞箱）
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const colliderBody = BodyFactory.createBox(
      0.3,
      1,
      length,
      0,
      new CANNON.Vec3(
        x + sin * length / 2,
        y + 0.5,
        z + cos * length / 2
      )
    );
    // 设置旋转
    const quat = new CANNON.Quaternion();
    quat.setFromEuler(0, rotation, 0);
    colliderBody.quaternion.copy(quat);
    (colliderBody as any).userData = { tag: "ground" };
    this.physicsWorld.world.addBody(colliderBody);
  }
  
  /**
   * 创建石柱
   */
  private createStonePillar(x: number, y: number, z: number): void {
    const pillar = new THREE.Group();
    
    const pillarGeo = new THREE.CylinderGeometry(0.4, 0.5, 3, 6);
    const pillarMat = new THREE.MeshStandardMaterial({
      map: this.stoneTexture,
      color: 0x7a7a7a,
    });
    const main = new THREE.Mesh(pillarGeo, pillarMat);
    main.position.y = 1.5;
    main.castShadow = true;
    pillar.add(main);
    
    // 顶部装饰
    const topGeo = new THREE.BoxGeometry(1, 0.3, 1);
    const top = new THREE.Mesh(topGeo, pillarMat);
    top.position.y = 3.15;
    top.castShadow = true;
    pillar.add(top);
    
    pillar.position.set(x, y, z);
    this.mapRoot.add(pillar);
  }
  
  /**
   * 创建森林主题旗帜
   */
  private createForestFlag(): THREE.Group {
    const group = new THREE.Group();

    // 木杆
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 4);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 2;
    pole.castShadow = true;
    group.add(pole);

    // 三角形旗帜
    const flagShape = new THREE.Shape();
    flagShape.moveTo(0, 0);
    flagShape.lineTo(1.5, 0.4);
    flagShape.lineTo(0, 0.8);
    flagShape.lineTo(0, 0);
    
    const flagGeo = new THREE.ShapeGeometry(flagShape);
    const flagMat = new THREE.MeshStandardMaterial({ 
      color: 0x228b22,
      side: THREE.DoubleSide,
    });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.1, 3.2, 0);
    flag.castShadow = true;
    group.add(flag);

    return group;
  }
  
  /**
   * 创建萤火虫效果
   */
  private createFireflies(): void {
    const fireflyPositions = [
      new THREE.Vector3(5, 3, 10),
      new THREE.Vector3(-3, 4, 18),
      new THREE.Vector3(8, 2, 25),
      new THREE.Vector3(-2, 6, 35),
      new THREE.Vector3(15, 5, 55),
      new THREE.Vector3(22, 6, 65),
      new THREE.Vector3(2, 2, 5),
      new THREE.Vector3(-4, 3, 12),
      new THREE.Vector3(6, 4, 20),
      new THREE.Vector3(10, 6, 50),
    ];
    
    fireflyPositions.forEach(pos => {
      const fireflyGeo = new THREE.SphereGeometry(0.08, 8, 8);
      const fireflyMat = new THREE.MeshBasicMaterial({
        color: 0xaaffaa,
        transparent: true,
        opacity: 0.9,
      });
      const firefly = new THREE.Mesh(fireflyGeo, fireflyMat);
      firefly.position.copy(pos);
      
      // 添加点光源
      const light = new THREE.PointLight(0xaaffaa, 0.8, 5);
      firefly.add(light);
      
      this.mapRoot.add(firefly);
      
      // 存储萤火虫用于动画
      this.fireflies.push({
        mesh: firefly,
        basePos: pos.clone(),
        offset: new THREE.Vector3(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        ),
        speed: new THREE.Vector3(
          0.3 + Math.random() * 0.4,
          0.2 + Math.random() * 0.3,
          0.3 + Math.random() * 0.4
        )
      });
    });
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
   * 更新萤火虫动画
   */
  public updateFireflies(time: number): void {
    this.fireflies.forEach(ff => {
      // 缓慢的随机移动
      const wanderRadius = 1.5;
      ff.mesh.position.x = ff.basePos.x + Math.sin(time * ff.speed.x + ff.offset.x) * wanderRadius;
      ff.mesh.position.y = ff.basePos.y + Math.sin(time * ff.speed.y + ff.offset.y) * wanderRadius * 0.5;
      ff.mesh.position.z = ff.basePos.z + Math.cos(time * ff.speed.z + ff.offset.z) * wanderRadius;
      
      // 闪烁效果
      const mat = ff.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.6 + Math.sin(time * 3 + ff.offset.x) * 0.4;
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
