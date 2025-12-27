import * as THREE from "three";
import * as CANNON from "cannon-es";
import { MapBuilder, MapDefinition } from "./MapDefinition";
import { PhysicsWorld } from "../../physics/PhysicsWorld";
import { Resources } from "../Resources";
import { BodyFactory } from "../../physics/BodyFactory";
import { PlaceholderGenerator } from "../../utils/PlaceholderGenerator";

/**
 * 冰霜王国地图 - 螺旋冰塔与滑冰坡道
 * 道路特色：螺旋上升 → 滑冰坡道 → 悬空冰桥网络
 */
export class IceKingdomMap implements MapBuilder {
  definition: MapDefinition = {
    id: "ice_kingdom",
    name: "冰霜王国",
    description: "攀登螺旋冰塔，滑下冰坡，穿越悬空冰桥",
    previewColor: 0x87ceeb,
    skyColor: 0xb0e0e6,
    fogColor: 0xc5e8f0,
    fogNear: 40,
    fogFar: 100,
  };

  private iceTexture!: THREE.Texture;
  private snowTexture!: THREE.Texture;
  private mapRoot!: THREE.Group;
  private snowflakes: THREE.Points | null = null;
  private icicles: THREE.Mesh[] = [];
  private auroras: THREE.Mesh[] = [];

  build(
    _scene: THREE.Scene,
    physicsWorld: PhysicsWorld,
    _resources: Resources,
    mapRoot: THREE.Group
  ): void {
    this.mapRoot = mapRoot;
    this.initTextures();
    
    // 创建起点雪地区域
    this.createStartArea(physicsWorld);
    
    // 第一阶段：螺旋冰塔（环绕中央冰柱上升）
    this.createSpiralIceTower(physicsWorld);
    
    // 第二阶段：滑冰坡道（弧形下滑）
    this.createIceSlide(physicsWorld);
    
    // 第三阶段：悬空冰桥网络（多路选择）
    this.createSuspendedIceBridges(physicsWorld);
    
    // 创建终点冰宫
    this.createGoalArea(physicsWorld);
    
    // 创建雪花粒子
    this.createSnowfall();
    
    // 创建极光效果
    this.createAurora();
  }

  update(time: number): void {
    // 更新雪花
    if (this.snowflakes) {
      this.snowflakes.rotation.y = time * 0.02;
      const positions = this.snowflakes.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        let y = positions.getY(i);
        y -= 0.02;
        if (y < -5) y = 25;
        positions.setY(i, y);
      }
      positions.needsUpdate = true;
    }
    
    // 更新冰锥闪烁
    this.icicles.forEach((icicle, idx) => {
      const mat = icicle.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.1 + Math.sin(time * 2 + idx) * 0.05;
    });
    
