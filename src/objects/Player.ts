import * as CANNON from "cannon-es";
import * as THREE from "three";
import { Character } from "./character/Character";
import { CharacterAnimState } from "./character/CharacterAppearance";
import { CharacterRig } from "./character/CharacterRig";

type GroundInfo = {
  grounded: boolean;
  isIce: boolean;
  isIceSlope: boolean;
  canJump: boolean;
  slopeAngle: number;
  groundBody?: CANNON.Body;
  groundVelocity?: { x: number; z: number };
  slideDirection?: { x: number; z: number };
  tiltAngle?: number;
};

type SurfaceProbe = {
  tag: string | null;
  distance: number;
  isIce: boolean;
  isIceSlope: boolean;
  slideDirection?: { x: number; z: number };
  tiltAngle?: number;
};

export class Player extends Character {
  private isJumping: boolean = false;
  private jumpTime: number = 0;
  private readonly MAX_JUMP_TIME: number = 0.3;
  private readonly MIN_JUMP_FORCE: number = 4;
  private readonly JUMP_HOLD_FORCE: number = 10;
  private readonly MOVE_SPEED: number = 5;
  private readonly SPRINT_MULTIPLIER: number = 1.4;

  // Coyote Jump: Allow jumping shortly after leaving ground
  private readonly COYOTE_TIME: number = 0.12; // 120ms grace period
  private coyoteTimer: number = 0;
  private wasGrounded: boolean = false;

  // Ice movement robustness: tolerate short grounded/tag flicker without breaking ice behavior
  private readonly MOVE_GROUNDED_GRACE: number = 0.12;
  private timeSinceLastGrounded: number = 999;
  private timeSinceIce: number = 999; // Track how long since we were last on ice
  private lastGroundInfo: GroundInfo = {
    grounded: false,
    isIce: false,
    isIceSlope: false,
    canJump: false,
    slopeAngle: 0,
  };

  // Stuck detection: track position to detect when character is stuck on edges
  private lastPosition: CANNON.Vec3 = new CANNON.Vec3();
  private stuckTimer: number = 0;

  public onJumpStart?: () => void;
  public onCoinCollect?: () => void;
  public onGoal?: () => void;
  public onDeath?: (info: { tag: string; owner?: string }) => void;

  public isDead: boolean = false;
  public hasWon: boolean = false;
  public score: number = 0;

  // 大炮发射状态
  private isLaunched: boolean = false;
  private launchTimer: number = 0;
  private readonly LAUNCH_CONTROL_LOCK_TIME: number = 0.5; // 发射后锁定控制的时间

  protected animState: CharacterAnimState = "idle";

  // Wall collision tracking - to prevent wall climbing
  private isAgainstWall: boolean = false;
  private wallContactNormal: CANNON.Vec3 = new CANNON.Vec3();

  // Cached local vertical extents of the physics compound (relative to body frame)
  private localBottomY: number = 0;
  private localTopY: number = 1;

  private getHeight(): number {
    return Math.max(0.2, this.localTopY - this.localBottomY);
  }

  constructor(rig: CharacterRig, body: CANNON.Body) {
    super(rig, body);

    // Cache collider extents once (compound shapes are static)
    const { minY, maxY } = this.computeLocalYExtents();
    this.localBottomY = minY;
    this.localTopY = maxY;

    // Collision Listener
    this.body.addEventListener("collide", (e: any) => {
      const contactBody = e.body;
      const contact = e.contact as CANNON.ContactEquation;
      
      // Get contact normal (points from body to contactBody)
      const contactNormal = new CANNON.Vec3();
      if (contact.bi === this.body) {
        contact.ni.negate(contactNormal); // Flip to point away from wall
      } else {
        contactNormal.copy(contact.ni);
      }
      
      // Check if this is a wall collision (normal is mostly horizontal)
      const normalY = Math.abs(contactNormal.y);
      if (normalY < 0.3) { // Wall = normal is mostly horizontal
        this.isAgainstWall = true;
        this.wallContactNormal.copy(contactNormal);
        
        // CRITICAL FIX: If touching a wall and have small upward velocity,
        // this is likely the physics engine pushing us up against the wall.
        // Cancel this upward movement to prevent wall climbing.
        if (!this.isJumping && this.body.velocity.y > 0 && this.body.velocity.y < 3.0) {
          // Only cancel if not in a legitimate jump (velocity would be higher)
          const groundInfo = this.getGroundInfo();
          if (!groundInfo.grounded) {
            this.body.velocity.y = Math.min(this.body.velocity.y, 0);
          }
        }
      }
      
      if (contactBody.userData) {
        const tag = contactBody.userData.tag;
        if (tag === "trap" || tag === "black_hole" || tag === "turret") {
          if (!this.isDead) {
            this.isDead = true;
            this.animState = "dead";
            this.lastHitBy = contactBody.userData.owner; // Track killer
            this.onDeath?.({ tag, owner: contactBody.userData.owner });
          }
        } else if (tag === "goal") {
          if (!this.hasWon) {
            this.hasWon = true;
            this.onGoal?.();
          }
        } else if (tag === "spring") {
          this.body.velocity.y = 20; // High bounce
          this.isJumping = true;
        } else if (tag === "coin") {
          if (!contactBody.userData.collected) {
            this.score += 1;
            contactBody.userData.collected = true;
            this.onCoinCollect?.();
            // Hide coin visually
            if (contactBody.meshReference) {
              contactBody.meshReference.visible = false;
            }
          }
        } else if (tag === "conveyor") {
          this.body.velocity.z -= 5; // Push forward
        }
      }
    });
  }

