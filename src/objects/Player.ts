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

  // Stuck detection: track position to detect when character is stuck on edges
  private lastPosition: CANNON.Vec3 = new CANNON.Vec3();
  private stuckTimer: number = 0;
  private readonly STUCK_THRESHOLD: number = 0.3; // Time before considering stuck
  private readonly STUCK_MOVE_THRESHOLD: number = 0.05; // Minimum movement to not be stuck

  public onJumpStart?: () => void;
  public onCoinCollect?: () => void;
  public onGoal?: () => void;
  public onDeath?: (info: { tag: string; owner?: string }) => void;

  public isDead: boolean = false;
  public hasWon: boolean = false;
  public score: number = 0;

  protected animState: CharacterAnimState = "idle";

  // Wall collision tracking - to prevent wall climbing
  private isAgainstWall: boolean = false;
  private wallContactNormal: CANNON.Vec3 = new CANNON.Vec3();

  constructor(rig: CharacterRig, body: CANNON.Body) {
    super(rig, body);

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
        if (this.body.velocity.y > 0 && this.body.velocity.y < 3.0) {
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
    // Reset wall contact flag each frame (will be set again if still touching)
    this.isAgainstWall = false;
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

    // --- Stuck Detection and Recovery ---
    // Check if character is stuck on an edge (not grounded but barely moving)
    if (!grounded) {
      const posDiff = this.body.position.vsub(this.lastPosition);
      const moveDistance = posDiff.length();
      
      // If barely moving and has small upward velocity (being pushed by collision)
      if (moveDistance < this.STUCK_MOVE_THRESHOLD && Math.abs(this.body.velocity.y) < 2.0) {
        this.stuckTimer += delta;
        
        // If stuck for too long, apply downward force to dislodge
        if (this.stuckTimer > this.STUCK_THRESHOLD) {
          // Apply strong downward velocity to break free
          this.body.velocity.y = Math.min(this.body.velocity.y, -2.0);
          // Also apply small random horizontal push to help slide off
          const pushDir = Math.random() * Math.PI * 2;
          this.body.velocity.x += Math.cos(pushDir) * 0.5;
          this.body.velocity.z += Math.sin(pushDir) * 0.5;
          this.stuckTimer = 0; // Reset timer
        }
      } else {
        this.stuckTimer = 0; // Reset if moving normally
      }
    } else {
      this.stuckTimer = 0; // Reset when grounded
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
      
      // Force downward if we have any upward velocity while against wall
      if (this.body.velocity.y > 0 && this.body.velocity.y < 5.0) {
        this.body.velocity.y = 0;
      }
    }

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
  private DEBUG_GROUND_CHECK: boolean = false;
  private debugLogTimer: number = 0;

  /**
   * Check ground type and get ice slope info if standing on ice
   * Uses multiple ray casts for more reliable edge detection
   */
  private getGroundInfo(): { grounded: boolean; isIce: boolean; isIceSlope: boolean; canJump: boolean; slopeAngle: number; slideDirection?: { x: number; z: number }; tiltAngle?: number } {
    if (!this.body.world) return { grounded: false, isIce: false, isIceSlope: false, canJump: false, slopeAngle: 0 };

    // If moving upward significantly, not grounded (prevents edge-climbing glitch)
    if (this.body.velocity.y > 1.5) {
      return { grounded: false, isIce: false, isIceSlope: false, canJump: false, slopeAngle: 0 };
    }

    const radius = 0.4; // Character radius
    const rayLength = 0.35; // Shorter ray to avoid detecting platforms we're next to
    const rayStartOffset = 0.05; // Start very close to bottom

    // Only cast center ray - simpler and more reliable
    // Side rays were causing false positives when stuck on edges
    const start = new CANNON.Vec3(
      this.body.position.x,
      this.body.position.y + rayStartOffset,
      this.body.position.z
    );
    const end = new CANNON.Vec3(
      this.body.position.x,
      this.body.position.y - rayLength,
      this.body.position.z
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

    if (!result.hasHit || !result.body || result.body === this.body) {
      return { grounded: false, isIce: false, isIceSlope: false, canJump: false, slopeAngle: 0 };
    }

    // CRITICAL: Check that the hit point is actually below us, not to the side
    // The hit point's Y should be close to or below our feet position
    const hitY = result.hitPointWorld ? result.hitPointWorld.y : 0;
    const feetY = this.body.position.y;
    
    // DEBUG: Log ground check info
    if (this.DEBUG_GROUND_CHECK) {
      this.debugLogTimer += 1/60;
      if (this.debugLogTimer > 0.2) { // Log every 200ms
        this.debugLogTimer = 0;
        const normalY = result.hitNormalWorld ? result.hitNormalWorld.y : 0;
        console.log(`[GroundCheck] pos.y=${feetY.toFixed(2)}, hitY=${hitY.toFixed(2)}, normalY=${normalY.toFixed(2)}, vel.y=${this.body.velocity.y.toFixed(2)}, isJumping=${this.isJumping}, coyote=${this.coyoteTimer.toFixed(2)}`);
      }
    }
    
    // If hit point is above our feet position, we're hitting a wall/edge, not ground
    if (hitY > feetY + 0.1) {
      return { grounded: false, isIce: false, isIceSlope: false, canJump: false, slopeAngle: 0 };
    }

    // Calculate slope angle from hit normal (angle from vertical)
    const normalY = result.hitNormalWorld ? result.hitNormalWorld.y : 1;
    const slopeAngle = Math.acos(Math.min(1, Math.max(0, normalY)));

    // Check if the hit normal is mostly upward (standing on surface, not wall)
    // normalY < 0.7 corresponds to slope > ~45 degrees - be stricter
    if (normalY < 0.7) {
      return { grounded: false, isIce: false, isIceSlope: false, canJump: false, slopeAngle };
    }

    // Can only jump if slope is below threshold
    const canJump = slopeAngle < this.MAX_JUMPABLE_SLOPE_ANGLE;

    const userData = (result.body as any).userData;
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
    this.stuckTimer = 0; // Reset stuck detection
    this.lastPosition.copy(position);
  }
}
