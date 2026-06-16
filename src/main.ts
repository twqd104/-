import * as THREE from 'three';
import { DragControls } from 'three/examples/jsm/controls/DragControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import gsap from 'gsap';
import { FurnitureDatabase } from './furnitureDatabase';
import { HistoryManager, MoveCommand, TransformCommand, SpawnCommand, DeleteCommand, ColorCommand, MultiTransformCommand } from './historyManager';
import './style.css';

// --- CONFIG & STATE ---
let selectedObject: THREE.Object3D | null = null;
const allFurniture: THREE.Object3D[] = []; // ALL items for Layers Panel
const draggableObjects: THREE.Object3D[] = []; // Unlocked items only
let isDraggingFurniture = false;
let isUiHidden = false;

// --- HISTORY MANAGER ---
const history = new HistoryManager();
const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
const redoBtn = document.getElementById('redo-btn') as HTMLButtonElement;

history.onHistoryChange = (canUndo, canRedo) => {
    if (undoBtn) undoBtn.disabled = !canUndo;
    if (redoBtn) redoBtn.disabled = !canRedo;
    updateLayersUI();
};

undoBtn?.addEventListener('click', () => history.undo());
redoBtn?.addEventListener('click', () => history.redo());

// --- AUDIO SYSTEM ---
const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

function playSound(type: 'drag' | 'drop' | 'click' | 'delete' | 'explosion') {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  const now = audioCtx.currentTime;
  
  if (type === 'click') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.1, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'drag') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.1);
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (type === 'drop') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (type === 'delete') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.1, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'explosion') {
    const bufferSize = audioCtx.sampleRate * 2.0; 
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, now);
    filter.frequency.exponentialRampToValueAtTime(50, now + 1.5);

    gainNode.gain.setValueAtTime(1.0, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.5);

    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    noiseSource.start(now);
  }
}

// --- EXPLOSION SYSTEM ---

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = null;
// Fog removed to prevent background color from bleeding into objects

// --- CAMERA (Perspective) ---
const camera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(35, 35, 35);

// --- RENDERER ---
const canvasContainer = document.getElementById('app')!;
canvasContainer.style.backgroundColor = '#0f172a';
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
canvasContainer.appendChild(renderer.domElement);

// --- CONTROLS (Orbit/Map) ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.mouseButtons = {
  LEFT: THREE.MOUSE.PAN,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.ROTATE
};
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 - 0.05; // Restrict to above floor
controls.screenSpacePanning = false; // Pan moves along floor plane

// --- POST-PROCESSING (SSAO) ---
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
ssaoPass.kernelRadius = 16;
ssaoPass.minDistance = 0.005;
ssaoPass.maxDistance = 0.1;
composer.addPass(ssaoPass);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.3, 0.4, 0.85);
bloomPass.threshold = 0.85; // 提高閾值，只讓非常亮的物件發光
bloomPass.strength = 0.3;   // 降低發光強度，避免過度曝光
bloomPass.radius = 0.4;
composer.addPass(bloomPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.4); 
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(15, 30, 15);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 100;
dirLight.shadow.camera.left = -30;
dirLight.shadow.camera.right = 30;
dirLight.shadow.camera.top = 30;
dirLight.shadow.camera.bottom = -30;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

// --- ROOM ENVIRONMENT ---
const floorGeom = new THREE.PlaneGeometry(200, 200);
const floorMat = new THREE.MeshStandardMaterial({ 
  color: 0x1e293b, 
  roughness: 1.0
});
const floor = new THREE.Mesh(floorGeom, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const gridHelper = new THREE.GridHelper(200, 200, 0x334155, 0x334155);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 1.0 });
const backWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), wallMat);
backWall.position.set(0, 5, -10);
backWall.receiveShadow = true;
scene.add(backWall);

const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), wallMat);
leftWall.position.set(-10, 5, 0);
leftWall.rotation.y = Math.PI / 2;
leftWall.receiveShadow = true;
scene.add(leftWall);

// --- ENVIRONMENT COLOR UI ---
const floorColorInput = document.getElementById('floor-color') as HTMLInputElement;
floorColorInput?.addEventListener('input', (e) => {
  const color = (e.target as HTMLInputElement).value;
  floorMat.color.set(color);
  (gridHelper.material as THREE.LineBasicMaterial).color.set(color);
});

const wallColorInput = document.getElementById('wall-color') as HTMLInputElement;
wallColorInput?.addEventListener('input', (e) => {
  const color = (e.target as HTMLInputElement).value;
  wallMat.color.set(color);
});

const bgColorInput = document.getElementById('bg-color') as HTMLInputElement;
bgColorInput?.addEventListener('input', (e) => {
  const color = (e.target as HTMLInputElement).value;
  canvasContainer.style.backgroundColor = color;
});

const uiColorInput = document.getElementById('ui-color') as HTMLInputElement;

function applyThemeColor(color: string) {
  document.body.style.setProperty('--accent-color', color);
  document.body.style.setProperty('--glass-border', color);
  if (document.body.classList.contains('theme-retro')) {
    document.body.style.setProperty('--text-primary', color);
  } else {
    document.body.style.removeProperty('--text-primary');
  }
}

uiColorInput?.addEventListener('input', (e) => {
  applyThemeColor((e.target as HTMLInputElement).value);
});

const toggleGrid = document.getElementById('toggle-grid') as HTMLInputElement;
toggleGrid?.addEventListener('change', (e) => {
  const enabled = (e.target as HTMLInputElement).checked;
  gridHelper.visible = enabled;
});

// --- INTERACTION SETUP ---
const selectionBox = new THREE.BoxHelper(floor, 0x38bdf8);
selectionBox.visible = false;
scene.add(selectionBox);

const dragControls = new DragControls(draggableObjects, camera, renderer.domElement);
dragControls.transformGroup = true;

dragControls.addEventListener('hoveron', function () {
  renderer.domElement.style.cursor = 'grab';
});

dragControls.addEventListener('hoveroff', function () {
  renderer.domElement.style.cursor = 'auto';
});

const dragStartPos = new THREE.Vector3();
dragControls.addEventListener('dragstart', function (event) {
  isDraggingFurniture = true;
  controls.enabled = false;
  renderer.domElement.style.cursor = 'grabbing';
  playSound('drag');
  dragStartPos.copy(event.object.position);
  selectObject(event.object);
});

dragControls.addEventListener('drag', function (event) {
  const originalY = event.object.userData.originalY ?? 0;
  event.object.position.y = originalY;
  if (selectionBox.visible) selectionBox.update();
});

