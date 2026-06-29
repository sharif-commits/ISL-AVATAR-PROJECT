import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================================================
// SCENE SETUP
// ============================================================================
const scene = new THREE.Scene();
const container = document.getElementById('canvas-wrapper') || document.getElementById('avatar-container') || document.body;
const width = container.clientWidth || window.innerWidth;
const height = container.clientHeight || window.innerHeight;

const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
camera.position.set(0, 1.5, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(width, height);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 4, 0);
controls.update();

scene.add(new THREE.AmbientLight(0xffffff, 1.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);
scene.add(new THREE.GridHelper(10, 10, 0x555555, 0x444444));


// ============================================================================
// COORDINATE TRANSFORM
// MediaPipe: x right, y down, z depth (positive = further from camera)
// Three.js:  x right, y up,   z toward viewer
// ============================================================================
function lmToWorld(lm) {
    return new THREE.Vector3(lm[0], -lm[1], -lm[2]);
}

// ============================================================================
// BONE TABLES
// ============================================================================
const targetBones = [
    'LeftArm', 'LeftForeArm', 'LeftHand',
    'LeftHandThumb1',  'LeftHandThumb2',  'LeftHandThumb3',
    'LeftHandIndex1',  'LeftHandIndex2',  'LeftHandIndex3',
    'LeftHandMiddle1', 'LeftHandMiddle2', 'LeftHandMiddle3',
    'LeftHandRing1',   'LeftHandRing2',   'LeftHandRing3',
    'LeftHandPinky1',  'LeftHandPinky2',  'LeftHandPinky3',
    'RightArm', 'RightForeArm', 'RightHand',
    'RightHandThumb1',  'RightHandThumb2',  'RightHandThumb3',
    'RightHandIndex1',  'RightHandIndex2',  'RightHandIndex3',
    'RightHandMiddle1', 'RightHandMiddle2', 'RightHandMiddle3',
    'RightHandRing1',   'RightHandRing2',   'RightHandRing3',
    'RightHandPinky1',  'RightHandPinky2',  'RightHandPinky3',
];

const boneObjects       = {};
const restQuaternions   = {};
const targetQuaternions = {};
const defaultPoseQuaternions = {};

let boneHitMeshes = [];    // Cylinder meshes for picking bones
let ringMeshes = [];       // Torus ring meshes for rotation gizmo
let innerIKSphere = null;  // Central sphere for IK drag
let selectedBoneName = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Rotation gizmo group (3 torus rings)
let rotationGizmo = null;

// IK drag state
let isDragging = false;
let dragPlane = new THREE.Plane();
let dragIntersect = new THREE.Vector3();
let dragOffset = new THREE.Vector3();

// Rotation ring drag state
let isRotDragging = false;
let rotDragAxis = null;         // 'x', 'y', or 'z'
let rotDragStartAngle = 0;
let rotDragStartQuat = new THREE.Quaternion();
let rotDragBoneWorldPos = new THREE.Vector3();

let isManualMode = false;
let manualFrames = [];
let hasUnsavedChanges = false;
let fileHandle = null;
let pendingFrameChange = null;

let activeEuler = new THREE.Euler();
let lastSelectedBoneForEuler = null;

// IK chain definitions: bone -> chain of parents to rotate
const ikChains = {};
function buildIKChains() {
    // Finger chains: tip (3) -> mid (2) -> base (1)
    const fingers = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
    const sides = ['Left', 'Right'];
    sides.forEach(side => {
        fingers.forEach(finger => {
            const tip = `${side}Hand${finger}3`;
            ikChains[tip] = [
                `${side}Hand${finger}3`,
                `${side}Hand${finger}2`,
                `${side}Hand${finger}1`
            ];
            // Also allow dragging from mid-finger
            const mid = `${side}Hand${finger}2`;
            ikChains[mid] = [
                `${side}Hand${finger}2`,
                `${side}Hand${finger}1`
            ];
        });
        // Hand -> ForeArm -> Arm chain
        ikChains[`${side}Hand`] = [
            `${side}Hand`,
            `${side}ForeArm`,
            `${side}Arm`
        ];
        // ForeArm -> Arm chain
        ikChains[`${side}ForeArm`] = [
            `${side}ForeArm`,
            `${side}Arm`
        ];
    });
}
buildIKChains();

let restBasisQuatR         = new THREE.Quaternion();
let rightHandRestWorldQuat = new THREE.Quaternion();
let isRightHandBasisReady  = false;

let restBasisQuatL        = new THREE.Quaternion();
let leftHandRestWorldQuat = new THREE.Quaternion();
let isLeftHandBasisReady  = false;

let modelLoaded = false;

let framesSinceLastLeft  = 999;
let framesSinceLastRight = 999;
let lastTargetWristL = null;
let lastTargetWristR = null;
// tracking variables removed
const TRACKING_LOSS_THRESHOLD = 3; 

// ============================================================================
// CORE IK: rotate one bone so its rest direction aligns with dirWorld
// ============================================================================
function solveDirection(boneName, dirWorld, parentWorldQuat) {
    const bone = boneObjects[boneName];
    if (!bone || !bone.userData.boneVector) return null;

    const rest    = restQuaternions[boneName] || new THREE.Quaternion();
    const restDir = bone.userData.boneVector.clone().applyQuaternion(rest);
    const dirLocal = dirWorld.clone().applyQuaternion(parentWorldQuat.clone().invert());

    // CRITICAL FIX: Mathematically stable 180-degree rotation
    let dot = restDir.dot(dirLocal);
    let delta = new THREE.Quaternion();
    
    if (dot < -0.9999) {
        // Vectors are perfectly opposite. Find any perpendicular axis to rotate around.
        let perp = new THREE.Vector3(1, 0, 0);
        if (Math.abs(restDir.x) > 0.9) perp.set(0, 1, 0);
        let axis = new THREE.Vector3().crossVectors(restDir, perp).normalize();
        delta.setFromAxisAngle(axis, Math.PI);
    } else {
        delta.setFromUnitVectors(restDir, dirLocal);
    }
    const finalQ = delta.clone().multiply(rest);
    targetQuaternions[boneName].copy(finalQ);
    return finalQ;
}

// ============================================================================
// NEUTRAL STANDING POSE
// ============================================================================
// Hardcode the thumb rotations here so you only have to tweak them in one place
const LEFT_THUMB_ROTATION = new THREE.Euler(-0.10, 0, -0.15, 'XYZ'); 
const RIGHT_THUMB_ROTATION = new THREE.Euler(-0.10, 0, 0.15, 'XYZ'); 

function setNeutralPose() {
    const armL = boneObjects['LeftArm'];
    const armR = boneObjects['RightArm'];
    if (!armL || !armR) return;

    const pwL = new THREE.Quaternion();
    const pwR = new THREE.Quaternion();
    armL.parent.getWorldQuaternion(pwL);
    armR.parent.getWorldQuaternion(pwR);

    const qLA  = solveDirection('LeftArm', new THREE.Vector3( 0.15, -0.98, 0.0).normalize(), pwL);
    const qLFA = qLA ? solveDirection('LeftForeArm', new THREE.Vector3( 0.10, -0.98, 0.15).normalize(), pwL.clone().multiply(qLA)) : null;
    if (qLA && qLFA) {
        const hp = pwL.clone().multiply(qLA).multiply(qLFA);
        solveDirection('LeftHand', new THREE.Vector3(-0.10, -0.40, 0.45).normalize(), hp);
    }

    const qRA  = solveDirection('RightArm',     new THREE.Vector3(-0.15, -0.98, 0.0).normalize(), pwR);
    const qRFA = qRA ? solveDirection('RightForeArm', new THREE.Vector3(-0.10, -0.98, 0.15).normalize(), pwR.clone().multiply(qRA)) : null;
    if (qRA && qRFA) {
        const hp = pwR.clone().multiply(qRA).multiply(qRFA);
        solveDirection('RightHand', new THREE.Vector3( 0.10,-0.40, 0.45).normalize(), hp);
    }

    const curlAngle = 25 * Math.PI / 180; 
    targetBones
        .filter(n => n.includes('Hand') && n !== 'LeftHand' && n !== 'RightHand')
        .forEach(name => {
            if (restQuaternions[name]) {
                let q = restQuaternions[name].clone();
                if (name.includes('LeftHandThumb')) {
                    const thumbCurl = new THREE.Quaternion().setFromEuler(LEFT_THUMB_ROTATION);
                    q.multiply(thumbCurl);
                } else if (name.includes('RightHandThumb')) {
                    const thumbCurl = new THREE.Quaternion().setFromEuler(RIGHT_THUMB_ROTATION);
                    q.multiply(thumbCurl);
                } else {
                    const curl = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), curlAngle);
                    q.multiply(curl);
                }
                targetQuaternions[name].copy(q);
            }
        });

    // Save the computed neutral pose local quaternions
    targetBones.forEach(name => {
        if (targetQuaternions[name]) {
            defaultPoseQuaternions[name] = targetQuaternions[name].clone();
        }
    });
}