  public lastHitBy: string | null = null;

  public update(delta: number) {
    // Debug logging disabled
    // this.debugTimer += delta;
    // if (this.debugTimer > 0.25) {
    //   this.debugTimer = 0;
    //   const groundInfo = this.getGroundInfo();
    //   console.log(`[DEBUG] grounded=${groundInfo.grounded}, isAgainstWall=${this.isAgainstWall}, vel.y=${this.body.velocity.y.toFixed(2)}, pos.y=${this.body.position.y.toFixed(2)}`);
    // }
    
    // 更新发射状态计时器
    if (this.isLaunched) {
      this.launchTimer += delta;
      if (this.launchTimer > this.LAUNCH_CONTROL_LOCK_TIME) {
        this.isLaunched = false;
        this.launchTimer = 0;
      }
    }
    
    super.setAnimState(this.animState);
    super.update(delta);
  }

  /**
   * 设置被大炮发射状态
   */
  public setLaunched(launched: boolean): void {
    this.isLaunched = launched;
    if (launched) {
      this.launchTimer = 0;
      this.isJumping = true; // 设置跳跃状态以启用空中动画
    }
  }

  /**
   * 检查是否处于发射状态
   */
  public isInLaunchedState(): boolean {
    return this.isLaunched;
  }

  private getWallContact(direction: THREE.Vector3): CANNON.Vec3 | null {
    if (!this.body.world) return null;

    const radius = 0.4;
    const checkDist = radius + 0.2; // Slightly more than radius

    // Check at feet, center, head (relative to actual collider height)
    const height = this.getHeight();
    const heights = [0.2, height * 0.5, Math.max(0.2, height - 0.2)];
    const vec = new CANNON.Vec3(
      direction.x * checkDist,
      0,
      direction.z * checkDist
    );

    const footY = this.getFootWorldY();

    for (const h of heights) {
      const start = this.body.position.clone();
      start.y = footY + h;
      const end = start.vadd(vec);

      const result = new CANNON.RaycastResult();
      this.body.world.raycastClosest(
        start,
        end,
        {
          collisionFilterMask: -1,
          skipBackfaces: true,
        },
        result
      );

      if (result.hasHit && result.body !== this.body) {
        return result.hitNormalWorld;
      }
    }
    return null;
  }

  private computeLocalYExtents(): { minY: number; maxY: number } {
    // Compute min/max local Y across all shapes, including offsets and per-shape orientations.
    // This is the only robust way to map body.position.y to actual feet/head when using compounds.
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    const shapes = this.body.shapes;
    const offsets = this.body.shapeOffsets;
    const orientations = this.body.shapeOrientations;

    for (let i = 0; i < shapes.length; i++) {
      const shape = shapes[i] as any;
      const offset = offsets?.[i] ?? new CANNON.Vec3(0, 0, 0);
      const orientation = orientations?.[i] ?? new CANNON.Quaternion(0, 0, 0, 1);

      // Fast paths for common primitives
      if (shape.type === CANNON.Shape.types.SPHERE) {
        const r = (shape as CANNON.Sphere).radius;
        minY = Math.min(minY, offset.y - r);
        maxY = Math.max(maxY, offset.y + r);
        continue;
      }

      if (shape.type === CANNON.Shape.types.BOX) {
        const hy = (shape as CANNON.Box).halfExtents.y;
        minY = Math.min(minY, offset.y - hy);
        maxY = Math.max(maxY, offset.y + hy);
        continue;
      }

      // ConvexPolyhedron-like shapes: use actual vertices (respects orientation)
      const vertices: CANNON.Vec3[] | undefined = shape.vertices;
      if (Array.isArray(vertices) && vertices.length > 0) {
        const tmp = new CANNON.Vec3();
        for (const v of vertices) {
          orientation.vmult(v, tmp);
          const y = offset.y + tmp.y;
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
        continue;
      }

      // Fallback: bounding sphere (conservative)
      const bs = typeof shape.boundingSphereRadius === "number" ? shape.boundingSphereRadius : 0.5;
      minY = Math.min(minY, offset.y - bs);
      maxY = Math.max(maxY, offset.y + bs);
    }

    if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
      return { minY: 0, maxY: 1 };
    }
    return { minY, maxY };
  }