dragControls.addEventListener('dragend', function (event) {
  isDraggingFurniture = false;
  controls.enabled = true;
  playSound('drop');
  
  if (!dragStartPos.equals(event.object.position)) {
      const cmd = new MoveCommand(event.object, dragStartPos.clone(), event.object.position.clone(), () => {
          if (selectedObject === event.object && selectionBox.visible) {
              selectionBox.update();
              selectObject(event.object);
          }
      });
      // push without executing since it's already in the new position
      cmd.execute(); // technically no-op structurally, but triggers UI update
      history.addCommand(cmd);
  }
});

// Raycasting for Selection (Click without drag)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let clickStartX = 0;
let clickStartY = 0;

window.addEventListener('pointerdown', (event) => {
  if (isUiHidden) return;
  if ((event.target as HTMLElement).closest('.glass-panel') || (event.target as HTMLElement).closest('.floating-toolbar')) return;
  clickStartX = event.clientX;
  clickStartY = event.clientY;
});

window.addEventListener('pointerup', (event) => {
  if (isUiHidden) return;
  if ((event.target as HTMLElement).closest('.glass-panel') || (event.target as HTMLElement).closest('.floating-toolbar')) return;
  
  // Only select if it was a click, not a drag
  if (Math.abs(event.clientX - clickStartX) > 5 || Math.abs(event.clientY - clickStartY) > 5) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const intersectableMeshes: THREE.Object3D[] = [];
  draggableObjects.forEach(group => {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) intersectableMeshes.push(child);
    });
  });

  const intersects = raycaster.intersectObjects(intersectableMeshes);

  if (intersects.length > 0) {
    let object = intersects[0].object;
    while (object.parent && !object.userData.isFurniture) {
      if (object.parent.userData.isFurniture) {
        object = object.parent;
        break;
      }
      object = object.parent;
    }
    if (object.userData.isFurniture && !object.userData.locked) {
      selectObject(object);
    }
  } else {
    deselectObject();
  }
});

const intensitySlider = document.getElementById('intensity-slider') as HTMLInputElement;
const transformGroup = document.getElementById('transform-group');
const scaleXSlider = document.getElementById('scale-x-slider') as HTMLInputElement;
const scaleZSlider = document.getElementById('scale-z-slider') as HTMLInputElement;
const elevationSlider = document.getElementById('elevation-slider') as HTMLInputElement;
const rotationSlider = document.getElementById('rotation-slider') as HTMLInputElement;
const rotationDisplay = document.getElementById('rotation-display') as HTMLSpanElement;

let initialColorHex = '';

function selectObject(object: THREE.Object3D) {
  selectedObject = object;
  selectionBox.setFromObject(object);
  selectionBox.visible = true;

  const tvControls = document.getElementById('tv-controls');
  const intensityGroup = document.getElementById('intensity-group');
  
  if (tvControls) tvControls.style.display = 'none';
  if (intensityGroup) intensityGroup.style.display = 'none';
  if (transformGroup) transformGroup.style.display = 'flex';

  // Compute base size if not already cached
  if (!object.userData.baseSize) {
      const oldScale = object.scale.clone();
      const oldRot = object.rotation.clone();
      object.scale.set(1, 1, 1);
      object.rotation.set(0, 0, 0);
      object.updateMatrixWorld();
      const box = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      box.getSize(size);
      object.userData.baseSize = size;
      object.scale.copy(oldScale);
      object.rotation.copy(oldRot);
      object.updateMatrixWorld();
  }

  // Set initial slider values based on object
  if (scaleXSlider) scaleXSlider.value = object.scale.x.toString();
  if (scaleZSlider) scaleZSlider.value = object.scale.z.toString();
  if (elevationSlider) elevationSlider.value = (object.userData.originalY || 0).toString();
  
  if (rotationSlider) {
      let deg = Math.round(THREE.MathUtils.radToDeg(object.rotation.y)) % 360;
      if (deg < 0) deg += 360;
      rotationSlider.value = deg.toString();
      if (rotationDisplay) rotationDisplay.innerText = `${deg}°`;
  }

  let primaryMesh: any = null;
  let activeLight: any = null;
  let activeTvScreen: any = null;

  object.traverse((child) => {
    if (!primaryMesh && child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
      if (!child.userData.isCustomImage) {
         primaryMesh = child;
      }
    }
    if (child instanceof THREE.Light && child.userData.isLampLight) {
        activeLight = child;
    }
    if (child instanceof THREE.Mesh && child.userData.isCustomImage) {
        activeTvScreen = child;
    }
  });

  if (activeTvScreen) {
      if (tvControls) tvControls.style.display = 'flex';
      if (intensityGroup) {
          intensityGroup.style.display = 'flex';
          const mat = activeTvScreen.material as THREE.MeshStandardMaterial;
          intensitySlider.value = (mat.emissiveIntensity * 50).toString(); 
      }
  } else if (activeLight) {
      if (intensityGroup) {
          intensityGroup.style.display = 'flex';
          intensitySlider.value = activeLight.intensity.toString();
      }
  }

  // Update Color Picker
  if (primaryMesh && primaryMesh.material instanceof THREE.MeshStandardMaterial) {
    const hexColor = '#' + primaryMesh.material.color.getHexString();
    initialColorHex = hexColor;
    const colorPicker = document.getElementById('color-picker') as HTMLInputElement;
    if (colorPicker) colorPicker.value = hexColor;
  }
  
  updateLayersUI();
}

function deselectObject() {
  selectedObject = null;
  selectionBox.visible = false;
  const tvControls = document.getElementById('tv-controls');
  const intensityGroup = document.getElementById('intensity-group');
  if (tvControls) tvControls.style.display = 'none';
  if (intensityGroup) intensityGroup.style.display = 'none';
  if (transformGroup) transformGroup.style.display = 'none';
  
  updateLayersUI();
}

function deleteSelectedObject() {
  if (!selectedObject) return;
  playSound('delete');
  const cmd = new DeleteCommand(
      selectedObject, scene, draggableObjects,
      (obj) => { 
          if (selectedObject === obj) selectObject(obj);
          if (!allFurniture.includes(obj)) allFurniture.push(obj);
      },
      (obj) => { 
          if (selectedObject === obj) deselectObject();
          const idx = allFurniture.indexOf(obj);
          if (idx > -1) allFurniture.splice(idx, 1);
      }
  );
  history.execute(cmd);
  updateLayersUI();
}

