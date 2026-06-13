import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- 1. Scene Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.5, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 4, 0);
controls.update();

scene.add(new THREE.AmbientLight(0xffffff, 1.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);
scene.add(new THREE.GridHelper(10, 10, 0x555555, 0x444444));

// --- 2. Load Avatar ---
const loader = new GLTFLoader();

const targetBones = [
    'LeftArm', 'LeftForeArm', 'LeftHand',
    'LeftHandThumb1', 'LeftHandThumb2', 'LeftHandThumb3', 'LeftHandThumb4',
    'LeftHandIndex1', 'LeftHandIndex2', 'LeftHandIndex3', 'LeftHandIndex4',
    'LeftHandMiddle1', 'LeftHandMiddle2', 'LeftHandMiddle3', 'LeftHandMiddle4',
    'LeftHandRing1', 'LeftHandRing2', 'LeftHandRing3', 'LeftHandRing4',
    'LeftHandPinky1', 'LeftHandPinky2', 'LeftHandPinky3', 'LeftHandPinky4',
    'RightArm', 'RightForeArm', 'RightHand',
    'RightHandThumb1', 'RightHandThumb2', 'RightHandThumb3', 'RightHandThumb4',
    'RightHandIndex1', 'RightHandIndex2', 'RightHandIndex3', 'RightHandIndex4',
    'RightHandMiddle1', 'RightHandMiddle2', 'RightHandMiddle3', 'RightHandMiddle4',
    'RightHandRing1', 'RightHandRing2', 'RightHandRing3', 'RightHandRing4',
    'RightHandPinky1', 'RightHandPinky2', 'RightHandPinky3', 'RightHandPinky4'
];

const boneObjects = {};
const fingerRestQuaternions = {};
let modelLoaded = false;

let restBasisQuatR = new THREE.Quaternion();
let rightHandRestWorldQuat = new THREE.Quaternion();
let isRightHandBasisReady = false;

let restBasisQuatL = new THREE.Quaternion();
let leftHandRestWorldQuat = new THREE.Quaternion();
let isLeftHandBasisReady = false;

// MediaPipe → Three.js coordinate conversion
const mpToWorld = (lm) => new THREE.Vector3(lm[0], -lm[1], -lm[2]);

loader.load('./assets/male2k.glb', (gltf) => {
    const avatar = gltf.scene;
    scene.add(avatar);
    avatar.scale.set(0.04, 0.04, 0.04);
    avatar.position.set(0, 0, 0);

    avatar.traverse((child) => {
        if (child.isBone) {
            const baseName = child.name.split('_')[0];
            if (targetBones.includes(baseName)) {
                boneObjects[baseName] = child;
                fingerRestQuaternions[baseName] = child.quaternion.clone();
                const targetChildBone = child.children.find(c => c.isBone);
                child.userData.boneVector = targetChildBone
                    ? targetChildBone.position.clone().normalize()
                    : new THREE.Vector3(0, 1, 0);
            }
        }
    });

    avatar.updateMatrixWorld(true);

    // --- RIGHT HAND REST BASIS ---
    if (boneObjects['RightHand'] && boneObjects['RightHandIndex1'] && boneObjects['RightHandPinky1']) {
        const wristW = new THREE.Vector3(); boneObjects['RightHand'].getWorldPosition(wristW);
        const indexW = new THREE.Vector3(); boneObjects['RightHandIndex1'].getWorldPosition(indexW);
        const pinkyW = new THREE.Vector3(); boneObjects['RightHandPinky1'].getWorldPosition(pinkyW);

        const midW    = new THREE.Vector3().addVectors(indexW, pinkyW).multiplyScalar(0.5);
        const fwdW    = new THREE.Vector3().subVectors(midW, wristW).normalize();
        const rightW  = new THREE.Vector3().subVectors(pinkyW, indexW).normalize();
        const upW     = new THREE.Vector3().crossVectors(fwdW, rightW).normalize();
        rightW.crossVectors(upW, fwdW).normalize();

        restBasisQuatR.setFromRotationMatrix(new THREE.Matrix4().makeBasis(rightW, upW, fwdW));
        boneObjects['RightHand'].getWorldQuaternion(rightHandRestWorldQuat);
        isRightHandBasisReady = true;
    }

    // --- LEFT HAND REST BASIS ---
    if (boneObjects['LeftHand'] && boneObjects['LeftHandIndex1'] && boneObjects['LeftHandPinky1']) {
        const wristW = new THREE.Vector3(); boneObjects['LeftHand'].getWorldPosition(wristW);
        const indexW = new THREE.Vector3(); boneObjects['LeftHandIndex1'].getWorldPosition(indexW);
        const pinkyW = new THREE.Vector3(); boneObjects['LeftHandPinky1'].getWorldPosition(pinkyW);

        const midW    = new THREE.Vector3().addVectors(indexW, pinkyW).multiplyScalar(0.5);
        const fwdW    = new THREE.Vector3().subVectors(midW, wristW).normalize();
        const rightW  = new THREE.Vector3().subVectors(pinkyW, indexW).normalize();
        const upW     = new THREE.Vector3().crossVectors(fwdW, rightW).normalize();
        rightW.crossVectors(upW, fwdW).normalize();

        restBasisQuatL.setFromRotationMatrix(new THREE.Matrix4().makeBasis(rightW, upW, fwdW));
        boneObjects['LeftHand'].getWorldQuaternion(leftHandRestWorldQuat);
        isLeftHandBasisReady = true;
    }

    modelLoaded = true;
    console.log("Model loaded successfully!");
}, undefined, (error) => console.error("Error loading GLB:", error));

const targetQuaternions = {};
targetBones.forEach(bone => { targetQuaternions[bone] = new THREE.Quaternion(); });

// --- Swing-Twist Decomposition ---
function decomposeSwingTwist(q, twistAxis) {
    const p = new THREE.Vector3(q.x, q.y, q.z);
    const proj = new THREE.Vector3().copy(twistAxis).multiplyScalar(p.dot(twistAxis));
    let twist = new THREE.Quaternion(proj.x, proj.y, proj.z, q.w);
    twist = (twist.lengthSq() === 0) ? new THREE.Quaternion() : twist.normalize();
    const swing = twist.clone().invert().multiply(q);
    return { swing, twist };
}

// --- Generic single-hand solver (from ruff.js — the version that worked best) ---
function solveHandIK(
    handData,
    handBone,
    restBasisQuat,
    handRestWorldQuat,
    futureForeArmWorldQuat,
    futureArmWorldQuat,
    foreArmLocalQuat,
    foreArmBoneName,
    fingerChains,
    fingerIndices,
    sign
) {
    const v = (lm) => new THREE.Vector3(sign * lm[0], -lm[1], -lm[2]);

    const wristWorld = v(handData[0]);
    const indexWorld = v(handData[5]);
    const pinkyWorld = v(handData[17]);

    const midPt  = new THREE.Vector3().addVectors(indexWorld, pinkyWorld).multiplyScalar(0.5);
    const fwdW   = new THREE.Vector3().subVectors(midPt, wristWorld).normalize();
    const rightW = new THREE.Vector3().subVectors(pinkyWorld, indexWorld).normalize();
    const upW    = new THREE.Vector3().crossVectors(fwdW, rightW).normalize();
    rightW.crossVectors(upW, fwdW).normalize();

    const targetBasisQuat  = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(rightW, upW, fwdW));
    const deltaQuat        = targetBasisQuat.multiply(restBasisQuat.clone().invert());
    const newHandWorldQuat = deltaQuat.multiply(handRestWorldQuat);
    const rawHandLocal     = futureForeArmWorldQuat.clone().invert().multiply(newHandWorldQuat);

    const handBoneName   = handBone.name.split('_')[0];
    const handRestLocal = fingerRestQuaternions[handBoneName] || new THREE.Quaternion();
    const relRot        = handRestLocal.clone().invert().multiply(rawHandLocal);

    // CRITICAL FIX: The twist axis must be the forward direction of the hand.
    // The old code used 'boneVector', which points to the thumb, causing the
    // swing/twist decomposition to split the rotation around the thumb axis,
    // making the wrist bend sideways instead of up/down!
    // The forward direction in world space at rest is the Z-axis of restBasisQuat.
    const restFwdWorld = new THREE.Vector3(0, 0, 1).applyQuaternion(restBasisQuat);
    // Map it to the hand bone's local space to use as the true twist axis:
    const twistAxis = restFwdWorld.applyQuaternion(handRestWorldQuat.clone().invert()).normalize();

    const { swing, twist } = decomposeSwingTwist(relRot, twistAxis);

    const twistInForeArmSpace = handRestLocal.clone().multiply(twist).multiply(handRestLocal.clone().invert());
    
    const foreArmBone = boneObjects[foreArmBoneName];
    const foreArmAxis = foreArmBone.userData.boneVector.clone().normalize();
    const { twist: pureForeArmTwist } = decomposeSwingTwist(twistInForeArmSpace, foreArmAxis);

    foreArmLocalQuat.multiply(pureForeArmTwist);
    targetQuaternions[foreArmBoneName].copy(foreArmLocalQuat);
    const updatedForeArmWorldQuat = futureArmWorldQuat.clone().multiply(foreArmLocalQuat);

    const finalHandLocal = handRestLocal.clone().multiply(swing);
    targetQuaternions[handBoneName].copy(finalHandLocal);

    // --- Fingers ---
    fingerChains.forEach((chain) => {
        let parentWorldQuat = updatedForeArmWorldQuat.clone().multiply(finalHandLocal);

        chain.forEach(boneName => {
            const bone = boneObjects[boneName];
            if (!bone || !bone.userData.boneVector) return;

            const idxs     = fingerIndices[boneName];
            const startVec = v(handData[idxs[0]]);
            const endVec   = v(handData[idxs[1]]);
            if (startVec.length() === 0 || endVec.length() === 0) return;

            const dirWorld = new THREE.Vector3().subVectors(endVec, startVec).normalize();
            
            const restQuat = fingerRestQuaternions[boneName] || new THREE.Quaternion();
            const dirLocal = dirWorld.clone().applyQuaternion(parentWorldQuat.clone().invert());
            
            const targetDirBone = dirLocal.clone().applyQuaternion(restQuat.clone().invert());
            const localRot = new THREE.Quaternion().setFromUnitVectors(bone.userData.boneVector, targetDirBone);
            
            const euler = new THREE.Euler().setFromQuaternion(localRot, 'XYZ');
            
            const isMCP = boneName.endsWith('1');
            const isPIP = boneName.endsWith('2');
            const isDIP = boneName.endsWith('3');
            
            const pitchLimit = isMCP ? 100 * Math.PI / 180
                             : isPIP ? 95  * Math.PI / 180
                             : isDIP ? 90  * Math.PI / 180 : 100 * Math.PI / 180;
                             
            euler.x = Math.max(-pitchLimit, Math.min(pitchLimit, euler.x));
            
            if (isMCP) {
                const yawLimit = 45 * Math.PI / 180;
                euler.z = Math.max(-yawLimit, Math.min(yawLimit, euler.z));
            } else {
                euler.z = 0;
            }
            euler.y = 0;
            
            localRot.setFromEuler(euler);
            
            const finalQuat = restQuat.clone().multiply(localRot);
            
            targetQuaternions[boneName].copy(finalQuat);
            parentWorldQuat.multiply(finalQuat);
        });
    });

    return updatedForeArmWorldQuat;
}

