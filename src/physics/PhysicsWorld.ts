import * as CANNON from 'cannon-es';

export class PhysicsWorld {
    public world: CANNON.World;

    constructor() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -7.5, 0); // Reduced gravity for better jumping
        this.world.broadphase = new CANNON.NaiveBroadphase();
        (this.world.solver as CANNON.GSSolver).iterations = 10;
        
        // Default material
        const defaultMaterial = new CANNON.Material('default');
        const defaultContactMaterial = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
            friction: 0.3,
            restitution: 0.3,
        });
        this.world.addContactMaterial(defaultContactMaterial);

        // Player material (Slippery)
        this.playerMaterial = new CANNON.Material('player');
        const playerContactMaterial = new CANNON.ContactMaterial(this.playerMaterial, defaultMaterial, {
            friction: 0.0,
            restitution: 0.0,
        });
        this.world.addContactMaterial(playerContactMaterial);
    }

    public playerMaterial: CANNON.Material;

    public step(dt: number): void {
        this.world.step(1 / 60, dt, 3);
    }
}