// --- LAYER SYSTEM ---
function updateLayersUI() {
    const layersList = document.getElementById('layers-list');
    if (!layersList) return;
    
    layersList.innerHTML = '';
    
    // Render layers in reverse order (newest on top)
    for (let i = allFurniture.length - 1; i >= 0; i--) {
        const obj = allFurniture[i];
        
        const li = document.createElement('li');
        li.className = 'layer-item';
        if (selectedObject === obj) li.classList.add('active');
        if (obj.userData.locked) li.classList.add('locked');
        
        li.addEventListener('click', (e) => {
            // Prevent selecting if clicking lock button or if locked
            if ((e.target as HTMLElement).closest('.lock-btn')) return;
            if (obj.userData.locked) return;
            selectObject(obj);
        });

        const nameSpan = document.createElement('span');
        nameSpan.className = 'layer-name';
        nameSpan.innerText = obj.userData.name || `Object ${i+1}`;
        
        const lockBtn = document.createElement('button');
        lockBtn.className = 'lock-btn';
        lockBtn.title = obj.userData.locked ? 'Unlock' : 'Lock';
        lockBtn.innerHTML = obj.userData.locked 
            ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0110 0v4"></path></svg>` // Lock icon
            : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 019.9-1"></path></svg>`; // Unlock icon

        lockBtn.addEventListener('click', () => {
            obj.userData.locked = !obj.userData.locked;
            if (obj.userData.locked) {
                // Remove from draggable list
                const idx = draggableObjects.indexOf(obj);
                if (idx > -1) draggableObjects.splice(idx, 1);
                // Deselect if it was selected
                if (selectedObject === obj) deselectObject();
            } else {
                // Add back to draggable list
                if (!draggableObjects.includes(obj)) draggableObjects.push(obj);
            }
            updateLayersUI();
        });

        li.appendChild(nameSpan);
        li.appendChild(lockBtn);
        layersList.appendChild(li);
    }
}


// --- FURNITURE DATABASE SPAWNING ---

async function spawnNewFurniture(type: string, x: number = 0, z: number = 0) {
  try {
    const furniture = await FurnitureDatabase.spawn(type);
    furniture.position.set(x, furniture.userData.originalY || 0, z);
    
    // Assign ID and Name
    furniture.userData.id = Math.random().toString(36).substr(2, 9);
    
    // Calculate how many of this type exist
    const count = allFurniture.filter(o => o.userData.type === type).length + 1;
    const properName = type.charAt(0).toUpperCase() + type.slice(1);
    furniture.userData.name = `${properName} ${count}`;
    furniture.userData.type = type;
    
    const cmd = new SpawnCommand(
        furniture, scene, draggableObjects,
        (obj) => { 
            if (!allFurniture.includes(obj)) allFurniture.push(obj);
            // Intro animation
            const originalScale = obj.scale.clone();
            obj.scale.set(0, 0, 0);
            gsap.to(obj.scale, {
              x: originalScale.x,
              y: originalScale.y,
              z: originalScale.z,
              duration: 0.5,
              ease: "back.out(1.5)",
              onUpdate: () => {
                if (selectedObject === obj && selectionBox.visible) {
                    selectionBox.update();
                }
              }
            });
            updateLayersUI();
        },
        (obj) => {
            const idx = allFurniture.indexOf(obj);
            if (idx > -1) allFurniture.splice(idx, 1);
            if (selectedObject === obj) deselectObject();
            updateLayersUI();
        }
    );
    history.execute(cmd);
    
  } catch (error) {
    console.error("Failed to spawn furniture:", error);
  }
}

// Initial Population (bypassing history for intro)
async function initPopulate() {
    const items = ['sofa', 'table', 'plant', 'lamp'];
    const positions = [[0,-2], [0,2], [4,-4], [3,-1]];
    
    for (let i = 0; i < items.length; i++) {
        const type = items[i];
        const s = await FurnitureDatabase.spawn(type); 
        s.position.set(positions[i][0], s.userData.originalY||0, positions[i][1]);
        s.userData.id = Math.random().toString(36).substr(2, 9);
        const properName = type.charAt(0).toUpperCase() + type.slice(1);
        s.userData.name = `${properName} 1`;
        s.userData.type = type;
        
        scene.add(s); 
        draggableObjects.push(s);
        allFurniture.push(s);
    }
    updateLayersUI();
}
// initPopulate(); // Disabled, let start screen handle it



// --- UI EVENT LISTENERS ---

// Color Picker (History wrapped on 'change')
const colorPicker = document.getElementById('color-picker') as HTMLInputElement;

colorPicker?.addEventListener('input', (event) => {
  if (!selectedObject) return;
  const newColor = (event.target as HTMLInputElement).value;
  let appliedMesh = false;
  selectedObject.traverse((child) => {
    if (!appliedMesh && child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
      if (!child.userData.isCustomImage) {
        child.material.color.set(newColor);
        if (child.material.emissive && child.material.emissiveIntensity > 0) {
            child.material.emissive.set(newColor);
        }
        appliedMesh = true; 
      }
    }
    if (child instanceof THREE.Light && child.userData.isLampLight) {
        child.color.set(newColor);
    }
  });
});

colorPicker?.addEventListener('change', (event) => {
    if (!selectedObject) return;
    const newColor = (event.target as HTMLInputElement).value;
    const cmd = new ColorCommand(selectedObject, initialColorHex, newColor, () => {
        if (selectedObject) selectObject(selectedObject);
    });
    // We already applied the color during 'input', so just push to history
    cmd.execute();
    history.addCommand(cmd);
    initialColorHex = newColor; 
});

// Intensity Slider (Not tracked in history for simplicity, acts immediately)
intensitySlider?.addEventListener('input', (event: Event) => {
    if (!selectedObject) return;
    const val = parseFloat((event.target as HTMLInputElement).value);
    
    selectedObject.traverse((child) => {
        if (child instanceof THREE.Light && child.userData.isLampLight) {
            child.intensity = val;
        }
        if (child instanceof THREE.Mesh && child.userData.isCustomImage) {
            const mat = child.material as THREE.MeshStandardMaterial;
            mat.emissiveIntensity = val / 50; 
        }
    });
});

// Transform Sliders (History tracking)
let oldScale = new THREE.Vector3();
let oldRotation = new THREE.Euler();
let oldPosition = new THREE.Vector3();

function saveTransformState() {
    if (!selectedObject) return;
    oldScale.copy(selectedObject.scale);
    oldRotation.copy(selectedObject.rotation);
    oldPosition.copy(selectedObject.position);
}

function pushTransformCommand() {
    if (!selectedObject) return;
    const cmd = new TransformCommand(
        selectedObject, oldScale.clone(), selectedObject.scale.clone(),
        oldRotation.clone(), selectedObject.rotation.clone(),
        oldPosition.clone(), selectedObject.position.clone(),
        () => {
            if (selectedObject && selectionBox.visible) selectionBox.update();
            if (selectedObject) selectObject(selectedObject);
        }
    );
    // Already applied via input, so just push
    cmd.execute();
    history.addCommand(cmd);
}

[scaleXSlider, scaleZSlider, elevationSlider, rotationSlider].forEach(slider => {
    slider?.addEventListener('pointerdown', saveTransformState);
    slider?.addEventListener('change', pushTransformCommand); 
});

