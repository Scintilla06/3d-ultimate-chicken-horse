import * as THREE from "three";
import * as CANNON from "cannon-es";
import { MapBuilder, MapDefinition } from "./MapDefinition";
import { PhysicsWorld } from "../../physics/PhysicsWorld";
import { Resources } from "../Resources";
import { BodyFactory } from "../../physics/BodyFactory";
import { PlaceholderGenerator } from "../../utils/PlaceholderGenerator";

/**
 * 火山岛地图 - Z字峡谷与垂直攀爬
 * 道路特色：Z字形熔岩峡谷 → 圆形跳跃平台 → 垂直攀爬火山壁
 */
export class VolcanoIslandMap implements MapBuilder {
  definition: MapDefinition = {
    id: "volcano_island",
    name: "火山岛",
    description: "穿越Z字峡谷，踏过圆盘，攀登火山壁",
    previewColor: 0xff4500,
    skyColor: 0x2a1a0a,
    fogColor: 0x3a2010,
    fogNear: 30,
    fogFar: 90,
  };

  private lavaTexture!: THREE.Texture;
  private rockTexture!: THREE.Texture;
  private obsidianTexture!: THREE.Texture;
  private mapRoot!: THREE.Group;
  private lavaEmbers: THREE.Points | null = null;
  private lavaPools: THREE.Mesh[] = [];
  private fireGlows: THREE.PointLight[] = [];
  private floatingDiscs: { mesh: THREE.Group; body: CANNON.Body; angle: number; centerX: number; centerZ: number; radius: number; prevX: number; prevZ: number }[] = [];

  build(
    _scene: THREE.Scene,
    physicsWorld: PhysicsWorld,
    _resources: Resources,
    mapRoot: THREE.Group
  ): void {
    this.mapRoot = mapRoot;
    this.initTextures();
    
    // 创建起点区域
    this.createStartArea(physicsWorld);
    
    // 第一阶段：Z字形熔岩峡谷
    this.createZigzagLavaCanyon(physicsWorld);
    
    // 第二阶段：圆形跳跃平台（环形分布）
    this.createCircularJumpingPlatforms(physicsWorld);
    
    // 第三阶段：垂直攀爬火山壁
    this.createVerticalClimbingWall(physicsWorld);
    
    // 创建终点火山祭坛
    this.createGoalArea(physicsWorld);
    
    // 创建熔岩装饰
    this.createLavaDecorations();
    
    // 创建熔岩火星粒子
    this.createLavaEmbers();
  }

  update(time: number): void {
    // 更新熔岩池动画
    this.lavaPools.forEach((pool, idx) => {
      const mat = pool.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.85 + Math.sin(time * 2 + idx) * 0.1;
      pool.position.y = -1.8 + Math.sin(time * 0.5 + idx * 0.3) * 0.1;
    });
    
    // 更新火星粒子
    if (this.lavaEmbers) {
      const positions = this.lavaEmbers.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        let y = positions.getY(i);
        y += 0.03;
        if (y > 15) {
          y = -2;
          positions.setX(i, (Math.random() - 0.5) * 60);
          positions.setZ(i, Math.random() * 80 + 10);
        }
        positions.setY(i, y);
      }
      positions.needsUpdate = true;
    }
    
    // 更新火焰光源闪烁
    this.fireGlows.forEach((light, idx) => {
      light.intensity = 1.5 + Math.sin(time * 4 + idx * 2) * 0.5;
    });
    