// ============================================================================
// HAND ORIENTATION SOLVER
// ============================================================================
function solveHandOrientation(handData, handBoneName, restBasisQuat, handRestWorldQuat,
                               foreArmWorldQuat, side) {
    const wristW = lmToWorld(handData[0]);
    const indexW = lmToWorld(handData[5]);
    const pinkyW = lmToWorld(handData[17]);

    const midPt = new THREE.Vector3().addVectors(indexW, pinkyW).multiplyScalar(0.5);
    let fwdW  = new THREE.Vector3().subVectors(midPt, wristW).normalize();

    // Side vector: from index toward pinky for right hand, reversed for left.
    const sideW = side === 'Right'
        ? new THREE.Vector3().subVectors(pinkyW, indexW)
        : new THREE.Vector3().subVectors(indexW, pinkyW);

    // CRITICAL FIX: Prevent NaN and 180-degree flips when hand points at camera (fwd & side are parallel)
    let upW = new THREE.Vector3().crossVectors(fwdW, sideW);
    if (upW.lengthSq() < 1e-2) { // Increased threshold to catch flat hands
        // Fallback to forearm's up vector
        upW.set(0, 1, 0).applyQuaternion(foreArmWorldQuat);
        // Project fwdW onto the plane perpendicular to upW to ensure orthogonality
        fwdW.sub(upW.clone().multiplyScalar(fwdW.dot(upW))).normalize();
    }
    upW.normalize();
    
    let rightW = new THREE.Vector3().crossVectors(upW, fwdW);
    if (rightW.lengthSq() < 1e-6) {
        rightW.crossVectors(upW, new THREE.Vector3(1, 0, 0));
        if (rightW.lengthSq() < 1e-6) {
            rightW.crossVectors(upW, new THREE.Vector3(0, 0, 1));
        }
    }
    rightW.normalize();

    // Re-orthogonalize upW to ensure perfectly orthonormal basis
    upW.crossVectors(fwdW, rightW).normalize();

    const targetBasisQuat = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(rightW, upW, fwdW)
    );
    const delta           = targetBasisQuat.clone().multiply(restBasisQuat.clone().invert());
    const newHandWorldQuat = delta.clone().multiply(handRestWorldQuat);
    const handLocalQuat   = foreArmWorldQuat.clone().invert().multiply(newHandWorldQuat);

    targetQuaternions[handBoneName].copy(handLocalQuat);
    return newHandWorldQuat; 
}

// ============================================================================
// FINGER SOLVER
// ============================================================================
const fingerSegments = {
    'LeftHandThumb1':  [1, 2], 'LeftHandThumb2':  [2, 3], 'LeftHandThumb3':  [3, 4],
    'RightHandThumb1': [1, 2], 'RightHandThumb2': [2, 3], 'RightHandThumb3': [3, 4],
    'LeftHandIndex1':  [5, 6], 'LeftHandIndex2':  [6, 7], 'LeftHandIndex3':  [7, 8],
    'RightHandIndex1': [5, 6], 'RightHandIndex2': [6, 7], 'RightHandIndex3': [7, 8],
    'LeftHandMiddle1':  [9,10], 'LeftHandMiddle2':  [10,11], 'LeftHandMiddle3':  [11,12],
    'RightHandMiddle1': [9,10], 'RightHandMiddle2': [10,11], 'RightHandMiddle3': [11,12],
    'LeftHandRing1':  [13,14], 'LeftHandRing2':  [14,15], 'LeftHandRing3':  [15,16],
    'RightHandRing1': [13,14], 'RightHandRing2': [14,15], 'RightHandRing3': [15,16],
    'LeftHandPinky1':  [17,18], 'LeftHandPinky2':  [18,19], 'LeftHandPinky3':  [19,20],
    'RightHandPinky1': [17,18], 'RightHandPinky2': [18,19], 'RightHandPinky3': [19,20],
};

const fingerChains = {
    Left: [
        ['LeftHandThumb1',  'LeftHandThumb2',  'LeftHandThumb3'],
        ['LeftHandIndex1',  'LeftHandIndex2',  'LeftHandIndex3'],
        ['LeftHandMiddle1', 'LeftHandMiddle2', 'LeftHandMiddle3'],
        ['LeftHandRing1',   'LeftHandRing2',   'LeftHandRing3'],
        ['LeftHandPinky1',  'LeftHandPinky2',  'LeftHandPinky3'],
    ],
    Right: [
        ['RightHandThumb1',  'RightHandThumb2',  'RightHandThumb3'],
        ['RightHandIndex1',  'RightHandIndex2',  'RightHandIndex3'],
        ['RightHandMiddle1', 'RightHandMiddle2', 'RightHandMiddle3'],
        ['RightHandRing1',   'RightHandRing2',   'RightHandRing3'],
        ['RightHandPinky1',  'RightHandPinky2',  'RightHandPinky3'],
    ],
};

function solveFingers(handData, side, handWorldQuat) {
    if (!handData || handData.length < 21) return;

    fingerChains[side].forEach(chain => {
        let parentWorldQuat = handWorldQuat.clone();

        chain.forEach(boneName => {
            const bone = boneObjects[boneName];
            const rest = restQuaternions[boneName];
            if (!bone || !rest || !bone.userData.boneVector) return;

            const seg = fingerSegments[boneName];
            if (!seg) return;

            const a = lmToWorld(handData[seg[0]]);
            const b = lmToWorld(handData[seg[1]]);
            if (a.lengthSq() === 0 || b.lengthSq() === 0) return;

            const dirWorld = new THREE.Vector3().subVectors(b, a).normalize();
            const dirLocal = dirWorld.clone().applyQuaternion(parentWorldQuat.clone().invert());
            const dirInBoneRest = dirLocal.clone().applyQuaternion(rest.clone().invert());

            const boneVec = bone.userData.boneVector;
            
            // CRITICAL FIX: Prevent 180-degree flips in fingers
            let dot = boneVec.dot(dirInBoneRest);
            if (dot < -0.9999) {
                dirInBoneRest.x += 0.001;
                dirInBoneRest.normalize();
            }

            const localRot = new THREE.Quaternion().setFromUnitVectors(boneVec, dirInBoneRest);

            const euler = new THREE.Euler().setFromQuaternion(localRot, 'XYZ');

            const isMCP = boneName.endsWith('1');
            const isPIP = boneName.endsWith('2');

            const maxFlex = isMCP ? 90 : isPIP ? 100 : 80;
            euler.x = Math.max(-10  * Math.PI / 180,
                       Math.min(maxFlex * Math.PI / 180, euler.x));

            if (isMCP) {
                euler.z = Math.max(-40 * Math.PI / 180,
                           Math.min(40  * Math.PI / 180, euler.z));
            } else {
                euler.z = 0;
            }

            euler.y = 0;

            localRot.setFromEuler(euler);

            const finalQuat = rest.clone().multiply(localRot);
            targetQuaternions[boneName].copy(finalQuat);

            parentWorldQuat = parentWorldQuat.clone().multiply(finalQuat);
        });
    });
}

// ============================================================================
// MAP MEDIAPIPE TO AVATAR SPACE
// ============================================================================
let mpScale = 1.0;
let mpOffset = new THREE.Vector3();

function updateMappingParams(frameData) {
    const LA = boneObjects['LeftArm'];
    const RA = boneObjects['RightArm'];
    if (!LA || !RA) return;

    const aL = new THREE.Vector3(); LA.getWorldPosition(aL);
    const aR = new THREE.Vector3(); RA.getWorldPosition(aR);
    const aDist   = aL.distanceTo(aR);
    const aCenter = new THREE.Vector3().addVectors(aL, aR).multiplyScalar(0.5);

    const mL = lmToWorld(frameData.body[11]);
    const mR = lmToWorld(frameData.body[12]);
    const mDist   = mL.distanceTo(mR);
    const mCenter = new THREE.Vector3().addVectors(mL, mR).multiplyScalar(0.5);

    if (mDist > 0.001) {
        let scale = aDist / mDist;
        scale = Math.max(0.8, Math.min(1.5, scale));
        mpScale = scale;
        mpOffset.copy(aCenter).sub(mCenter.clone().multiplyScalar(mpScale));
    }
}

function getTargetPosition(lm) {
    return lmToWorld(lm).multiplyScalar(mpScale).add(mpOffset);
}