scaleXSlider?.addEventListener('input', (event) => {
    if (!selectedObject) return;
    const newScaleX = parseFloat((event.target as HTMLInputElement).value);
    const deltaX = newScaleX - selectedObject.scale.x;
    if (selectedObject.userData.baseSize) {
        selectedObject.translateX(deltaX * selectedObject.userData.baseSize.x / 2);
    }
    selectedObject.scale.x = newScaleX;
    if (selectionBox.visible) selectionBox.update();
});
scaleZSlider?.addEventListener('input', (event) => {
    if (!selectedObject) return;
    const newScaleZ = parseFloat((event.target as HTMLInputElement).value);
    const deltaZ = newScaleZ - selectedObject.scale.z;
    if (selectedObject.userData.baseSize) {
        selectedObject.translateZ(deltaZ * selectedObject.userData.baseSize.z / 2);
    }
    selectedObject.scale.z = newScaleZ;
    if (selectionBox.visible) selectionBox.update();
});
elevationSlider?.addEventListener('input', (event) => {
    if (!selectedObject) return;
    const y = parseFloat((event.target as HTMLInputElement).value);
    selectedObject.userData.originalY = y;
    selectedObject.position.y = y;
    if (selectionBox.visible) selectionBox.update();
});
rotationSlider?.addEventListener('input', (event) => {
    if (!selectedObject) return;
    const deg = parseFloat((event.target as HTMLInputElement).value);
    selectedObject.rotation.y = THREE.MathUtils.degToRad(deg);
    if (rotationDisplay) rotationDisplay.innerText = `${deg}°`;
    if (selectionBox.visible) selectionBox.update();
});

const deleteBtn = document.getElementById('delete-btn');
deleteBtn?.addEventListener('click', deleteSelectedObject);

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.warn(`Error attempting to enable fullscreen: ${err.message}`);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

const fullscreenBtn = document.getElementById('fullscreen-btn');
fullscreenBtn?.addEventListener('click', toggleFullscreen);

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  
  // History Hotkeys
  if (event.ctrlKey || event.metaKey) {
      if (key === 'z') {
          if (event.shiftKey) {
              history.redo();
          } else {
              history.undo();
          }
          event.preventDefault();
          return;
      }
      if (key === 'y') {
          history.redo();
          event.preventDefault();
          return;
      }
  }

  if (key === 'r') rotateSelected();
  if (key === 'delete') deleteSelectedObject();
  if (key === 'backspace') {
    isUiHidden = !isUiHidden;
    const uiOverlay = document.querySelector('.ui-overlay') as HTMLElement;
    if (uiOverlay) {
      uiOverlay.classList.toggle('hidden', isUiHidden);
    }
    dragControls.enabled = !isUiHidden;
    if (isUiHidden) deselectObject();
  }
  if (key === 'f') toggleFullscreen();
  if (key === 'escape') {
    const mainMenu = document.getElementById('main-menu');
    if (mainMenu) mainMenu.classList.toggle('hidden');
  }
});

function rotateSelected() {
  if (!selectedObject || isDraggingFurniture) return;
  saveTransformState();
  const targetRotationY = selectedObject.rotation.y - Math.PI / 2;
  
  gsap.to(selectedObject.rotation, {
    y: targetRotationY,
    duration: 0.4,
    ease: "back.out(1.7)",
    onUpdate: () => {
      if (selectionBox.visible) selectionBox.update();
      if (rotationSlider && rotationDisplay) {
          let deg = Math.round(THREE.MathUtils.radToDeg(selectedObject!.rotation.y)) % 360;
          if (deg < 0) deg += 360;
          rotationSlider.value = deg.toString();
          rotationDisplay.innerText = `${deg}°`;
      }
    },
    onComplete: () => {
        pushTransformCommand();
    }
  });
}

const floatingToolbar = document.getElementById('floating-toolbar');
const floatRotateBtn = document.getElementById('float-rotate-btn');
const floatDuplicateBtn = document.getElementById('float-duplicate-btn');

function updateFloatingToolbar() {
    if (!selectedObject || isUiHidden || !floatingToolbar) {
        if (floatingToolbar && !floatingToolbar.classList.contains('hidden')) {
            floatingToolbar.classList.add('hidden');
        }
        return;
    }
    
    const pos = new THREE.Vector3();
    const box = new THREE.Box3().setFromObject(selectedObject);
    box.getCenter(pos);
    pos.y = box.max.y; // Top of the bounding box
    
    pos.project(camera);
    
    if (pos.z > 1) { // Behind camera
        floatingToolbar.classList.add('hidden');
        return;
    }
    
    const x = (pos.x * .5 + .5) * window.innerWidth;
    const y = (pos.y * -.5 + .5) * window.innerHeight;
    
    floatingToolbar.style.left = `${x}px`;
    floatingToolbar.style.top = `${y}px`;
    floatingToolbar.classList.remove('hidden');
}

floatRotateBtn?.addEventListener('click', () => {
    rotateSelected();
});

floatDuplicateBtn?.addEventListener('click', async () => {
    playSound('click');
    if (!selectedObject || isDraggingFurniture) return;
    const type = selectedObject.userData.type;
    if (!type) return;
    
    // Clone the object directly to preserve exact state
    const furniture = selectedObject.clone();
    
    // Deep clone materials so changing color on duplicate doesn't affect original
    furniture.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
            child.material = child.material.clone();
        }
    });

    furniture.userData.id = Math.random().toString(36).substr(2, 9);
    const count = allFurniture.filter(o => o.userData.type === type).length + 1;
    const properName = type.charAt(0).toUpperCase() + type.slice(1);
    furniture.userData.name = `${properName} ${count}`;

    const cmd = new SpawnCommand(
        furniture, scene, draggableObjects,
        (obj) => { 
            if (!allFurniture.includes(obj)) allFurniture.push(obj);
            updateLayersUI();
        },
        (obj) => {
            const idx = allFurniture.indexOf(obj);
            if (idx > -1) allFurniture.splice(idx, 1);
            if (selectedObject === obj) deselectObject();
            updateLayersUI();
        }
    );
    history.execute(cmd);
    selectObject(furniture);
});

const uploadTvBtn = document.getElementById('upload-tv-btn');
const tvFileInput = document.getElementById('tv-file-input') as HTMLInputElement;

uploadTvBtn?.addEventListener('click', () => {
  tvFileInput?.click();
});

tvFileInput?.addEventListener('change', (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file || !selectedObject) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string;
    downscaleImage(dataUrl).then(scaledUrl => {
      if (selectedObject) selectedObject.userData.customImageData = scaledUrl;
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(scaledUrl, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        selectedObject!.traverse((child) => {
          if (child instanceof THREE.Mesh && child.userData.isCustomImage) {
             child.material = new THREE.MeshStandardMaterial({
               map: texture,
               roughness: 0.2,
               metalness: 0.1,
               emissive: 0xffffff,
               emissiveMap: texture,
               emissiveIntensity: parseFloat(intensitySlider.value) / 50
             });
          }
        });
      });
    });
  };
  reader.readAsDataURL(file);
  
  // Clear the value so the same file can be uploaded again for different objects
  (event.target as HTMLInputElement).value = '';
});

