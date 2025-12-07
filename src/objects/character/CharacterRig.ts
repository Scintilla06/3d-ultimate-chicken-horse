import * as THREE from "three";
import * as CANNON from "cannon-es";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { Resources } from "../../core/Resources";
import { CharacterAppearance, CharacterAnimState } from "./CharacterAppearance";

interface SimpleRigNodes {
  root: THREE.Group;
  body: THREE.Object3D | null;
  head: THREE.Object3D | null;
  leftWing: THREE.Object3D | null;
  rightWing: THREE.Object3D | null;
  leftLeg: THREE.Object3D | null;
  rightLeg: THREE.Object3D | null;
}

export class CharacterRig {
  public readonly root: THREE.Group;

  private readonly nodes: SimpleRigNodes;
  private time: number = 0;

  // Animation Mixer support
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Map<string, THREE.AnimationAction> = new Map();
  private currentAction: THREE.AnimationAction | null = null;

  private constructor(
    root: THREE.Group,
    nodes: SimpleRigNodes,
    mixer: THREE.AnimationMixer | null = null,
    actions: Map<string, THREE.AnimationAction> = new Map()
  ) {
    this.root = root;
    this.nodes = nodes;
    this.mixer = mixer;
    this.actions = actions;
  }

  public static createFromAppearance(
    resources: Resources,
    appearance: CharacterAppearance
  ): CharacterRig {
    const originalModel = resources.models.get(appearance.modelKey);
    // Use SkeletonUtils.clone to properly clone skinned meshes with skeletons
    const baseModel = originalModel ? SkeletonUtils.clone(originalModel) as THREE.Group : undefined;
    const animations = resources.modelAnimations.get(appearance.modelKey);

    // Fallback: create a simple segmented placeholder chicken-like character
    const root = new THREE.Group();

    if (baseModel) {
      root.add(baseModel);
    }

    const nodes: SimpleRigNodes = {
      root,
      body: null,
      head: null,
      leftWing: null,
      rightWing: null,
      leftLeg: null,
      rightLeg: null,
    };

    let mixer: THREE.AnimationMixer | null = null;
    const actions = new Map<string, THREE.AnimationAction>();

    if (baseModel) {
      // Setup Mixer if animations exist
      if (animations && animations.length > 0) {
        console.log(`[CharacterRig] Found ${animations.length} animations for ${appearance.modelKey}:`, animations.map(a => a.name));
        mixer = new THREE.AnimationMixer(baseModel);
        animations.forEach((clip) => {
          // Normalize clip names to lower case for easier matching
          const action = mixer!.clipAction(clip);
          actions.set(clip.name.toLowerCase(), action);

          // Also map common names if they match partially
          if (clip.name.toLowerCase().includes("run"))
            actions.set("run", action);
          if (clip.name.toLowerCase().includes("walk"))
            actions.set("walk", action);
          if (clip.name.toLowerCase().includes("jump"))
            actions.set("jump", action);
          if (clip.name.toLowerCase().includes("idle"))
            actions.set("idle", action);
          if (clip.name.toLowerCase().includes("die") || clip.name.toLowerCase().includes("death"))
            actions.set("death", action);
        });
      } else {
        console.warn(`[CharacterRig] No animations found for ${appearance.modelKey}`);
      }

      baseModel.traverse((child) => {
        if (child.name.toLowerCase().includes("body")) nodes.body = child;
        if (child.name.toLowerCase().includes("head")) nodes.head = child;
        if (
          child.name.toLowerCase().includes("wing_l") ||
          child.name.toLowerCase().includes("left_wing")
        )
          nodes.leftWing = child;
        if (
          child.name.toLowerCase().includes("wing_r") ||
          child.name.toLowerCase().includes("right_wing")
        )
          nodes.rightWing = child;
        if (
          child.name.toLowerCase().includes("leg_l") ||
          child.name.toLowerCase().includes("left_leg")
        )
          nodes.leftLeg = child;
        if (
          child.name.toLowerCase().includes("leg_r") ||
          child.name.toLowerCase().includes("right_leg")
        )
          nodes.rightLeg = child;
      });
    }

    // Only create procedural parts if no body found AND no mixer (meaning likely no model or just a container)
    if (!nodes.body && !mixer) {
      const bodyGeo = new THREE.SphereGeometry(0.4, 16, 16);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: appearance.baseColor ?? 0xffffff,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.5;
      body.castShadow = true;
      body.receiveShadow = true;
      root.add(body);
      nodes.body = body;

      const headGeo = new THREE.SphereGeometry(0.25, 16, 16);
      const headMat = new THREE.MeshStandardMaterial({
        color: appearance.baseColor ?? 0xffffff,
      });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 0.95;
      head.castShadow = true;
      head.receiveShadow = true;
      root.add(head);
      nodes.head = head;

      const beakGeo = new THREE.ConeGeometry(0.08, 0.16, 8);
      const beakMat = new THREE.MeshStandardMaterial({
        color: appearance.beakColor ?? 0xffa500,
      });
      const beak = new THREE.Mesh(beakGeo, beakMat);
      beak.position.set(0, 0.95, 0.3);
      beak.rotation.x = Math.PI / 2;
      beak.castShadow = true;
      beak.receiveShadow = true;
      head.add(beak);

      const wingGeo = new THREE.BoxGeometry(0.15, 0.3, 0.4);
      const wingMat = new THREE.MeshStandardMaterial({
        color: appearance.baseColor ?? 0xffffff,
      });
      const leftWing = new THREE.Mesh(wingGeo, wingMat);
      leftWing.position.set(-0.45, 0.5, 0);
      leftWing.castShadow = true;
      leftWing.receiveShadow = true;
      root.add(leftWing);
      nodes.leftWing = leftWing;

      const rightWing = leftWing.clone();
      rightWing.position.x = 0.45;
      // clone copies properties like castShadow? Usually yes, but let's be safe or rely on clone.
      // Three.js Mesh.clone() copies castShadow/receiveShadow.
      root.add(rightWing);
      nodes.rightWing = rightWing;

      const legGeo = new THREE.BoxGeometry(0.12, 0.4, 0.12);
      const legMat = new THREE.MeshStandardMaterial({
        color: appearance.accentColor ?? 0xffcc66,
      });
      const leftLeg = new THREE.Mesh(legGeo, legMat);
      leftLeg.position.set(-0.15, 0.1, 0);
      leftLeg.castShadow = true;
      leftLeg.receiveShadow = true;
      root.add(leftLeg);
      nodes.leftLeg = leftLeg;

      const rightLeg = leftLeg.clone();
      rightLeg.position.x = 0.15;
      root.add(rightLeg);
      nodes.rightLeg = rightLeg;
    }

    // TODO: attach extra accessories based on appearance.attachments

    return new CharacterRig(root, nodes, mixer, actions);
  }

