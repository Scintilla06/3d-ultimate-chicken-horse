import * as CANNON from "cannon-es";
import * as THREE from "three";
import { Character } from "./character/Character";
import { CharacterAnimState } from "./character/CharacterAppearance";
import { CharacterRig } from "./character/CharacterRig";

export class Player extends Character {
  private isJumping: boolean = false;
  private jumpTime: number = 0;
  private readonly MAX_JUMP_TIME: number = 0.3;
  private readonly MIN_JUMP_FORCE: number = 5; // Reduced from 6
  private readonly JUMP_HOLD_FORCE: number = 12; // Reduced from 15
  private readonly MOVE_SPEED: number = 8; // Reduced from 12
  private readonly SPRINT_MULTIPLIER: number = 1.5;

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
          this.isDead = true;
          this.lastHitBy = contactBody.userData.owner; // Track killer
        } else if (tag === "goal") {
          this.hasWon = true;
        } else if (tag === "spring") {
          this.body.velocity.y = 20; // High bounce
          this.isJumping = true;
        } else if (tag === "coin") {
          if (!contactBody.userData.collected) {
            this.score += 1;
            contactBody.userData.collected = true;
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
    cameraAngleY: number
  ) {
    if (this.isDead || this.hasWon) return;

    const grounded = this.canJump();

    // --- Movement ---

    if (grounded) {
      const speed = input.sprint
        ? this.MOVE_SPEED * this.SPRINT_MULTIPLIER
        : this.MOVE_SPEED;

      if (Math.abs(input.x) > 0.1 || Math.abs(input.y) > 0.1) {
        const inputAngle = Math.atan2(input.x, input.y);
        const targetRotation = cameraAngleY + inputAngle;

        const vx = Math.sin(targetRotation) * speed;
        const vz = Math.cos(targetRotation) * speed;

        // Normal movement (instant)
        this.body.velocity.x = vx;
        this.body.velocity.z = vz;
        this.body.quaternion.setFromEuler(0, targetRotation, 0);

        this.animState = "run";
      } else {
        // Stop immediately (Honey or Ground)
        this.body.velocity.x = 0;
        this.body.velocity.z = 0;
        this.body.quaternion.setFromEuler(0, cameraAngleY, 0);
        this.animState = "idle";
      }
    } else {
      // Air Control
      if (Math.abs(input.x) > 0.1 || Math.abs(input.y) > 0.1) {
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

    // --- Jumping ---
    if (input.jump) {
      if (grounded) {
        this.isJumping = true;
        this.jumpTime = 0;

        let jumpForce = this.MIN_JUMP_FORCE;

        this.body.velocity.y = jumpForce;
      } else if (this.isJumping && this.jumpTime < this.MAX_JUMP_TIME) {
        this.body.applyForce(
          new CANNON.Vec3(0, this.JUMP_HOLD_FORCE, 0),
          this.body.position
        );
        this.jumpTime += 1 / 60;
      }
    } else {
      this.isJumping = false;
    }

    if (!grounded && !this.isJumping) {
      this.animState = "fall";
    }
  }

  private canJump(): boolean {
    if (!this.body.world) return false;

    // Start ray slightly above the feet (pivot) to avoid starting inside the ground surface
    const start = this.body.position.clone();
    start.y += 0.1;

    const end = start.clone();
    end.y -= 0.4; // Cast down: 0.1 above + 0.3 below feet.

    const result = new CANNON.RaycastResult();
    this.body.world.raycastClosest(
      start,
      end,
      {
        collisionFilterMask: -1, // Check all groups
        skipBackfaces: true,
      },
      result
    );

    return result.hasHit;
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
    this.animState = "idle";
  }
}
