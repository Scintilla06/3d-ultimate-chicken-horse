import * as THREE from "three";

/**
 * 相机控制器：管理相机的位置、旋转和平滑移动
 */
export class CameraController {
  private camera: THREE.PerspectiveCamera;

  // 轨道相机参数（用于跟随玩家）
  public angleY: number = 0; // 水平角度 (Yaw)
  public angleX: number = 0.3; // 垂直角度 (Pitch)
  public distance: number = 6;

  // 建造模式相机参数
  public buildAngle: number = 0;

  // 平滑过渡参数
  private lerpActive: boolean = false;
  private lerpStart: THREE.Vector3 = new THREE.Vector3();
  private lerpEnd: THREE.Vector3 = new THREE.Vector3();
  private lerpT: number = 0;
  private lerpDuration: number = 0.8;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  /**
   * 设置相机位置和朝向
   */
  public setPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z);
  }

  /**
   * 设置相机朝向目标点
   */
  public lookAt(x: number, y: number, z: number): void {
    this.camera.lookAt(x, y, z);
  }

  /**
   * 开始相机位置平滑过渡
   */
  public tweenTo(target: THREE.Vector3, duration: number = 0.8): void {
    this.lerpActive = true;
    this.lerpStart.copy(this.camera.position);
    this.lerpEnd.copy(target);
    this.lerpT = 0;
    this.lerpDuration = duration;
  }

  /**
   * 更新平滑过渡动画
   */
  public updateTween(dt: number): void {
    if (!this.lerpActive) return;

    this.lerpT += dt;
    const t = Math.min(this.lerpT / this.lerpDuration, 1);
    this.camera.position.lerpVectors(this.lerpStart, this.lerpEnd, t);

    if (t >= 1) {
      this.lerpActive = false;
    }
  }

  /**
   * 取消平滑过渡
   */
  public cancelTween(): void {
    this.lerpActive = false;
  }

  /**
   * 检查是否正在进行平滑过渡
   */
  public isTweening(): boolean {
    return this.lerpActive;
  }

  /**
   * 处理鼠标移动进行相机旋转
   */
  public handleMouseRotation(
    deltaX: number,
    deltaY: number,
    sensitivity: number = 0.002
  ): void {
    this.angleY -= deltaX * sensitivity;
    this.angleX += deltaY * sensitivity;

    // 限制垂直角度
    this.angleX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.angleX));
  }

  /**
   * 更新轨道相机位置（跟随目标）
   */
  public updateOrbitCamera(targetPosition: THREE.Vector3): void {
    const target = targetPosition.clone();
    target.y += 1.5; // 看向头部高度

    const offsetX =
      Math.sin(this.angleY) * Math.cos(this.angleX) * this.distance;
    const offsetZ =
      Math.cos(this.angleY) * Math.cos(this.angleX) * this.distance;
    const offsetY = Math.sin(this.angleX) * this.distance;

    this.camera.position.set(
      target.x + offsetX,
      target.y + offsetY,
      target.z + offsetZ
    );
    this.camera.lookAt(target);
  }

  /**
   * 更新建造模式相机（环绕地图中心）
   */
  public updateBuildViewCamera(
    movementX: number,
    centerX: number = 0,
    centerZ: number = 12.5,
    radius: number = 30,
    height: number = 20
  ): void {
    this.buildAngle -= movementX * 0.005;

    this.camera.position.x = centerX + Math.sin(this.buildAngle) * radius;
    this.camera.position.y = height;
    this.camera.position.z = centerZ + Math.cos(this.buildAngle) * radius;
    this.camera.lookAt(centerX, 1, centerZ);
  }

  /**
   * 设置建造模式初始视角
   */
  public initBuildViewCamera(
    centerX: number = 0,
    centerZ: number = 12.5,
    radius: number = 30,
    height: number = 20
  ): void {
    this.buildAngle = 0;
    this.camera.position.set(
      centerX + Math.sin(this.buildAngle) * radius,
      height,
      centerZ + Math.cos(this.buildAngle) * radius
    );
    this.camera.lookAt(centerX, 1, centerZ);
  }

  /**
   * 自由视角相机控制（观战模式）
   */
  public updateFreeCamera(
    forward: boolean,
    backward: boolean,
    left: boolean,
    right: boolean,
    up: boolean,
    down: boolean,
    speed: number = 0.5
  ): void {
    const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(
      this.camera.quaternion
    );
    const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(
      this.camera.quaternion
    );

    if (forward) this.camera.position.add(forwardVec.multiplyScalar(speed));
    if (backward)
      this.camera.position.sub(
        new THREE.Vector3(0, 0, -1)
          .applyQuaternion(this.camera.quaternion)
          .multiplyScalar(speed)
      );
    if (right) this.camera.position.add(rightVec.multiplyScalar(speed));
    if (left)
      this.camera.position.sub(
        new THREE.Vector3(1, 0, 0)
          .applyQuaternion(this.camera.quaternion)
          .multiplyScalar(speed)
      );
    if (up) this.camera.position.y += speed;
    if (down) this.camera.position.y -= speed;
  }

  /**
   * 自由视角鼠标控制
   */
  public handleFreeLook(movementX: number, movementY: number): void {
    const euler = new THREE.Euler(0, 0, 0, "YXZ");
    euler.setFromQuaternion(this.camera.quaternion);
    euler.y -= movementX * 0.002;
    euler.x -= movementY * 0.002;
    euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
    this.camera.quaternion.setFromEuler(euler);
  }

  /**
   * 获取相机实例
   */
  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }
}
