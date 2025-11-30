import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Arrow {
    public mesh: THREE.Group;
    public body: CANNON.Body;
    private speed: number = 8;
    private lifeTime: number = 3; // Seconds
    private age: number = 0;
    public shouldRemove: boolean = false;

    constructor(mesh: THREE.Group, position: THREE.Vector3, direction: THREE.Vector3) {
        this.mesh = mesh.clone();
        this.mesh.position.copy(position);
        
        // Rotate mesh to face direction
        // Assuming arrow model points along +Z. We look at the target point.
        const target = position.clone().add(direction);
        this.mesh.lookAt(target);

        // Save rotation for body (which aligns with flight direction Z)
        const bodyQuat = this.mesh.quaternion.clone();

        // Apply visual correction: Rotate 90 degrees left (around Y)
        this.mesh.rotateY(Math.PI / 2);

        // Create Body
        // Arrow shape: Box (Long in Z)
        const shape = new CANNON.Box(new CANNON.Vec3(0.1, 0.1, 0.4));
        this.body = new CANNON.Body({
            mass: 1, 
            type: CANNON.Body.KINEMATIC,
            shape: shape
        });
        this.body.position.set(position.x, position.y, position.z);
        
        // Set velocity
        this.body.velocity.set(
            direction.x * this.speed,
            direction.y * this.speed,
            direction.z * this.speed
        );

        // Set rotation
        // Cannon body quaternion needs to match direction (Z-aligned)
        this.body.quaternion.set(
            bodyQuat.x,
            bodyQuat.y,
            bodyQuat.z,
            bodyQuat.w
        );
        
        // Tag for player collision
        (this.body as any).userData = { tag: "trap" };
        (this.body as any).meshReference = this.mesh;
        
        // Make it a sensor so it doesn't physically push things?
        // If it's Kinematic, it pushes Dynamic bodies.
        // If we want it to just kill, maybe set collisionResponse = false
        this.body.collisionResponse = false;
    }

    public update(dt: number) {
        this.age += dt;
        if (this.age > this.lifeTime) {
            this.shouldRemove = true;
        }
        
        // Sync mesh with body
        this.mesh.position.copy(this.body.position as any);
        // Copy body quaternion then apply visual rotation correction
        this.mesh.quaternion.copy(this.body.quaternion as any);
        this.mesh.rotateY(Math.PI / 2);
    }
}
