import * as CANNON from "cannon-es";
import * as THREE from "three";
import { Character } from "./character/Character";
import { CharacterAnimState } from "./character/CharacterAppearance";
import { CharacterRig } from "./character/CharacterRig";

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

  public onJumpStart?: () => void;
  public onCoinCollect?: () => void;
  public onGoal?: () => void;
  public onDeath?: (info: { tag: string; owner?: string }) => void;

  public isDead: boolean = false;
  public hasWon: boolean = false;
  public score: number = 0;

  protected animState: CharacterAnimState = "idle";

  constructor(rig: CharacterRig, body: CANNON.Body) {
    super(rig, body);

    // Collision Listener
    this.body.addEventListener("collide", (e: any) => {
      const contactBody = e.body;
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
    super.setAnimState(this.animState);
    super.update(delta);
  }

  private getWallContact(direction: THREE.Vector3): CANNON.Vec3 | null {
    if (!this.body.world) return null;

    const radius = 0.4;
    const checkDist = radius + 0.2; // Slightly more than radius

    // Check at feet, center, head
    const heights = [0.2, 0.6, 1.0];
    const vec = new CANNON.Vec3(
      direction.x * checkDist,
      0,
      direction.z * checkDist
    );

    for (const h of heights) {
      const start = this.body.position.clone();
      start.y += h;
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

  public setInput(
    input: { x: number; y: number; jump: boolean; sprint: boolean },
    cameraAngleY: number,
    delta: number = 1 / 60
  ) {
    if (this.isDead || this.hasWon) return;

    const groundInfo = this.getGroundInfo();
    const grounded = groundInfo.grounded;

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
    const canJumpNow = (grounded && groundInfo.canJump) || (this.coyoteTimer > 0 && !this.isJumping);

    // --- Movement ---
    const hasMovementInput = Math.abs(input.x) > 0.1 || Math.abs(input.y) > 0.1;

    // Ice slope: Always apply gentle downhill acceleration when on ice slope
    if (grounded && groundInfo.isIceSlope && groundInfo.slideDirection && groundInfo.tiltAngle) {
      const slideAccel = 0.5 * groundInfo.tiltAngle; // Gentle constant acceleration
      this.body.velocity.x += groundInfo.slideDirection.x * slideAccel;
      this.body.velocity.z += groundInfo.slideDirection.z * slideAccel;
    }

    if (grounded) {
      const speed = input.sprint
        ? this.MOVE_SPEED * this.SPRINT_MULTIPLIER
        : this.MOVE_SPEED;

      if (hasMovementInput) {
        const inputAngle = Math.atan2(input.x, input.y);
        const targetRotation = cameraAngleY + inputAngle;

        const vx = Math.sin(targetRotation) * speed;
        const vz = Math.cos(targetRotation) * speed;

        if (groundInfo.isIce) {
          // Ice: Smooth acceleration/deceleration (slippery)
          const iceLerp = 0.08; // Lower = more slippery
          this.body.velocity.x += (vx - this.body.velocity.x) * iceLerp;
          this.body.velocity.z += (vz - this.body.velocity.z) * iceLerp;
        } else {
          // Normal movement (instant)
          this.body.velocity.x = vx;
          this.body.velocity.z = vz;
        }
        this.body.quaternion.setFromEuler(0, targetRotation, 0);

        this.animState = "run";
      } else {
        // No movement input
        if (groundInfo.isIce) {
          // Ice: Apply friction slowly (slide)
          const iceDeceleration = 0.98; // Close to 1 = very slippery
          this.body.velocity.x *= iceDeceleration;
          this.body.velocity.z *= iceDeceleration;
          
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
            this.body.velocity.x = 0;
            this.body.velocity.z = 0;
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

    // Reset jump state when landing to prevent edge-stuck issues
    if (grounded && this.body.velocity.y <= 0.1) {
      this.isJumping = false;
      this.jumpTime = 0;
    }

    // Animation state for airborne
    // Use smoothed velocity check and additional conditions to prevent edge jittering
    if (!grounded) {
      // Only show jump animation if:
      // 1. Actually jumping (isJumping flag) OR
      // 2. Moving upward significantly AND not just being pushed by collision
      const isActuallyJumping = this.isJumping && this.body.velocity.y > 0.5;
      const isFallingFast = this.body.velocity.y < -0.5;
      
      if (isActuallyJumping) {
        this.animState = "jump";
      } else if (isFallingFast) {
        this.animState = "fall";
      } else {
        // In-between state (small velocities, possibly stuck on edge)
        // Keep current animation or default to fall to avoid jitter
        if (this.animState !== "jump" && this.animState !== "fall") {
          this.animState = "fall";
        }
      }
    }
  }

  // Slope angle threshold for allowing jumps (in radians, ~50 degrees)
  private readonly MAX_JUMPABLE_SLOPE_ANGLE: number = 0.87;

  /**
   * Check ground type and get ice slope info if standing on ice
   * Uses multiple ray casts for more reliable edge detection
   */
  private getGroundInfo(): { grounded: boolean; isIce: boolean; isIceSlope: boolean; canJump: boolean; slopeAngle: number; slideDirection?: { x: number; z: number }; tiltAngle?: number } {
    if (!this.body.world) return { grounded: false, isIce: false, isIceSlope: false, canJump: false, slopeAngle: 0 };

    // If moving upward significantly, not grounded (prevents edge-climbing glitch)
    if (this.body.velocity.y > 1.0) {
      return { grounded: false, isIce: false, isIceSlope: false, canJump: false, slopeAngle: 0 };
    }

    const radius = 0.4; // Character radius
    const rayLength = 0.5; // How far below feet to check
    const rayStartOffset = 0.15; // Start slightly above bottom of capsule

    // Cast multiple rays for better edge detection
    // Center ray + 4 offset rays in cardinal directions
    const rayOffsets = [
      { x: 0, z: 0 },           // Center
      { x: radius * 0.5, z: 0 }, // Front
      { x: -radius * 0.5, z: 0 }, // Back
      { x: 0, z: radius * 0.5 }, // Right
      { x: 0, z: -radius * 0.5 }, // Left
    ];

    let hitCount = 0;
    let closestHit: CANNON.RaycastResult | null = null;
    let closestDistance = Infinity;

    for (const offset of rayOffsets) {
      const start = new CANNON.Vec3(
        this.body.position.x + offset.x,
        this.body.position.y + rayStartOffset,
        this.body.position.z + offset.z
      );
      const end = new CANNON.Vec3(
        start.x,
        this.body.position.y - rayLength,
        start.z
      );

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
        hitCount++;
        if (result.distance < closestDistance) {
          closestDistance = result.distance;
          closestHit = result;
        }
      }
    }

    // Need at least 2 rays hitting for stable ground contact
    // This prevents edge-climbing when only grazing the edge
    if (hitCount < 2 || !closestHit || !closestHit.body) {
      return { grounded: false, isIce: false, isIceSlope: false, canJump: false, slopeAngle: 0 };
    }

    // Calculate slope angle from hit normal (angle from vertical)
    const normalY = closestHit.hitNormalWorld ? closestHit.hitNormalWorld.y : 1;
    const slopeAngle = Math.acos(Math.min(1, Math.max(0, normalY))); // Clamp to valid range

    // Check if the hit normal is mostly upward (standing on surface, not wall)
    // normalY < 0.5 corresponds to slope > ~60 degrees
    if (normalY < 0.5) {
      return { grounded: false, isIce: false, isIceSlope: false, canJump: false, slopeAngle };
    }

    // Can only jump if slope is below threshold
    const canJump = slopeAngle < this.MAX_JUMPABLE_SLOPE_ANGLE;

    const userData = (closestHit.body as any).userData;
    if (!userData) {
      return { grounded: true, isIce: false, isIceSlope: false, canJump, slopeAngle };
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
      slideDirection: isIceSlope ? userData.slideDirection : undefined,
      tiltAngle: isIceSlope ? userData.tiltAngle : undefined
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
  }
}