// ============================================================================
// ARM SOLVER
// ============================================================================
function solveArmChain(bodyData, handData, side, frameData) {
    const isLeft = (side === 'Left');
    const sId = isLeft ? 11 : 12; 
    const eId = isLeft ? 13 : 14; 
    const wId = isLeft ? 15 : 16; 

    const armName     = isLeft ? 'LeftArm'      : 'RightArm';
    const foreArmName = isLeft ? 'LeftForeArm'  : 'RightForeArm';
    const handName    = isLeft ? 'LeftHand'     : 'RightHand';

    const arm     = boneObjects[armName];
    const foreArm = boneObjects[foreArmName];
    if (!arm || !foreArm) return;

    const shoulder = lmToWorld(bodyData[sId]);
    const elbow    = lmToWorld(bodyData[eId]);
    const wrist    = lmToWorld(bodyData[wId]);

    const pwQ = new THREE.Quaternion();
    arm.parent.getWorldQuaternion(pwQ);
    const avatarShoulder = new THREE.Vector3();
    arm.getWorldPosition(avatarShoulder);

    const hasFlag = isLeft 
        ? (frameData && 'left_detected' in frameData) 
        : (frameData && 'right_detected' in frameData);
    let detectedThisFrame;
    if (hasFlag) {
        detectedThisFrame = isLeft ? frameData.left_detected : frameData.right_detected;
    } else {
        detectedThisFrame = handData && handData.length >= 21 && (handData[0][0] !== 0 || handData[0][1] !== 0 || handData[0][2] !== 0);
    }
    
    if (detectedThisFrame) {
        if (isLeft) framesSinceLastLeft = 0;
        else        framesSinceLastRight = 0;
    } else {
        if (isLeft) framesSinceLastLeft++;
        else        framesSinceLastRight++;
    }
    const framesSinceLast = isLeft ? framesSinceLastLeft : framesSinceLastRight;
    const hasHand = detectedThisFrame && framesSinceLast < TRACKING_LOSS_THRESHOLD
        && handData && handData.length >= 21;

    if (shoulder.lengthSq() === 0 || elbow.lengthSq() === 0) {
        targetBones.filter(n => n.includes(side)).forEach(name => {
            if (defaultPoseQuaternions[name]) {
                targetQuaternions[name].copy(defaultPoseQuaternions[name]);
            }
        });
        return;
    }

    // Prevent raw MediaPipe elbow from going deep behind the back, which causes inverted bends
    if (elbow.z < shoulder.z - 0.10) {
        elbow.z = shoulder.z - 0.10;
    }
    let upperDir = new THREE.Vector3().subVectors(elbow, shoulder).normalize();
    let foreDir  = new THREE.Vector3().subVectors(wrist, elbow).normalize();

    // armNormal calculation removed for rollback

    const wristMissing = (bodyData[wId][0] === 0 && bodyData[wId][1] === 0 && bodyData[wId][2] === 0);
    let targetWrist = null;
    if (!wristMissing) {
        targetWrist = getTargetPosition(bodyData[wId]);
    } else if (hasHand && (handData[0][0] !== 0 || handData[0][1] !== 0 || handData[0][2] !== 0)) {
        targetWrist = getTargetPosition(handData[0]);
    }
    
    if (targetWrist) {
        if (isLeft) lastTargetWristL = targetWrist.clone();
        else        lastTargetWristR = targetWrist.clone();
    } else {
        targetWrist = isLeft ? lastTargetWristL : lastTargetWristR;
    }

    if (!targetWrist) {
        targetBones.filter(n => n.includes(side)).forEach(name => {
            if (defaultPoseQuaternions[name]) {
                targetQuaternions[name].copy(defaultPoseQuaternions[name]);
            }
        });
        return;
    }
    
    // Prevent the wrist from going deep into the torso
    const backLimit = avatarShoulder.z - 0.10;
    if (targetWrist.z < backLimit) {
        targetWrist.z = backLimit;
    }
    
    let targetVec = new THREE.Vector3().subVectors(targetWrist, avatarShoulder);
    
    const targetDist = targetVec.length();
    if (targetDist > 1e-6) {
        const armScale = new THREE.Vector3();
        arm.getWorldScale(armScale);
        const scale = armScale.y;
        
        let L1 = foreArm.position.length() * scale;
        let L2 = boneObjects[handName].position.length() * scale;

        if (targetDist > L1 + L2) {
            const stretch = targetDist / (L1 + L2);
            L1 *= stretch;
            L2 *= stretch;
        }

        const reachableDist = Math.min(targetDist, L1 + L2 - 0.001 * scale);
        const targetDir = targetVec.clone().normalize();
        
        let cosAlpha = (L1*L1 + reachableDist*reachableDist - L2*L2) / (2 * L1 * reachableDist);
        cosAlpha = Math.max(-1, Math.min(1, cosAlpha));
        const sinAlpha = Math.sqrt(1 - cosAlpha*cosAlpha);
        
        const dot = upperDir.dot(targetDir);
        let ortho = new THREE.Vector3().subVectors(upperDir, targetDir.clone().multiplyScalar(dot));
        if (ortho.lengthSq() < 1e-4) {
            const hint = new THREE.Vector3(isLeft ? -1 : 1, 0, -0.2).normalize();
            ortho = new THREE.Vector3().subVectors(hint, targetDir.clone().multiplyScalar(hint.dot(targetDir)));
            if (ortho.lengthSq() < 1e-4) ortho.set(isLeft ? -1 : 1, 0, 0);
        }
        ortho.normalize();
        
        upperDir = new THREE.Vector3()
            .addScaledVector(targetDir, cosAlpha)
            .addScaledVector(ortho, sinAlpha);
            
        foreDir = new THREE.Vector3().subVectors(
            targetDir.clone().multiplyScalar(reachableDist),
            upperDir.clone().multiplyScalar(L1)
        ).normalize();
    }

    const qArm = solveDirection(armName, upperDir, pwQ);
    if (!qArm) return;
    const armWorld = pwQ.clone().multiply(qArm);

    const qFore = solveDirection(foreArmName, foreDir, armWorld);
    if (!qFore) return;
    const foreWorld = armWorld.clone().multiply(qFore);

    const restBasis     = side === 'Left' ? restBasisQuatL        : restBasisQuatR;
    const handRestWorld = side === 'Left' ? leftHandRestWorldQuat  : rightHandRestWorldQuat;
    const basisReady    = side === 'Left' ? isLeftHandBasisReady   : isRightHandBasisReady;

    if (hasHand && basisReady) {
        const handWorldQuat = solveHandOrientation(
            handData, handName, restBasis, handRestWorld, foreWorld, side
        );
        solveFingers(handData, side, handWorldQuat);
    } else {
        // Hand tracking fully missing -> fallback to default hand/finger pose
        targetBones.filter(n => n.includes(side) && n.includes('Hand')).forEach(name => {
            if (defaultPoseQuaternions[name]) {
                targetQuaternions[name].copy(defaultPoseQuaternions[name]);
            }
        });
    }
}

// ============================================================================
// UPDATE FROM ONE FRAME OF DATA
// ============================================================================
function updateAvatar(frameData) {
    if (!frameData.body || frameData.body.length < 17) return;
    updateMappingParams(frameData);
    solveArmChain(frameData.body, frameData.left_hand,  'Left',  frameData);
    solveArmChain(frameData.body, frameData.right_hand, 'Right', frameData);
}

// ============================================================================
// MODEL LOAD
// ============================================================================
const loader = new GLTFLoader();

