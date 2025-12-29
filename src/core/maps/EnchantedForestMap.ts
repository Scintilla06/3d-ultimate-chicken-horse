import * as THREE from "three";
import * as CANNON from "cannon-es";
import { MapBuilder, MapDefinition } from "./MapDefinition";
import { PhysicsWorld } from "../../physics/PhysicsWorld";
import { Resources } from "../Resources";
import { BodyFactory } from "../../physics/BodyFactory";
import { PlaceholderGenerator } from "../../utils/PlaceholderGenerator";

/**
 * Enchanted Forest Map
 */
export class EnchantedForestMap implements MapBuilder {
  definition: MapDefinition = {
    id: "enchanted_forest",
    name: "Enchanted Forest",
    description: "Traverse the ancient forest, jump on tree stumps and rocks",
    previewColor: 0x228b22,
    skyColor: 0x87ceeb,
    fogColor: 0x9dd5e8,
    fogNear: 50,
    fogFar: 120,
  };

  private fireflies: { mesh: THREE.Mesh; basePos: THREE.Vector3; offset: THREE.Vector3; speed: THREE.Vector3 }[] = [];
  private grassTexture!: THREE.Texture;
  private stoneTexture!: THREE.Texture;
  private woodTexture!: THREE.Texture;
  private mapRoot!: THREE.Group;

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
    
    // 创建木桩跳台
    this.createWoodStumpPlatforms(physicsWorld);
    
    // 创建石头阶梯
    this.createStoneStairs(physicsWorld);
    
    // 创建L形树桥
    this.createTreeBridge(physicsWorld);
    
    // 创建漂浮岩石
    this.createFloatingRocks(physicsWorld);
    
    // 创建终点区域
    this.createGoalArea(physicsWorld);
    