    // 更新极光
    this.auroras.forEach((aurora, idx) => {
      const mat = aurora.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.2 + Math.sin(time * 0.5 + idx * 0.5) * 0.1;
      aurora.position.x = Math.sin(time * 0.1 + idx) * 5;
    });
  }

  cleanup(): void {
    this.snowflakes = null;
    this.icicles = [];
    this.auroras = [];
  }

  private initTextures(): void {
    this.iceTexture = PlaceholderGenerator.createCheckerTexture("#a8d8ea", "#cce5f0");
    this.iceTexture.wrapS = THREE.RepeatWrapping;
    this.iceTexture.wrapT = THREE.RepeatWrapping;
    
    this.snowTexture = PlaceholderGenerator.createCheckerTexture("#f0f8ff", "#ffffff");
    this.snowTexture.wrapS = THREE.RepeatWrapping;
    this.snowTexture.wrapT = THREE.RepeatWrapping;
  }

  private createStartArea(physicsWorld: PhysicsWorld): void {
    // 雪地平台
    const startBody = BodyFactory.createBox(14, 2, 14, 0, new CANNON.Vec3(0, -1, 0));
    (startBody as any).userData = { tag: "ground" };
    physicsWorld.world.addBody(startBody);

    const startMesh = this.createSnowPlatform(14, 2, 14);
    startMesh.position.set(0, -1, 0);
    this.mapRoot.add(startMesh);
    (startBody as any).meshReference = startMesh;
    
    const startZone = PlaceholderGenerator.createZone(2, 2, 2, 0x0000ff);
    startZone.position.set(0, 1, 0);
    this.mapRoot.add(startZone);
    
    // 冰晶装饰
    this.createIceCrystal(-5, 0, -5, 1.2);
    this.createIceCrystal(5, 0, -5, 1.0);
    this.createIceCrystal(-5, 0, 5, 0.9);
    this.createIceCrystal(5, 0, 5, 1.1);
  }

  /**
   * 螺旋冰塔 - 环绕中央巨大冰柱的螺旋上升平台
   */
  private createSpiralIceTower(physicsWorld: PhysicsWorld): void {
    const centerX = 0;
    const centerZ = 25;
    const radius = 8;
    const totalHeight = 12;
    const numPlatforms = 10;
    
    // 创建中央巨大冰柱
    this.createCentralIcePillar(centerX, centerZ, totalHeight + 2);
    
    // 螺旋上升的平台
    for (let i = 0; i < numPlatforms; i++) {
      const angle = (i / numPlatforms) * Math.PI * 2.5; // 2.5圈
      const height = 1 + (i / numPlatforms) * totalHeight;
      const x = centerX + Math.cos(angle) * radius;
      const z = centerZ + Math.sin(angle) * radius;
      
      // 平台大小逐渐变小
      const platformSize = 3.5 - i * 0.15;
      
      const body = BodyFactory.createBox(platformSize, 0.8, platformSize, 0, new CANNON.Vec3(x, height, z));
      (body as any).userData = { tag: "ground" };
      physicsWorld.world.addBody(body);
      
      const platform = this.createIcePlatform(platformSize, 0.8, platformSize);
      platform.position.set(x, height, z);
      this.mapRoot.add(platform);
      (body as any).meshReference = platform;
      
      // 添加冰锥装饰
      if (i % 3 === 0) {
        this.createHangingIcicles(x, height - 0.5, z, 3);
      }
    }
  }

  private createCentralIcePillar(x: number, z: number, height: number): void {
    const pillar = new THREE.Group();
    
    // 主冰柱
    const pillarGeo = new THREE.CylinderGeometry(2, 3, height, 8);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x88ccee,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.7
    });
    const main = new THREE.Mesh(pillarGeo, pillarMat);
    main.position.y = height / 2;
    main.castShadow = true;
    pillar.add(main);
    
    // 发光核心
    const coreGeo = new THREE.CylinderGeometry(0.8, 1.2, height - 2, 8);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x66aaff,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = height / 2;
    pillar.add(core);
    
    // 顶部冰晶
    const topGeo = new THREE.OctahedronGeometry(1.5, 0);
    const topMat = new THREE.MeshStandardMaterial({
      color: 0xaaddff,
      metalness: 0.6,
      roughness: 0.1,
      transparent: true,
      opacity: 0.8,
      emissive: 0x4488cc,
      emissiveIntensity: 0.2
    });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = height + 1;
    top.scale.y = 1.5;
    pillar.add(top);
    
    pillar.position.set(x, 0, z);
    this.mapRoot.add(pillar);
  }

  /**
   * 滑冰坡道 - 弧形的冰滑道下降
   */
  private createIceSlide(physicsWorld: PhysicsWorld): void {
    const startX = 8;
    const startZ = 33;
    const startY = 13;
    
    // 滑道由多段组成，形成弧形
    const segments = 8;
    const slideLength = 4;
    const totalDrop = 6;
    const curveAngle = Math.PI * 0.4; // 弧形角度
    
    let currentX = startX;
    let currentZ = startZ;
    let currentY = startY;
    let currentAngle = 0;
    
    for (let i = 0; i < segments; i++) {
      const segmentAngle = currentAngle + (i / segments) * curveAngle;
      const dropPerSegment = totalDrop / segments;
      
      // 计算这段的倾斜角度
      const tiltAngle = Math.atan2(dropPerSegment, slideLength);
      
      const body = BodyFactory.createBox(3, 0.5, slideLength, 0, new CANNON.Vec3(currentX, currentY - dropPerSegment / 2, currentZ + slideLength / 2));
      
      // 设置倾斜
      const quat = new CANNON.Quaternion();
      quat.setFromEuler(-tiltAngle, segmentAngle, 0);
      body.quaternion.copy(quat);
      (body as any).userData = { tag: "ground" };
      physicsWorld.world.addBody(body);
      
      const slideMesh = this.createSlideSegment(3, 0.5, slideLength);
      slideMesh.position.set(currentX, currentY - dropPerSegment / 2, currentZ + slideLength / 2);
      slideMesh.rotation.set(-tiltAngle, segmentAngle, 0);
      this.mapRoot.add(slideMesh);
      (body as any).meshReference = slideMesh;
      
      // 更新下一段的起点
      currentX += Math.sin(segmentAngle) * slideLength;
      currentZ += Math.cos(segmentAngle) * slideLength;
      currentY -= dropPerSegment;
    }
    
    // 滑道终点平台
    const endBody = BodyFactory.createBox(5, 1, 5, 0, new CANNON.Vec3(currentX, currentY - 0.5, currentZ + 2.5));
    (endBody as any).userData = { tag: "ground" };
    physicsWorld.world.addBody(endBody);
    
    const endPlatform = this.createIcePlatform(5, 1, 5);
    endPlatform.position.set(currentX, currentY - 0.5, currentZ + 2.5);
    this.mapRoot.add(endPlatform);
    (endBody as any).meshReference = endPlatform;
  }

  private createSlideSegment(width: number, height: number, length: number): THREE.Group {
    const group = new THREE.Group();
    
    // 滑道主体
    const slideGeo = new THREE.BoxGeometry(width, height, length);
    const slideMat = new THREE.MeshStandardMaterial({
      color: 0xaaddee,
      roughness: 0.02, // 非常光滑
      metalness: 0.4,
      transparent: true,
      opacity: 0.85
    });
    const slide = new THREE.Mesh(slideGeo, slideMat);
    slide.castShadow = true;
    slide.receiveShadow = true;
    group.add(slide);
    
    // 两侧护栏
    const railGeo = new THREE.BoxGeometry(0.2, 0.6, length);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xc5e8f0,
      roughness: 0.1,
      transparent: true,
      opacity: 0.7
    });
    
    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.position.set(-width / 2 - 0.1, 0.3, 0);
    group.add(leftRail);
    
    const rightRail = new THREE.Mesh(railGeo, railMat);
    rightRail.position.set(width / 2 + 0.1, 0.3, 0);
    group.add(rightRail);
    
    return group;
  }

  /**
   * 悬空冰桥网络 - 多条可选路线的冰桥
   */
  private createSuspendedIceBridges(physicsWorld: PhysicsWorld): void {
    // 起点连接平台 (从滑道终点连接)
    const hubX = 15;
    const hubZ = 60;
    const hubY = 6;
    
    // 中央枢纽平台
    const hubBody = BodyFactory.createBox(6, 1, 6, 0, new CANNON.Vec3(hubX, hubY, hubZ));
    (hubBody as any).userData = { tag: "ground" };
    physicsWorld.world.addBody(hubBody);
    
    const hubPlatform = this.createIcePlatform(6, 1, 6);
    hubPlatform.position.set(hubX, hubY, hubZ);
    this.mapRoot.add(hubPlatform);
    (hubBody as any).meshReference = hubPlatform;
    
    // 连接滑道终点到枢纽的桥
    this.createIceBridge(8, 6.5, 55, hubX, hubY, hubZ - 3, physicsWorld);
    
    // 三条分叉路线
    
    // 左路：窄冰桥，需要平衡
    this.createNarrowIcePath(hubX - 3, hubY, hubZ + 3, physicsWorld);
    
    // 中路：跳跃冰块，需要精确跳跃
    this.createJumpingIceBlocks(hubX, hubY - 1, hubZ + 5, physicsWorld);
    
    // 右路：宽阔但有间隙
    this.createGappedIcePath(hubX + 3, hubY, hubZ + 3, physicsWorld);
    
    // 三条路汇合的平台
    const convergeBody = BodyFactory.createBox(8, 1, 6, 0, new CANNON.Vec3(20, 5, 75));
    (convergeBody as any).userData = { tag: "ground" };
    physicsWorld.world.addBody(convergeBody);
    
    const convergePlatform = this.createIcePlatform(8, 1, 6);
    convergePlatform.position.set(20, 5, 75);
    this.mapRoot.add(convergePlatform);
    (convergeBody as any).meshReference = convergePlatform;
  }

  private createIceBridge(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, physicsWorld: PhysicsWorld): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const midZ = (z1 + z2) / 2;
    
    const body = BodyFactory.createBox(2.5, 0.6, length, 0, new CANNON.Vec3(midX, midY, midZ));
    const angle = Math.atan2(dx, dz);
    const tilt = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));
    const quat = new CANNON.Quaternion();
    quat.setFromEuler(-tilt, angle, 0);
    body.quaternion.copy(quat);
    (body as any).userData = { tag: "ground" };
    physicsWorld.world.addBody(body);
    
    const bridgeMesh = this.createIcePlatform(2.5, 0.6, length);
    bridgeMesh.position.set(midX, midY, midZ);
    bridgeMesh.rotation.set(-tilt, angle, 0);
    this.mapRoot.add(bridgeMesh);
    (body as any).meshReference = bridgeMesh;
  }

  private createNarrowIcePath(startX: number, startY: number, startZ: number, physicsWorld: PhysicsWorld): void {
    // 窄冰桥路线 - 需要小心平衡
    const segments = 5;
    for (let i = 0; i < segments; i++) {
      const x = startX - 5 - i * 1.5;
      const z = startZ + i * 3;
      const y = startY - i * 0.2;
      
      const body = BodyFactory.createBox(1.2, 0.5, 3, 0, new CANNON.Vec3(x, y, z));
      (body as any).userData = { tag: "ground" };
      physicsWorld.world.addBody(body);
      
      const platform = this.createIcePlatform(1.2, 0.5, 3);
      platform.position.set(x, y, z);
      this.mapRoot.add(platform);
      (body as any).meshReference = platform;
    }
    
    // 连接到汇合点
    const endBody = BodyFactory.createBox(3, 0.5, 4, 0, new CANNON.Vec3(12, 5, 72));
    (endBody as any).userData = { tag: "ground" };
    physicsWorld.world.addBody(endBody);
    
    const endPlatform = this.createIcePlatform(3, 0.5, 4);
    endPlatform.position.set(12, 5, 72);
    this.mapRoot.add(endPlatform);
    (endBody as any).meshReference = endPlatform;
  }

  private createJumpingIceBlocks(startX: number, startY: number, startZ: number, physicsWorld: PhysicsWorld): void {
    // 跳跃冰块路线 - 需要精确跳跃
    const blockPositions = [
      { x: 0, y: 0, z: 0 },
      { x: 1.5, y: 0.5, z: 4 },
      { x: -1, y: 1, z: 8 },
      { x: 2, y: 0.5, z: 12 },
      { x: 0, y: 0, z: 16 },
    ];
    
    blockPositions.forEach((pos, i) => {
      const x = startX + pos.x;
      const y = startY + pos.y;
      const z = startZ + pos.z;
      const size = 2 - i * 0.1;
      
      const body = BodyFactory.createBox(size, 1, size, 0, new CANNON.Vec3(x, y, z));
      (body as any).userData = { tag: "ground" };
      physicsWorld.world.addBody(body);
      
      const block = this.createFloatingIceBlock(size);
      block.position.set(x, y, z);
      this.mapRoot.add(block);
      (body as any).meshReference = block;
    });
  }

  private createFloatingIceBlock(size: number): THREE.Group {
    const group = new THREE.Group();
    
    const blockGeo = new THREE.BoxGeometry(size, 1, size);
    const blockMat = new THREE.MeshStandardMaterial({
      color: 0x99ddff,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.8
    });
    const block = new THREE.Mesh(blockGeo, blockMat);
    block.castShadow = true;
    block.receiveShadow = true;
    group.add(block);
    
    // 发光效果
    const glowGeo = new THREE.BoxGeometry(size + 0.2, 1.2, size + 0.2);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x66aaff,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    group.add(glow);
    
    return group;
  }

  private createGappedIcePath(startX: number, startY: number, startZ: number, physicsWorld: PhysicsWorld): void {
    // 宽阔但有间隙的路线
    const platforms = [
      { x: 6, z: 0, w: 4, d: 4 },
      { x: 8, z: 6, w: 3, d: 3 },
      { x: 6, z: 12, w: 4, d: 3 },
    ];
    
    platforms.forEach((p, i) => {
      const x = startX + p.x;
      const z = startZ + p.z;
      const y = startY - i * 0.3;
      
      const body = BodyFactory.createBox(p.w, 0.8, p.d, 0, new CANNON.Vec3(x, y, z));
      (body as any).userData = { tag: "ground" };
      physicsWorld.world.addBody(body);
      
      const platform = this.createIcePlatform(p.w, 0.8, p.d);
      platform.position.set(x, y, z);
      this.mapRoot.add(platform);
      (body as any).meshReference = platform;
    });
  }

  private createIcePlatform(width: number, height: number, depth: number): THREE.Group {
    const group = new THREE.Group();
    
    const mainGeo = new THREE.BoxGeometry(width, height, depth);
    const mainMat = new THREE.MeshStandardMaterial({
      color: 0x9dd8e8,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.85
    });
    const main = new THREE.Mesh(mainGeo, mainMat);
    main.castShadow = true;
    main.receiveShadow = true;
    group.add(main);
    
    // 顶部积雪
    const snowGeo = new THREE.BoxGeometry(width * 0.95, 0.15, depth * 0.95);
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const snow = new THREE.Mesh(snowGeo, snowMat);
    snow.position.y = height / 2 + 0.075;
    snow.receiveShadow = true;
    group.add(snow);
    
    return group;
  }

  private createSnowPlatform(width: number, height: number, depth: number): THREE.Group {
    const group = new THREE.Group();
    
    const mainGeo = new THREE.BoxGeometry(width, height, depth);
    const textureCopy = this.snowTexture.clone();
    textureCopy.repeat.set(width / 4, depth / 4);
    textureCopy.needsUpdate = true;
    
    const mainMat = new THREE.MeshStandardMaterial({
      map: textureCopy,
      color: 0xffffff,
      roughness: 0.8
    });
    const main = new THREE.Mesh(mainGeo, mainMat);
    main.castShadow = true;
    main.receiveShadow = true;
    group.add(main);
    
    return group;
  }

  private createGoalArea(physicsWorld: PhysicsWorld): void {
    // 冰宫平台
    const goalBody = BodyFactory.createBox(12, 2, 12, 0, new CANNON.Vec3(20, 5, 85));
    (goalBody as any).userData = { tag: "ground" };
    physicsWorld.world.addBody(goalBody);
    
    const goalPlatform = this.createIcePalacePlatform();
    goalPlatform.position.set(20, 5, 85);
    this.mapRoot.add(goalPlatform);
    (goalBody as any).meshReference = goalPlatform;
    
    const goalZone = PlaceholderGenerator.createZone(2, 2, 2, 0xff0000);
    goalZone.position.set(20, 7, 85);
    this.mapRoot.add(goalZone);
    
    // 冰之王座标记
    const throneFlag = this.createIceThrone();
    throneFlag.position.set(20, 6, 85);
    this.mapRoot.add(throneFlag);
    
    const goalTrigger = BodyFactory.createBox(1, 2, 1, 0, new CANNON.Vec3(20, 7, 85));
    goalTrigger.isTrigger = true;
    (goalTrigger as any).userData = { tag: "goal" };
    physicsWorld.world.addBody(goalTrigger);
    
    // 冰柱装饰
    this.createIceCrystal(15, 6, 80, 1.5);
    this.createIceCrystal(25, 6, 80, 1.3);
    this.createIceCrystal(15, 6, 90, 1.4);
    this.createIceCrystal(25, 6, 90, 1.5);
  }

  private createIcePalacePlatform(): THREE.Group {
    const group = new THREE.Group();
    
    // 主平台
    const mainGeo = new THREE.CylinderGeometry(6, 6.5, 2, 8);
    const mainMat = new THREE.MeshStandardMaterial({
      map: this.iceTexture,
      color: 0xb0e0e6,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.9
    });
    const main = new THREE.Mesh(mainGeo, mainMat);
    main.castShadow = true;
    main.receiveShadow = true;
    group.add(main);
    
    // 装饰环
    const ringGeo = new THREE.TorusGeometry(5.8, 0.2, 8, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xe0f0ff,
      metalness: 0.5,
      roughness: 0.1,
      emissive: 0x4488aa,
      emissiveIntensity: 0.2
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1;
    group.add(ring);
    
    return group;
  }

  private createIceThrone(): THREE.Group {
    const group = new THREE.Group();
    
    // 底座
    const baseGeo = new THREE.CylinderGeometry(0.5, 0.6, 0.3, 6);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0xc5e8f0,
      metalness: 0.5,
      roughness: 0.1
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.15;
    group.add(base);
    
    // 冰晶柱
    const crystalGeo = new THREE.OctahedronGeometry(0.4, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      metalness: 0.6,
      roughness: 0.1,
      transparent: true,
      opacity: 0.8,
      emissive: 0x4488cc,
      emissiveIntensity: 0.3
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.y = 0.8;
    crystal.scale.y = 2;
    group.add(crystal);
    
    // 光效
    const light = new THREE.PointLight(0x88ccff, 1, 8);
    light.position.y = 1;
    group.add(light);
    
    return group;
  }

  private createIceCrystal(x: number, y: number, z: number, scale: number): void {
    const crystal = new THREE.Group();
    
    // 主晶体
    const mainGeo = new THREE.OctahedronGeometry(0.6 * scale, 0);
    const mainMat = new THREE.MeshStandardMaterial({
      color: 0x88ccee,
      metalness: 0.6,
      roughness: 0.1,
      transparent: true,
      opacity: 0.75,
      emissive: 0x4488aa,
      emissiveIntensity: 0.15
    });
    const main = new THREE.Mesh(mainGeo, mainMat);
    main.scale.y = 2;
    main.position.y = 1.2 * scale;
    main.castShadow = true;
    crystal.add(main);
    
    // 小晶体
    for (let i = 0; i < 3; i++) {
      const smallGeo = new THREE.OctahedronGeometry(0.25 * scale, 0);
      const small = new THREE.Mesh(smallGeo, mainMat);
      small.scale.y = 1.5;
      small.position.set(
        Math.cos(i * Math.PI * 2 / 3) * 0.5 * scale,
        0.5 * scale,
        Math.sin(i * Math.PI * 2 / 3) * 0.5 * scale
      );
      small.rotation.z = (Math.random() - 0.5) * 0.3;
      small.castShadow = true;
      crystal.add(small);
    }
    
    crystal.position.set(x, y, z);
    this.mapRoot.add(crystal);
  }

  private createHangingIcicles(x: number, y: number, z: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const height = 0.5 + Math.random() * 0.5;
      const icicleGeo = new THREE.ConeGeometry(0.08, height, 4);
      const icicleMat = new THREE.MeshStandardMaterial({
        color: 0xb0e0e6,
        roughness: 0.1,
        metalness: 0.4,
        transparent: true,
        opacity: 0.8,
        emissive: 0x446688,
        emissiveIntensity: 0.1
      });
      const icicle = new THREE.Mesh(icicleGeo, icicleMat);
      icicle.position.set(
        x + (Math.random() - 0.5) * 2,
        y - height / 2,
        z + (Math.random() - 0.5) * 2
      );
      icicle.rotation.x = Math.PI;
      icicle.castShadow = true;
      this.mapRoot.add(icicle);
      this.icicles.push(icicle);
    }
  }

  private createSnowfall(): void {
    const snowCount = 1500;
    const positions = new Float32Array(snowCount * 3);
    
    for (let i = 0; i < snowCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = Math.random() * 30;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120 + 40;
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.15,
      transparent: true,
      opacity: 0.8,
      depthWrite: false
    });
    
    this.snowflakes = new THREE.Points(geometry, material);
    this.mapRoot.add(this.snowflakes);
  }

  private createAurora(): void {
    const auroraColors = [0x00ff88, 0x00ffaa, 0x88ffaa];
    
    for (let i = 0; i < 3; i++) {
      const auroraGeo = new THREE.PlaneGeometry(40, 8);
      const auroraMat = new THREE.MeshBasicMaterial({
        color: auroraColors[i],
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const aurora = new THREE.Mesh(auroraGeo, auroraMat);
      aurora.position.set(10 + i * 5, 35 - i * 2, 40 + i * 20);
      aurora.rotation.x = Math.PI * 0.2;
      aurora.rotation.z = Math.PI * 0.1 * (i - 1);
      this.mapRoot.add(aurora);
      this.auroras.push(aurora);
    }
  }
}