document.querySelectorAll('.spawn-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    playSound('click');
    const type = (e.currentTarget as HTMLElement).dataset.type;
    if (type) {
      spawnNewFurniture(type, controls.target.x, controls.target.z);
    }
  });
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  ssaoPass.setSize(window.innerWidth, window.innerHeight);
});

// --- RENDER LOOP ---
// EXPLOSION PHYSICS
interface PhysicsBody {
  velocity: THREE.Vector3;
  angularVelocity: THREE.Euler;
  particleGroup: THREE.Group;
  settled: boolean;
}
const physicsBodies = new Map<THREE.Object3D, PhysicsBody>();
let isExploding = false;
let preExplosionState: Array<{
  object: THREE.Object3D;
  oldPosition: THREE.Vector3;
  oldRotation: THREE.Euler;
  newPosition: THREE.Vector3;
  newRotation: THREE.Euler;
}> = [];

function explodeScene() {
    if (isExploding || allFurniture.length === 0) return;
    playSound('explosion');
    isExploding = true;
    preExplosionState = [];
    deselectObject();
    
    // Create shared materials for particles
    const fireMat = new THREE.MeshStandardMaterial({color: 0xff4500, emissive: 0xff8c00, emissiveIntensity: 2});
    const smokeMat = new THREE.MeshStandardMaterial({color: 0x222222, transparent: true, opacity: 0.8});
    
    allFurniture.forEach(obj => {
        // Save state
        preExplosionState.push({
            object: obj,
            oldPosition: obj.position.clone(),
            oldRotation: obj.rotation.clone(),
            newPosition: new THREE.Vector3(),
            newRotation: new THREE.Euler()
        });
        
        // Setup physics
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 15,
            Math.random() * 15 + 10,
            (Math.random() - 0.5) * 15
        );
        const angularVelocity = new THREE.Euler(
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5
        );
        
        // Attach particles
        const particleGroup = new THREE.Group();
        for(let i=0; i<10; i++) {
            const isSmoke = Math.random() > 0.5;
            const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), isSmoke ? smokeMat : fireMat);
            p.position.set((Math.random()-0.5)*2, (Math.random()-0.5)*2, (Math.random()-0.5)*2);
            p.userData = { 
                speed: Math.random() * 0.05 + 0.02, 
                life: Math.random() * 100, 
                maxLife: 100 
            };
            particleGroup.add(p);
        }
        obj.add(particleGroup);
        
        physicsBodies.set(obj, { velocity, angularVelocity, particleGroup, settled: false });
    });
}

const explodeBtn = document.getElementById('explode-btn');
explodeBtn?.addEventListener('click', explodeScene);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);
  
  // Physics simulation
  if (isExploding) {
      let allSettled = true;
      physicsBodies.forEach((body, obj) => {
          if (!body.settled) {
              allSettled = false;
              
              // Gravity
              body.velocity.y -= 30 * delta;
              
              // Move
              obj.position.addScaledVector(body.velocity, delta);
              
              // Rotate
              obj.rotation.x += body.angularVelocity.x;
              obj.rotation.y += body.angularVelocity.y;
              obj.rotation.z += body.angularVelocity.z;
              
              // Bounce on floor
              const floorY = 0.5; // Rough estimate to avoid clipping too much
              if (obj.position.y < floorY) {
                  obj.position.y = floorY;
                  body.velocity.y *= -0.5; // Bounce
                  body.velocity.x *= 0.8; // Friction
                  body.velocity.z *= 0.8;
                  body.angularVelocity.x *= 0.8;
                  body.angularVelocity.y *= 0.8;
                  body.angularVelocity.z *= 0.8;
                  
                  if (body.velocity.lengthSq() < 0.1) {
                      body.settled = true;
                  }
              }
          }
          
          // Animate particles
          if (body.particleGroup) {
              body.particleGroup.children.forEach((p: any) => {
                  p.position.y += p.userData.speed;
                  p.rotation.x += p.userData.speed;
                  p.rotation.y += p.userData.speed;
                  p.scale.multiplyScalar(0.98);
                  p.userData.life--;
                  if (p.userData.life <= 0) {
                      p.position.set((Math.random()-0.5)*2, (Math.random()-0.5)*2, (Math.random()-0.5)*2);
                      p.scale.set(1,1,1);
                      p.userData.life = p.userData.maxLife;
                  }
              });
          }
      });
      
      if (allSettled) {
          isExploding = false;
          // Capture end state and create undo command
          preExplosionState.forEach(state => {
              state.newPosition.copy(state.object.position);
              state.newRotation.copy(state.object.rotation);
              const pb = physicsBodies.get(state.object);
              if (pb && pb.particleGroup) {
                  state.object.remove(pb.particleGroup);
              }
          });
          physicsBodies.clear();
          const cmd = new MultiTransformCommand(preExplosionState, () => updateLayersUI());
          cmd.execute(); // doesn't do much since they are already there, but triggers UI
          history.addCommand(cmd);
          preExplosionState = [];
      }
  }

  controls.update(); // Required for damping
  updateFloatingToolbar();
  composer.render();
}

animate();

// --- SAVE & LOAD SYSTEM ---
interface SavedDesign {
  id: string;
  name: string;
  timestamp: number;
  environment: { floorColor: string; wallColor: string; };
  furniture: Array<{
    id: string; type: string; name: string; locked: boolean;
    position: { x: number, y: number, z: number };
    rotation: { x: number, y: number, z: number };
    scale: { x: number, y: number, z: number };
    color: string | null; intensity: number | null; customImage: string | null;
  }>;
}

function downscaleImage(dataUrl: string, maxWidth: number = 800): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.width <= maxWidth) { resolve(dataUrl); return; }
      const canvas = document.createElement('canvas');
      const scale = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
         ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
         resolve(canvas.toDataURL('image/jpeg', 0.8));
      } else {
         resolve(dataUrl);
      }
    };
    img.src = dataUrl;
  });
}

