import * as THREE from 'three';

export class PlaceholderGenerator {
  // 生成纯色纹理
  static createSolidTexture(color: string): THREE.Texture {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = color;
      context.fillRect(0, 0, 2, 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  // 生成棋盘格纹理 (比纯色更好确认运动)
  static createCheckerTexture(color1: string, color2: string): THREE.Texture {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = color1;
      context.fillRect(0, 0, 64, 64);
      context.fillStyle = color2;
      for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 2; x++) {
          if ((x + y) % 2 === 0) {
            context.fillRect(x * 32, y * 32, 32, 32);
          }
        }
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  // --- 角色模型 ---
  static createChicken(): THREE.Group {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff }); // White
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.4;
    body.name = "Body";
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Head (Chicken head is often just part of body or on top)
    // Let's make a separate head for rig compatibility
    const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(0, 1.0, 0);
    head.name = "Head";
    head.castShadow = true;
    head.receiveShadow = true;
    group.add(head);

    // Beak
    const beakGeo = new THREE.ConeGeometry(0.1, 0.2, 4);
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xffa500 }); // Orange
    const beak = new THREE.Mesh(beakGeo, beakMat);
    beak.rotation.x = -Math.PI / 2;
    beak.position.set(0, 0, 0.4); // Relative to head
    beak.castShadow = true;
    head.add(beak);

    // Wings
    const wingGeo = new THREE.BoxGeometry(0.1, 0.4, 0.6);
    const leftWing = new THREE.Mesh(wingGeo, bodyMat);
    leftWing.position.set(-0.5, 0.4, 0);
    leftWing.name = "Wing_L";
    leftWing.castShadow = true;
    group.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, bodyMat);
    rightWing.position.set(0.5, 0.4, 0);
    rightWing.name = "Wing_R";
    rightWing.castShadow = true;
    group.add(rightWing);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.1, 0.4, 0.1);
    const legMat = new THREE.MeshStandardMaterial({ color: 0xffa500 });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.2, 0.2, 0);
    leftLeg.name = "Leg_L";
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.2, 0.2, 0);
    rightLeg.name = "Leg_R";
    rightLeg.castShadow = true;
    group.add(rightLeg);

    return group;
  }

  static createPenguin(): THREE.Group {
    const group = new THREE.Group();

    // Body (Black capsule-ish)
    const bodyGeo = new THREE.CapsuleGeometry(0.4, 0.8, 4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222 }); // Black
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    body.name = "Body";
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Belly (White patch)
    const bellyGeo = new THREE.CapsuleGeometry(0.35, 0.7, 4, 8);
    const bellyMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const belly = new THREE.Mesh(bellyGeo, bellyMat);
    belly.position.set(0, 0, 0.1); // Slightly forward
    belly.castShadow = true;
    body.add(belly);

    // Head (Part of body visually, but separate node for rig)
    const headGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(0, 1.1, 0);
    head.name = "Head";
    head.castShadow = true;
    head.receiveShadow = true;
    group.add(head);

    // Beak
    const beakGeo = new THREE.ConeGeometry(0.08, 0.2, 4);
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xffa500 });
    const beak = new THREE.Mesh(beakGeo, beakMat);
    beak.rotation.x = -Math.PI / 2;
    beak.position.set(0, 0, 0.35);
    beak.castShadow = true;
    head.add(beak);

    // Wings (Flippers)
    const wingGeo = new THREE.BoxGeometry(0.1, 0.5, 0.2);
    const leftWing = new THREE.Mesh(wingGeo, bodyMat);
    leftWing.position.set(-0.45, 0.7, 0);
    leftWing.rotation.z = 0.2;
    leftWing.name = "Wing_L";
    leftWing.castShadow = true;
    group.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, bodyMat);
    rightWing.position.set(0.45, 0.7, 0);
    rightWing.rotation.z = -0.2;
    rightWing.name = "Wing_R";
    rightWing.castShadow = true;
    group.add(rightWing);

    // Legs (Feet)
    const legGeo = new THREE.BoxGeometry(0.2, 0.1, 0.3);
    const legMat = new THREE.MeshStandardMaterial({ color: 0xffa500 });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.2, 0.05, 0);
    leftLeg.name = "Leg_L";
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.2, 0.05, 0);
    rightLeg.name = "Leg_R";
    rightLeg.castShadow = true;
    group.add(rightLeg);

    return group;
  }

  static createHorse(): THREE.Group {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.6, 0.6, 1.2);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 }); // SaddleBrown
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Neck/Head
    const headGeo = new THREE.BoxGeometry(0.4, 0.8, 0.5);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(0, 1.2, 0.5);
    head.castShadow = true;
    head.receiveShadow = true;
    group.add(head);

    return group;
  }

  // --- 陷阱模型 ---
  static createSpikes(): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.8,
      roughness: 0.2,
    });

    // Base
    const base = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 1), mat);
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Spikes
    const spikeGeo = new THREE.ConeGeometry(0.1, 0.4, 8);
    for (let i = 0; i < 4; i++) {
      const spike = new THREE.Mesh(spikeGeo, mat);
      spike.position.set(
        (i % 2) * 0.5 - 0.25,
        0.25,
        Math.floor(i / 2) * 0.5 - 0.25
      );
      spike.castShadow = true;
      spike.receiveShadow = true;
      group.add(spike);
    }
    return group;
  }

  // --- 地形块 ---
  static createWoodBox(): THREE.Group {
    const group = new THREE.Group();
    const texture = this.createCheckerTexture("#8B4513", "#A0522D");
    const mat = new THREE.MeshStandardMaterial({ map: texture });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return group;
  }

  // UI 按钮，风格与 HOST/JOIN 按钮统一
  static createUIBoardButton(
    width: number,
    height: number,
    text: string
  ): THREE.Mesh {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // 圆角矩形背景
      const r = 20;
      const w = canvas.width;
      const h = canvas.height;
      
      ctx.fillStyle = "#4CAF50"; // Green
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(w - r, 0);
      ctx.quadraticCurveTo(w, 0, w, r);
      ctx.lineTo(w, h - r);
      ctx.quadraticCurveTo(w, h, w - r, h);
      ctx.lineTo(r, h);
      ctx.quadraticCurveTo(0, h, 0, h - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.fill();

      // 文本
      ctx.fillStyle = "#ffffff";
      ctx.font = '60px "JotiOne", "Comic Sans MS", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, w / 2, h / 2 + 5); // +5 for visual centering
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;

    const geom = new THREE.PlaneGeometry(width, height);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData.type = "button";
    return mesh;
  }

  static createOpenBox(): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x5c4033,
      side: THREE.DoubleSide,
    });

    // Dimensions
    const w = 12;
    const h = 6;
    const d = 8;

    // Bottom
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), mat);
    bottom.position.y = 0.1;
    bottom.receiveShadow = true;
    group.add(bottom);

    // Back
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), mat);
    back.position.set(0, h / 2, -d / 2 + 0.1);
    back.castShadow = true;
    back.receiveShadow = true;
    group.add(back);

    // Left
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.2, h, d), mat);
    left.position.set(-w / 2 + 0.1, h / 2, 0);
    left.castShadow = true;
    left.receiveShadow = true;
    group.add(left);

    // Right
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.2, h, d), mat);
    right.position.set(w / 2 - 0.1, h / 2, 0);
    right.castShadow = true;
    right.receiveShadow = true;
    group.add(right);

    return group;
  }

  static createFlag(): THREE.Group {
    const group = new THREE.Group();

    // Pole
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 3);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 1.5;
    pole.castShadow = true;
    group.add(pole);

    // Flag
    const flagGeo = new THREE.BoxGeometry(1.2, 0.8, 0.1);
    const flagMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.6, 2.5, 0);
    flag.castShadow = true;
    group.add(flag);

    return group;
  }

  static createZone(
    width: number,
    height: number,
    depth: number,
    color: number
  ): THREE.Group {
    const group = new THREE.Group();
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
    return group;
  }

  static createSpring(): THREE.Group {
    const group = new THREE.Group();
    // Base
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.2, 1),
      new THREE.MeshStandardMaterial({ color: 0x555555 })
    );
    base.position.y = 0.1;
    group.add(base);
    // Coil (Green Box for now)
    const coil = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.6, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x00ff00 })
    );
    coil.position.y = 0.5;
    group.add(coil);
    return group;
  }

  static createHoney(): THREE.Group {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.8,
      })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return group;
  }

  static createIce(): THREE.Group {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0xaaddff,
        transparent: true,
        opacity: 0.6,
        roughness: 0.1,
      })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return group;
  }

  static createPlank(): THREE.Group {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.2, 1),
      new THREE.MeshStandardMaterial({ color: 0x8b4513 })
    );
    mesh.position.y = 0.1;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return group;
  }

  static createRamp(): THREE.Group {
    const group = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(1, 0);
    shape.lineTo(1, 1);
    shape.lineTo(0, 0);

    const extrudeSettings = { depth: 1, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Center geometry
    geo.translate(-0.5, -0.5, -0.5);

    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: 0x8b4513 })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return group;
  }

  static createBlackHole(): THREE.Group {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.5),
      new THREE.MeshStandardMaterial({ color: 0x000000 })
    );
    mesh.position.y = 0.5;
    group.add(mesh);

    // Accretion disk
    const disk = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 1.0, 32),
      new THREE.MeshBasicMaterial({ color: 0x880088, side: THREE.DoubleSide })
    );
    disk.rotation.x = -Math.PI / 2;
    disk.position.y = 0.5;
    group.add(disk);
    return group;
  }

  static createTurret(): THREE.Group {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.5, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x555555 })
    );
    base.position.y = 0.25;
    group.add(base);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 1),
      new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.6, 0.4);
    group.add(barrel);
    return group;
  }

  static createCoin(): THREE.Group {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.05, 32),
      new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1.0 })
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = 0.5;
    group.add(mesh);
    return group;
  }

  static createBomb(): THREE.Group {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.4),
      new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    mesh.position.y = 0.4;
    group.add(mesh);

    const fuse = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    fuse.position.y = 0.8;
    group.add(fuse);
    return group;
  }

  static createConveyor(): THREE.Group {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.2, 1),
      new THREE.MeshStandardMaterial({
        map: this.createCheckerTexture("#333333", "#555555"),
      })
    );
    mesh.position.y = 0.1;
    group.add(mesh);
    return group;
  }

  static createCloud(): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      transparent: true,
      opacity: 0.9,
    });

    // Use multiple low-poly spheres (Icosahedron) to create an irregular cloud shape
    const numBlobs = 3 + Math.floor(Math.random() * 3); // 3 to 5 blobs

    for (let i = 0; i < numBlobs; i++) {
      const radius = 0.5 + Math.random() * 0.5;
      const detail = 0; // Low poly look
      const geo = new THREE.IcosahedronGeometry(radius, detail);

      const mesh = new THREE.Mesh(geo, mat);

      // Random position offset, clustered around center
      const offset = 1.0;
      mesh.position.set(
        (Math.random() - 0.5) * offset * 2,
        (Math.random() - 0.5) * offset * 0.5,
        (Math.random() - 0.5) * offset
      );

      // Random rotation for variety
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      // Random scale variation
      const s = 0.8 + Math.random() * 0.4;
      mesh.scale.set(s, s, s);

      group.add(mesh);
    }

    return group;
  }
}