  private computeWallContactFromContacts(): { againstWall: boolean; normal: CANNON.Vec3 } {
    // Derive wall contact from current solver contacts (per-frame, not sticky).
    const normalOut = new CANNON.Vec3(0, 0, 0);
    if (!this.body.world) return { againstWall: false, normal: normalOut };

    for (const c of this.body.world.contacts) {
      const normal = new CANNON.Vec3();
      if (c.bi === this.body) {
        // normal points from bi to bj; we want normal pointing away from the other body
        c.ni.negate(normal);
      } else if (c.bj === this.body) {
        normal.copy(c.ni);
      } else {
        continue;
      }

      // Mostly horizontal normal => wall-ish contact
      const ay = Math.abs(normal.y);
      if (ay > 0.25) continue;

      // Ignore near-zero normals
      const len2 = normal.x * normal.x + normal.y * normal.y + normal.z * normal.z;
      if (len2 < 1e-6) continue;

      normalOut.copy(normal);
      return { againstWall: true, normal: normalOut };
    }
    return { againstWall: false, normal: normalOut };
  }

  private getFootWorldY(): number {
    return this.body.position.y + this.localBottomY;
  }

  public setInput(
    input: { x: number; y: number; jump: boolean; sprint: boolean },
    cameraAngleY: number,
    delta: number = 1 / 60
  ) {
    if (this.isDead || this.hasWon) return;
    
    // 如果处于发射状态，不处理移动输入（让玩家自由飞行）
    if (this.isLaunched) {
      // 仍然更新动画状态
      this.animState = "jump";
      return;
    }

    const groundInfo = this.getGroundInfo();
    const grounded = groundInfo.grounded;

    // Recompute wall contact per-frame (collide event is not reliable as a persistent state)
    // Moved up so it can be used in moveIsIce logic
    const wallContact = this.computeWallContactFromContacts();
    this.isAgainstWall = wallContact.againstWall;
    if (wallContact.againstWall) {
      this.wallContactNormal.copy(wallContact.normal);
    }

    // Foot-probe: independent from grounded. Used to stabilize ice behavior and add diagnostics.
    const surfaceProbe = this.probeSurfaceBelow(2.0);
    const probeIsIce = !!surfaceProbe?.isIce;
    const probeIsIceSlope = !!surfaceProbe?.isIceSlope;
    const probeIsClose =
      surfaceProbe != null && surfaceProbe.distance <= 0.55 && surfaceProbe.distance >= -0.12;

    // Track last grounded info for a short grace window (used only to keep ice behavior stable).
    this.timeSinceLastGrounded += delta;
    if (grounded) {
      this.timeSinceLastGrounded = 0;
      this.lastGroundInfo = groundInfo;
    }

    // Track time since we were last on ice (either grounded on ice, or probing ice)
    if (groundInfo.isIce || (probeIsIce && probeIsClose)) {
      this.timeSinceIce = 0;
    } else {
      this.timeSinceIce += delta;
    }

    const withinGrace = this.timeSinceLastGrounded < this.MOVE_GROUNDED_GRACE;
    const withinIceGrace = this.timeSinceIce < this.MOVE_GROUNDED_GRACE;

    // Check for external forces (like Black Hole)
    const externalForceActive = (this.body as any).userData.externalForceActive === true;
    // Reset the flag for the next frame (it will be set again if the force is still active)
    (this.body as any).userData.externalForceActive = false;

    const moveIsIce =
      groundInfo.isIce ||
      externalForceActive ||
      (probeIsIce && probeIsClose) ||
      (!grounded && withinGrace && this.lastGroundInfo.isIce) ||
      (withinIceGrace); // Keep ice physics if we were recently on ice (even if now grounded on non-ice wall)
    const moveIsIceSlope =
      groundInfo.isIceSlope ||
      (probeIsIceSlope && probeIsClose) ||
      (!grounded && withinGrace && this.lastGroundInfo.isIceSlope);
    const moveSlideDirection =
      groundInfo.slideDirection ?? surfaceProbe?.slideDirection ?? this.lastGroundInfo.slideDirection;
    const moveTiltAngle =
      groundInfo.tiltAngle ?? surfaceProbe?.tiltAngle ?? this.lastGroundInfo.tiltAngle;

    // Only treat us as "move-grounded" on ice when we're not moving upward.
    // This avoids accidentally running ground/ice movement logic during the early jump ascent.
    const iceGraceVyOk = this.body.velocity.y <= 0.75;
    const iceGraceActive = !grounded && moveIsIce && iceGraceVyOk && (withinGrace || probeIsClose);
    const moveGrounded = grounded || iceGraceActive;

    if (this.DEBUG_ICE) {
      this.iceDebugTimer += delta;
      const shouldLog =
        this.iceDebugTimer > 0.25 &&
        probeIsClose &&
        (probeIsIce || probeIsIceSlope) &&
        (!grounded || !groundInfo.isIce || !moveGrounded);

      if (shouldLog) {
        this.iceDebugTimer = 0;
        const planarSpeed = Math.hypot(this.body.velocity.x, this.body.velocity.z);
        console.log(
          `[ICEBUG] tag=${surfaceProbe?.tag ?? "none"} dist=${surfaceProbe?.distance.toFixed(2) ?? "NA"} ` +
            `grounded=${grounded} moveGrounded=${moveGrounded} iceGrace=${iceGraceActive} ` +
            `groundIsIce=${groundInfo.isIce} moveIsIce=${moveIsIce} ` +
            `vel=(${this.body.velocity.x.toFixed(2)},${this.body.velocity.y.toFixed(2)},${this.body.velocity.z.toFixed(2)}) ` +
            `planar=${planarSpeed.toFixed(2)} pos.y=${this.body.position.y.toFixed(2)} footY=${this.getFootWorldY().toFixed(2)} ` +
            `sinceGrounded=${this.timeSinceLastGrounded.toFixed(2)}`
        );
      }
    }

    // --- Stuck Detection and Recovery ---
    // Detect when character is stuck on an edge (physics engine pushing against penetration)
    // Symptoms: not grounded, barely moving, velocity near zero
    if (!moveGrounded) {
      const posDiff = this.body.position.vsub(this.lastPosition);
      const horizontalMove = Math.sqrt(posDiff.x * posDiff.x + posDiff.z * posDiff.z);
      const verticalMove = Math.abs(posDiff.y);
      
      // Stuck condition: almost no movement AND velocity is tiny (physics pushing back)
      const isStuck = horizontalMove < 0.01 && verticalMove < 0.01 && Math.abs(this.body.velocity.y) < 0.5;
      
      if (isStuck) {
        this.stuckTimer += delta;
        
        // After being stuck for a short time, forcefully teleport down
        if (this.stuckTimer > 0.15) { // 150ms - quick response
          // TELEPORT the position down - this bypasses physics constraints
          this.body.position.y -= 0.1;
          // Also give strong downward velocity
          this.body.velocity.y = -3.0;
          // Push away from where we're stuck (use last movement direction or random)
          const pushAngle = Math.atan2(this.body.velocity.x, this.body.velocity.z) + Math.PI; // Push backward
          this.body.velocity.x = Math.sin(pushAngle) * 2.0;
          this.body.velocity.z = Math.cos(pushAngle) * 2.0;
          this.stuckTimer = 0;
        }
      } else {
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
    }
    
    // Update last position for next frame's stuck check
    this.lastPosition.copy(this.body.position);

    // --- Coyote Jump Timer ---
    // Only allow coyote jump if the ground was jumpable (not too steep)
    if (grounded && groundInfo.canJump) {
      this.coyoteTimer = this.COYOTE_TIME;
      this.wasGrounded = true;
    } else if (grounded && !groundInfo.canJump) {
      // On steep slope: reset coyote timer, can't jump
      this.coyoteTimer = 0;
      this.wasGrounded = false;
    } else {
      if (this.wasGrounded && this.coyoteTimer > 0) {
        this.coyoteTimer -= delta;
      }
    }

    // Determine if jump is allowed (grounded with jumpable slope OR within coyote time)
    // BUT NOT if currently against a wall (prevents wall climbing)
    let canJumpNow = (grounded && groundInfo.canJump) || (this.coyoteTimer > 0 && !this.isJumping);
    
    // WALL CLIMBING PREVENTION: If against wall and not solidly grounded, disable jump
    if (this.isAgainstWall && !grounded) {
      canJumpNow = false;
      this.coyoteTimer = 0; // Also reset coyote timer to prevent delayed wall jumps

      // Only cancel *small* upward velocity when we're NOT in a legitimate jump.
      // (Previously this canceled MIN_JUMP_FORCE=4 and caused tiny/no jumps near walls.)
      if (!this.isJumping && this.body.velocity.y > 0 && this.body.velocity.y < 2.5) {
        if (this.DEBUG_JUMP) {
          console.log(
            `[WALL] cancelUp vel.y=${this.body.velocity.y.toFixed(2)} pos.y=${this.body.position.y.toFixed(2)} ` +
              `n=(${this.wallContactNormal.x.toFixed(2)},${this.wallContactNormal.y.toFixed(2)},${this.wallContactNormal.z.toFixed(2)})`
          );
        }
        this.body.velocity.y = 0;
      }
    }

    // --- Movement ---
    const hasMovementInput = Math.abs(input.x) > 0.1 || Math.abs(input.y) > 0.1;

    // Moving platforms: when grounded on a kinematic body, inherit its horizontal velocity.
    // This prevents the player from being slowly carried off / feeling "slow" on rotating platforms.
    const baseVX =
      moveGrounded && grounded && groundInfo.groundBody?.type === CANNON.Body.KINEMATIC
        ? groundInfo.groundBody.velocity.x
        : 0;
    const baseVZ =
      moveGrounded && grounded && groundInfo.groundBody?.type === CANNON.Body.KINEMATIC
        ? groundInfo.groundBody.velocity.z
        : 0;

    // DEBUG: Log movement state when on ice or moving fast
    if (this.DEBUG_ICE) {
      const speed = Math.hypot(this.body.velocity.x, this.body.velocity.z);
      if (moveIsIce || speed > 5.0) {
        this.iceDebugTimer += delta;
        if (this.iceDebugTimer > 0.1) { // Log every 100ms
          this.iceDebugTimer = 0;
          console.log(`[MOVE_DEBUG] grounded=${grounded} moveGrounded=${moveGrounded} isIce=${moveIsIce} ` +
            `speed=${speed.toFixed(2)} vel=(${this.body.velocity.x.toFixed(2)}, ${this.body.velocity.y.toFixed(2)}, ${this.body.velocity.z.toFixed(2)}) ` +
            `baseV=(${baseVX.toFixed(2)}, ${baseVZ.toFixed(2)}) input=(${input.x.toFixed(2)}, ${input.y.toFixed(2)})`);
        }
      }
    }

    // Ice slope: Always apply gentle downhill acceleration when on ice slope
    if (moveGrounded && moveIsIceSlope && moveSlideDirection && moveTiltAngle) {
      const slideAccel = 0.5 * moveTiltAngle; // Gentle constant acceleration
      this.body.velocity.x += moveSlideDirection.x * slideAccel;
      this.body.velocity.z += moveSlideDirection.z * slideAccel;
    }

    if (moveGrounded) {
      const speed = input.sprint
        ? this.MOVE_SPEED * this.SPRINT_MULTIPLIER
        : this.MOVE_SPEED;

      if (hasMovementInput) {
        const inputAngle = Math.atan2(input.x, input.y);
        const targetRotation = cameraAngleY + inputAngle;

        const vx = Math.sin(targetRotation) * speed;
        const vz = Math.cos(targetRotation) * speed;

        if (moveIsIce) {
          // Ice: Smooth acceleration/deceleration (slippery)
          // Instead of simple lerp, we clamp the change to simulate limited grip (max acceleration/deceleration)
          const iceLerp = 0.08; // Lower = more slippery
          
          const targetVX = baseVX + vx;
          const targetVZ = baseVZ + vz;
          
          const diffX = targetVX - this.body.velocity.x;
          const diffZ = targetVZ - this.body.velocity.z;
          
          let changeX = diffX * iceLerp;
          let changeZ = diffZ * iceLerp;
          
          // Limit the maximum velocity change per frame on ice to preserve momentum
          // 0.5 per frame at 60fps = ~30 units/s^2 max acceleration/braking
          // This allows normal control at low speeds but prevents instant stopping from high speeds
          const maxChange = 0.5; 
          const changeLen = Math.hypot(changeX, changeZ);
          
          if (changeLen > maxChange) {
            const scale = maxChange / changeLen;
            changeX *= scale;
            changeZ *= scale;
          }
          
          this.body.velocity.x += changeX;
          this.body.velocity.z += changeZ;
        } else {
          // Normal movement (instant)
          this.body.velocity.x = baseVX + vx;
          this.body.velocity.z = baseVZ + vz;
        }
        this.body.quaternion.setFromEuler(0, targetRotation, 0);

        this.animState = "run";
      } else {
        // No movement input
        if (moveIsIce) {
          // Ice: Apply friction slowly (slide)
          const iceDeceleration = 0.98; // Close to 1 = very slippery
          const relX = this.body.velocity.x - baseVX;
          const relZ = this.body.velocity.z - baseVZ;
          
          let newRelX = relX * iceDeceleration;
          let newRelZ = relZ * iceDeceleration;
          
          // Also clamp the deceleration amount to prevent rapid speed loss
          const changeX = newRelX - relX;
          const changeZ = newRelZ - relZ;
          const maxDecel = 0.2; // Lower limit for friction deceleration
          
          const changeLen = Math.hypot(changeX, changeZ);
          if (changeLen > maxDecel) {
             const scale = maxDecel / changeLen;
             newRelX = relX + changeX * scale;
             newRelZ = relZ + changeZ * scale;
          }

          this.body.velocity.x = baseVX + newRelX;
          this.body.velocity.z = baseVZ + newRelZ;
          
          // Only go to idle if nearly stopped
          if (Math.abs(this.body.velocity.x) < 0.3 && Math.abs(this.body.velocity.z) < 0.3) {
            this.animState = "idle";
          } else {
            this.animState = "run"; // Still sliding
          }
        } else {
          // Normal ground: Stop immediately (but preserve velocity if about to jump)
          const aboutToJump = input.jump && canJumpNow && !this.isJumping;
          if (!aboutToJump) {
            this.body.velocity.x = baseVX;
            this.body.velocity.z = baseVZ;
          }
          this.animState = "idle";
        }
      }
    } else {
      // Air Control
      if (hasMovementInput) {
        const speed = this.MOVE_SPEED;
        const inputAngle = Math.atan2(input.x, input.y);
        const targetRotation = cameraAngleY + inputAngle;

        let vx = Math.sin(targetRotation) * speed;
        let vz = Math.cos(targetRotation) * speed;

        // Wall Slide Logic: Prevent pushing into walls
        const moveDir = new THREE.Vector3(vx, 0, vz).normalize();
        const wallNormal = this.getWallContact(moveDir);

        if (wallNormal) {
          // Project velocity along wall to slide
          // V_new = V - (V . N) * N
          const dot = vx * wallNormal.x + vz * wallNormal.z;
          if (dot < 0) {
            // Only if moving INTO the wall
            vx -= dot * wallNormal.x;
            vz -= dot * wallNormal.z;
          }
        }

        // Smooth air control
        const lerp = 0.1;
        this.body.velocity.x += (vx - this.body.velocity.x) * lerp;
        this.body.velocity.z += (vz - this.body.velocity.z) * lerp;

        this.body.quaternion.setFromEuler(0, targetRotation, 0);
        this.animState = "jump";
      }
    }

    // --- Jumping (with Coyote Jump support) ---
    // SAFETY: If on ground and not moving up, force reset isJumping
    // This prevents isJumping from getting stuck
    if (grounded && this.body.velocity.y <= 0.5) {
      this.isJumping = false;
      this.jumpTime = 0;
    }

    // Debug: log every jump input frame
    if (this.DEBUG_JUMP && input.jump) {
      console.log(
        `[JUMP] canJumpNow=${canJumpNow}, isJumping=${this.isJumping}, grounded=${grounded}, canJump=${groundInfo.canJump}, ` +
          `againstWall=${this.isAgainstWall}, coyote=${this.coyoteTimer.toFixed(2)}, jumpTime=${this.jumpTime.toFixed(2)}, ` +
          `vel.y=${this.body.velocity.y.toFixed(2)}, pos.y=${this.body.position.y.toFixed(2)}, footY=${this.getFootWorldY().toFixed(2)}, ` +
          `slope=${groundInfo.slopeAngle.toFixed(2)}`
      );
    }
    
    if (input.jump) {
      const startedJump = canJumpNow && !this.isJumping;
      if (startedJump) {
        this.isJumping = true;
        this.jumpTime = 0;
        this.coyoteTimer = 0; // Consume coyote time
        this.wasGrounded = false;

        // Preserve horizontal velocity when jumping
        // (don't reset vx/vz, only set vy)
        this.body.velocity.y = this.MIN_JUMP_FORCE;
        this.onJumpStart?.();
      } else if (this.isJumping && this.jumpTime < this.MAX_JUMP_TIME) {
        this.body.applyForce(
          new CANNON.Vec3(0, this.JUMP_HOLD_FORCE, 0),
          this.body.position
        );
        this.jumpTime += delta;
      }
    } else {
      this.isJumping = false;
    }

    // Animation state for airborne
    // Use smoothed velocity check and additional conditions to prevent edge jittering
    if (!grounded && !moveGrounded) {
      // Only show jump animation if:
      // 1. Actually jumping (isJumping flag) AND moving upward significantly
      const isActuallyJumping = this.isJumping && this.body.velocity.y > 1.0;
      const isFallingFast = this.body.velocity.y < -1.0;
      
      // If stuck (timer active), always show fall animation
      if (this.stuckTimer > 0.1) {
        this.animState = "fall";
      } else if (isActuallyJumping) {
        this.animState = "jump";
      } else if (isFallingFast) {
        this.animState = "fall";
      } else {
        // In-between state (small velocities, possibly stuck on edge)
        // Default to fall to avoid jitter
        this.animState = "fall";
      }
    }
  }

  // Slope angle threshold for allowing jumps (in radians, ~50 degrees)
  private readonly MAX_JUMPABLE_SLOPE_ANGLE: number = 0.87;

  // Debug mode - set to true to enable console logging
  private DEBUG_GROUND_CHECK: boolean = true;
  private debugLogTimer: number = 0;
  private DEBUG_JUMP: boolean = true;
  private DEBUG_ICE: boolean = true;
  private iceDebugTimer: number = 0;

  /**
   * Check ground type and get ice slope info if standing on ice
   * Uses multiple ray casts for more reliable edge detection
   */
  private getGroundInfo(): GroundInfo {
    if (!this.body.world) return { grounded: false, isIce: false, isIceSlope: false, canJump: false, slopeAngle: 0 };

    // If moving upward significantly, not grounded (prevents edge-climbing glitch)
    if (this.body.velocity.y > 2.0) {
      return { grounded: false, isIce: false, isIceSlope: false, canJump: false, slopeAngle: 0 };
    }

    // Ray should probe close to the *feet*; using body.position.y here is wrong for compound bodies.
    const footY = this.getFootWorldY();
    // Long ray (so we can still "see" ground reliably), but strict acceptance threshold below.
    const rayUpFromFeet = 0.25;
    const rayDownFromFeet = 1.2;

    // ---------- CONTACT-BASED CHECK (more reliable than raycast) ----------
    let bestGround: {
      slopeAngle: number;
      userData: any;
      body: CANNON.Body | null;
      isIce: boolean;
    } | null = null;

    for (const c of this.body.world.contacts) {
      // Contact normals point from bi to bj. Determine direction relative to this body.
      const normal = new CANNON.Vec3();
      let other: CANNON.Body | null = null;
      if (c.bi === this.body) {
        normal.copy(c.ni); // normal points from bi to bj
        other = c.bj as CANNON.Body;
      } else if (c.bj === this.body) {
        // flip normal
        c.ni.scale(-1, normal);
        other = c.bi as CANNON.Body;
      } else {
        continue;
      }

      // Require upward-facing normal
      const nY = normal.y;
      if (nY < 0.6) continue; // roughly <=53 degrees slope is allowed

      // Require contact point near feet: use contact point world positions
      const contactPoint = new CANNON.Vec3();
      if (c.bi === this.body) {
        // contact point on bi: bi.position + ri
        c.ri.vadd(this.body.position, contactPoint);
      } else {
        // contact point on bj: bj.position + rj
        c.rj.vadd(other.position, contactPoint);
      }
      const distanceToFeet = footY - contactPoint.y;
      if (distanceToFeet > 1.0 || distanceToFeet < -0.3) continue;

      // Found a valid ground contact. Check if it's ice.
      const userData = other ? (other as any).userData : null;
      const tag = userData?.tag;
      const isIce = tag === "ice" || tag === "ice_slope";
      const slopeAngle = Math.acos(Math.min(1, Math.max(0, nY)));

      // Prioritize ICE: If we haven't found ground yet, OR if this ground is ICE and the previous best was NOT ICE, take it.
      // This prevents "rubbing against non-ice wall" from overriding the ice floor contact.
      if (!bestGround || (isIce && !bestGround.isIce)) {
        bestGround = {
          slopeAngle,
          userData,
          body: other,
          isIce
        };
      }
    }

    if (bestGround) {
      const canJumpContact = bestGround.slopeAngle < this.MAX_JUMPABLE_SLOPE_ANGLE;
      const tag = bestGround.userData?.tag;
      const isIce = bestGround.isIce;
      const isIceSlope = tag === "ice_slope";

      const groundVelocity = bestGround.body
        ? { x: bestGround.body.velocity.x, z: bestGround.body.velocity.z }
        : undefined;

      return {
        grounded: true,
        isIce,
        isIceSlope,
        canJump: canJumpContact,
        slopeAngle: bestGround.slopeAngle,
        groundBody: bestGround.body || undefined,
        groundVelocity,
        slideDirection: isIceSlope ? bestGround.userData.slideDirection : undefined,
        tiltAngle: isIceSlope ? bestGround.userData.tiltAngle : undefined
      };
    }

    // Cast center ray
    const start = new CANNON.Vec3(this.body.position.x, footY + rayUpFromFeet, this.body.position.z);
    const end = new CANNON.Vec3(this.body.position.x, footY - rayDownFromFeet, this.body.position.z);

    const result = new CANNON.RaycastResult();
    this.body.world.raycastClosest(
      start,
      end,
      {
        collisionFilterMask: -1,
        skipBackfaces: true,
      },
      result
    );

    if (!result.hasHit || !result.body || result.body === this.body) {
      if (this.DEBUG_GROUND_CHECK) {
        this.debugLogTimer += 1 / 60;
        if (this.debugLogTimer > 0.2) {
          this.debugLogTimer = 0;
          console.log(
            `[GROUND] no-hit pos.y=${this.body.position.y.toFixed(2)} footY=${footY.toFixed(2)} vel.y=${this.body.velocity.y.toFixed(2)}`
          );
        }
      }
      return { grounded: false, isIce: false, isIceSlope: false, canJump: false, slopeAngle: 0 };
    }

    // Check that the hit point is actually below us
    const hitY = result.hitPointWorld ? result.hitPointWorld.y : 0;
    const feetY = footY;
    
    // Calculate distance from feet to hit point
    const distanceToGround = feetY - hitY;
    
    // Only grounded if ground is close enough to feet.
    // Using a tight band here prevents "ground far below" false-positives on edges.
    // Accept a small "snap" distance above ground; larger means we're airborne.
    if (distanceToGround > 0.16 || distanceToGround < -0.12) {
      if (this.DEBUG_GROUND_CHECK) {
        this.debugLogTimer += 1 / 60;
        if (this.debugLogTimer > 0.2) {
          this.debugLogTimer = 0;
          console.log(
            `[GROUND] out-of-range pos.y=${this.body.position.y.toFixed(2)} footY=${feetY.toFixed(2)} hitY=${hitY.toFixed(2)} dist=${distanceToGround.toFixed(2)} vel.y=${this.body.velocity.y.toFixed(2)}`
          );
        }
      }
      return { grounded: false, isIce: false, isIceSlope: false, canJump: false, slopeAngle: 0 };
    }

    // Calculate slope angle from hit normal (angle from vertical)
    const normalY = result.hitNormalWorld ? result.hitNormalWorld.y : 1;
    const slopeAngle = Math.acos(Math.min(1, Math.max(0, normalY)));

    // Check if the hit normal is mostly upward (standing on surface, not wall)
    // normalY < 0.7 corresponds to slope > ~45 degrees - be stricter
    if (normalY < 0.7) {
      if (this.DEBUG_GROUND_CHECK) {
        this.debugLogTimer += 1 / 60;
        if (this.debugLogTimer > 0.2) {
          this.debugLogTimer = 0;
          console.log(
            `[GROUND] steep normalY=${normalY.toFixed(2)} slope=${slopeAngle.toFixed(2)} pos.y=${feetY.toFixed(2)} hitY=${hitY.toFixed(2)}`
          );
        }
      }
      return { grounded: false, isIce: false, isIceSlope: false, canJump: false, slopeAngle };
    }

    // Can only jump if slope is below threshold
    const canJump = slopeAngle < this.MAX_JUMPABLE_SLOPE_ANGLE;

    const userData = (result.body as any).userData;
    if (!userData) {
      return {
        grounded: true,
        isIce: false,
        isIceSlope: false,
        canJump,
        slopeAngle,
        groundBody: result.body,
        groundVelocity: { x: result.body.velocity.x, z: result.body.velocity.z },
      };
    }

    const tag = userData.tag;
    const isIce = tag === "ice" || tag === "ice_slope";
    const isIceSlope = tag === "ice_slope";

    return {
      grounded: true,
      isIce,
      isIceSlope,
      canJump,
      slopeAngle,
      groundBody: result.body,
      groundVelocity: { x: result.body.velocity.x, z: result.body.velocity.z },
      slideDirection: isIceSlope ? userData.slideDirection : undefined,
      tiltAngle: isIceSlope ? userData.tiltAngle : undefined
    };
  }

  private probeSurfaceBelow(maxDown: number): SurfaceProbe | null {
    if (!this.body.world) return null;

    const footY = this.getFootWorldY();
    const start = new CANNON.Vec3(this.body.position.x, footY + 0.25, this.body.position.z);
    const end = new CANNON.Vec3(this.body.position.x, footY - maxDown, this.body.position.z);

    const result = new CANNON.RaycastResult();
    this.body.world.raycastClosest(
      start,
      end,
      {
        collisionFilterMask: -1,
        skipBackfaces: true,
      },
      result
    );

    if (!result.hasHit || !result.body || result.body === this.body) return null;

    const hitY = result.hitPointWorld ? result.hitPointWorld.y : 0;
    const distance = footY - hitY;
    const userData = (result.body as any).userData;
    const tag = userData?.tag ?? null;
    const isIce = tag === "ice" || tag === "ice_slope";
    const isIceSlope = tag === "ice_slope";

    return {
      tag,
      distance,
      isIce,
      isIceSlope,
      slideDirection: isIceSlope ? userData?.slideDirection : undefined,
      tiltAngle: isIceSlope ? userData?.tiltAngle : undefined,
    };
  }

  public checkDeath(): boolean {
    if (this.isDead) return true;
    if (this.body.position.y < -5) {
      // Lowered threshold for faster reset
      this.isDead = true;
      return true;
    }
    return false;
  }

  public resetPosition(position: CANNON.Vec3) {
    this.body.position.copy(position);
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    this.body.quaternion.set(0, 0, 0, 1);
    this.isDead = false;
    this.hasWon = false;
    this.score = 0; // Reset coin score for new round
    this.lastHitBy = null; // Reset killer tracking for new round
    this.animState = "idle";
    this.stuckTimer = 0; // Reset stuck detection
    this.lastPosition.copy(position);
    this.isLaunched = false; // Reset launch state
    this.launchTimer = 0;
  }
}