loader.load('./assets/male2k.glb', (gltf) => {
    const avatar = gltf.scene;
    scene.add(avatar);
    avatar.scale.set(0.04, 0.04, 0.04);
    avatar.position.set(0, 0, 0);

    avatar.traverse((child) => {
        if (!child.isBone) return;
        const baseName = child.name.split('_')[0];
        if (!targetBones.includes(baseName)) return;

        boneObjects[baseName]       = child;
        restQuaternions[baseName]   = child.quaternion.clone();
        targetQuaternions[baseName] = child.quaternion.clone();

        let childBone = null;
        const childBones = child.children.filter(c => c.isBone);
        if (childBones.length > 0) {
            // For branching joints like Hands, prioritize the Middle finger to find the true central axis
            childBone = childBones.find(c => c.name.includes('Middle1')) || 
                        childBones.find(c => c.name.includes('Index1')) ||
                        childBones[0];
        }

        child.userData.boneVector = childBone
            ? childBone.position.clone().normalize()
            : new THREE.Vector3(0, 1, 0);

        let length = 0.05;
        if (childBone && childBone.position.length() > 0.01) {
            length = childBone.position.length();
        }
        child.userData.boneLength = length;

        const isFinger = baseName.includes('Thumb') || baseName.includes('Index') || 
                         baseName.includes('Middle') || baseName.includes('Ring') || 
                         baseName.includes('Pinky');
        
        let radius = isFinger ? 0.006 : 0.015; // Thin hitboxes to avoid overlap
        
        // Create an invisible capsule/cylinder for bone selection
        const hitGeo = new THREE.CylinderGeometry(radius, radius, length, 8);
        hitGeo.rotateX(Math.PI / 2);
        hitGeo.translate(0, 0, length / 2);

        const hitMat = new THREE.MeshBasicMaterial({ 
            visible: false, // Purely for raycasting 
            depthTest: false 
        });
        const hitMesh = new THREE.Mesh(hitGeo, hitMat);
        
        // Make bones white by default (as requested)
        const baseColor = new THREE.Color(0xffffff);
        
        const boneMat = new THREE.MeshBasicMaterial({ 
            color: baseColor,
            opacity: 0.0, // Hidden by default, updated by toggle later
            transparent: true,
            depthTest: false 
        });

        // Create fancy octahedral bone visual
        const boneGroup = new THREE.Group();
        
        // Dynamic proportions based on length to prevent disproportionate shapes
        const wideZ = length * 0.2; // Widest part at 20%
        let width = length * 0.15;
        if (isFinger) width = length * 0.1;
        width = Math.min(width, radius * 1.5); // Clamp max width
        
        // 1. Joint Sphere (perfectly centered on the joint)
        const jointGeo = new THREE.SphereGeometry(width * 1.2, 8, 8);
        const jointMesh = new THREE.Mesh(jointGeo, boneMat);
        boneGroup.add(jointMesh);
        
        // 2. Octahedron Body (Two Cones aligned to Z-axis)
        const botGeo = new THREE.ConeGeometry(width, wideZ, 4);
        botGeo.rotateX(-Math.PI / 2); // Align to Z axis
        botGeo.rotateZ(Math.PI / 4);  // Spin around Z axis to create flat diamond sides
        botGeo.translate(0, 0, wideZ / 2);
        const botMesh = new THREE.Mesh(botGeo, boneMat);
        boneGroup.add(botMesh);
        
        const topGeo = new THREE.ConeGeometry(width, length - wideZ, 4);
        topGeo.rotateX(Math.PI / 2);
        topGeo.rotateZ(Math.PI / 4);
        topGeo.translate(0, 0, wideZ + (length - wideZ) / 2);
        const topMesh = new THREE.Mesh(topGeo, boneMat);
        boneGroup.add(topMesh);
        
        const visibleBone = boneGroup;

        if (childBone) {
            const dir = childBone.position.clone().normalize();
            hitMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
            visibleBone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        }
        
        hitMesh.userData.boneName = baseName;
        hitMesh.userData.visibleBone = visibleBone;
        hitMesh.userData.boneMat = boneMat;
        hitMesh.userData.baseColor = baseColor;
        child.add(hitMesh);
        child.add(visibleBone);
        boneHitMeshes.push(hitMesh);
    });

    avatar.updateMatrixWorld(true);

    // ── Build unified transform gizmo ──
    rotationGizmo = new THREE.Object3D();
    rotationGizmo.visible = false;
    rotationGizmo.renderOrder = 1000;
    
    // 1. Inner Sphere for IK translation
    const innerRadius = 0.04; // Way bigger
    const innerGeo = new THREE.SphereGeometry(innerRadius, 16, 16);
    const innerMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        depthTest: false,
        transparent: true,
        opacity: 0.9
    });
    innerIKSphere = new THREE.Mesh(innerGeo, innerMat);
    innerIKSphere.userData.isIKDot = true;
    innerIKSphere.renderOrder = 1002;
    rotationGizmo.add(innerIKSphere);

    // 2. Outer Rings for Rotation
    const ringRadius = 0.14; // Back to a reasonable size
    const tubeRadius = 0.01; // Thicker than original, but not too chunky
    const ringSegments = 48;
    const tubeSegments = 12;
    
    const axisColors = { x: 0xff4444, y: 0x44ff44, z: 0x4488ff };
    const axisRotations = {
        x: new THREE.Euler(0, Math.PI / 2, 0),
        y: new THREE.Euler(Math.PI / 2, 0, 0),
        z: new THREE.Euler(0, 0, 0)
    };
    
    ['x', 'y', 'z'].forEach(axis => {
        const torusGeo = new THREE.TorusGeometry(ringRadius, tubeRadius, tubeSegments, ringSegments);
        const torusMat = new THREE.MeshBasicMaterial({
            color: axisColors[axis],
            depthTest: false,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(torusGeo, torusMat);
        ring.rotation.copy(axisRotations[axis]);
        ring.userData.axis = axis;
        ring.userData.isGizmoRing = true;
        ring.renderOrder = 1001;
        rotationGizmo.add(ring);
        ringMeshes.push(ring);
    });
    
    scene.add(rotationGizmo);

    if (boneObjects['RightHand'] && boneObjects['RightHandIndex1'] && boneObjects['RightHandPinky1']) {
        const wW = new THREE.Vector3(); boneObjects['RightHand'].getWorldPosition(wW);
        const iW = new THREE.Vector3(); boneObjects['RightHandIndex1'].getWorldPosition(iW);
        const pW = new THREE.Vector3(); boneObjects['RightHandPinky1'].getWorldPosition(pW);

        const mid  = new THREE.Vector3().addVectors(iW, pW).multiplyScalar(0.5);
        const fwd  = new THREE.Vector3().subVectors(mid, wW).normalize();
        const side = new THREE.Vector3().subVectors(pW, iW).normalize(); 
        const up   = new THREE.Vector3().crossVectors(fwd, side).normalize();
        const right = new THREE.Vector3().crossVectors(up, fwd).normalize();

        restBasisQuatR.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, fwd));
        boneObjects['RightHand'].getWorldQuaternion(rightHandRestWorldQuat);
        isRightHandBasisReady = true;
    }

    if (boneObjects['LeftHand'] && boneObjects['LeftHandIndex1'] && boneObjects['LeftHandPinky1']) {
        const wW = new THREE.Vector3(); boneObjects['LeftHand'].getWorldPosition(wW);
        const iW = new THREE.Vector3(); boneObjects['LeftHandIndex1'].getWorldPosition(iW);
        const pW = new THREE.Vector3(); boneObjects['LeftHandPinky1'].getWorldPosition(pW);

        const mid  = new THREE.Vector3().addVectors(iW, pW).multiplyScalar(0.5);
        const fwd  = new THREE.Vector3().subVectors(mid, wW).normalize();
        const side = new THREE.Vector3().subVectors(iW, pW).normalize(); 
        const up   = new THREE.Vector3().crossVectors(fwd, side).normalize();
        const right = new THREE.Vector3().crossVectors(up, fwd).normalize();

        restBasisQuatL.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, fwd));
        boneObjects['LeftHand'].getWorldQuaternion(leftHandRestWorldQuat);
        isLeftHandBasisReady = true;
    }

    setNeutralPose();
    
    modelLoaded = true;
    
    // Begin loading data only after bones are populated
    loadData();
}, undefined, (err) => console.error('GLB load error:', err));

// ============================================================================
// DATA LOAD
// ============================================================================
let animationFrames = [];
let currentFrame    = 0;
let isDataLoaded    = false;
let isPlaying       = false;

window.playTranslation = () => {
    if (!isDataLoaded || animationFrames.length === 0) return;
    if (hasUnsavedChanges) {
        alert("Please save or discard changes before playing.");
        return;
    }
    isPlaying = true;
    currentFrame = 0;
    const playBtn = document.getElementById('play-pause-btn');
    if (playBtn) playBtn.textContent = '⏸';
};

function applyManualFrame(frameIndex) {
    if (!isManualMode) return;
    const frameData = manualFrames[frameIndex];
    if (!frameData) return;
    targetBones.forEach(name => {
        if (frameData[name]) {
            const bone = boneObjects[name];
            if (bone) {
                bone.position.fromArray(frameData[name].position);
                bone.quaternion.fromArray(frameData[name].rotation);
                targetQuaternions[name].copy(bone.quaternion);
            }
        }
    });
}

function updateUIForSelectedBone(fromManualEdit = false) {
    const nameEl = document.getElementById('selected-bone-name');
    const deselectBtn = document.getElementById('ui-deselect-btn');
    if (!nameEl) return; 
    
    if (!selectedBoneName) {
        nameEl.textContent = 'None';
        nameEl.style.color = '#ccc';
        if (deselectBtn) deselectBtn.style.display = 'none';
        return;
    }
    
    const bone = boneObjects[selectedBoneName];
    if (!bone) return;
    
    nameEl.textContent = selectedBoneName;
    nameEl.style.color = '#4CAF50';
    if (deselectBtn) deselectBtn.style.display = 'block';
    
    if (!fromManualEdit || lastSelectedBoneForEuler !== selectedBoneName) {
        activeEuler.setFromQuaternion(bone.quaternion, 'XYZ');
        lastSelectedBoneForEuler = selectedBoneName;
    }
    
    document.getElementById('rot-x-val').textContent = (activeEuler.x * 180 / Math.PI).toFixed(1);
    document.getElementById('rot-y-val').textContent = (activeEuler.y * 180 / Math.PI).toFixed(1);
    document.getElementById('rot-z-val').textContent = (activeEuler.z * 180 / Math.PI).toFixed(1);
}

