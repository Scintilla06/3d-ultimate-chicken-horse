/// <reference types="vite/client" />
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PlaceholderGenerator } from '../utils/PlaceholderGenerator';
import { convertToToon } from '../utils/ToonUtils';

export class Resources {
    private manager: THREE.LoadingManager;
    private gltfLoader: GLTFLoader;
    private textureLoader: THREE.TextureLoader;
    private audioLoader: THREE.AudioLoader;

    public models: Map<string, THREE.Group> = new Map();
    public modelAnimations: Map<string, THREE.AnimationClip[]> = new Map();
    public textures: Map<string, THREE.Texture> = new Map();
    public sounds: Map<string, AudioBuffer> = new Map();

    constructor() {
        this.manager = new THREE.LoadingManager();
        this.gltfLoader = new GLTFLoader(this.manager);
        this.textureLoader = new THREE.TextureLoader(this.manager);
        this.audioLoader = new THREE.AudioLoader(this.manager);

        this.manager.onProgress = (url, itemsLoaded, itemsTotal) => {
            console.log(`Loading file: ${url}.\nLoaded ${itemsLoaded} of ${itemsTotal} files.`);
        };
    }

    // 加载所有默认的占位符资源
    public loadDefaultPlaceholders() {
      // Models
      // Blocks / traps
      this.loadModel(
        "wood_block_321",
        import.meta.env.BASE_URL + "models/blocks/wood_block_321.glb"
      );
      this.loadModel(
        "spikes",
        import.meta.env.BASE_URL + "models/traps/spikes.glb"
      );
      this.loadModel(
        "crossbow",
        import.meta.env.BASE_URL + "models/traps/bow.glb",
        (scene) => {
          // Rotate 90 degrees around Y to face +Z (assuming original faces -X)
          scene.rotation.y = Math.PI / 2;
        }
      );
      this.loadModel(
        "arrow",
        import.meta.env.BASE_URL + "models/traps/arrrow.glb",
        (scene) => {
          // Rotate 90 degrees around Y to face +Z (assuming original faces -X)
          scene.rotation.y = Math.PI / 2;
        }
      );

      // 新工具：黑洞
      this.loadModel(
        "blackhole",
        import.meta.env.BASE_URL + "models/traps/blackhole.glb"
      );

      // 新工具：金币
      this.loadModel(
        "gold",
        import.meta.env.BASE_URL + "models/traps/gold.glb"
      );

      // 新工具：大炮
      this.loadModel(
        "cannon",
        import.meta.env.BASE_URL + "models/traps/cannon.glb"
      );

      this.loadModel(
        "platform",
        import.meta.env.BASE_URL + "models/blocks/platform.glb"
      );

      this.loadModel(
        "cloud",
        import.meta.env.BASE_URL + "models/blocks/cloud.glb"
      );

      // Register procedural character models
      this.loadModel(
        "chicken",
        import.meta.env.BASE_URL + "models/characters/chicken/chicken.glb",
        (scene) => {
          // Debug: Check size
          const box = new THREE.Box3().setFromObject(scene);
          const size = new THREE.Vector3();
          box.getSize(size);
          console.log(`[Resources] Loaded chicken model. Size: ${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)}`);
          
          // Reset scale for now to debug, or keep it if user insists no scaling needed?
          // User said "I think there is no scaling problem", implying I should remove my 0.01 scale.
          // But if it IS huge, I need to know.
          // Let's remove the scale for now as per user request/implication, but log the size.
        }
      );
      this.loadModel(
        "horse",
        import.meta.env.BASE_URL + "models/characters/horse/horse.glb"
      );
      this.loadModel(
        "sheep",
        import.meta.env.BASE_URL + "models/characters/sheep/sheep.glb"
      );
      this.loadModel(
        "monkey",
        import.meta.env.BASE_URL + "models/characters/monkey/monkey.glb"
      );
      this.loadModel(
        "lizard",
        import.meta.env.BASE_URL + "models/characters/lizard/lizard.glb"
      );

      // Textures
      this.textures.set(
        "default_grid",
        PlaceholderGenerator.createCheckerTexture("#cccccc", "#ffffff")
      );

      // Sounds (Empty buffers)
      const emptyBuffer = new AudioBuffer({ length: 1, sampleRate: 44100 });
      this.sounds.set("jump", emptyBuffer);
      this.sounds.set("death", emptyBuffer);
    }

    public loadModel(
        name: string,
        path: string,
        onLoaded?: (scene: THREE.Group) => void
    ): void {
        this.gltfLoader.load(path, (gltf) => {
            convertToToon(gltf.scene);
            if (onLoaded) {
                onLoaded(gltf.scene);
            }
            this.models.set(name, gltf.scene);
            this.modelAnimations.set(name, gltf.animations);
        });
    }

    public loadTexture(name: string, path: string): void {
        this.textureLoader.load(path, (texture) => {
            this.textures.set(name, texture);
        });
    }

    public loadSound(name: string, path: string): void {
        this.audioLoader.load(path, (buffer) => {
            this.sounds.set(name, buffer);
        });
    }

    public onReady(callback: () => void): void {
        this.manager.onLoad = callback;
    }
}
