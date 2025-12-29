import * as CANNON from 'cannon-es';

export class PhysicsWorld {
    public world: CANNON.World;
    public playerMaterial: CANNON.Material;
    public iceMaterial: CANNON.Material;
    public defaultMaterial: CANNON.Material;

    constructor() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -7.5, 0); // Reduced gravity for better jumping
        this.world.broadphase = new CANNON.NaiveBroadphase();
        (this.world.solver as CANNON.GSSolver).iterations = 10;
        
        // Default material
        this.defaultMaterial = new CANNON.Material('default');
        const defaultContactMaterial = new CANNON.ContactMaterial(this.defaultMaterial, this.defaultMaterial, {
            friction: 0.3,
            restitution: 0.0, // 降低弹性，减少碰撞反弹
        });
        this.world.addContactMaterial(defaultContactMaterial);

        // Player material (Slippery)
        this.playerMaterial = new CANNON.Material('player');
        const playerContactMaterial = new CANNON.ContactMaterial(this.playerMaterial, this.defaultMaterial, {
            friction: 0.0,
            restitution: 0.0,
        });
        this.world.addContactMaterial(playerContactMaterial);

        // Ice material (Very slippery)
        this.iceMaterial = new CANNON.Material('ice');
        const iceContactMaterial = new CANNON.ContactMaterial(this.defaultMaterial, this.iceMaterial, {
            friction: 0.02,
            restitution: 0.1,
        });
        this.world.addContactMaterial(iceContactMaterial);

        // Player on ice (Extremely slippery)
        const playerIceContactMaterial = new CANNON.ContactMaterial(this.playerMaterial, this.iceMaterial, {
            friction: 0.01, // Very low friction for slippery ice
            restitution: 0.0,
        });
        this.world.addContactMaterial(playerIceContactMaterial);
    }

    public step(dt: number): void {
        this.world.step(1 / 60, dt, 3);
    }
}
