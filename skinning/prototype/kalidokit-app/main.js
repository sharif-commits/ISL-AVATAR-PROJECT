import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as Kalidokit from 'kalidokit';

const threeCanvas = document.getElementById('threeCanvas');
const loadingMessage = document.getElementById('loadingMessage');

// Three.js Setup
const renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, alpha: true, antialias: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.4, 3);
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.target.set(0, 1.0, 0);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(1, 1, 1).normalize();
scene.add(light);
const ambient = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambient);

let currentVrm = null;
let currentGltf = null;
let modelLoaded = false;

// Load Model
const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

loader.load(
  '/avatar.glb',
  (gltf) => {
    const vrm = gltf.userData.vrm;
    if (vrm) {
      scene.add(vrm.scene);
      VRMUtils.removeUnnecessaryJoints(gltf.scene);
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      currentVrm = vrm;
      vrm.scene.rotation.y = Math.PI; // Face camera
    } else {
      scene.add(gltf.scene);
      currentGltf = gltf.scene;
      // Many Mixamo models face backwards relative to VRM
      gltf.scene.rotation.y = Math.PI;
    }
    modelLoaded = true;
    checkAndProcessImage();
  },
  undefined,
  (error) => console.error(error)
);

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});
renderer.setSize(window.innerWidth, window.innerHeight, false);

// Animation Loop
let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const delta = (now - lastTime) / 1000;
  lastTime = now;
  
  if (currentVrm) {
    currentVrm.update(delta);
  }
  renderer.render(scene, camera);
}
animate();

// MediaPipe Setup
let holistic = new window.Holistic({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
});

holistic.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
  refineFaceLandmarks: true,
});

let inputImage = new Image();
inputImage.crossOrigin = "anonymous";
let imageLoaded = false;

inputImage.onload = () => {
  imageLoaded = true;
  checkAndProcessImage();
};
inputImage.src = "/image.png";

async function checkAndProcessImage() {
  if (modelLoaded && imageLoaded) {
    await holistic.send({ image: inputImage });
    loadingMessage.style.opacity = '0';
  }
}

holistic.onResults((results) => {
  if (!currentVrm && !currentGltf) return;

  const width = inputImage.naturalWidth || inputImage.width;
  const height = inputImage.naturalHeight || inputImage.height;

  // Kalidokit processing
  let rigFace, rigPose, rigLeftHand, rigRightHand;
  
  if (results.faceLandmarks) {
    rigFace = Kalidokit.Face.solve(results.faceLandmarks, { runtime: "mediapipe", imageSize: { width, height } });
  }
  if (results.poseWorldLandmarks && results.poseLandmarks) {
    rigPose = Kalidokit.Pose.solve(results.poseWorldLandmarks, results.poseLandmarks, { runtime: "mediapipe", imageSize: { width, height } });
  }
  if (results.leftHandLandmarks) {
    rigLeftHand = Kalidokit.Hand.solve(results.leftHandLandmarks, "Left");
  }
  if (results.rightHandLandmarks) {
    rigRightHand = Kalidokit.Hand.solve(results.rightHandLandmarks, "Right");
  }

  animateModel(rigPose, rigLeftHand, rigRightHand, rigFace);
});

// Animate helper
function getBoneNode(name) {
  if (currentVrm) {
    return currentVrm.humanoid.getNormalizedBoneNode(name);
  }
  if (currentGltf) {
    const nameMap = {
      hips: "Hips",
      spine: "Spine",
      rightUpperArm: "RightArm",
      rightLowerArm: "RightForeArm",
      leftUpperArm: "LeftArm",
      leftLowerArm: "LeftForeArm",
      leftUpperLeg: "LeftUpLeg",
      leftLowerLeg: "LeftLeg",
      rightUpperLeg: "RightUpLeg",
      rightLowerLeg: "RightLeg",
      neck: "Neck",
      leftHand: "LeftHand",
      rightHand: "RightHand",
    };
    const searchName = nameMap[name] || name;
    let found = null;
    currentGltf.traverse((child) => {
      // Find bone that includes the search name (ignoring case)
      if (child.isBone && child.name.toLowerCase().includes(searchName.toLowerCase())) {
        found = child;
      }
    });
    return found;
  }
  return null;
}

const rigRotation = (name, rotation = { x: 0, y: 0, z: 0 }, dampener = 1, lerpAmount = 1.0) => {
  const Part = getBoneNode(name);
  if (!Part) {
    console.warn("Could not find bone for:", name);
    return;
  }
  
  let euler = new THREE.Euler(
    rotation.x * dampener,
    rotation.y * dampener,
    rotation.z * dampener
  );
  let quaternion = new THREE.Quaternion().setFromEuler(euler);
  Part.quaternion.slerp(quaternion, lerpAmount);
};

function animateModel(pose, leftHand, rightHand, face) {
  console.log("Applying pose to model:", pose);
  // Pose
  if (pose) {
    rigRotation("hips", pose.Hips.rotation, 0.7);
    rigRotation("spine", pose.Spine, 1);
    rigRotation("rightUpperArm", pose.RightUpperArm, 1);
    rigRotation("rightLowerArm", pose.RightLowerArm, 1);
    rigRotation("leftUpperArm", pose.LeftUpperArm, 1);
    rigRotation("leftLowerArm", pose.LeftLowerArm, 1);
    rigRotation("leftUpperLeg", pose.LeftUpperLeg, 1);
    rigRotation("leftLowerLeg", pose.LeftLowerLeg, 1);
    rigRotation("rightUpperLeg", pose.RightUpperLeg, 1);
    rigRotation("rightLowerLeg", pose.RightLowerLeg, 1);
  }

  // Hands (simplified mapping for mixamo)
  if (leftHand && pose && pose.LeftHand) {
    rigRotation("leftHand", { z: pose.LeftHand.z });
  }
  if (rightHand && pose && pose.RightHand) {
    rigRotation("rightHand", { z: pose.RightHand.z });
  }

  // Face (only VRM supports blendshapes this easily)
  if (face && currentVrm) {
    rigRotation("neck", face.head, 0.7);
    
    const preset = currentVrm.expressionManager.presetNameMap;
    currentVrm.expressionManager.setValue(preset?.blinkLeft || "blinkLeft", face.eye.l);
    currentVrm.expressionManager.setValue(preset?.blinkRight || "blinkRight", face.eye.r);
    currentVrm.expressionManager.setValue(preset?.aa || "aa", face.mouth.shape.A);
    currentVrm.expressionManager.setValue(preset?.ee || "ee", face.mouth.shape.E);
    currentVrm.expressionManager.setValue(preset?.ih || "ih", face.mouth.shape.I);
    currentVrm.expressionManager.setValue(preset?.oh || "oh", face.mouth.shape.O);
    currentVrm.expressionManager.setValue(preset?.ou || "ou", face.mouth.shape.U);
  }
}