// --- Collision Avoidance Helper ---
function pushOutFromEllipticalCapsule(point, capStart, capEnd, radiusX, radiusZ, xAxis, zAxis) {
    const ab = new THREE.Vector3().subVectors(capEnd, capStart);
    const ap = new THREE.Vector3().subVectors(point, capStart);
    let t = ap.dot(ab) / ab.lengthSq();
    t = Math.max(0, Math.min(1, t)); // clamp to segment
    
    const closest = new THREE.Vector3().copy(capStart).add(ab.clone().multiplyScalar(t));
    const diff = new THREE.Vector3().subVectors(point, closest);
    
    let dx = diff.dot(xAxis);
    let dz = diff.dot(zAxis);
    
    // If exact center, give an arbitrary push forward (+Z in MediaPipe space)
    if (dx === 0 && dz === 0) {
        dz = 0.001; 
    }
    
    // Check if inside the ellipse (dx/rx)^2 + (dz/rz)^2 < 1
    const val = (dx * dx) / (radiusX * radiusX) + (dz * dz) / (radiusZ * radiusZ);
    if (val < 1) {
        // Find intersection of the ray (dx, dz) with the ellipse boundary
        const s = 1.0 / Math.sqrt(val);
        const newDx = dx * s;
        const newDz = dz * s;
        
        const pushVec = new THREE.Vector3()
            .add(xAxis.clone().multiplyScalar(newDx))
            .add(zAxis.clone().multiplyScalar(newDz));
            
        point.copy(closest).add(pushVec);
    }
}