  public updateFromBody(body: CANNON.Body) {
    this.root.position.copy(body.position as any);
    this.root.quaternion.copy(body.quaternion as any);
  }

  public updateAnimation(delta: number, state: CharacterAnimState) {
    this.time += delta;

    if (this.mixer) {
      this.mixer.update(delta);

      let targetAction: THREE.AnimationAction | undefined;

      if (state === "run")
        targetAction = this.actions.get("run") || this.actions.get("walk");
      else if (state === "idle")
        targetAction = this.actions.get("idle") || this.actions.get("walk");
      else if (state === "jump") targetAction = this.actions.get("jump");
      else if (state === "fall") targetAction = this.actions.get("jump");
      else if (state === "dead")
        targetAction = this.actions.get("death") || this.actions.get("idle");
      else if (state === "win")
        targetAction = this.actions.get("jump") || this.actions.get("run");
      else if (state === "dance")
        targetAction = this.actions.get("dance") || this.actions.get("idle");

      // If no specific action found, try to find by state name directly
      if (!targetAction) targetAction = this.actions.get(state);

      if (targetAction) {
        if (this.currentAction !== targetAction) {
          if (this.currentAction) this.currentAction.fadeOut(0.2);
          targetAction.reset().fadeIn(0.2).play();
          this.currentAction = targetAction;
        }
      }
      return;
    }

    const speed = 6;
    const runAmplitude = 0.6;
    const idleAmplitude = 0.06;

    const body = this.nodes.body;
    const head = this.nodes.head;
    const leftWing = this.nodes.leftWing;
    const rightWing = this.nodes.rightWing;
    const leftLeg = this.nodes.leftLeg;
    const rightLeg = this.nodes.rightLeg;

    if (body) body.position.y = 0.5;
    if (head) head.rotation.set(0, 0, 0);
    if (leftWing) leftWing.rotation.set(0, 0, 0);
    if (rightWing) rightWing.rotation.set(0, 0, 0);
    if (leftLeg) leftLeg.rotation.set(0, 0, 0);
    if (rightLeg) rightLeg.rotation.set(0, 0, 0);

    switch (state) {
      case "run": {
        const legPhase = this.time * speed;
        if (leftLeg) leftLeg.rotation.x = Math.sin(legPhase) * runAmplitude;
        if (rightLeg)
          rightLeg.rotation.x = Math.sin(legPhase + Math.PI) * runAmplitude;

        if (body) body.position.y += Math.sin(this.time * speed * 2) * 0.04;

        if (leftWing)
          leftWing.rotation.z = Math.sin(this.time * speed * 1.2) * 0.2 - 0.3;
        if (rightWing)
          rightWing.rotation.z = -Math.sin(this.time * speed * 1.2) * 0.2 + 0.3;
        break;
      }
      case "idle": {
        if (body) body.position.y += Math.sin(this.time * 1.5) * idleAmplitude;
        if (head) head.rotation.y = Math.sin(this.time * 0.5) * 0.2;
        break;
      }
      case "jump": {
        if (leftLeg) leftLeg.rotation.x = -0.3;
        if (rightLeg) rightLeg.rotation.x = -0.3;
        if (leftWing) leftWing.rotation.z = -0.6;
        if (rightWing) rightWing.rotation.z = 0.6;
        break;
      }
      case "fall": {
        if (leftLeg) leftLeg.rotation.x = 0.4;
        if (rightLeg) rightLeg.rotation.x = 0.4;
        if (leftWing) leftWing.rotation.z = -0.4;
        if (rightWing) rightWing.rotation.z = 0.4;
        break;
      }
      case "dead": {
        this.root.rotation.z = -Math.PI / 2;
        break;
      }
      case "win": {
        if (body) body.position.y += Math.sin(this.time * 6) * 0.1 + 0.2;
        if (leftWing) leftWing.rotation.z = -0.8;
        if (rightWing) rightWing.rotation.z = 0.8;
        if (head) head.rotation.y = Math.sin(this.time * 4) * 0.5;
        break;
      }
    }
  }
}