    // 更新浮动圆盘（绕中心旋转）
    const dt = 1 / 60; // 假设60fps
    this.floatingDiscs.forEach((disc) => {
      disc.angle += 0.008;
      const newX = disc.centerX + Math.cos(disc.angle) * disc.radius;
      const newZ = disc.centerZ + Math.sin(disc.angle) * disc.radius;
      
      // 计算速度以使玩家能够跟随平台移动
      const velocityX = (newX - disc.prevX) / dt;
      const velocityZ = (newZ - disc.prevZ) / dt;
      
      disc.mesh.position.x = newX;
      disc.mesh.position.z = newZ;
      disc.body.position.x = newX;
      disc.body.position.z = newZ;
      disc.body.velocity.x = velocityX;
      disc.body.velocity.z = velocityZ;
      disc.body.velocity.y = 0;
      disc.mesh.rotation.y += 0.01;
      
      // 更新前一帧位置
      disc.prevX = newX;
      disc.prevZ = newZ;
    });
  }

  cleanup(): void {
    this.lavaEmbers = null;
    this.lavaPools = [];
    this.fireGlows = [];
    this.floatingDiscs = [];
  }

  private initTextures(): void {
    this.lavaTexture = PlaceholderGenerator.createCheckerTexture("#ff4500", "#ff6a00");
    this.lavaTexture.wrapS = THREE.RepeatWrapping;
    this.lavaTexture.wrapT = THREE.RepeatWrapping;
    
    this.rockTexture = PlaceholderGenerator.createCheckerTexture("#3a3a3a", "#4a4040");
    this.rockTexture.wrapS = THREE.RepeatWrapping;
    this.rockTexture.wrapT = THREE.RepeatWrapping;
    
    this.obsidianTexture = PlaceholderGenerator.createCheckerTexture("#1a1020", "#2a1830");
    this.obsidianTexture.wrapS = THREE.RepeatWrapping;
    this.obsidianTexture.wrapT = THREE.RepeatWrapping;
  }

  private createStartArea(physicsWorld: PhysicsWorld): void {
    // 火山岩平台
    const startBody = BodyFactory.createBox(12, 2, 12, 0, new CANNON.Vec3(0, -1, 0));
    (startBody as any).userData = { tag: "ground" };
    physicsWorld.world.addBody(startBody);

    const startMesh = this.createVolcanicPlatform(12, 2, 12);
    startMesh.position.set(0, -1, 0);
    this.mapRoot.add(startMesh);
    (startBody as any).meshReference = startMesh;
    
    const startZone = PlaceholderGenerator.createZone(2, 2, 2, 0x0000ff);
    startZone.position.set(0, 1, 0);
    this.mapRoot.add(startZone);
    
    // 火把装饰
    this.createTorch(-5, 0, -5);
    this.createTorch(5, 0, -5);
    this.createTorch(-5, 0, 5);
    this.createTorch(5, 0, 5);
  }

  /**
   * Z字形熔岩峡谷 - 需要左右跳跃穿越
   */
  private createZigzagLavaCanyon(physicsWorld: PhysicsWorld): void {
    // 峡谷两侧的岩壁
    this.createCanyonWall(-10, 0, 20, 30);
    this.createCanyonWall(10, 0, 20, 30);
    
    // 底部熔岩
    this.createLavaPool(0, -3, 25, 18, 25);
    
    // Z字形跳跃平台
    const platforms = [
      { x: -5, y: 1, z: 10, w: 4, d: 4 },
      { x: 4, y: 2, z: 15, w: 3.5, d: 3.5 },
      { x: -4, y: 3, z: 20, w: 3.5, d: 3.5 },
      { x: 5, y: 4, z: 25, w: 3, d: 3 },
      { x: -3, y: 5, z: 30, w: 3.5, d: 3.5 },
      { x: 4, y: 6, z: 35, w: 4, d: 4 },
    ];
    
    platforms.forEach((p, i) => {
      const body = BodyFactory.createBox(p.w, 1, p.d, 0, new CANNON.Vec3(p.x, p.y, p.z));
      (body as any).userData = { tag: "ground" };
      physicsWorld.world.addBody(body);
      
      const platform = this.createFlatRockPlatform(p.w, 1, p.d);
      platform.position.set(p.x, p.y, p.z);
      this.mapRoot.add(platform);
      (body as any).meshReference = platform;
      
      // 在某些平台上添加火把
      if (i % 2 === 0) {
        this.createSmallFlame(p.x, p.y + 0.5, p.z);
      }
    });
    
    // 峡谷出口平台
    const exitBody = BodyFactory.createBox(8, 1.5, 6, 0, new CANNON.Vec3(0, 7, 42));
    (exitBody as any).userData = { tag: "ground" };
    physicsWorld.world.addBody(exitBody);
    
    const exitPlatform = this.createVolcanicPlatform(8, 1.5, 6);
    exitPlatform.position.set(0, 7, 42);
    this.mapRoot.add(exitPlatform);
    (exitBody as any).meshReference = exitPlatform;
  }

  private createCanyonWall(x: number, _y: number, z: number, length: number): void {
    const wall = new THREE.Group();
    
    // 不规则岩壁
    for (let i = 0; i < 6; i++) {
      const wallGeo = new THREE.BoxGeometry(
        2 + Math.random() * 2,
        8 + Math.random() * 4,
        length / 6
      );
      const wallMat = new THREE.MeshStandardMaterial({
        map: this.rockTexture,
        color: 0x3a3030,
        roughness: 1.0,
        flatShading: true
      });
      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      wallMesh.position.set(
        (Math.random() - 0.5) * 2,
        4 + Math.random() * 2,
        z + (i - 2.5) * (length / 6)
      );
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      wall.add(wallMesh);
    }
    
    // 熔岩裂缝效果
    const crackGeo = new THREE.PlaneGeometry(0.3, length);
    const crackMat = new THREE.MeshBasicMaterial({
      color: 0xff4500,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    const crack = new THREE.Mesh(crackGeo, crackMat);
    crack.position.set(x > 0 ? -1 : 1, 3, z);
    crack.rotation.y = Math.PI / 2;
    wall.add(crack);
    
    wall.position.x = x;
    this.mapRoot.add(wall);
  }

  /**
   * 圆形跳跃平台 - 环形分布的旋转圆盘
   */
  private createCircularJumpingPlatforms(physicsWorld: PhysicsWorld): void {
    const centerX = 0;
    const centerZ = 58;
    const centerY = 8;
    
    // 中央熔岩池
    this.createLavaPool(centerX, centerY - 4, centerZ, 12, 12);
    
    // 环形分布的静态平台
    const numStaticPlatforms = 6;
    for (let i = 0; i < numStaticPlatforms; i++) {
      const angle = (i / numStaticPlatforms) * Math.PI * 2;
      const radius = 10;
      const x = centerX + Math.cos(angle) * radius;
      const z = centerZ + Math.sin(angle) * radius;
      const y = centerY + Math.sin(angle * 2) * 1; // 高低起伏
      
      const body = BodyFactory.createBox(2.5, 0.8, 2.5, 0, new CANNON.Vec3(x, y, z));
      (body as any).userData = { tag: "ground" };
      physicsWorld.world.addBody(body);
      
      const platform = this.createCircularRockPlatform(2.5);
      platform.position.set(x, y, z);
      this.mapRoot.add(platform);
      (body as any).meshReference = platform;
    }
    
    // 移动的圆盘平台（绕中心旋转）
    const numMovingDiscs = 3;
    for (let i = 0; i < numMovingDiscs; i++) {
      const angle = (i / numMovingDiscs) * Math.PI * 2;
      const radius = 6;
      const x = centerX + Math.cos(angle) * radius;
      const z = centerZ + Math.sin(angle) * radius;
      const y = centerY + 0.5;
      
      const body = BodyFactory.createBox(2, 0.6, 2, 0, new CANNON.Vec3(x, y, z));
      // 设置为 Kinematic 类型，这样手动移动时玩家能正确站立和跳跃
      body.type = CANNON.Body.KINEMATIC;
      (body as any).userData = { tag: "ground" };
      physicsWorld.world.addBody(body);
      
      const disc = this.createFloatingDisc(2);
      disc.position.set(x, y, z);
      this.mapRoot.add(disc);
      (body as any).meshReference = disc;
      
      this.floatingDiscs.push({
        mesh: disc,
        body: body,
        angle: angle,
        centerX: centerX,
        centerZ: centerZ,
        radius: radius,
        prevX: x,
        prevZ: z
      });
    }
    
    // 通往下一阶段的平台
    const exitBody = BodyFactory.createBox(5, 1, 5, 0, new CANNON.Vec3(centerX, centerY + 1, centerZ + 15));
    (exitBody as any).userData = { tag: "ground" };
    physicsWorld.world.addBody(exitBody);
    
    const exitPlatform = this.createVolcanicPlatform(5, 1, 5);
    exitPlatform.position.set(centerX, centerY + 1, centerZ + 15);
    this.mapRoot.add(exitPlatform);
    (exitBody as any).meshReference = exitPlatform;
  }

  private createCircularRockPlatform(size: number): THREE.Group {
    const group = new THREE.Group();
    
    // 圆形岩石平台
    const platformGeo = new THREE.CylinderGeometry(size / 2, size / 2 + 0.2, 0.8, 8);
    const platformMat = new THREE.MeshStandardMaterial({
      map: this.rockTexture,
      color: 0x4a4040,
      roughness: 0.95,
      flatShading: true
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.castShadow = true;
    platform.receiveShadow = true;
    group.add(platform);
    
    // 边缘发光
    const ringGeo = new THREE.TorusGeometry(size / 2, 0.08, 8, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff4500,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.4;
    group.add(ring);
    
    return group;
  }

  private createFloatingDisc(size: number): THREE.Group {
    const group = new THREE.Group();
    
    // 浮动圆盘
    const discGeo = new THREE.CylinderGeometry(size / 2, size / 2, 0.6, 12);
    const discMat = new THREE.MeshStandardMaterial({
      map: this.obsidianTexture,
      color: 0x2a1830,
      roughness: 0.3,
      metalness: 0.4
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.castShadow = true;
    disc.receiveShadow = true;
    group.add(disc);
    
    // 底部熔岩发光
    const glowGeo = new THREE.CylinderGeometry(size / 2 - 0.1, size / 2 - 0.1, 0.1, 12);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = -0.35;
    group.add(glow);
    
    // 火焰光源
    const light = new THREE.PointLight(0xff4500, 0.8, 5);
    light.position.y = -0.5;
    group.add(light);
    this.fireGlows.push(light);
    
    return group;
  }

  /**
   * 螺旋攀爬火山 - 绕圈上升到达终点
   */
  private createVerticalClimbingWall(physicsWorld: PhysicsWorld): void {
    const centerX = 0;
    const centerZ = 85;
    const baseY = 9;
    const spiralRadius = 7;
    const numPlatforms = 10; // 减少平台数量
    const totalHeight = 14;
    
    // 中央熔岩柱装饰（缩小一点避免碰撞）
    this.createCentralLavaColumn(centerX, baseY + totalHeight / 2, centerZ, totalHeight);
    
    // 螺旋上升的平台 - 只绕 0.75 圈，最后一个平台在外侧
    for (let i = 0; i < numPlatforms; i++) {
      const angle = (i / numPlatforms) * Math.PI * 1.5; // 只绕0.75圈
      const heightProgress = i / (numPlatforms - 1);
      
      const x = centerX + Math.cos(angle) * spiralRadius;
      const z = centerZ + Math.sin(angle) * spiralRadius;
      const y = baseY + heightProgress * totalHeight;
      const size = 2.8;
      
      const body = BodyFactory.createBox(size, 0.8, size, 0, new CANNON.Vec3(x, y, z));
      (body as any).userData = { tag: "ground" };
      physicsWorld.world.addBody(body);
      
      const platform = this.createClimbingLedge(size);
      platform.position.set(x, y, z);
      this.mapRoot.add(platform);
      (body as any).meshReference = platform;
      
      // 每隔几个平台添加火焰效果
      if (i % 3 === 0) {
        this.createSmallFlame(x, y + 0.5, z);
      }
    }
  }

  /**
   * 中央熔岩柱装饰
   */
  private createCentralLavaColumn(x: number, y: number, z: number, height: number): void {
    const column = new THREE.Group();
    
    // 岩石柱子 - 缩小尺寸避免阻挡跳跃
    const columnGeo = new THREE.CylinderGeometry(1.2, 1.5, height, 8);
    const columnMat = new THREE.MeshStandardMaterial({
      map: this.rockTexture,
      color: 0x2a2020,
      roughness: 1.0
    });
    const columnMesh = new THREE.Mesh(columnGeo, columnMat);
    columnMesh.castShadow = true;
    columnMesh.receiveShadow = true;
    column.add(columnMesh);
    
    // 熔岩裂缝效果
    for (let i = 0; i < 6; i++) {
      const crackGeo = new THREE.PlaneGeometry(0.2, height * 0.6);
      const crackMat = new THREE.MeshBasicMaterial({
        color: 0xff4500,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
      const crack = new THREE.Mesh(crackGeo, crackMat);
      const angle = (i / 6) * Math.PI * 2;
      crack.position.set(Math.cos(angle) * 1.3, 0, Math.sin(angle) * 1.3);
      crack.rotation.y = angle + Math.PI / 2;
      column.add(crack);
    }
    
    // 顶部发光
    const topGlowGeo = new THREE.CircleGeometry(1, 8);
    const topGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    const topGlow = new THREE.Mesh(topGlowGeo, topGlowMat);
    topGlow.rotation.x = -Math.PI / 2;
    topGlow.position.y = height / 2 + 0.1;
    column.add(topGlow);
    
    column.position.set(x, y, z);
    this.mapRoot.add(column);
  }

  private createClimbingLedge(size: number): THREE.Group {
    const group = new THREE.Group();
    
    // 岩石突出
    const ledgeGeo = new THREE.BoxGeometry(size, 0.8, size);
    const ledgeMat = new THREE.MeshStandardMaterial({
      map: this.rockTexture,
      color: 0x3a3535,
      roughness: 0.95
    });
    const ledge = new THREE.Mesh(ledgeGeo, ledgeMat);
    ledge.castShadow = true;
    ledge.receiveShadow = true;
    group.add(ledge);
    
    // 熔岩发光边缘（纯装饰，不会阻挡玩家）
    const glowGeo = new THREE.RingGeometry(size / 2 - 0.1, size / 2, 8);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff4500,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = Math.PI / 2;
    glow.position.y = -0.4;
    group.add(glow);
    
    return group;
  }

  private createVolcanicPlatform(width: number, height: number, depth: number): THREE.Group {
    const group = new THREE.Group();
    
    const mainGeo = new THREE.BoxGeometry(width, height, depth);
    const textureCopy = this.rockTexture.clone();
    textureCopy.repeat.set(width / 2, depth / 2);
    textureCopy.needsUpdate = true;
    
    const mainMat = new THREE.MeshStandardMaterial({
      map: textureCopy,
      color: 0x4a4040,
      roughness: 0.95
    });
    const main = new THREE.Mesh(mainGeo, mainMat);
    main.castShadow = true;
    main.receiveShadow = true;
    group.add(main);
    
    // 熔岩裂缝发光效果
    const crackGeo = new THREE.PlaneGeometry(width * 0.6, depth * 0.6);
    const crackMat = new THREE.MeshBasicMaterial({
      color: 0xff4500,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending
    });
    const crack = new THREE.Mesh(crackGeo, crackMat);
    crack.rotation.x = -Math.PI / 2;
    crack.position.y = height / 2 + 0.01;
    group.add(crack);
    
    return group;
  }

  /**
   * 创建平整的火山岩平台（用于Z字峡谷）
   */
  private createFlatRockPlatform(width: number, height: number, depth: number): THREE.Group {
    const group = new THREE.Group();
    
    // 平整的六边形岩石平台
    const platformGeo = new THREE.CylinderGeometry(
      Math.min(width, depth) / 2,
      Math.min(width, depth) / 2 + 0.15,
      height,
      6
    );
    const platformMat = new THREE.MeshStandardMaterial({
      map: this.rockTexture,
      color: 0x3a3535,
      roughness: 0.95,
      flatShading: true
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.castShadow = true;
    platform.receiveShadow = true;
    group.add(platform);
    
    // 顶部熔岩发光纹路
    const glowGeo = new THREE.CircleGeometry(Math.min(width, depth) / 2 - 0.2, 6);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff4500,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = height / 2 + 0.01;
    group.add(glow);
    
    return group;
  }

  private createGoalArea(physicsWorld: PhysicsWorld): void {
    // 火山祭坛平台 - 位于螺旋中央上方
    // 螺旋: baseY=9, totalHeight=14, 最后平台 y=23
    // 终点稍高于最后平台，方便跳跃
    const goalY = 24;
    const goalZ = 85; // 螺旋中心
    
    const goalBody = BodyFactory.createBox(8, 2, 8, 0, new CANNON.Vec3(0, goalY, goalZ));
    (goalBody as any).userData = { tag: "ground" };
    physicsWorld.world.addBody(goalBody);
    
    const goalPlatform = this.createVolcanoAltar();
    goalPlatform.position.set(0, goalY, goalZ);
    this.mapRoot.add(goalPlatform);
    (goalBody as any).meshReference = goalPlatform;
    
    const goalZone = PlaceholderGenerator.createZone(2, 2, 2, 0xff0000);
    goalZone.position.set(0, goalY + 2, goalZ);
    this.mapRoot.add(goalZone);
    
    // 火焰标记
    const flameMarker = this.createFlameMarker();
    flameMarker.position.set(0, goalY + 1, goalZ);
    this.mapRoot.add(flameMarker);
    
    const goalTrigger = BodyFactory.createBox(1, 2, 1, 0, new CANNON.Vec3(0, goalY + 2, goalZ));
    goalTrigger.isTrigger = true;
    (goalTrigger as any).userData = { tag: "goal" };
    physicsWorld.world.addBody(goalTrigger);
    
    // 火把装饰
    this.createTorch(-3, goalY + 1, goalZ - 3);
    this.createTorch(3, goalY + 1, goalZ - 3);
    this.createTorch(-3, goalY + 1, goalZ + 3);
    this.createTorch(3, goalY + 1, goalZ + 3);
  }

  private createVolcanoAltar(): THREE.Group {
    const group = new THREE.Group();
    
    // 主平台 - 六边形
    const mainGeo = new THREE.CylinderGeometry(6, 6.5, 2, 6);
    const mainMat = new THREE.MeshStandardMaterial({
      map: this.obsidianTexture,
      color: 0x3a2530,
      roughness: 0.4,
      metalness: 0.3
    });
    const main = new THREE.Mesh(mainGeo, mainMat);
    main.castShadow = true;
    main.receiveShadow = true;
    group.add(main);
    
    // 熔岩纹路
    const ringGeo = new THREE.TorusGeometry(5, 0.2, 8, 6);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff4500,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.01;
    group.add(ring);
    
    // 发光效果
    const light = new THREE.PointLight(0xff4500, 1.5, 15);
    light.position.y = 2;
    group.add(light);
    this.fireGlows.push(light);
    
    return group;
  }

  private createFlameMarker(): THREE.Group {
    const group = new THREE.Group();
    
    // 底座
    const baseGeo = new THREE.CylinderGeometry(0.4, 0.5, 0.4, 8);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x2a1830,
      roughness: 0.4,
      metalness: 0.5
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.2;
    group.add(base);
    
    // 火焰效果
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    
    for (let i = 0; i < 3; i++) {
      const flameGeo = new THREE.ConeGeometry(0.2 - i * 0.05, 0.8 - i * 0.1, 8);
      const flame = new THREE.Mesh(flameGeo, flameMat.clone());
      (flame.material as THREE.MeshBasicMaterial).opacity = 0.8 - i * 0.2;
      (flame.material as THREE.MeshBasicMaterial).color.setHex(i === 0 ? 0xff4400 : i === 1 ? 0xff6600 : 0xffaa00);
      flame.position.y = 0.8 + i * 0.2;
      flame.scale.x = 1 - i * 0.2;
      flame.scale.z = 1 - i * 0.2;
      group.add(flame);
    }
    
    // 强光源
    const light = new THREE.PointLight(0xff4500, 2, 10);
    light.position.y = 1.2;
    group.add(light);
    this.fireGlows.push(light);
    
    return group;
  }

  private createSmallFlame(x: number, y: number, z: number): void {
    const flame = new THREE.Group();
    
    const flameGeo = new THREE.ConeGeometry(0.15, 0.4, 6);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    const main = new THREE.Mesh(flameGeo, flameMat);
    main.position.y = 0.2;
    flame.add(main);
    
    const light = new THREE.PointLight(0xff4500, 0.5, 4);
    light.position.y = 0.3;
    flame.add(light);
    this.fireGlows.push(light);
    
    flame.position.set(x, y, z);
    this.mapRoot.add(flame);
  }

  private createTorch(x: number, y: number, z: number): void {
    const torch = new THREE.Group();
    
    // 火把杆
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.15, 2, 8);
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x3a3030,
      roughness: 0.9
    });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 1;
    pole.castShadow = true;
    torch.add(pole);
    
    // 火盆
    const bowlGeo = new THREE.CylinderGeometry(0.25, 0.15, 0.3, 8);
    const bowl = new THREE.Mesh(bowlGeo, poleMat);
    bowl.position.y = 2.15;
    bowl.castShadow = true;
    torch.add(bowl);
    
    // 火焰
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const flameGeo = new THREE.ConeGeometry(0.2, 0.5, 8);
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.y = 2.55;
    torch.add(flame);
    
    // 火光
    const light = new THREE.PointLight(0xff4500, 1.5, 8);
    light.position.y = 2.5;
    torch.add(light);
    this.fireGlows.push(light);
    
    torch.position.set(x, y, z);
    this.mapRoot.add(torch);
  }

  private createLavaPool(x: number, y: number, z: number, width: number, depth: number): void {
    const poolGeo = new THREE.PlaneGeometry(width, depth);
    const poolMat = new THREE.MeshBasicMaterial({
      color: 0xff4500,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, y, z);
    this.mapRoot.add(pool);
    this.lavaPools.push(pool);
    
    // 发光效果
    const light = new THREE.PointLight(0xff4500, 2, 15);
    light.position.set(x, y + 1, z);
    this.mapRoot.add(light);
    this.fireGlows.push(light);
  }

  private createLavaDecorations(): void {
    // 在地图边缘添加一些熔岩池装饰
    this.createLavaPool(-15, -2, 30, 5, 8);
    this.createLavaPool(15, -2, 45, 6, 6);
    this.createLavaPool(-12, 5, 65, 4, 5);
  }

  private createLavaEmbers(): void {
    const emberCount = 800;
    const positions = new Float32Array(emberCount * 3);
    
    for (let i = 0; i < emberCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 10 - 2;
      positions[i * 3 + 2] = Math.random() * 80 + 10;
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: 0xff6600,
      size: 0.12,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    this.lavaEmbers = new THREE.Points(geometry, material);
    this.mapRoot.add(this.lavaEmbers);
  }
}