    // 创建萤火虫
    this.createFireflies();
  }

  update(time: number): void {
    // 更新萤火虫动画
    this.fireflies.forEach(ff => {
      const wanderRadius = 1.5;
      ff.mesh.position.x = ff.basePos.x + Math.sin(time * ff.speed.x + ff.offset.x) * wanderRadius;
      ff.mesh.position.y = ff.basePos.y + Math.sin(time * ff.speed.y + ff.offset.y) * wanderRadius * 0.5;
      ff.mesh.position.z = ff.basePos.z + Math.cos(time * ff.speed.z + ff.offset.z) * wanderRadius;
      
      const mat = ff.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.6 + Math.sin(time * 3 + ff.offset.x) * 0.4;
    });
  }

  cleanup(): void {
    this.fireflies = [];
  }

  private initTextures(): void {
    this.grassTexture = PlaceholderGenerator.createCheckerTexture("#2d5a27", "#3d7a37");
    this.grassTexture.wrapS = THREE.RepeatWrapping;
    this.grassTexture.wrapT = THREE.RepeatWrapping;
    
    this.stoneTexture = PlaceholderGenerator.createCheckerTexture("#5a5a5a", "#7a7a7a");
    this.stoneTexture.wrapS = THREE.RepeatWrapping;
    this.stoneTexture.wrapT = THREE.RepeatWrapping;
    
    this.woodTexture = PlaceholderGenerator.createCheckerTexture("#5c3a21", "#7a4a31");
    this.woodTexture.wrapS = THREE.RepeatWrapping;
    this.woodTexture.wrapT = THREE.RepeatWrapping;
  }

  private createPlatformMesh(width: number, height: number, depth: number, texture: THREE.Texture): THREE.Mesh {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const textureCopy = texture.clone();
    textureCopy.repeat.set(width / 2, depth / 2);
    textureCopy.needsUpdate = true;
    
    const mat = new THREE.MeshStandardMaterial({ map: textureCopy, roughness: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private createStartArea(physicsWorld: PhysicsWorld): void {
    const startPlatBody = BodyFactory.createBox(12, 2, 12, 0, new CANNON.Vec3(0, -1, 0));
    (startPlatBody as any).userData = { tag: "ground" };
    physicsWorld.world.addBody(startPlatBody);

    const startPlatMesh = this.createPlatformMesh(12, 2, 12, this.grassTexture);
    startPlatMesh.position.set(0, -1, 0);
    this.mapRoot.add(startPlatMesh);
    (startPlatBody as any).meshReference = startPlatMesh;
    
    const startZone = PlaceholderGenerator.createZone(2, 2, 2, 0x0000ff);
    startZone.position.set(0, 1, 0);
    this.mapRoot.add(startZone);
    
    this.createTree(-4, 0, -4, 1.0);
    this.createTree(4, 0, -4, 0.9);
    this.createTree(-4, 0, 4, 0.8);
    this.createTree(4, 0, 4, 0.9);
  }

  private createWoodStumpPlatforms(physicsWorld: PhysicsWorld): void {
    const stumpPositions = [
      { x: 3, y: 0.5, z: 8, scale: 1.0 },
      { x: -2, y: 1.5, z: 12, scale: 0.8 },
      { x: 4, y: 2.5, z: 16, scale: 1.2 },
      { x: -1, y: 3.5, z: 20, scale: 0.9 },
    ];
    
    stumpPositions.forEach(pos => {
      this.createWoodStump(pos.x, pos.y, pos.z, pos.scale, physicsWorld);
    });
  }

  private createWoodStump(x: number, y: number, z: number, scale: number, physicsWorld: PhysicsWorld): void {
    const stumpRadius = 1.5 * scale;
    const stumpHeight = 2 * scale;
    
    const body = BodyFactory.createBox(stumpRadius * 2, stumpHeight, stumpRadius * 2, 0, new CANNON.Vec3(x, y + stumpHeight / 2, z));
    (body as any).userData = { tag: "ground" };
    physicsWorld.world.addBody(body);
    
    const stump = new THREE.Group();
    
    const stumpGeo = new THREE.CylinderGeometry(stumpRadius, stumpRadius * 1.1, stumpHeight, 12);
    const textureCopy = this.woodTexture.clone();
    textureCopy.repeat.set(2, 2);
    textureCopy.needsUpdate = true;
    const stumpMat = new THREE.MeshStandardMaterial({ map: textureCopy, roughness: 0.9 });
    const stumpMesh = new THREE.Mesh(stumpGeo, stumpMat);
    stumpMesh.position.y = stumpHeight / 2;
    stumpMesh.castShadow = true;
    stumpMesh.receiveShadow = true;
    stump.add(stumpMesh);
    
    const topGeo = new THREE.CircleGeometry(stumpRadius, 16);
    const topMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.8 });
    const topMesh = new THREE.Mesh(topGeo, topMat);
    topMesh.rotation.x = -Math.PI / 2;
    topMesh.position.y = stumpHeight;
    topMesh.receiveShadow = true;
    stump.add(topMesh);
    
    stump.position.set(x, y, z);
    this.mapRoot.add(stump);
    (body as any).meshReference = stump;
  }

  private createStoneStairs(physicsWorld: PhysicsWorld): void {
    const stairStart = { x: 2, z: 24 };
    for (let i = 0; i < 5; i++) {
      const stepBody = BodyFactory.createBox(3, 0.5, 2, 0, new CANNON.Vec3(stairStart.x - i * 0.5, 4 + i * 0.8, stairStart.z + i * 2.5));
      (stepBody as any).userData = { tag: "ground" };
      physicsWorld.world.addBody(stepBody);
      
      const stepMesh = this.createPlatformMesh(3, 0.5, 2, this.stoneTexture);
      stepMesh.position.set(stairStart.x - i * 0.5, 4 + i * 0.8, stairStart.z + i * 2.5);
      this.mapRoot.add(stepMesh);
      (stepBody as any).meshReference = stepMesh;
    }
  }

  private createTreeBridge(physicsWorld: PhysicsWorld): void {
    // 第一段
    const bridge1Body = BodyFactory.createBox(4, 1, 10, 0, new CANNON.Vec3(-3, 8, 40));
    (bridge1Body as any).userData = { tag: "ground" };
    physicsWorld.world.addBody(bridge1Body);
    
    const bridge1Mesh = this.createPlatformMesh(4, 1, 10, this.woodTexture);
    bridge1Mesh.position.set(-3, 8, 40);
    this.mapRoot.add(bridge1Mesh);
    (bridge1Body as any).meshReference = bridge1Mesh;
    
    this.createRailing(-5, 8.5, 35, 0, 10, physicsWorld);
    this.createRailing(-1, 8.5, 35, 0, 10, physicsWorld);
    
    // 转角
    const cornerBody = BodyFactory.createBox(4, 1, 4, 0, new CANNON.Vec3(-3, 8, 47));
    (cornerBody as any).userData = { tag: "ground" };
    physicsWorld.world.addBody(cornerBody);
    
    const cornerMesh = this.createPlatformMesh(4, 1, 4, this.woodTexture);
    cornerMesh.position.set(-3, 8, 47);
    this.mapRoot.add(cornerMesh);
    (cornerBody as any).meshReference = cornerMesh;
    
    // 第二段
    const bridge2Body = BodyFactory.createBox(10, 1, 4, 0, new CANNON.Vec3(4, 8, 47));
    (bridge2Body as any).userData = { tag: "ground" };
    physicsWorld.world.addBody(bridge2Body);
    
    const bridge2Mesh = this.createPlatformMesh(10, 1, 4, this.woodTexture);
    bridge2Mesh.position.set(4, 8, 47);
    this.mapRoot.add(bridge2Mesh);
    (bridge2Body as any).meshReference = bridge2Mesh;
    
    this.createRailing(-1, 8.5, 49, Math.PI / 2, 10, physicsWorld);
  }

  private createRailing(x: number, y: number, z: number, rotation: number, length: number, physicsWorld: PhysicsWorld): void {
    const railing = new THREE.Group();
    const railMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21 });
    
    const railGeo = new THREE.CylinderGeometry(0.08, 0.08, length, 8);
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.rotation.x = Math.PI / 2;
    rail.position.z = length / 2;
    rail.position.y = 0.8;
    rail.castShadow = true;
    railing.add(rail);
    
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
    
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const colliderBody = BodyFactory.createBox(0.3, 1, length, 0, new CANNON.Vec3(x + sin * length / 2, y + 0.5, z + cos * length / 2));
    const quat = new CANNON.Quaternion();
    quat.setFromEuler(0, rotation, 0);
    colliderBody.quaternion.copy(quat);
    (colliderBody as any).userData = { tag: "ground" };
    physicsWorld.world.addBody(colliderBody);
  }

  private createFloatingRocks(physicsWorld: PhysicsWorld): void {
    const rockPositions = [
      { x: 12, y: 7, z: 50, size: 2.5 },
      { x: 16, y: 6, z: 54, size: 2.0 },
      { x: 13, y: 5, z: 58, size: 2.2 },
      { x: 17, y: 4.5, z: 62, size: 2.8 },
    ];
    
    rockPositions.forEach(pos => {
      this.createFloatingRock(pos.x, pos.y, pos.z, pos.size, physicsWorld);
    });
  }

  private createFloatingRock(x: number, y: number, z: number, size: number, physicsWorld: PhysicsWorld): void {
    const body = BodyFactory.createBox(size, 1, size, 0, new CANNON.Vec3(x, y, z));
    (body as any).userData = { tag: "ground" };
    physicsWorld.world.addBody(body);
    
    const rockGroup = new THREE.Group();
    
    const mainGeo = new THREE.DodecahedronGeometry(size / 2, 0);
    const rockMat = new THREE.MeshStandardMaterial({ map: this.stoneTexture, color: 0x6a6a6a, roughness: 1.0, flatShading: true });
    const mainRock = new THREE.Mesh(mainGeo, rockMat);
    mainRock.scale.y = 0.5;
    mainRock.castShadow = true;
    mainRock.receiveShadow = true;
    rockGroup.add(mainRock);
    
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

  private createGoalArea(physicsWorld: PhysicsWorld): void {
    const goalPlatBody = BodyFactory.createBox(10, 2, 10, 0, new CANNON.Vec3(20, 3, 68));
    (goalPlatBody as any).userData = { tag: "ground" };
    physicsWorld.world.addBody(goalPlatBody);
    
    const altarMesh = this.createCircularPlatform(5, 2, 0x4a6741);
    altarMesh.position.set(20, 3, 68);
    this.mapRoot.add(altarMesh);
    (goalPlatBody as any).meshReference = altarMesh;
    
    const goalZone = PlaceholderGenerator.createZone(2, 2, 2, 0xff0000);
    goalZone.position.set(20, 5, 68);
    this.mapRoot.add(goalZone);
    
    const flagGroup = this.createForestFlag();
    flagGroup.position.set(20, 4, 68);
    this.mapRoot.add(flagGroup);
    
    const goalBody = BodyFactory.createBox(1, 2, 1, 0, new CANNON.Vec3(20, 5, 68));
    goalBody.isTrigger = true;
    (goalBody as any).userData = { tag: "goal" };
    physicsWorld.world.addBody(goalBody);
    
    this.createStonePillar(17, 4, 65);
    this.createStonePillar(23, 4, 65);
    this.createStonePillar(17, 4, 71);
    this.createStonePillar(23, 4, 71);
    
    this.createTree(16, 4, 64, 0.8);
    this.createTree(24, 4, 64, 0.7);
    this.createTree(16, 4, 72, 0.75);
    this.createTree(24, 4, 72, 0.8);
  }

  private createCircularPlatform(radius: number, height: number, color: number): THREE.Group {
    const group = new THREE.Group();
    
    const geo = new THREE.CylinderGeometry(radius, radius + 0.5, height, 16);
    const mat = new THREE.MeshStandardMaterial({ map: this.stoneTexture, color: color, roughness: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    
    const ringGeo = new THREE.TorusGeometry(radius + 0.3, 0.15, 8, 32);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x3d5c3d });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = height / 2;
    ring.castShadow = true;
    group.add(ring);
    
    return group;
  }

  private createTree(x: number, y: number, z: number, scale: number): void {
    const tree = new THREE.Group();
    
    const trunkGeo = new THREE.CylinderGeometry(0.3 * scale, 0.5 * scale, 3 * scale, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.5 * scale;
    trunk.castShadow = true;
    tree.add(trunk);
    
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 });
    
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

  private createStonePillar(x: number, y: number, z: number): void {
    const pillar = new THREE.Group();
    
    const pillarGeo = new THREE.CylinderGeometry(0.4, 0.5, 3, 6);
    const pillarMat = new THREE.MeshStandardMaterial({ map: this.stoneTexture, color: 0x7a7a7a });
    const main = new THREE.Mesh(pillarGeo, pillarMat);
    main.position.y = 1.5;
    main.castShadow = true;
    pillar.add(main);
    
    const topGeo = new THREE.BoxGeometry(1, 0.3, 1);
    const top = new THREE.Mesh(topGeo, pillarMat);
    top.position.y = 3.15;
    top.castShadow = true;
    pillar.add(top);
    
    pillar.position.set(x, y, z);
    this.mapRoot.add(pillar);
  }

  private createForestFlag(): THREE.Group {
    const group = new THREE.Group();

    const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 4);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 2;
    pole.castShadow = true;
    group.add(pole);

    const flagShape = new THREE.Shape();
    flagShape.moveTo(0, 0);
    flagShape.lineTo(1.5, 0.4);
    flagShape.lineTo(0, 0.8);
    flagShape.lineTo(0, 0);
    
    const flagGeo = new THREE.ShapeGeometry(flagShape);
    const flagMat = new THREE.MeshStandardMaterial({ color: 0x228b22, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.1, 3.2, 0);
    flag.castShadow = true;
    group.add(flag);

    return group;
  }

  private createFireflies(): void {
    const fireflyPositions = [
      new THREE.Vector3(5, 3, 10),
      new THREE.Vector3(-3, 4, 18),
      new THREE.Vector3(8, 2, 25),
      new THREE.Vector3(-2, 6, 35),
      new THREE.Vector3(15, 5, 55),
      new THREE.Vector3(22, 6, 65),
    ];
    
    fireflyPositions.forEach(pos => {
      const fireflyGeo = new THREE.SphereGeometry(0.08, 8, 8);
      const fireflyMat = new THREE.MeshBasicMaterial({ color: 0xaaffaa, transparent: true, opacity: 0.9 });
      const firefly = new THREE.Mesh(fireflyGeo, fireflyMat);
      firefly.position.copy(pos);
      
      const light = new THREE.PointLight(0xaaffaa, 0.8, 5);
      firefly.add(light);
      
      this.mapRoot.add(firefly);
      
      this.fireflies.push({
        mesh: firefly,
        basePos: pos.clone(),
        offset: new THREE.Vector3(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2),
        speed: new THREE.Vector3(0.3 + Math.random() * 0.4, 0.2 + Math.random() * 0.3, 0.3 + Math.random() * 0.4)
      });
    });
  }
}