function showUnsavedModal(targetFrame) {
    pendingFrameChange = targetFrame;
    const modal = document.getElementById('unsaved-modal');
    if (modal) modal.style.display = 'block';
}

function setPlaying(state) {
    isPlaying = state;
    const playBtn = document.getElementById('play-pause-btn');
    const symbol = isPlaying ? '⏸' : '▶';
    if (playBtn) playBtn.textContent = symbol;
    
    document.querySelectorAll('.fs-play-pause-btn').forEach(btn => {
        btn.textContent = symbol;
    });
    
    const vid = document.getElementById('reference-video');
    if (vid) {
        if (isPlaying) {
            // Sync time once before starting playback
            vid.currentTime = currentFrame / 30.0;
            vid.play().catch(e => console.warn("Video play blocked:", e));
        } else {
            vid.pause();
        }
    }
}

let originalFrameState = null;

function goToFrame(frameIdx) {
    if (window.deselectBone) window.deselectBone();
    
    currentFrame = frameIdx;
    
    // Take a pristine snapshot for discard purposes
    if (isManualMode && manualFrames[currentFrame]) {
        originalFrameState = JSON.parse(JSON.stringify(manualFrames[currentFrame]));
    }
    
    const slider = document.getElementById('frame-slider');
    if (slider) slider.value = currentFrame;
    document.querySelectorAll('.fs-frame-slider').forEach(s => s.value = currentFrame);
    
    const currDisp = document.getElementById('current-frame-display');
    if (currDisp) currDisp.textContent = currentFrame;
    document.querySelectorAll('.fs-current-frame-display').forEach(d => d.textContent = currentFrame);
    
    setPlaying(false);
    
    if (isManualMode) {
        applyManualFrame(currentFrame);
    } else {
        updateAvatar(animationFrames[currentFrame]);
    }
    updateUIForSelectedBone();
    syncVideoToFrame(currentFrame);
}

function syncVideoToFrame(frameIdx) {
    const vid = document.getElementById('reference-video');
    if (vid) {
        if (!isPlaying) {
            vid.currentTime = frameIdx / 30.0; // Assuming 30 FPS
        }
    }
}