// --- 3. Main IK Solver ---
function updateArmsIK(frameData) {
    const body = frameData.body;
    if (!body || body.length < 17) return;

    // --- Torso Collision Setup ---
    const leftShoulderMp = mpToWorld(body[11]);
    const rightShoulderMp = mpToWorld(body[12]);
    const shoulderCenter = new THREE.Vector3().addVectors(leftShoulderMp, rightShoulderMp).multiplyScalar(0.5);
    const shoulderWidth = leftShoulderMp.distanceTo(rightShoulderMp);
    
    const xAxis = new THREE.Vector3().subVectors(leftShoulderMp, rightShoulderMp).normalize();
    const yAxis = new THREE.Vector3(0, -1, 0); // straight down
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize(); // forward depth
    
    // Oval cylinder dimensions - Dialed back for a closer fit
    const torsoRadiusX = shoulderWidth * 0.50; // Snugger width
    const torsoRadiusZ = shoulderWidth * 0.50; // Snugger depth
    const torsoLength  = shoulderWidth * 1.8;
    
    const torsoEnd = shoulderCenter.clone();
    torsoEnd.y -= torsoLength;

    // ---- LEFT ARM ----
    const leftArm     = boneObjects['LeftArm'];
    const leftForeArm = boneObjects['LeftForeArm'];

    if (leftArm && leftForeArm && leftArm.parent && leftArm.userData.boneVector) {
        const startArmL = leftShoulderMp;
        let endArmL   = mpToWorld(body[13]);
        let endForeArmL = mpToWorld(body[15]);

        if (startArmL.length() > 0 && endArmL.length() > 0) {
            // Collision Avoidance: Push elbow and wrist out of the torso volume
            // Wrist gets a medium buffer (+0.04)
            pushOutFromEllipticalCapsule(endArmL, shoulderCenter, torsoEnd, torsoRadiusX, torsoRadiusZ, xAxis, zAxis);
            pushOutFromEllipticalCapsule(endForeArmL, shoulderCenter, torsoEnd, torsoRadiusX + 0.04, torsoRadiusZ + 0.04, xAxis, zAxis);

            const parentWorldQuatL = new THREE.Quaternion();
            leftArm.parent.getWorldQuaternion(parentWorldQuatL);

            const dirArmL      = new THREE.Vector3().subVectors(endArmL, startArmL).normalize();
            const dirArmLocalL = dirArmL.clone().applyQuaternion(parentWorldQuatL.clone().invert());
            
            const restArmL     = fingerRestQuaternions['LeftArm'] || new THREE.Quaternion();
            const restDirArmL  = leftArm.userData.boneVector.clone().applyQuaternion(restArmL);
            const deltaArmL    = new THREE.Quaternion().setFromUnitVectors(restDirArmL, dirArmLocalL);
            const quatArmL     = deltaArmL.clone().multiply(restArmL);
            
            targetQuaternions['LeftArm'].copy(quatArmL);

            const futureArmWorldL   = parentWorldQuatL.clone().multiply(quatArmL);

            const dirForeL      = new THREE.Vector3().subVectors(endForeArmL, endArmL).normalize();
            const dirForeLocalL = dirForeL.clone().applyQuaternion(futureArmWorldL.clone().invert());
            
            const restForeL     = fingerRestQuaternions['LeftForeArm'] || new THREE.Quaternion();
            const restDirForeL  = leftForeArm.userData.boneVector.clone().applyQuaternion(restForeL);
            const deltaForeL    = new THREE.Quaternion().setFromUnitVectors(restDirForeL, dirForeLocalL);
            let quatForeArmL    = deltaForeL.clone().multiply(restForeL);
            
            targetQuaternions['LeftForeArm'].copy(quatForeArmL);

            let futureForeArmWorldL = futureArmWorldL.clone().multiply(quatForeArmL);

            const leftHandData = frameData.left_hand;
            const leftHandBone = boneObjects['LeftHand'];

            if (leftHandData && leftHandData[0][0] !== 0 && leftHandBone && isLeftHandBasisReady) {
                const fingerChainsL = [
                    ['LeftHandThumb1',  'LeftHandThumb2',  'LeftHandThumb3'],
                    ['LeftHandIndex1',  'LeftHandIndex2',  'LeftHandIndex3'],
                    ['LeftHandMiddle1', 'LeftHandMiddle2', 'LeftHandMiddle3'],
                    ['LeftHandRing1',   'LeftHandRing2',   'LeftHandRing3'],
                    ['LeftHandPinky1',  'LeftHandPinky2',  'LeftHandPinky3']
                ];
                const fingerIndicesL = {
                    'LeftHandThumb1':  [1,2],  'LeftHandThumb2':  [2,3],  'LeftHandThumb3':  [3,4],
                    'LeftHandIndex1':  [5,6],  'LeftHandIndex2':  [6,7],  'LeftHandIndex3':  [7,8],
                    'LeftHandMiddle1': [9,10], 'LeftHandMiddle2': [10,11],'LeftHandMiddle3': [11,12],
                    'LeftHandRing1':   [13,14],'LeftHandRing2':   [14,15],'LeftHandRing3':   [15,16],
                    'LeftHandPinky1':  [17,18],'LeftHandPinky2':  [18,19],'LeftHandPinky3':  [19,20]
                };

                solveHandIK(
                    leftHandData, leftHandBone,
                    restBasisQuatL, leftHandRestWorldQuat,
                    futureForeArmWorldL, futureArmWorldL,
                    quatForeArmL, 'LeftForeArm',
                    fingerChainsL, fingerIndicesL,
                    +1
                );
            }
        }
    }

    // ---- RIGHT ARM ----
    const rightArm     = boneObjects['RightArm'];
    const rightForeArm = boneObjects['RightForeArm'];

    if (rightArm && rightForeArm && rightArm.parent && rightArm.userData.boneVector) {
        const startArmR = rightShoulderMp;
        let endArmR   = mpToWorld(body[14]);
        let endForeArmR = mpToWorld(body[16]);

        if (startArmR.length() > 0 && endArmR.length() > 0) {
            // Collision Avoidance: Push elbow and wrist out of the torso volume
            // Wrist gets a medium buffer (+0.04)
            pushOutFromEllipticalCapsule(endArmR, shoulderCenter, torsoEnd, torsoRadiusX, torsoRadiusZ, xAxis, zAxis);
            pushOutFromEllipticalCapsule(endForeArmR, shoulderCenter, torsoEnd, torsoRadiusX + 0.04, torsoRadiusZ + 0.04, xAxis, zAxis);

            const parentWorldQuatR = new THREE.Quaternion();
            rightArm.parent.getWorldQuaternion(parentWorldQuatR);

            const dirArmR      = new THREE.Vector3().subVectors(endArmR, startArmR).normalize();
            const dirArmLocalR = dirArmR.clone().applyQuaternion(parentWorldQuatR.clone().invert());
            
            const restArmR     = fingerRestQuaternions['RightArm'] || new THREE.Quaternion();
            const restDirArmR  = rightArm.userData.boneVector.clone().applyQuaternion(restArmR);
            const deltaArmR    = new THREE.Quaternion().setFromUnitVectors(restDirArmR, dirArmLocalR);
            const quatArmR     = deltaArmR.clone().multiply(restArmR);
            
            targetQuaternions['RightArm'].copy(quatArmR);

            const futureArmWorldR   = parentWorldQuatR.clone().multiply(quatArmR);

            const dirForeR      = new THREE.Vector3().subVectors(endForeArmR, endArmR).normalize();
            const dirForeLocalR = dirForeR.clone().applyQuaternion(futureArmWorldR.clone().invert());
            
            const restForeR     = fingerRestQuaternions['RightForeArm'] || new THREE.Quaternion();
            const restDirForeR  = rightForeArm.userData.boneVector.clone().applyQuaternion(restForeR);
            const deltaForeR    = new THREE.Quaternion().setFromUnitVectors(restDirForeR, dirForeLocalR);
            let quatForeArmR    = deltaForeR.clone().multiply(restForeR);
            
            targetQuaternions['RightForeArm'].copy(quatForeArmR);

            let futureForeArmWorldR = futureArmWorldR.clone().multiply(quatForeArmR);

            const rightHandData = frameData.right_hand;
            const rightHandBone = boneObjects['RightHand'];

            if (rightHandData && rightHandData[0][0] !== 0 && rightHandBone && isRightHandBasisReady) {
                const fingerChainsR = [
                    ['RightHandThumb1',  'RightHandThumb2',  'RightHandThumb3'],
                    ['RightHandIndex1',  'RightHandIndex2',  'RightHandIndex3'],
                    ['RightHandMiddle1', 'RightHandMiddle2', 'RightHandMiddle3'],
                    ['RightHandRing1',   'RightHandRing2',   'RightHandRing3'],
                    ['RightHandPinky1',  'RightHandPinky2',  'RightHandPinky3']
                ];
                const fingerIndicesR = {
                    'RightHandThumb1':  [1,2],  'RightHandThumb2':  [2,3],  'RightHandThumb3':  [3,4],
                    'RightHandIndex1':  [5,6],  'RightHandIndex2':  [6,7],  'RightHandIndex3':  [7,8],
                    'RightHandMiddle1': [9,10], 'RightHandMiddle2': [10,11],'RightHandMiddle3': [11,12],
                    'RightHandRing1':   [13,14],'RightHandRing2':   [14,15],'RightHandRing3':   [15,16],
                    'RightHandPinky1':  [17,18],'RightHandPinky2':  [18,19],'RightHandPinky3':  [19,20]
                };

                solveHandIK(
                    rightHandData, rightHandBone,
                    restBasisQuatR, rightHandRestWorldQuat,
                    futureForeArmWorldR, futureArmWorldR,
                    quatForeArmR, 'RightForeArm',
                    fingerChainsR, fingerIndicesR,
                    +1
                );
            }
        }
    }
}

