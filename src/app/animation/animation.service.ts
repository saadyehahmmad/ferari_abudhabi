import { Injectable } from '@angular/core';
import * as THREE from 'three';
import {
  RollerCoasterGeometry,
  RollerCoasterLiftersGeometry,
  RollerCoasterShadowGeometry,
} from 'three/examples/jsm/misc/RollerCoaster.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface ParametricCurve {
  getPointAt(t: number): THREE.Vector3;
  getTangentAt(t: number): THREE.Vector3;
}

const CONFIG = {
  CAMERA_FOV: 50,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 500,
  CAMERA_HEIGHT_OFFSET: 0.3,

  BACKGROUND_COLOR: 0x87ceeb,
  GROUND_COLOR: 0xd2b48c,
  SHADOW_COLOR: 0x8b7355,
  FERRARI_RED: 0xdc0000,
  TRACK_METAL: 0x2c3e50,
  SKY_LIGHT_COLOR: 0xffe4b5,
  GROUND_LIGHT_COLOR: 0x8b7355,
  AMBIENT_LIGHT_COLOR: 0xffffff,
  DIRECTIONAL_LIGHT_COLOR: 0xffe4b5,
  HEMISPHERE_INTENSITY: 1.5,
  AMBIENT_INTENSITY: 0.4,
  DIRECTIONAL_INTENSITY: 1.2,

  CURVE_DIVISIONS: 2000,
  LIFTER_DIVISIONS: 150,
  SHADOW_DIVISIONS: 600,
  CURVE_SCALE: 2.5,
  TRACK_WIDTH_SCALE: 1.2,

  INITIAL_VELOCITY: 0.0002,
  MIN_VELOCITY: 0.00005,
  MAX_VELOCITY: 0.004,
  GRAVITY_FACTOR: 0.000003,
  VELOCITY_DAMPING: 0.995,
  FIXED_DELTA_TIME: 16,
  ACCELERATION_SMOOTHING: 0.95,

  GROUND_SIZE: 800,
  GROUND_HEIGHT: 0.1,
  FOG_NEAR: 100,
  FOG_FAR: 400,
} as const;

@Injectable({
  providedIn: 'root',
})
export class AnimationService {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private animationId = 0;

  private progress = 0;
  private velocity: number = CONFIG.INITIAL_VELOCITY;
  private curve!: ParametricCurve;

  private carModel?: THREE.Group;
  private mixer?: THREE.AnimationMixer;