// UI Bindings
if (true) {
    async function saveToDisk(callback) {
        try {
            if (window.showDirectoryPicker && typeof idbKeyval !== 'undefined') {
                let dirHandle = await idbKeyval.get('outputDir');
                
                if (!dirHandle) {
                    alert("Please select the 'output' folder in your project directory. This will allow the app to automatically save the file directly to your repo!");
                    dirHandle = await window.showDirectoryPicker();
                    await idbKeyval.set('outputDir', dirHandle);
                }
                
                if (await dirHandle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
                    if (await dirHandle.requestPermission({ mode: 'readwrite' }) !== 'granted') {
                        throw new Error("Permission denied by user.");
                    }
                }
                
                const fileHandle = await dirHandle.getFileHandle('Apple_manual.json', { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(JSON.stringify({ frames: manualFrames }, null, 2));
                await writable.close();
                
                hasUnsavedChanges = false;
                alert('Saved directly to your output folder in the repo!');
                if (callback) callback();
            } else {
                throw new Error("Directory API not supported");
            }
        } catch (e) {
            console.warn('Silent save failed, falling back to download:', e);
            const blob = new Blob([JSON.stringify({ frames: manualFrames }, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "Apple_manual.json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            hasUnsavedChanges = false;
            alert('File downloaded to your Downloads folder! Please move it to the output folder.');
            if (callback) callback();
        }
    }

    const saveFrameBtn = document.getElementById('save-frame-btn');
    if (saveFrameBtn) {
        saveFrameBtn.addEventListener('click', () => {
            hasUnsavedChanges = false;
            
            const originalText = "Save Current Frame";
            saveFrameBtn.textContent = `✅ Frame ${currentFrame} Saved!`;
            saveFrameBtn.style.backgroundColor = '#388E3C';
            
            setTimeout(() => {
                saveFrameBtn.textContent = originalText;
                saveFrameBtn.style.backgroundColor = '#4CAF50';
            }, 2000);
        });
    }

    const saveAllBtn = document.getElementById('save-all-btn');
    if (saveAllBtn) {
        saveAllBtn.addEventListener('click', () => saveToDisk());
    }

    const discardBtn = document.getElementById('modal-discard');
    if (discardBtn) {
        discardBtn.addEventListener('click', () => {
            document.getElementById('unsaved-modal').style.display = 'none';
            hasUnsavedChanges = false;
            
            // Restore pristine state for this frame if it exists
            if (originalFrameState && manualFrames[currentFrame]) {
                manualFrames[currentFrame] = JSON.parse(JSON.stringify(originalFrameState));
                applyManualFrame(currentFrame);
            }
            
            goToFrame(pendingFrameChange);
        });
    }

    const modalSaveBtn = document.getElementById('modal-save');
    if (modalSaveBtn) {
        modalSaveBtn.addEventListener('click', () => {
            document.getElementById('unsaved-modal').style.display = 'none';
            hasUnsavedChanges = false;
            goToFrame(pendingFrameChange);
        });
    }

    const importPrevBtn = document.getElementById('import-prev-btn');
    if (importPrevBtn) {
        importPrevBtn.addEventListener('click', () => {
            if (!isManualMode) return;
            if (currentFrame === 0) {
                alert("Cannot import previous pose: This is the first frame (Frame 0).");
                return;
            }
            if (!manualFrames[currentFrame - 1]) return;
            
            const confirmed = confirm("Are you sure you want to import the previous pose? This will overwrite the current frame's pose.");
            if (!confirmed) return;
            
            if (window.deselectBone) window.deselectBone();
            
            // Copy previous frame to current
            manualFrames[currentFrame] = JSON.parse(JSON.stringify(manualFrames[currentFrame - 1]));
            hasUnsavedChanges = true;
            applyManualFrame(currentFrame);
            
            // Visual feedback
            const originalText = "Import Prev Pose";
            importPrevBtn.textContent = "✅ Successfully Imported!";
            importPrevBtn.style.backgroundColor = '#4CAF50';
            
            setTimeout(() => {
                importPrevBtn.textContent = originalText;
                importPrevBtn.style.backgroundColor = '#607d8b';
            }, 2000);
        });
    }

    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            const mainView = document.getElementById('main-view');
            sidebar.classList.toggle('collapsed');
            mainView.classList.toggle('collapsed');
            sidebarToggleBtn.classList.toggle('collapsed');
        });
    }
    
    function toggleFullscreen(element) {
        if (!document.fullscreenElement) {
            if (isPlaying) setPlaying(false);
            element.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }

    const videoFsBtn = document.getElementById('video-fs-btn');
    if (videoFsBtn) {
        videoFsBtn.addEventListener('click', () => toggleFullscreen(document.getElementById('video-wrapper')));
    }

    const avatarFsBtn = document.getElementById('avatar-fs-btn');
    if (avatarFsBtn) {
        avatarFsBtn.addEventListener('click', () => toggleFullscreen(document.getElementById('avatar-container')));
    }

    function attachAdjustmentListener(id, axis, type, sign) {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (!selectedBoneName || !isManualMode) return;
            const bone = boneObjects[selectedBoneName];
            if (!bone) return;
            
            hasUnsavedChanges = true;
            
            if (type === 'rot') {
                const step = 5 * Math.PI / 180;
                // Ensure we are working with the active UI euler to prevent gimbal lock flips
                if (lastSelectedBoneForEuler !== selectedBoneName) {
                    activeEuler.setFromQuaternion(bone.quaternion, 'XYZ');
                    lastSelectedBoneForEuler = selectedBoneName;
                }
                activeEuler[axis] += sign * step;
                bone.quaternion.setFromEuler(activeEuler);
            }
            
            targetQuaternions[selectedBoneName].copy(bone.quaternion);
            
            const fd = manualFrames[currentFrame][selectedBoneName];
            fd.position = bone.position.toArray();
            fd.rotation = bone.quaternion.toArray();
            
            updateUIForSelectedBone(true);
        });
    }

    ['x','y','z'].forEach(axis => {
        attachAdjustmentListener(`rot-${axis}-minus`, axis, 'rot', -1);
        attachAdjustmentListener(`rot-${axis}-plus`,  axis, 'rot', 1);
        
        const row = document.getElementById(`rot-${axis}-row`);
        if (row) {
            row.addEventListener('wheel', (e) => {
                if (!selectedBoneName || !isManualMode) return;
                e.preventDefault();
                const sign = e.deltaY > 0 ? -1 : 1; // Scroll down = negative, Scroll up = positive
                const btn = document.getElementById(`rot-${axis}-${sign > 0 ? 'plus' : 'minus'}`);
                if (btn) btn.click();
            }, { passive: false });
        }
    });

    document.getElementById('prev-frame-btn')?.addEventListener('click', () => {
        if (currentFrame > 0) {
            if (hasUnsavedChanges) showUnsavedModal(currentFrame - 1);
            else goToFrame(currentFrame - 1);
        }
    });

    document.getElementById('next-frame-btn')?.addEventListener('click', () => {
        if (currentFrame < manualFrames.length - 1) {
            if (hasUnsavedChanges) showUnsavedModal(currentFrame + 1);
            else goToFrame(currentFrame + 1);
        }
    });

    // ========================================================================
    // CCD IK SOLVER for drag-to-translate
    // ========================================================================
    function solveCCDIK(effectorBoneName, targetWorldPos, iterations = 15) {
        const chain = ikChains[effectorBoneName];
        if (!chain || chain.length < 2) return;
        
        const isFingerChain = effectorBoneName.includes('Thumb') || effectorBoneName.includes('Index') || 
                              effectorBoneName.includes('Middle') || effectorBoneName.includes('Ring') || 
                              effectorBoneName.includes('Pinky');
        
        for (let iter = 0; iter < iterations; iter++) {
            let moved = false;
            
            // Skip effector (index 0), iterate links from 1 upward
            for (let j = 1; j < chain.length; j++) {
                const linkBone = boneObjects[chain[j]];
                if (!linkBone) continue;
                
                // Effector is now the midpoint of the selected bone
                const effectorBone = boneObjects[chain[0]];
                if (!effectorBone) continue;
                
                const length = effectorBone.userData.boneLength || 0.05;
                const midLocal = effectorBone.userData.boneVector.clone().multiplyScalar(length / 2);
                
                const effectorPos = new THREE.Vector3();
                effectorBone.localToWorld(midLocal);
                effectorPos.copy(midLocal);
                
                const linkWorldPos = new THREE.Vector3();
                linkBone.getWorldPosition(linkWorldPos);
                
                const linkWorldQuat = new THREE.Quaternion();
                linkBone.getWorldQuaternion(linkWorldQuat);
                const invLinkWorldQuat = linkWorldQuat.clone().invert();
                
                // Vectors from link to effector and link to target, in link's local space
                const toEffector = effectorPos.clone().sub(linkWorldPos).applyQuaternion(invLinkWorldQuat).normalize();
                const toTarget = targetWorldPos.clone().sub(linkWorldPos).applyQuaternion(invLinkWorldQuat).normalize();
                
                let dot = toEffector.dot(toTarget);
                dot = Math.max(-1, Math.min(1, dot));
                let angle = Math.acos(dot);
                
                if (angle < 1e-5) continue;
                
                // Clamp max rotation per step to prevent wild swings. Fingers need smaller steps to stay stable.
                const maxAngle = isFingerChain ? (3 * Math.PI / 180) : (15 * Math.PI / 180);
                angle = Math.min(angle, maxAngle);
                
                const axis = new THREE.Vector3().crossVectors(toEffector, toTarget).normalize();
                if (axis.lengthSq() < 1e-10) continue;
                
                // Soft hinge constraint for fingers: dampen twisting by scaling down non-dominant axes
                // Assuming primary curl is around local Z or X. We can just dampen the axis vector towards its largest component to encourage single-axis bending.
                if (isFingerChain) {
                    const absX = Math.abs(axis.x);
                    const absY = Math.abs(axis.y);
                    const absZ = Math.abs(axis.z);
                    
                    if (absX > absY && absX > absZ) { axis.y *= 0.1; axis.z *= 0.1; }
                    else if (absY > absX && absY > absZ) { axis.x *= 0.1; axis.z *= 0.1; }
                    else { axis.x *= 0.1; axis.y *= 0.1; }
                    axis.normalize();
                }
                
                const deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, angle);
                linkBone.quaternion.multiply(deltaQ);
                
                // Update matrices down the chain
                linkBone.updateMatrixWorld(true);
                
                moved = true;
            }
            
            if (!moved) break;
        }
        
        // Persist all changed bones to manualFrames
        const chain2 = ikChains[effectorBoneName];
        if (chain2 && isManualMode && manualFrames[currentFrame]) {
            chain2.forEach(name => {
                const bone = boneObjects[name];
                if (bone && manualFrames[currentFrame][name]) {
                    targetQuaternions[name].copy(bone.quaternion);
                    manualFrames[currentFrame][name].rotation = bone.quaternion.toArray();
                    manualFrames[currentFrame][name].position = bone.position.toArray();
                }
            });
        }
    }

    // ========================================================================
    // GIZMO HELPERS
    // ========================================================================
    function showGizmoAtBone(boneName) {
        if (!rotationGizmo || !boneName) return;
        const bone = boneObjects[boneName];
        if (!bone) return;
        
        // Find midpoint of the bone in local space
        const length = bone.userData.boneLength || 0.05;
        const midLocal = bone.userData.boneVector.clone().multiplyScalar(length / 2);
        
        // Convert midpoint to world space
        const worldPos = new THREE.Vector3();
        bone.localToWorld(midLocal);
        worldPos.copy(midLocal);
        
        // Scale gizmo: 2x for main joints, 1x for fingers
        const isFinger = boneName.includes('Thumb') || boneName.includes('Index') || 
                         boneName.includes('Middle') || boneName.includes('Ring') || 
                         boneName.includes('Pinky');
        
        if (isFinger) {
            rotationGizmo.scale.set(1, 1, 1);
        } else {
            rotationGizmo.scale.set(2, 2, 2);
        }
        
        rotationGizmo.position.copy(worldPos);
        rotationGizmo.visible = true;
    }
    
    function hideGizmo() {
        if (rotationGizmo) rotationGizmo.visible = false;
        if (typeof updateTooltip === 'function') updateTooltip(false);
    }
    
    function selectBone(boneName) {
        selectedBoneName = boneName;
        if (typeof updateTooltip === 'function') updateTooltip(false);
        
        // Highlight selected bone's visible cylinder, hide others
        boneHitMeshes.forEach(h => {
            if (h.userData.boneName === boneName) {
                h.userData.boneMat.color.setHex(0xff4444);
                h.userData.boneMat.opacity = 1.0;
            } else {
                h.userData.boneMat.color.copy(h.userData.baseColor);
                h.userData.boneMat.opacity = getBaseOpacity();
            }
        });
        
        showGizmoAtBone(boneName);
        updateUIForSelectedBone();
    }
    window.selectBone = selectBone;
    
    function deselectBone() {
        selectedBoneName = null;
        boneHitMeshes.forEach(h => {
            h.userData.boneMat.color.copy(h.userData.baseColor);
            h.userData.boneMat.opacity = getBaseOpacity();
        });
        hideGizmo();
        updateUIForSelectedBone();
    }
    window.deselectBone = deselectBone;
    
    function persistBoneChange(boneName) {
        if (!isManualMode || !manualFrames[currentFrame]) return;
        const bone = boneObjects[boneName];
        if (!bone) return;
        hasUnsavedChanges = true;
        targetQuaternions[boneName].copy(bone.quaternion);
        const fd = manualFrames[currentFrame][boneName];
        if (fd) {
            fd.position = bone.position.toArray();
            fd.rotation = bone.quaternion.toArray();
        }
    }

    // ========================================================================
    // MOUSE EVENT HANDLERS
    // ========================================================================
    let hoveredBoneHit = null;
    
    function getMouseNDC(e) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }
    
    function getMouseOnPlane(e, plane) {
        getMouseNDC(e);
        raycaster.setFromCamera(mouse, camera);
        const target = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, target);
        return target;
    }
    
    function getRotAngle(e, center, axis) {
        getMouseNDC(e);
        const centerScreen = center.clone().project(camera);
        const dx = mouse.x - centerScreen.x;
        const dy = mouse.y - centerScreen.y;
        return Math.atan2(dy, dx);
    }

    // ========================================================================
    // TOOLTIP FOR FIXED BONES & VISIBILITY TOGGLE
    // ========================================================================
    
    let alwaysShowBones = false;
    function getBaseOpacity() { return alwaysShowBones ? 0.6 : 0.0; }
    
    // Wire up the checkbox from debug.html if it exists
    const visibilityToggle = document.getElementById('always-show-bones');
    if (visibilityToggle) {
        visibilityToggle.addEventListener('change', (e) => {
            alwaysShowBones = e.target.checked;
            // Update all bones immediately
            boneHitMeshes.forEach(h => {
                if (h.userData.boneName !== selectedBoneName) {
                    h.userData.boneMat.opacity = getBaseOpacity();
                }
            });
        });
    }

    let ikTooltip = document.createElement('div');
    ikTooltip.style.position = 'fixed';
    ikTooltip.style.background = 'rgba(0,0,0,0.8)';
    ikTooltip.style.color = '#ff6666';
    ikTooltip.style.padding = '6px 10px';
    ikTooltip.style.borderRadius = '4px';
    ikTooltip.style.pointerEvents = 'none';
    ikTooltip.style.fontSize = '12px';
    ikTooltip.style.display = 'none';
    ikTooltip.style.zIndex = '1000';
    ikTooltip.style.fontFamily = 'sans-serif';
    ikTooltip.textContent = 'Fixed Bone (Translation Disabled)';
    document.body.appendChild(ikTooltip);
    
    function updateTooltip(show, x=0, y=0) {
        if (show) {
            ikTooltip.style.left = (x + 15) + 'px';
            ikTooltip.style.top = (y + 15) + 'px';
            ikTooltip.style.display = 'block';
        } else {
            ikTooltip.style.display = 'none';
        }
    }

    // ── MOUSEMOVE ──
    window.addEventListener('mousemove', (e) => {
        if (e.target.closest('#sidebar') || e.target.closest('#controls-wrapper') || e.target.closest('#unsaved-modal')) {
            return;
        }
        
        getMouseNDC(e);
        
        // ── IK Drag in progress ──
        if (isDragging && selectedBoneName) {
            const targetPos = getMouseOnPlane(e, dragPlane);
            if (targetPos) {
                solveCCDIK(selectedBoneName, targetPos);
                hasUnsavedChanges = true;
                showGizmoAtBone(selectedBoneName);
                updateUIForSelectedBone();
            }
            return;
        }
        
        // ── Rotation ring drag in progress ──
        if (isRotDragging && rotDragAxis && selectedBoneName) {
            const currentAngle = getRotAngle(e, rotDragBoneWorldPos, rotDragAxis);
            // Invert the angle difference to match clockwise visual dragging
            const deltaAngle = rotDragStartAngle - currentAngle;
            
            const bone = boneObjects[selectedBoneName];
            if (bone) {
                const axisVec = new THREE.Vector3(
                    rotDragAxis === 'x' ? 1 : 0,
                    rotDragAxis === 'y' ? 1 : 0,
                    rotDragAxis === 'z' ? 1 : 0
                );
                
                // The visual rings are aligned to the World axes. 
                // We must apply the rotation delta in World Space, then convert to Local Space.
                const worldDeltaQ = new THREE.Quaternion().setFromAxisAngle(axisVec, deltaAngle);
                
                const parentWorldQ = new THREE.Quaternion();
                if (bone.parent) {
                    bone.parent.getWorldQuaternion(parentWorldQ);
                }
                
                // Initial world rotation of the bone = ParentWorld * InitialLocal
                const startWorldQ = parentWorldQ.clone().multiply(rotDragStartQuat);
                
                // Apply world rotation delta: NewWorld = WorldDelta * InitialWorld
                const newWorldQ = worldDeltaQ.multiply(startWorldQ);
                
                // Convert back to local space: NewLocal = Inverse(ParentWorld) * NewWorld
                const newLocalQ = parentWorldQ.invert().multiply(newWorldQ);
                
                bone.quaternion.copy(newLocalQ);
                
                persistBoneChange(selectedBoneName);
                showGizmoAtBone(selectedBoneName);
                updateUIForSelectedBone();
            }
            return;
        }
        
        // ── Normal hover ──
        raycaster.setFromCamera(mouse, camera);
        
        // Check gizmo hover first
        if (rotationGizmo && rotationGizmo.visible) {
            // Check Inner IK Sphere
            if (innerIKSphere) {
                const innerIntersects = raycaster.intersectObject(innerIKSphere);
                if (innerIntersects.length > 0) {
                    const chain = ikChains[selectedBoneName];
                    const isMovable = chain && chain.length > 1;
                    
                    if (isMovable) {
                        innerIKSphere.material.color.setHex(0xffff00); // Yellow on hover
                        document.body.style.cursor = 'grab';
                        updateTooltip(false);
                        return;
                    } else {
                        // Bone is fixed, show tooltip but don't block ring interactions
                        updateTooltip(true, e.clientX, e.clientY);
                    }
                } else {
                    innerIKSphere.material.color.setHex(0xffffff); // Default white
                    updateTooltip(false);
                }
            }

            // Check Rings
            const ringIntersects = raycaster.intersectObjects(ringMeshes, false);
            ringMeshes.forEach(r => {
                const baseColors = { x: 0xff4444, y: 0x44ff44, z: 0x4488ff };
                r.material.opacity = 0.85;
                r.material.color.setHex(baseColors[r.userData.axis]);
            });
            if (ringIntersects.length > 0) {
                const hitRing = ringIntersects[0].object;
                hitRing.material.opacity = 1.0;
                hitRing.material.color.setHex(0xffffff);
                document.body.style.cursor = 'grab';
                return;
            }
        }
        
        // Check bone hover (ONLY if no bone is currently selected)
        if (!selectedBoneName) {
            const boneIntersects = raycaster.intersectObjects(boneHitMeshes, false);
            
            if (boneIntersects.length > 0) {
                const hit = boneIntersects[0].object;
                if (hoveredBoneHit !== hit) {
                    // Unhover previous
                    if (hoveredBoneHit) {
                        hoveredBoneHit.userData.boneMat.color.copy(hoveredBoneHit.userData.baseColor);
                        hoveredBoneHit.userData.boneMat.opacity = getBaseOpacity();
                    }
                    hoveredBoneHit = hit;
                    hoveredBoneHit.userData.boneMat.color.setHex(0xffffff);
                    hoveredBoneHit.userData.boneMat.opacity = 0.8;
                }
                document.body.style.cursor = 'pointer';
            } else {
                if (hoveredBoneHit) {
                    hoveredBoneHit.userData.boneMat.color.copy(hoveredBoneHit.userData.baseColor);
                    hoveredBoneHit.userData.boneMat.opacity = getBaseOpacity();
                }
                hoveredBoneHit = null;
                document.body.style.cursor = 'default';
            }
        }
    });

    // ── MOUSEDOWN ──
    window.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Left click only
        if (e.target.closest('#sidebar') || e.target.closest('#controls-wrapper') || e.target.closest('#unsaved-modal')) {
            return;
        }
        
        getMouseNDC(e);
        raycaster.setFromCamera(mouse, camera);
        
        // Check gizmo click
        if (rotationGizmo && rotationGizmo.visible && selectedBoneName) {
            // Check Inner IK Sphere
            if (innerIKSphere) {
                const innerIntersects = raycaster.intersectObject(innerIKSphere);
                if (innerIntersects.length > 0) {
                    const chain = ikChains[selectedBoneName];
                    const isMovable = chain && chain.length > 1;
                    
                    if (isMovable) {
                        isDragging = true;
                        const bone = boneObjects[selectedBoneName];
                        const length = bone.userData.boneLength || 0.05;
                        const midLocal = bone.userData.boneVector.clone().multiplyScalar(length / 2);
                        const midWorldPos = new THREE.Vector3();
                        bone.localToWorld(midLocal);
                        midWorldPos.copy(midLocal);
                        
                        const cameraDir = new THREE.Vector3();
                        camera.getWorldDirection(cameraDir);
                        dragPlane.setFromNormalAndCoplanarPoint(cameraDir.negate(), midWorldPos);
                        
                        controls.enabled = false;
                        document.body.style.cursor = 'grabbing';
                        e.preventDefault();
                        return;
                    }
                }
            }

            // Check rotation rings
            const ringIntersects = raycaster.intersectObjects(ringMeshes, false);
            if (ringIntersects.length > 0) {
                const hitRing = ringIntersects[0].object;
                isRotDragging = true;
                rotDragAxis = hitRing.userData.axis;
                
                const bone = boneObjects[selectedBoneName];
                const length = bone.userData.boneLength || 0.05;
                const midLocal = bone.userData.boneVector.clone().multiplyScalar(length / 2);
                bone.localToWorld(midLocal);
                rotDragBoneWorldPos.copy(midLocal);
                
                rotDragStartQuat.copy(bone.quaternion);
                rotDragStartAngle = getRotAngle(e, rotDragBoneWorldPos, rotDragAxis);
                
                controls.enabled = false;
                document.body.style.cursor = 'grabbing';
                e.preventDefault();
                return;
            }
        }
        
        // Check bone click
        const boneIntersects = raycaster.intersectObjects(boneHitMeshes, false);
        if (boneIntersects.length > 0) {
            const hitMesh = boneIntersects[0].object;
            
            if (!selectedBoneName) {
                // Only select a new bone if nothing is currently selected
                selectBone(hitMesh.userData.boneName);
            }
            
            e.preventDefault();
            return;
        }
        
        // Clicked empty space → do nothing (forces user to use Deselect button)
    });

    // ── MOUSEUP ──
    window.addEventListener('mouseup', (e) => {
        if (isDragging) {
            isDragging = false;
            if (innerIKSphere) innerIKSphere.material.color.setHex(0xffffff);
            controls.enabled = true;
            document.body.style.cursor = 'default';
        }
        if (isRotDragging) {
            isRotDragging = false;
            rotDragAxis = null;
            controls.enabled = true;
            document.body.style.cursor = 'default';
            updateTooltip(false); // Hide tooltip if it was accidentally triggered
            
            if (selectedBoneName) {
                persistBoneChange(selectedBoneName);
                updateUIForSelectedBone();
            }
        }
    });

    // ========================================================================
    // CAMERA FRAMING CONTROLS
    // ========================================================================
    function focusCameraOn(targetPos, distance) {
        // Simple snap for now, could be animated
        controls.target.copy(targetPos);
        const dir = camera.position.clone().sub(targetPos).normalize();
        camera.position.copy(targetPos).add(dir.multiplyScalar(distance));
        controls.update();
    }

    document.getElementById('ui-deselect-btn')?.addEventListener('click', deselectBone);

    document.getElementById('focus-full')?.addEventListener('click', () => {
        const leftArm = boneObjects['LeftArm'];
        const rightArm = boneObjects['RightArm'];
        if (leftArm && rightArm) {
            const posL = new THREE.Vector3();
            const posR = new THREE.Vector3();
            leftArm.getWorldPosition(posL);
            rightArm.getWorldPosition(posR);
            const midPoint = new THREE.Vector3().addVectors(posL, posR).multiplyScalar(0.5);
            
            // Explicitly set target and camera position to ensure a slight downward angle
            // Target slightly below shoulders to center the torso
            controls.target.set(midPoint.x, midPoint.y - 1.5, midPoint.z);
            // Zoom out far enough so hands/arms aren't cut off
            camera.position.set(midPoint.x, midPoint.y - 1.0, midPoint.z + 8.5);
            controls.update();
        } else {
            controls.target.set(0, 1.5, 0);
            camera.position.set(0, 1.5, 8.5);
            controls.update();
        }
    });

    document.getElementById('focus-left')?.addEventListener('click', () => {
        // Center on the middle knuckle rather than the wrist so fingers are in view
        const targetBone = boneObjects['LeftHandMiddle2'] || boneObjects['LeftHandMiddle1'] || boneObjects['LeftHand'];
        if (targetBone) {
            const wp = new THREE.Vector3();
            targetBone.getWorldPosition(wp);
            
            // Explicitly set camera position on the OUTSIDE of the left hand
            // Assuming X is left/right. We push the camera further along the hand's X position.
            const xOffset = wp.x >= 0 ? 1.5 : -1.5; 
            camera.position.set(wp.x + xOffset, wp.y + 0.2, wp.z + 1.0);
            controls.target.copy(wp);
            controls.update();
        }
    });

    document.getElementById('focus-right')?.addEventListener('click', () => {
        const targetBone = boneObjects['RightHandMiddle2'] || boneObjects['RightHandMiddle1'] || boneObjects['RightHand'];
        if (targetBone) {
            const wp = new THREE.Vector3();
            targetBone.getWorldPosition(wp);
            
            // Explicitly set camera position on the OUTSIDE of the right hand
            const xOffset = wp.x >= 0 ? 1.5 : -1.5;
            camera.position.set(wp.x + xOffset, wp.y + 0.2, wp.z + 1.0);
            controls.target.copy(wp);
            controls.update();
        }
    });
}