// --- 4. Load Animation Data ---
let animationFrames = [];
let currentFrame    = 0;
let isDataLoaded    = false;



const JSON_FILE_PATH = './output/image4_ready.json';
fetch(JSON_FILE_PATH)
    .then(r => r.json())
    .then(data => {
        animationFrames = data.frames;
        console.log(`Loaded ${animationFrames.length} frames.`);
        isDataLoaded = true;
    })
    .catch(err => console.error("Error loading JSON:", err));

// --- 5. Render Loop ---
const clock        = new THREE.Clock();
let timeAccumulator = 0;
const FPS           = 30;
const frameDuration = 1.0 / FPS;
let SLERP_SPEED     = 0.15;



window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();

    if (modelLoaded && isDataLoaded && animationFrames.length > 0) {
        timeAccumulator += deltaTime;
        if (timeAccumulator >= frameDuration) {
            timeAccumulator -= frameDuration;
            updateArmsIK(animationFrames[currentFrame]);
            if (animationFrames.length > 1) {
                currentFrame = (currentFrame + 1) % animationFrames.length;
            }
        }
        targetBones.forEach(boneName => {
            if (boneObjects[boneName]) {
                boneObjects[boneName].quaternion.slerp(targetQuaternions[boneName], SLERP_SPEED);
            }
        });
    }

    renderer.render(scene, camera);
}

animate();