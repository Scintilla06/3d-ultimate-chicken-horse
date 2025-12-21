import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { Resources } from "../../core/Resources";

/**
 * 赢家界面组件
 */
export class WinScreen {
  private uiLayer: HTMLElement;
  private resources: Resources | null = null;
  private winnerModel: THREE.Group | null = null;
  private winnerMixer: THREE.AnimationMixer | null = null;

  constructor(uiLayer: HTMLElement) {
    this.uiLayer = uiLayer;
  }

  public setResources(resources: Resources): void {
    this.resources = resources;
  }

  public show(
    winnerName: string,
    winnerCharacter: string,
    onBackToLobby: () => void
  ): void {
    this.uiLayer.innerHTML = "";

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.top = "50%";
    container.style.left = "50%";
    container.style.transform = "translate(-50%, -50%)";
    container.style.backgroundColor = "rgba(0, 0, 0, 0.9)";
    container.style.padding = "60px 80px";
    container.style.borderRadius = "15px";
    container.style.color = "white";
    container.style.textAlign = "center";
    container.style.border = "4px solid gold";
    container.style.pointerEvents = "auto";

    const title = document.createElement("h1");
    title.innerText = "🏆 WINNER! 🏆";
    title.style.fontSize = "48px";
    title.style.color = "gold";
    title.style.marginBottom = "20px";
    title.style.textShadow = "2px 2px 4px rgba(0,0,0,0.5)";
    container.appendChild(title);

    const modelContainer = document.createElement("div");
    modelContainer.id = "winner-model-container";
    modelContainer.style.width = "200px";
    modelContainer.style.height = "250px";
    modelContainer.style.margin = "0 auto 20px auto";
    modelContainer.style.position = "relative";
    container.appendChild(modelContainer);

    const name = document.createElement("h2");
    name.innerText = winnerName;
    name.style.fontSize = "36px";
    name.style.marginBottom = "30px";
    name.style.color = "#FFD700";
    container.appendChild(name);

    const btn = document.createElement("button");
    btn.innerText = "BACK TO LOBBY";
    btn.style.padding = "15px 40px";
    btn.style.fontSize = "20px";
    btn.style.cursor = "pointer";
    btn.style.backgroundColor = "#4CAF50";
    btn.style.color = "white";
    btn.style.border = "none";
    btn.style.borderRadius = "8px";
    btn.style.fontWeight = "bold";
    btn.style.transition = "background-color 0.2s";
    btn.onmouseenter = () => {
      btn.style.backgroundColor = "#45a049";
    };
    btn.onmouseleave = () => {
      btn.style.backgroundColor = "#4CAF50";
    };
    btn.onclick = () => {
      this.cleanup();
      onBackToLobby();
    };
    container.appendChild(btn);

    this.uiLayer.appendChild(container);

    this.createCharacterDisplay(winnerCharacter, modelContainer);
  }

  private createCharacterDisplay(
    characterId: string,
    container: HTMLElement
  ): void {
    if (!this.resources) return;

    const width = 200;
    const height = 250;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.5, 4);
    camera.lookAt(0, 1, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffd700, 1.0);
    directionalLight.position.set(2, 3, 2);
    scene.add(directionalLight);

    const originalModel = this.resources.models.get(characterId);
    if (originalModel) {
      const charModel = SkeletonUtils.clone(originalModel) as THREE.Group;
      charModel.position.set(0, 0, 0);
      charModel.rotation.y = 0;
      scene.add(charModel);
      this.winnerModel = charModel;

      const animations = this.resources.modelAnimations.get(characterId);
      if (animations && animations.length > 0) {
        this.winnerMixer = new THREE.AnimationMixer(charModel);
        let danceClip = animations.find((a) =>
          a.name.toLowerCase().includes("dance")
        );
        if (!danceClip)
          danceClip = animations.find((a) =>
            a.name.toLowerCase().includes("idle")
          );
        if (!danceClip) danceClip = animations[0];
        if (danceClip) {
          const action = this.winnerMixer.clipAction(danceClip);
          action.play();
        }
      }
    }

    let rotationAngle = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      if (!container.isConnected) {
        renderer.dispose();
        return;
      }
      requestAnimationFrame(animate);

      const delta = clock.getDelta();
      if (this.winnerMixer) {
        this.winnerMixer.update(delta);
      }

      if (this.winnerModel) {
        rotationAngle += delta * 0.5;
        this.winnerModel.rotation.y = Math.sin(rotationAngle) * 0.3;
      }

      renderer.render(scene, camera);
    };
    animate();
  }

  public cleanup(): void {
    this.winnerModel = null;
    this.winnerMixer = null;
  }
}