function processReadyData(data) {
    const generatedFrames = [];
    data.frames.forEach(frame => {
        updateAvatar(frame); 
        const frameState = {};
        targetBones.forEach(name => {
            const bone = boneObjects[name];
            const tgt  = targetQuaternions[name];
            if (tgt && bone) bone.quaternion.copy(tgt);
            frameState[name] = {
                position: bone.position.toArray(),
                rotation: bone.quaternion.toArray()
            };
        });
        generatedFrames.push(frameState);
    });
    return generatedFrames;
}

function setupPlayback(numFrames) {
    isDataLoaded = true;
    const slider = document.getElementById('frame-slider');
    const totalDisplay = document.getElementById('total-frames-display');
    
    function handleSliderInput(e) {
        const target = parseInt(e.target.value, 10);
        if (hasUnsavedChanges) {
            e.preventDefault();
            showUnsavedModal(target);
            e.target.value = currentFrame; 
            return;
        }
        goToFrame(target);
    }
    
    if (slider) {
        slider.max = numFrames - 1;
        if (totalDisplay) totalDisplay.textContent = numFrames - 1;
        slider.addEventListener('input', handleSliderInput);
    }
    
    document.querySelectorAll('.fs-frame-slider').forEach(s => {
        s.max = numFrames - 1;
        s.addEventListener('input', handleSliderInput);
    });
    
    document.querySelectorAll('.fs-total-frames-display').forEach(d => {
        d.textContent = numFrames - 1;
    });
    
    function handlePlayPause() {
        if (hasUnsavedChanges) {
            alert("Please save or discard changes before playing.");
            return;
        }
        setPlaying(!isPlaying);
    }
    
    const playBtn = document.getElementById('play-pause-btn');
    if (playBtn) {
        playBtn.addEventListener('click', handlePlayPause);
    }
    
    document.querySelectorAll('.fs-play-pause-btn').forEach(btn => {
        btn.addEventListener('click', handlePlayPause);
    });
}