const saveBtn = document.getElementById('save-design-btn') as HTMLButtonElement;
const loadBtn = document.getElementById('load-design-btn') as HTMLButtonElement;
const designNameInput = document.getElementById('design-name-input') as HTMLInputElement;
const loadModal = document.getElementById('load-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const savedDesignsList = document.getElementById('saved-designs-list');

async function saveCurrentDesign() {
  const name = designNameInput.value.trim() || 'Untitled Design';
  const design: SavedDesign = {
    id: Math.random().toString(36).substr(2, 9),
    name: name,
    timestamp: Date.now(),
    environment: {
      floorColor: '#' + floorMat.color.getHexString(),
      wallColor: '#' + wallMat.color.getHexString()
    },
    furniture: []
  };

  for (const obj of allFurniture) {
    let color: string | null = null;
    let intensity: number | null = null;
    let customImage: string | null = obj.userData.customImageData || null;

    obj.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
         if (!child.userData.isCustomImage && !color) {
            color = '#' + child.material.color.getHexString();
         }
      }
      if (child instanceof THREE.Light && child.userData.isLampLight) {
         intensity = child.intensity;
      }
      if (child instanceof THREE.Mesh && child.userData.isCustomImage) {
         const mat = child.material as THREE.MeshStandardMaterial;
         if (mat.emissiveIntensity !== undefined && !intensity) {
             intensity = mat.emissiveIntensity * 50;
         }
      }
    });

    design.furniture.push({
      id: obj.userData.id, type: obj.userData.type, name: obj.userData.name, locked: obj.userData.locked,
      position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
      rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
      scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
      color, intensity, customImage
    });
  }

  const saved = JSON.parse(localStorage.getItem('digital_room_designs') || '[]');
  saved.push(design);
  
  try {
    localStorage.setItem('digital_room_designs', JSON.stringify(saved));
    const oldText = saveBtn.innerText;
    saveBtn.innerText = 'Saved!';
    saveBtn.style.backgroundColor = '#10b981';
    setTimeout(() => { saveBtn.innerText = oldText; saveBtn.style.backgroundColor = ''; }, 2000);
    designNameInput.value = '';
  } catch (e) {
    alert('Failed to save design. LocalStorage might be full due to large images.');
  }
}

function openLoadModal() {
  if (!loadModal || !savedDesignsList) return;
  savedDesignsList.innerHTML = '';
  const saved = JSON.parse(localStorage.getItem('digital_room_designs') || '[]');
  
  if (saved.length === 0) {
     savedDesignsList.innerHTML = '<li style="padding: 12px; color: var(--text-secondary); text-align: center;">No saved designs found.</li>';
  } else {
     saved.forEach((design: SavedDesign, index: number) => {
        const li = document.createElement('li');
        li.className = 'design-item';
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'design-info';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'design-name';
        nameSpan.innerText = design.name;
        
        const dateSpan = document.createElement('span');
        dateSpan.className = 'design-date';
        dateSpan.innerText = new Date(design.timestamp).toLocaleString();
        
        infoDiv.appendChild(nameSpan);
        infoDiv.appendChild(dateSpan);
        infoDiv.addEventListener('click', () => {
           loadDesign(design).then(() => {
               loadModal.classList.add('hidden');
               const startScreen = document.getElementById('start-screen');
               if (startScreen && !startScreen.classList.contains('hidden')) {
                   startScreen.classList.add('hidden');
                   const editorUi = document.getElementById('editor-ui');
                   if (editorUi) editorUi.style.display = 'flex';
               }
           });
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-design-btn';
        deleteBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
        deleteBtn.addEventListener('click', (e) => {
           e.stopPropagation();
           saved.splice(index, 1);
           localStorage.setItem('digital_room_designs', JSON.stringify(saved));
           openLoadModal(); // refresh
        });
        
        li.appendChild(infoDiv);
        li.appendChild(deleteBtn);
        savedDesignsList.appendChild(li);
     });
  }
  loadModal.classList.remove('hidden');
}

closeModalBtn?.addEventListener('click', () => { loadModal?.classList.add('hidden'); });

async function loadDesign(design: SavedDesign) {
  deselectObject();
  
  [...allFurniture].forEach(obj => scene.remove(obj));
  allFurniture.length = 0;
  draggableObjects.length = 0;
  history.clear();
  
  if (design.environment) {
     if (floorColorInput) floorColorInput.value = design.environment.floorColor;
     if (wallColorInput) wallColorInput.value = design.environment.wallColor;
     floorMat.color.set(design.environment.floorColor);
     (gridHelper.material as THREE.LineBasicMaterial).color.set(design.environment.floorColor);
     wallMat.color.set(design.environment.wallColor);
  }

  for (const item of design.furniture) {
     try {
       const furniture = await FurnitureDatabase.spawn(item.type);
       furniture.position.set(item.position.x, item.position.y, item.position.z);
       furniture.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
       furniture.scale.set(item.scale.x, item.scale.y, item.scale.z);
       furniture.userData.id = item.id;
       furniture.userData.name = item.name;
       furniture.userData.type = item.type;
       furniture.userData.locked = item.locked;
       furniture.userData.originalY = item.position.y;
       furniture.userData.customImageData = item.customImage;
       
       if (item.customImage) {
          const textureLoader = new THREE.TextureLoader();
          textureLoader.load(item.customImage, (texture) => {
             texture.colorSpace = THREE.SRGBColorSpace;
             furniture.traverse((child) => {
               if (child instanceof THREE.Mesh && child.userData.isCustomImage) {
                  child.material = new THREE.MeshStandardMaterial({
                    map: texture, roughness: 0.2, metalness: 0.1,
                    emissive: 0xffffff, emissiveMap: texture,
                    emissiveIntensity: (item.intensity || 50) / 50
                  });
               }
             });
          });
       }

       furniture.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            if (!child.userData.isCustomImage && item.color) {
               child.material.color.set(item.color);
               if (child.material.emissive && child.material.emissiveIntensity > 0) {
                   child.material.emissive.set(item.color);
               }
            }
          }
          if (child instanceof THREE.Light && child.userData.isLampLight && item.intensity !== null) {
              child.intensity = item.intensity;
          }
       });
       
       scene.add(furniture);
       allFurniture.push(furniture);
       if (!item.locked) draggableObjects.push(furniture);
       
     } catch (e) {
       console.error('Failed to spawn saved item:', item.type, e);
     }
  }
  updateLayersUI();
}

saveBtn?.addEventListener('click', saveCurrentDesign);
loadBtn?.addEventListener('click', openLoadModal);

