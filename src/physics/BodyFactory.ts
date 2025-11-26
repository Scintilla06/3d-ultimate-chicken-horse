import * as CANNON from 'cannon-es';

export class BodyFactory {
    static createBox(width: number, height: number, depth: number, mass: number, position: CANNON.Vec3): CANNON.Body {
        const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
        const body = new CANNON.Body({
            mass: mass,
            position: position,
            shape: shape
        });
        return body;
    }

    static createSphere(radius: number, mass: number, position: CANNON.Vec3): CANNON.Body {
        const shape = new CANNON.Sphere(radius);
        const body = new CANNON.Body({
            mass: mass,
            position: position,
            shape: shape
        });
        return body;
    }

    /**
     * Creates a capsule-like body using two spheres.
     * This is more stable for character controllers than a single cylinder or box.
     * @param radius Radius of the character
     * @param height Total height of the character
     * @param mass Mass
     * @param position Starting position
     */
    static createPlayerBody(radius: number, height: number, mass: number, position: CANNON.Vec3, material?: CANNON.Material): CANNON.Body {
        const body = new CANNON.Body({
            mass: mass,
            position: position,
            fixedRotation: true,
            material: material
        });

        // Bottom Sphere (Feet)
        const sphereShape = new CANNON.Sphere(radius);
        // Offset so the bottom of the sphere is at local y=0 (relative to body pivot if pivot was at bottom)
        // But usually body position is center. 
        // Let's keep the convention that body.position is the pivot point (feet).
        
        // Bottom sphere center: radius
        body.addShape(sphereShape, new CANNON.Vec3(0, radius, 0));

        // Top Sphere (Head)
        // Top of character is at 'height'.
        // Top sphere center: height - radius
        // Ensure we don't place it lower than bottom sphere
        const topSphereY = Math.max(radius, height - radius);
        body.addShape(sphereShape, new CANNON.Vec3(0, topSphereY, 0));

        // If height is significantly larger than 2*radius, we might want a middle sphere or cylinder
        // For height 1.2 and radius 0.4:
        // Bottom center: 0.4
        // Top center: 0.8
        // Gap is 0.4. Spheres overlap significantly. This is fine.

        return body;
    }
    
    static createGround(): CANNON.Body {
        const shape = new CANNON.Plane();
        const body = new CANNON.Body({
            mass: 0, // Static
        });
        body.addShape(shape);
        body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        return body;
    }
}
