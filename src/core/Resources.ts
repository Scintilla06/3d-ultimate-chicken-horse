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

      // TODO: replace these simple placeholder characters with real rigged models
      // e.g. this.loadModel('chicken', import.meta.env.BASE_URL + 'models/characters/chicken_rigged.glb')

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

    public loadModel(name: string, path: string): void {
        this.gltfLoader.load(path, (gltf) => {
            convertToToon(gltf.scene);
            this.models.set(name, gltf.scene);
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