async function loadData() {
    try {
        const resManual = await fetch('./output/Apple_manual.json');
        if (resManual.ok) {
            const data = await resManual.json();
            manualFrames = data.frames;
            animationFrames = manualFrames; 
            isManualMode = true;
            console.log(`Loaded ${manualFrames.length} manual frames.`);
            setupPlayback(manualFrames.length);
            goToFrame(0);
            return;
        }
    } catch(e) {}
    
    try {
        const resReady = await fetch('./output/Apple_ready.json');
        if (resReady.ok) {
            const data = await resReady.json();
            console.log("No manual JSON found. Running IK solver to generate initial frames...");
            manualFrames = processReadyData(data);
            animationFrames = manualFrames;
            isManualMode = true;
            console.log(`Generated ${manualFrames.length} manual frames from IK.`);
            
            setupPlayback(manualFrames.length);
            goToFrame(0);
            
            if (saveBtn && confirm("IK has generated manual coordinates. Would you like to save this as Apple_manual.json now?")) {
                saveBtn.click();
            }
        }
    } catch(e) {
        console.error('JSON load error:', e);
    }
}
// ============================================================================
// RENDER LOOP
// ============================================================================
const clock       = new THREE.Clock();
let   timeAccum   = 0;
const FRAME_DUR   = 1 / 30; 
// const SLERP_SPEED = 0.6;

const handleResize = () => {
    const container = document.getElementById('canvas-wrapper') || document.getElementById('avatar-container') || document.body;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
};

window.addEventListener('resize', handleResize);

const containerEl = document.getElementById('avatar-container');
if (containerEl) {
    const resizeObserver = new ResizeObserver(() => {
        handleResize();
    });
    resizeObserver.observe(containerEl);
}

function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();

    if (modelLoaded && isDataLoaded && animationFrames.length > 0 && isPlaying) {
        timeAccum += dt;
        if (timeAccum >= FRAME_DUR) {
            timeAccum -= FRAME_DUR;
            
            if (animationFrames.length > 1) {
                if (currentFrame < animationFrames.length - 1) {
                    currentFrame++;
                } else {
                    setPlaying(false);
                }
            }
            
            if (isManualMode) {
                applyManualFrame(currentFrame);
            } else {
                updateAvatar(animationFrames[currentFrame]);
            }
            
            const slider = document.getElementById('frame-slider');
            if (slider) slider.value = currentFrame;
            document.querySelectorAll('.fs-frame-slider').forEach(s => s.value = currentFrame);
            
            const currDisp = document.getElementById('current-frame-display');
            if (currDisp) currDisp.textContent = currentFrame;
            document.querySelectorAll('.fs-current-frame-display').forEach(d => d.textContent = currentFrame);
            
            updateUIForSelectedBone();
            syncVideoToFrame(currentFrame);
        }
    }

    if (!isManualMode) {
        targetBones.forEach(name => {
            const bone = boneObjects[name];
            const tgt  = targetQuaternions[name];
            if (bone && tgt) bone.quaternion.copy(tgt);
        });
    }
    
    // Keep rotation gizmo synced with selected bone position
    if (rotationGizmo && rotationGizmo.visible && selectedBoneName) {
        const bone = boneObjects[selectedBoneName];
        if (bone) {
            const wp = new THREE.Vector3();
            bone.getWorldPosition(wp);
            rotationGizmo.position.copy(wp);
        }
    }

    controls.update();
    renderer.render(scene, camera);
}

animate();