// --- START SCREEN & PRESETS ---
const BUILT_IN_PRESETS = [
  {
    id: 'preset-1',
    name: '現代極簡風',
    description: '乾淨的線條，中性的色彩與實用的家具。',
    design: {
      id: 'modern-min',
      name: 'Modern Minimalist',
      timestamp: Date.now(),
      environment: { floorColor: '#e2e8f0', wallColor: '#f8fafc' },
      furniture: [
        { id: '1', type: 'sofa', name: 'Sofa', locked: false, position: {x: 0, y: 0, z: -2}, rotation: {x: 0, y: 0, z: 0}, scale: {x: 1, y: 1, z: 1}, color: '#94a3b8', intensity: null, customImage: null },
        { id: '2', type: 'table', name: 'Coffee Table', locked: false, position: {x: 0, y: 0, z: 1}, rotation: {x: 0, y: 0, z: 0}, scale: {x: 1, y: 1, z: 1}, color: '#f1f5f9', intensity: null, customImage: null },
        { id: '3', type: 'tv', name: 'TV', locked: false, position: {x: 0, y: 3, z: -9.8}, rotation: {x: 0, y: 0, z: 0}, scale: {x: 1.5, y: 1.5, z: 1.5}, color: '#334155', intensity: 0, customImage: null },
        { id: '4', type: 'plant', name: 'Plant 1', locked: false, position: {x: -8, y: 0, z: -8}, rotation: {x: 0, y: 0, z: 0}, scale: {x: 1.5, y: 1.5, z: 1.5}, color: null, intensity: null, customImage: null },
        { id: '5', type: 'rug', name: 'Rug', locked: false, position: {x: 0, y: 0, z: 0}, rotation: {x: 0, y: 0, z: 0}, scale: {x: 1.5, y: 1, z: 1.5}, color: '#cbd5e1', intensity: null, customImage: null },
        { id: '6', type: 'lamp', name: 'Floor Lamp', locked: false, position: {x: -8, y: 0, z: -2}, rotation: {x: 0, y: 0, z: 0}, scale: {x: 1, y: 1, z: 1}, color: null, intensity: 40, customImage: null },
        { id: '7', type: 'painting', name: 'Painting', locked: false, position: {x: -9.8, y: 5, z: -4.5}, rotation: {x: 0, y: Math.PI / 2, z: 0}, scale: {x: 1.5, y: 1.5, z: 1}, color: '#64748b', intensity: null, customImage: null },
        { id: '8', type: 'chair', name: 'Chair', locked: false, position: {x: 3, y: 0, z: 1}, rotation: {x: 0, y: -Math.PI/4, z: 0}, scale: {x: 1, y: 1, z: 1}, color: '#475569', intensity: null, customImage: null }
      ]
    }
  },
  {
    id: 'preset-2',
    name: '溫馨木質風',
    description: '溫暖的色調，木質紋理與舒適的氛圍。',
    design: {
      id: 'cozy-wood',
      name: 'Cozy Wood',
      timestamp: Date.now(),
      environment: { floorColor: '#8b5a2b', wallColor: '#fef3c7' },
      furniture: [
        { id: '1', type: 'bed', name: 'Bed', locked: false, position: {x: -4, y: 0, z: -4}, rotation: {x: 0, y: Math.PI/2, z: 0}, scale: {x: 1, y: 1, z: 1}, color: '#fbbf24', intensity: null, customImage: null },
        { id: '2', type: 'bookshelf', name: 'Bookshelf 1', locked: false, position: {x: 3, y: 0, z: -9.5}, rotation: {x: 0, y: 0, z: 0}, scale: {x: 1, y: 1, z: 1}, color: '#78350f', intensity: null, customImage: null },
        { id: '2b', type: 'bookshelf', name: 'Bookshelf 2', locked: false, position: {x: 5.5, y: 0, z: -9.5}, rotation: {x: 0, y: 0, z: 0}, scale: {x: 1, y: 1, z: 1}, color: '#78350f', intensity: null, customImage: null },
        { id: '3', type: 'rug', name: 'Rug', locked: false, position: {x: -2, y: 0, z: 1}, rotation: {x: 0, y: 0, z: 0}, scale: {x: 1.2, y: 1, z: 1.2}, color: '#d97706', intensity: null, customImage: null },
        { id: '4', type: 'lamp', name: 'Lamp', locked: false, position: {x: -8, y: 0, z: 2}, rotation: {x: 0, y: 0, z: 0}, scale: {x: 1, y: 1, z: 1}, color: null, intensity: 60, customImage: null },
        { id: '5', type: 'desk', name: 'Desk', locked: false, position: {x: 4, y: 0, z: 3}, rotation: {x: 0, y: -Math.PI/2, z: 0}, scale: {x: 1, y: 1, z: 1}, color: '#92400e', intensity: null, customImage: null },
        { id: '6', type: 'chair', name: 'Chair', locked: false, position: {x: 2.5, y: 0, z: 3}, rotation: {x: 0, y: Math.PI/2, z: 0}, scale: {x: 1, y: 1, z: 1}, color: '#b45309', intensity: null, customImage: null },
        { id: '7', type: 'plantGroup', name: 'Planter', locked: false, position: {x: -8, y: 0, z: -9.5}, rotation: {x: 0, y: 0, z: 0}, scale: {x: 1, y: 1, z: 1}, color: null, intensity: null, customImage: null },
        { id: '8', type: 'painting', name: 'Painting', locked: false, position: {x: -9.8, y: 5, z: -2}, rotation: {x: 0, y: Math.PI / 2, z: 0}, scale: {x: 1.2, y: 1.2, z: 1}, color: '#f59e0b', intensity: null, customImage: null }
      ]
    }
  },
  {
    id: 'preset-3',
    name: '賽博龐克霓虹',
    description: '暗系環境搭配霓虹發光色彩。',
    design: {
      id: 'cyberpunk',
      name: 'Cyberpunk Neon',
      timestamp: Date.now(),
      environment: { floorColor: '#0f172a', wallColor: '#020617' },
      furniture: [
        { id: '1', type: 'desk', name: 'Desk', locked: false, position: {x: 0, y: 0, z: -4}, rotation: {x: 0, y: 0, z: 0}, scale: {x: 1.2, y: 1, z: 1}, color: '#1e293b', intensity: null, customImage: null },
        { id: '2', type: 'chair', name: 'Chair', locked: false, position: {x: 0, y: 0, z: -2}, rotation: {x: 0, y: 0, z: 0}, scale: {x: 1, y: 1, z: 1}, color: '#ec4899', intensity: null, customImage: null },
        { id: '3', type: 'lamp', name: 'Lamp Cyan', locked: false, position: {x: -3, y: 0, z: -8}, rotation: {x: 0, y: 0, z: 0}, scale: {x: 1, y: 1, z: 1}, color: '#06b6d4', intensity: 150, customImage: null },
        { id: '4', type: 'lamp', name: 'Lamp Purple', locked: false, position: {x: 3, y: 0, z: -8}, rotation: {x: 0, y: 0, z: 0}, scale: {x: 1, y: 1, z: 1}, color: '#a855f7', intensity: 150, customImage: null },
        { id: '5', type: 'tv', name: 'Main Screen', locked: false, position: {x: 0, y: 4, z: -9.8}, rotation: {x: 0, y: 0, z: 0}, scale: {x: 1.2, y: 1.2, z: 1.2}, color: '#000000', intensity: 200, customImage: null },
        { id: '6', type: 'tv', name: 'Side Screen', locked: false, position: {x: -9.8, y: 4, z: -2.5}, rotation: {x: 0, y: Math.PI / 2, z: 0}, scale: {x: 1, y: 1, z: 1}, color: '#000000', intensity: 150, customImage: null },
        { id: '7', type: 'tv', name: 'Side Screen 2', locked: false, position: {x: -9.8, y: 4, z: 2.5}, rotation: {x: 0, y: Math.PI / 2, z: 0}, scale: {x: 1, y: 1, z: 1}, color: '#000000', intensity: 150, customImage: null },
        { id: '8', type: 'bed', name: 'Bed', locked: false, position: {x: 6, y: 0, z: 4}, rotation: {x: 0, y: -Math.PI/2, z: 0}, scale: {x: 1, y: 1, z: 1}, color: '#334155', intensity: null, customImage: null },
        { id: '9', type: 'rug', name: 'Neon Rug', locked: false, position: {x: 0, y: 0, z: -2}, rotation: {x: 0, y: 0, z: 0}, scale: {x: 1, y: 1, z: 1}, color: '#e11d48', intensity: null, customImage: null },
        { id: '10', type: 'cabinet', name: 'Server Rack', locked: false, position: {x: -9.5, y: 0, z: 6}, rotation: {x: 0, y: Math.PI/2, z: 0}, scale: {x: 1, y: 1.5, z: 1}, color: '#0f172a', intensity: null, customImage: null },
        { id: '11', type: 'lamp', name: 'Lamp Red', locked: false, position: {x: -8, y: 0, z: 8}, rotation: {x: 0, y: 0, z: 0}, scale: {x: 1, y: 1, z: 1}, color: '#ef4444', intensity: 100, customImage: null }
      ]
    }
  }
];

