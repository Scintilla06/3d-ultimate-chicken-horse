import * as CANNON from 'cannon-es';

export class BodyFactory {
    static createBox(width: number, height: number, depth: number, mass: number, position: CANNON.Vec3, material?: CANNON.Material): CANNON.Body {
        const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
        const body = new CANNON.Body({
            mass: mass,
            position: position,
            shape: shape,
            material: material
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
     * Creates a capsule-like body using a cylinder with a bottom sphere.
     * The cylinder provides flat vertical sides to prevent edge-climbing,
     * while the bottom sphere helps with smooth movement over terrain.
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
            material: material,
            linearDamping: 0.1, // 添加线性阻尼减少抖动
        });

        // Use a cylinder for the main body - flat sides prevent edge-climbing
        const cylinderHeight = height - radius; // Leave room for bottom sphere
        const cylinderShape = new CANNON.Cylinder(radius, radius, cylinderHeight, 12);

        // cannon-es Cylinder is not guaranteed to be aligned with Y; rotate to ensure it's upright.
        const cylinderOrientation = new CANNON.Quaternion();
        cylinderOrientation.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI / 2);

        const cylinderOffset = new CANNON.Vec3(0, radius + cylinderHeight / 2, 0);
        body.addShape(cylinderShape, cylinderOffset, cylinderOrientation);

        // Bottom sphere for smooth ground contact
        const bottomSphere = new CANNON.Sphere(radius * 0.9); // Slightly smaller to not poke out sides
        body.addShape(bottomSphere, new CANNON.Vec3(0, radius * 0.9, 0));

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