  private mouseX = 0;

  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  /**
   * Initializes the Three.js scene with the provided canvas element
   */
  initialize(canvas: HTMLCanvasElement): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.BACKGROUND_COLOR);
    this.scene.fog = new THREE.Fog(
      CONFIG.BACKGROUND_COLOR,
      CONFIG.FOG_NEAR,
      CONFIG.FOG_FAR
    );

    this.camera = new THREE.PerspectiveCamera(
      CONFIG.CAMERA_FOV,
      window.innerWidth / window.innerHeight,
      CONFIG.CAMERA_NEAR,
      CONFIG.CAMERA_FAR
    );
    this.camera.position.set(0, 5, 5);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.curve = this.createParametricCurve();
    this.createLighting();
    this.createTrack();
    this.createGround();
    this.loadCarModel();
  }

  /**
   * Starts the animation loop
   */
  start(): void {
    this.animate();
  }

  /**
   * Stops the animation and cleans up resources
   */
  dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }

    this.geometries.forEach((geometry) => geometry.dispose());
    this.geometries = [];

    this.materials.forEach((material) => material.dispose());
    this.materials = [];

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }

    if (this.scene) {
      this.scene.clear();
    }
  }

  /**
   * Handles window resize events
   */
  onResize(canvas: HTMLCanvasElement): void {
    if (!this.camera || !this.renderer) return;

    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  /**
   * Sets the mouse X position (normalized 0-1)
   */
  setMouseX(normalizedX: number): void {
    this.mouseX = normalizedX;
  }

  /**
   * Creates a parametric curve for the roller coaster path
   * Uses mathematical functions (sin/cos) for perfectly smooth looping
   */
  private createParametricCurve(): ParametricCurve {
    const PI2 = Math.PI * 2;

    const vector = new THREE.Vector3();
    const vector2 = new THREE.Vector3();

    return {
      getPointAt(t: number): THREE.Vector3 {
        const angle = t * PI2;

        const x = Math.sin(angle * 2) * Math.cos(angle * 3) * 60;
        const y = Math.sin(angle * 4) * 8 + Math.cos(angle * 8) * 4 + 15;
        const z = Math.sin(angle * 1.5) * Math.cos(angle * 2) * 60;

        return vector.set(x, y, z).multiplyScalar(CONFIG.CURVE_SCALE);
      },

      getTangentAt(t: number): THREE.Vector3 {
        const delta = 0.0001;
        const t1 = Math.max(0, t - delta);
        const t2 = Math.min(1, t + delta);

        return vector2
          .copy(this.getPointAt(t2))
          .sub(this.getPointAt(t1))
          .normalize();
      },
    };
  }

  /**
   * Creates realistic lighting for desert environment
   */
  private createLighting(): void {
    const hemisphereLight = new THREE.HemisphereLight(
      CONFIG.SKY_LIGHT_COLOR,
      CONFIG.GROUND_LIGHT_COLOR,
      CONFIG.HEMISPHERE_INTENSITY
    );
    this.scene.add(hemisphereLight);

    const ambientLight = new THREE.AmbientLight(
      CONFIG.AMBIENT_LIGHT_COLOR,
      CONFIG.AMBIENT_INTENSITY
    );
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(
      CONFIG.DIRECTIONAL_LIGHT_COLOR,
      CONFIG.DIRECTIONAL_INTENSITY
    );
    directionalLight.position.set(100, 200, 100);
    directionalLight.castShadow = false;
    this.scene.add(directionalLight);
  }

  /**
   * Creates the roller coaster track with supports and shadows
   */
  private createTrack(): void {
    const trackGeometry = new RollerCoasterGeometry(
      this.curve,
      CONFIG.CURVE_DIVISIONS
    );
    const trackMaterial = new THREE.MeshStandardMaterial({
      color: CONFIG.FERRARI_RED,
      metalness: 0.8,
      roughness: 0.3,
      envMapIntensity: 1.0,
    });
    const trackMesh = new THREE.Mesh(trackGeometry, trackMaterial);

    this.geometries.push(trackGeometry);
    this.materials.push(trackMaterial);
    this.scene.add(trackMesh);

    const liftersGeometry = new RollerCoasterLiftersGeometry(
      this.curve,
      CONFIG.LIFTER_DIVISIONS
    );
    const liftersMaterial = new THREE.MeshStandardMaterial({
      color: CONFIG.TRACK_METAL,
      metalness: 0.9,
      roughness: 0.4,
    });
    const liftersMesh = new THREE.Mesh(liftersGeometry, liftersMaterial);
    liftersMesh.position.y = CONFIG.GROUND_HEIGHT;

    this.geometries.push(liftersGeometry);
    this.materials.push(liftersMaterial);
    this.scene.add(liftersMesh);

    const shadowGeometry = new RollerCoasterShadowGeometry(
      this.curve,
      CONFIG.SHADOW_DIVISIONS
    );
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: CONFIG.SHADOW_COLOR,
      transparent: true,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadowMesh.position.y = CONFIG.GROUND_HEIGHT;

    this.geometries.push(shadowGeometry);
    this.materials.push(shadowMaterial);
    this.scene.add(shadowMesh);
  }

  /**
   * Creates the desert ground plane
   */
  private createGround(): void {
    const groundGeometry = new THREE.PlaneGeometry(
      CONFIG.GROUND_SIZE,
      CONFIG.GROUND_SIZE,
      50,
      50
    );
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: CONFIG.GROUND_COLOR,
      roughness: 0.9,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;

    this.geometries.push(groundGeometry);
    this.materials.push(groundMaterial);
    this.scene.add(ground);
  }

  /**
   * Loads the Red Bull RB6 F1 car 3D model
   */
  private loadCarModel(): void {
    const loader = new GLTFLoader();

    loader.load(
      'rb6.glb',
      (gltf) => {
        this.carModel = gltf.scene;

        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.carModel);
          gltf.animations.forEach((clip) => {
            const action = this.mixer!.clipAction(clip);
            action.play();
          });
        }

        const carScale = 0.05;
        this.carModel.scale.set(carScale, carScale, carScale);

        this.scene.add(this.carModel);
      },
      () => {},
      (error) => {
        console.error('Error loading car model:', error);
      }
    );
  }

  /**
   * Animation loop - runs every frame (~60 FPS)
   */
  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    this.updateCameraPosition();
    this.updateCarPosition();

    if (this.mixer) {
      this.mixer.update(0.016);
    }

    this.renderer.render(this.scene, this.camera);
  };

  /**
   * Updates camera position and velocity based on physics
   */
  private updateCameraPosition(): void {
    this.progress += this.velocity;
    this.progress = this.progress % 1;

    const position = this.curve.getPointAt(this.progress);
    const tangent = this.curve.getTangentAt(this.progress);

    const slopeEffect = -tangent.y;
    const acceleration =
      slopeEffect * CONFIG.GRAVITY_FACTOR * CONFIG.FIXED_DELTA_TIME;
    this.velocity += acceleration;
    this.velocity *= CONFIG.VELOCITY_DAMPING;

    this.velocity = Math.max(
      CONFIG.MIN_VELOCITY,
      Math.min(CONFIG.MAX_VELOCITY, this.velocity)
    );

    const cameraOffset = new THREE.Vector3()
      .copy(tangent)
      .multiplyScalar(-1.5)
      .add(new THREE.Vector3(0, 1, 0));

    this.camera.position.copy(position).add(cameraOffset);

    // Add mouse influence on x-axis
    const mouseOffsetX = (this.mouseX - 0.5) * 20; // Adjust sensitivity as needed
    this.camera.position.x += mouseOffsetX;

    const lookAhead = new THREE.Vector3()
      .copy(position)
      .add(tangent.multiplyScalar(5));
    this.camera.lookAt(lookAhead);
  }

  /**
   * Updates the F1 car position to follow the track
   */
  private updateCarPosition(): void {
    if (!this.carModel) return;

    const position = this.curve.getPointAt(this.progress);
    const tangent = this.curve.getTangentAt(this.progress);

    this.carModel.position.copy(position);
    this.carModel.position.y += 0.2;

    const forward = tangent.clone().normalize();

    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3()
      .crossVectors(up, forward)
      .normalize();
    const carUp = new THREE.Vector3()
      .crossVectors(forward, right)
      .normalize();

    const matrix = new THREE.Matrix4();
    matrix.makeBasis(right, carUp, forward);
    this.carModel.rotation.setFromRotationMatrix(matrix);
    this.carModel.rotateY(0);
  }
}