const startScreen = document.getElementById('start-screen');
const editorUi = document.getElementById('editor-ui');
const startBlankBtn = document.getElementById('start-blank-btn');
const startPresetsBtn = document.getElementById('start-presets-btn');
const startLoadBtn = document.getElementById('start-load-btn');
const startSettingsBtn = document.getElementById('start-settings-btn');
const presetsModal = document.getElementById('presets-modal');
const closePresetsBtn = document.getElementById('close-presets-btn');
const presetsGrid = document.getElementById('presets-grid');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const toggleSsao = document.getElementById('toggle-ssao') as HTMLInputElement;
const toggleShadows = document.getElementById('toggle-shadows') as HTMLInputElement;

function startGame() {
  startScreen?.classList.add('hidden');
  if (editorUi) editorUi.style.display = 'flex';
}

startBlankBtn?.addEventListener('click', () => {
  [...allFurniture].forEach(obj => scene.remove(obj));
  allFurniture.length = 0;
  draggableObjects.length = 0;
  history.clear();
  
  // Default dark mode colors
  if (floorColorInput) floorColorInput.value = '#1e293b';
  if (wallColorInput) wallColorInput.value = '#334155';
  floorMat.color.set('#1e293b');
  (gridHelper.material as THREE.LineBasicMaterial).color.set('#1e293b');
  wallMat.color.set('#334155');

  startGame();
});

startPresetsBtn?.addEventListener('click', () => {
  if (!presetsGrid) return;
  presetsGrid.innerHTML = '';
  
  BUILT_IN_PRESETS.forEach(preset => {
    const card = document.createElement('div');
    card.className = 'preset-card';
    card.innerHTML = `
      <div class="preset-title">${preset.name}</div>
      <div class="preset-desc">${preset.description}</div>
    `;
    card.addEventListener('click', () => {
      loadDesign(preset.design as any).then(() => {
        presetsModal?.classList.add('hidden');
        startGame();
      });
    });
    presetsGrid.appendChild(card);
  });
  
  presetsModal?.classList.remove('hidden');
});

closePresetsBtn?.addEventListener('click', () => presetsModal?.classList.add('hidden'));

startLoadBtn?.addEventListener('click', () => {
  openLoadModal();
});

startSettingsBtn?.addEventListener('click', () => settingsModal?.classList.remove('hidden'));
closeSettingsBtn?.addEventListener('click', () => settingsModal?.classList.add('hidden'));

const editorSettingsBtn = document.getElementById('editor-settings-btn');
editorSettingsBtn?.addEventListener('click', () => settingsModal?.classList.remove('hidden'));

toggleSsao?.addEventListener('change', (e) => {
  const enabled = (e.target as HTMLInputElement).checked;
  if (enabled) {
    if (!composer.passes.includes(ssaoPass)) {
        // Find output pass index and insert before it
        const idx = composer.passes.indexOf(outputPass);
        composer.insertPass(ssaoPass, idx > -1 ? idx : composer.passes.length);
    }
  } else {
    composer.removePass(ssaoPass);
  }
});

toggleShadows?.addEventListener('change', (e) => {
  const enabled = (e.target as HTMLInputElement).checked;
  renderer.shadowMap.enabled = enabled;
  scene.traverse(child => {
    if (child instanceof THREE.Light) {
       child.castShadow = enabled;
    }
    if (child instanceof THREE.Mesh) {
       child.receiveShadow = enabled;
       child.castShadow = enabled;
       if (child.material) {
           child.material.needsUpdate = true;
       }
    }
});
  dirLight.castShadow = enabled;
});

const toggleRetroUi = document.getElementById('toggle-retro-ui') as HTMLInputElement;
toggleRetroUi?.addEventListener('change', (e) => {
  const enabled = (e.target as HTMLInputElement).checked;
  if (enabled) {
    document.body.classList.add('theme-retro');
  } else {
    document.body.classList.remove('theme-retro');
  }
  applyThemeColor(uiColorInput.value);
});

const backStartBtn = document.getElementById('back-start-btn');
backStartBtn?.addEventListener('click', () => {
    if (editorUi) editorUi.style.display = 'none';
    if (startScreen) startScreen.classList.remove('hidden');
});

const helpModal = document.getElementById('help-modal');
const editorHelpBtn = document.getElementById('editor-help-btn');
const closeHelpBtn = document.getElementById('close-help-btn');

editorHelpBtn?.addEventListener('click', () => helpModal?.classList.remove('hidden'));
closeHelpBtn?.addEventListener('click', () => helpModal?.classList.add('hidden'));

const textColorInput = document.getElementById('text-color-input') as HTMLInputElement;
textColorInput?.addEventListener('input', (e) => {
    document.body.style.setProperty('--text-primary', (e.target as HTMLInputElement).value);
});

const textSizeInput = document.getElementById('text-size-input') as HTMLInputElement;
textSizeInput?.addEventListener('input', (e) => {
    document.documentElement.style.fontSize = `${(e.target as HTMLInputElement).value}px`;
});

