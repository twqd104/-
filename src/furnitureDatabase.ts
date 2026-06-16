import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export interface FurnitureDef {
  id: string;
  name: string;
  modelUrl: string;
  originalY: number;
  generateFallback: () => THREE.Object3D;
}

function createMat(colorHex: number, roughness = 0.4) {
  return new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: roughness,
    metalness: 0.1,
  });
}

export const FurnitureCatalog: Record<string, FurnitureDef> = {
  sofa: {
    id: 'sofa', name: 'Sofa', modelUrl: '/models/sofa.glb', originalY: 0,
    generateFallback: () => {
      const group = new THREE.Group();
      const baseMat = createMat(0x3b82f6);
      const base = new THREE.Mesh(new RoundedBoxGeometry(4, 1, 2, 4, 0.2), baseMat);
      base.position.y = 0.5; base.castShadow = true; base.receiveShadow = true;
      const back = new THREE.Mesh(new RoundedBoxGeometry(4, 1.5, 0.5, 4, 0.2), baseMat);
      back.position.set(0, 1.75, -0.75); back.castShadow = true; back.receiveShadow = true;
      group.add(base, back); return group;
    }
  },
  table: {
    id: 'table', name: 'Coffee Table', modelUrl: '/models/table.glb', originalY: 0,
    generateFallback: () => {
      const group = new THREE.Group();
      const topMat = createMat(0xe2e8f0);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.2, 32), topMat);
      top.position.y = 1.1; top.castShadow = true; top.receiveShadow = true;
      const legMat = createMat(0x94a3b8);
      const legGeom = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
      [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].forEach(pos => {
        const leg = new THREE.Mesh(legGeom, legMat);
        leg.position.set(pos[0], 0.5, pos[1]); leg.castShadow = true;
        group.add(leg);
      });
      group.add(top); return group;
    }
  },
  plant: {
    id: 'plant', name: 'Potted Plant', modelUrl: '/models/plant.glb', originalY: 0,
    generateFallback: () => {
      const group = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.4, 1, 16), createMat(0x64748b));
      pot.position.y = 0.5; pot.castShadow = true;
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), createMat(0x10b981));
      leaves.position.y = 1.5; leaves.castShadow = true;
      group.add(pot, leaves); return group;
    }
  },
  tv: {
    id: 'tv', name: 'TV & Stand', modelUrl: '/models/tv.glb', originalY: 0,
    generateFallback: () => {
      const group = new THREE.Group();
      const stand = new THREE.Mesh(new RoundedBoxGeometry(5, 1, 1.5, 4, 0.1), createMat(0xf8fafc));
      stand.position.y = 0.5; stand.castShadow = true; stand.receiveShadow = true;
      
      // TV Base/Frame
      const tvBody = new THREE.Mesh(new RoundedBoxGeometry(4, 2.5, 0.2, 4, 0.05), createMat(0x1e293b));
      tvBody.position.set(0, 2.25, 0); tvBody.castShadow = true;
      
      // Screen itself (Needs a specific name to target for custom textures)
      const screenGeom = new THREE.PlaneGeometry(3.8, 2.3);
      const screenMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1, metalness: 0.8 });
      const screen = new THREE.Mesh(screenGeom, screenMat);
      screen.position.set(0, 2.25, 0.11); // Slightly in front of the TV body
      screen.userData.isCustomImage = true; // Tag it!
      
      group.add(stand, tvBody, screen); 
      return group;
    }
  },
  bed: {
    id: 'bed', name: 'Bed', modelUrl: '/models/bed.glb', originalY: 0,
    generateFallback: () => {
      const group = new THREE.Group();
      const frame = new THREE.Mesh(new RoundedBoxGeometry(4.5, 0.6, 6, 4, 0.1), createMat(0x8B5A2B)); // Wood color
      frame.position.y = 0.3; frame.castShadow = true; frame.receiveShadow = true;
      const mattress = new THREE.Mesh(new RoundedBoxGeometry(4, 0.8, 5.5, 4, 0.2), createMat(0xffffff));
      mattress.position.y = 1; mattress.castShadow = true; mattress.receiveShadow = true;
      const pillow = new THREE.Mesh(new RoundedBoxGeometry(2.5, 0.3, 1, 4, 0.1), createMat(0xf1f5f9));
      pillow.position.set(0, 1.5, -2); pillow.castShadow = true;
      group.add(frame, mattress, pillow);
      return group;
    }
  },
  bookshelf: {
    id: 'bookshelf', name: 'Bookshelf', modelUrl: '/models/bookshelf.glb', originalY: 0,
    generateFallback: () => {
      const group = new THREE.Group();
      const woodMat = createMat(0x654321);
      const mainFrame = new THREE.Mesh(new RoundedBoxGeometry(3, 5, 1, 4, 0.05), woodMat);
      mainFrame.position.y = 2.5; mainFrame.castShadow = true; mainFrame.receiveShadow = true;
      group.add(mainFrame);
      return group;
    }
  },
  lamp: {
    id: 'lamp', name: 'Floor Lamp', modelUrl: '/models/lamp.glb', originalY: 0,
    generateFallback: () => {
      const group = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.1, 16), createMat(0x333333));
      base.position.y = 0.05; base.castShadow = true;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4, 8), createMat(0x333333));
      pole.position.y = 2; pole.castShadow = true;
      const shadeMat = new THREE.MeshStandardMaterial({
        color: 0xfffbeb,
        roughness: 0.8,
        emissive: 0xfffbeb,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.9
      });
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.8, 1, 16, 1, true), shadeMat);
      shade.position.y = 4; shade.castShadow = true;
      
      const light = new THREE.PointLight(0xfffbeb, 100, 20);
      light.position.y = 3.8;
      light.castShadow = true;
      // Configure shadow resolution for the point light
      light.shadow.mapSize.width = 512;
      light.shadow.mapSize.height = 512;
      light.userData.isLampLight = true; // Tag for color picker
      
      group.add(base, pole, shade, light);
      return group;
    }
  },
  chair: {
    id: 'chair', name: 'Armchair', modelUrl: '/models/chair.glb', originalY: 0,
    generateFallback: () => {
      const group = new THREE.Group();
      const mat = createMat(0xf43f5e); // Pinkish red
      const seat = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.5, 1.5, 4, 0.1), mat);
      seat.position.y = 0.75; seat.castShadow = true;
      const legMat = createMat(0x94a3b8);
      const legGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8);
      [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].forEach(pos => {
        const leg = new THREE.Mesh(legGeom, legMat);
        leg.position.set(pos[0], 0.25, pos[1]); leg.castShadow = true;
        group.add(leg);
      });
      const back = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.5, 0.3, 4, 0.1), mat);
      back.position.set(0, 1.75, -0.6); back.castShadow = true;
      group.add(seat, back);
      return group;
    }
  },
  desk: {
    id: 'desk', name: 'Computer Desk', modelUrl: '/models/desk.glb', originalY: 0,
    generateFallback: () => {
      const group = new THREE.Group();
      const woodMat = createMat(0xd4a373); // Light wood
      const top = new THREE.Mesh(new RoundedBoxGeometry(4, 0.2, 2.5, 4, 0.05), woodMat);
      top.position.y = 2.4; top.castShadow = true; top.receiveShadow = true;
      
      const legGeom = new THREE.CylinderGeometry(0.1, 0.1, 2.3, 16);
      const legMat = createMat(0x333333); // Metal legs
      [[-1.8, -1.0], [1.8, -1.0], [-1.8, 1.0], [1.8, 1.0]].forEach(pos => {
        const leg = new THREE.Mesh(legGeom, legMat);
        leg.position.set(pos[0], 1.15, pos[1]); leg.castShadow = true;
        group.add(leg);
      });
      group.add(top);
      return group;
    }
  },
  cabinet: {
    id: 'cabinet', name: 'Storage Cabinet', modelUrl: '/models/cabinet.glb', originalY: 0,
    generateFallback: () => {
      const group = new THREE.Group();
      const woodMat = createMat(0x8b5a2b); 
      const body = new THREE.Mesh(new RoundedBoxGeometry(3, 4, 1.5, 4, 0.05), woodMat);
      body.position.y = 2; body.castShadow = true; body.receiveShadow = true;
      
      const handleMat = createMat(0xdddddd);
      const handle1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), handleMat);
      handle1.position.set(-0.2, 2, 0.8);
      const handle2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), handleMat);
      handle2.position.set(0.2, 2, 0.8);
      
      group.add(body, handle1, handle2);
      return group;
    }
  },
  rug: {
    id: 'rug', name: 'Floor Rug', modelUrl: '/models/rug.glb', originalY: 0,
    generateFallback: () => {
      const group = new THREE.Group();
      // Very thin box for rug, originalY slightly above 0 to prevent z-fighting with floor
      const mat = createMat(0xcbd5e1, 0.9); 
      const rugMesh = new THREE.Mesh(new RoundedBoxGeometry(6, 0.05, 8, 4, 0.02), mat);
      rugMesh.position.y = 0.025; 
      rugMesh.receiveShadow = true;
      group.add(rugMesh);
      return group;
    }
  },
  painting: {
    id: 'painting', name: 'Wall Painting', modelUrl: '/models/painting.glb', originalY: 0,
    generateFallback: () => {
      const group = new THREE.Group();
      
      // Frame
      const frameMat = createMat(0x1e293b); 
      const frame = new THREE.Mesh(new RoundedBoxGeometry(3.2, 4.2, 0.1, 4, 0.02), frameMat);
      frame.position.y = 2.1; 
      frame.castShadow = true; 
      
      // Canvas (Where the image goes)
      const canvasGeom = new THREE.PlaneGeometry(3, 4);
      const canvasMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
      const canvas = new THREE.Mesh(canvasGeom, canvasMat);
      canvas.position.set(0, 2.1, 0.06); 
      canvas.userData.isCustomImage = true; // Same as TV screen
      
      group.add(frame, canvas);
      return group;
    }
  },
  flower: {
    id: 'flower', name: 'Flower Pot', modelUrl: '/models/flower.glb', originalY: 0,
    generateFallback: () => {
      const group = new THREE.Group();
      const potMat = createMat(0xe2e8f0);
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.6, 16), potMat);
      pot.position.y = 0.3; pot.castShadow = true;
      
      const stemGeom = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
      const stemMat = createMat(0x22c55e);
      const stem = new THREE.Mesh(stemGeom, stemMat);
      stem.position.y = 1.0; stem.castShadow = true;
      
      const petalMat = createMat(0xec4899); // Pink
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), createMat(0xfacc15));
      center.position.y = 1.5; center.castShadow = true;
      group.add(pot, stem, center);
      
      // Petals
      for (let i = 0; i < 6; i++) {
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), petalMat);
        const angle = (i / 6) * Math.PI * 2;
        petal.position.set(Math.cos(angle) * 0.3, 1.5, Math.sin(angle) * 0.3);
        petal.castShadow = true;
        group.add(petal);
      }
      return group;
    }
  },
  vine: {
    id: 'vine', name: 'Hanging Vine', modelUrl: '/models/vine.glb', originalY: 0,
    generateFallback: () => {
      const group = new THREE.Group();
      const potMat = createMat(0xf97316); // Terracotta
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.6, 16), potMat);
      pot.position.y = 0.3; pot.castShadow = true;
      group.add(pot);
      
      const leafMat = createMat(0x15803d);
      // Trailing vines
      for (let v = 0; v < 4; v++) {
        const vx = Math.cos((v/4)*Math.PI*2) * 0.4;
        const vz = Math.sin((v/4)*Math.PI*2) * 0.4;
        for (let l = 0; l < 5; l++) {
          const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), leafMat);
          leaf.position.set(vx + (Math.random()*0.2-0.1), 0.5 - l*0.3, vz + (Math.random()*0.2-0.1));
          leaf.castShadow = true;
          group.add(leaf);
        }
      }
      return group;
    }
  },
  plantGroup: {
    id: 'plantGroup', name: 'Planter Box', modelUrl: '/models/plantgroup.glb', originalY: 0,
    generateFallback: () => {
      const group = new THREE.Group();
      const boxMat = createMat(0x334155);
      const box = new THREE.Mesh(new RoundedBoxGeometry(4, 0.8, 1.5, 4, 0.1), boxMat);
      box.position.y = 0.4; box.castShadow = true;
      group.add(box);
      
      const plantMat = createMat(0x16a34a);
      for(let p=0; p<3; p++) {
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16), plantMat);
        bush.position.set(-1.2 + p*1.2, 1.0, 0);
        bush.castShadow = true;
        group.add(bush);
      }
      return group;
    }
  },
  succulent: {
    id: 'succulent', name: 'Succulent', modelUrl: '/models/succulent.glb', originalY: 0,
    generateFallback: () => {
      const group = new THREE.Group();
      const potMat = createMat(0xffffff);
      const pot = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), potMat);
      pot.position.y = 0.3; pot.castShadow = true;
      group.add(pot);
      
      const leafMat = createMat(0x10b981);
      // Spiky succulent leaves
      for(let i=0; i<8; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.8, 8), leafMat);
        const angle = (i/8)*Math.PI*2;
        leaf.position.set(Math.cos(angle)*0.2, 0.7, Math.sin(angle)*0.2);
        leaf.rotation.x = Math.sin(angle)*0.5;
        leaf.rotation.z = -Math.cos(angle)*0.5;
        leaf.castShadow = true;
        group.add(leaf);
      }
      return group;
    }
  },
  tree: {
    id: 'tree', name: 'Indoor Tree', modelUrl: '/models/tree.glb', originalY: 0,
    generateFallback: () => {
      const group = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.8, 1.5, 16), createMat(0x475569));
      pot.position.y = 0.75; pot.castShadow = true;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 4, 8), createMat(0x78350f));
      trunk.position.y = 3.5; trunk.castShadow = true;
      const leafMat = createMat(0x15803d);
      const canopy1 = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 16), leafMat);
      canopy1.position.set(0, 5.5, 0); canopy1.castShadow = true;
      const canopy2 = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 16), leafMat);
      canopy2.position.set(1, 4.5, 1); canopy2.castShadow = true;
      const canopy3 = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 16), leafMat);
      canopy3.position.set(-1, 5, -0.5); canopy3.castShadow = true;
      group.add(pot, trunk, canopy1, canopy2, canopy3);
      return group;
    }
  },
  ceilingLamp: {
    id: 'ceilingLamp', name: 'Ceiling Lamp', modelUrl: '/models/ceilingLamp.glb', originalY: 9.8,
    generateFallback: () => {
      const group = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 16), createMat(0x94a3b8));
      base.position.y = 0;
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2, 8), createMat(0x334155));
      wire.position.y = -1;
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.2, 0.8, 16, 1, true), createMat(0x1e293b));
      shade.position.y = -2;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshStandardMaterial({color: 0xffffff, emissive: 0xffe4b5, emissiveIntensity: 2}));
      bulb.position.y = -2.1;
      const light = new THREE.PointLight(0xffe4b5, 200, 20);
      light.position.y = -2.1;
      light.castShadow = true;
      light.userData.isLampLight = true;
      group.add(base, wire, shade, bulb, light);
      return group;
    }
  },
  neonSign: {
    id: 'neonSign', name: 'Neon Sign', modelUrl: '/models/neon.glb', originalY: 5,
    generateFallback: () => {
      const group = new THREE.Group();
      const tubeGeom = new THREE.TorusKnotGeometry(1.5, 0.1, 64, 8);
      const tubeMat = new THREE.MeshStandardMaterial({color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 3});
      const tube = new THREE.Mesh(tubeGeom, tubeMat);
      tube.rotation.x = Math.PI / 2;
      const light = new THREE.PointLight(0xff00ff, 150, 15);
      light.position.z = 0.5;
      light.userData.isLampLight = true;
      group.add(tube, light);
      return group;
    }
  },
  deskLamp: {
    id: 'deskLamp', name: 'Desk Lamp', modelUrl: '/models/deskLamp.glb', originalY: 2.2,
    generateFallback: () => {
      const group = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16), createMat(0x1e293b));
      base.position.y = 0.05; base.castShadow = true;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8), createMat(0x334155));
      arm.position.y = 0.8; arm.rotation.z = Math.PI / 8; arm.castShadow = true;
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 16), createMat(0x1e293b));
      head.position.set(-0.3, 1.4, 0); head.rotation.z = Math.PI / 3; head.castShadow = true;
      const light = new THREE.PointLight(0xffffff, 80, 8);
      light.position.set(-0.4, 1.3, 0);
      light.userData.isLampLight = true;
      light.castShadow = true;
      group.add(base, arm, head, light);
      return group;
    }
  },
  fridge: {
    id: 'fridge', name: 'Refrigerator', modelUrl: '/models/fridge.glb', originalY: 0,
    generateFallback: () => {
      const group = new THREE.Group();
      const bodyMat = createMat(0x94a3b8, 0.2);
      const body = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 2.5), bodyMat);
      body.position.y = 3; body.castShadow = true; body.receiveShadow = true;
      const handleMat = createMat(0xe2e8f0, 0.1);
      const topHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5), handleMat);
      topHandle.position.set(-1.2, 4.5, 1.3);
      const bottomHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5), handleMat);
      bottomHandle.position.set(-1.2, 1.5, 1.3);
      const line = new THREE.Mesh(new THREE.BoxGeometry(3.02, 0.05, 2.52), createMat(0x334155));
      line.position.y = 3;
      group.add(body, topHandle, bottomHandle, line);
      return group;
    }
  },
  oven: {
    id: 'oven', name: 'Oven', modelUrl: '/models/oven.glb', originalY: 0,
    generateFallback: () => {
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3, 2.5), createMat(0x475569, 0.3));
      body.position.y = 1.5; body.castShadow = true; body.receiveShadow = true;
      const windowGeom = new THREE.PlaneGeometry(1.8, 1.2);
      const windowMat = new THREE.MeshStandardMaterial({color: 0x111111, emissive: 0xffaa00, emissiveIntensity: 0.5});
      const ovenWindow = new THREE.Mesh(windowGeom, windowMat);
      ovenWindow.position.set(0, 1.5, 1.26);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8), createMat(0xe2e8f0, 0.1));
      handle.rotation.z = Math.PI / 2; handle.position.set(0, 2.3, 1.35);
      const stoveMat = createMat(0x000000);
      for(let i=0; i<4; i++) {
        const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16), stoveMat);
        burner.position.set((i%2===0?-0.6:0.6), 3.02, (i<2?-0.6:0.6));
        group.add(burner);
      }
      group.add(body, ovenWindow, handle);
      return group;
    }
  },
  kitchenCounter: {
    id: 'kitchenCounter', name: 'Kitchen Counter', modelUrl: '/models/counter.glb', originalY: 0,
    generateFallback: () => {
      const group = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(5, 2.8, 2.5), createMat(0xe2e8f0));
      base.position.y = 1.4; base.castShadow = true; base.receiveShadow = true;
      const top = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.2, 2.7), createMat(0xf8fafc, 0.1));
      top.position.y = 2.9; top.castShadow = true; top.receiveShadow = true;
      const sink = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1.2), createMat(0x94a3b8, 0.1));
      sink.position.set(1, 3.01, 0);
      const faucet = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6), createMat(0xe2e8f0, 0.1));
      faucet.position.set(1, 3.3, -0.7);
      const faucetHead = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4), createMat(0xe2e8f0, 0.1));
      faucetHead.rotation.x = Math.PI / 2; faucetHead.position.set(1, 3.55, -0.5);
      group.add(base, top, sink, faucet, faucetHead);
      return group;
    }
  },
  pc: {
    id: 'pc', name: 'PC Case', modelUrl: '/models/pc.glb', originalY: 2.2,
    generateFallback: () => {
      const group = new THREE.Group();
      const caseBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 1.8), createMat(0x0f172a));
      caseBody.position.y = 0.9; caseBody.castShadow = true;
      const sidePanel = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshStandardMaterial({color: 0x000000, emissive: 0x38bdf8, emissiveIntensity: 1}));
      sidePanel.position.set(-0.41, 0.9, 0); sidePanel.rotation.y = -Math.PI / 2;
      group.add(caseBody, sidePanel);
      return group;
    }
  },
  keyboard: {
    id: 'keyboard', name: 'Keyboard', modelUrl: '/models/keyboard.glb', originalY: 2.2,
    generateFallback: () => {
      const group = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.5), createMat(0x1e293b));
      base.position.y = 0.025; base.castShadow = true;
      const keys = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.4), new THREE.MeshStandardMaterial({color: 0x334155, emissive: 0xf43f5e, emissiveIntensity: 0.5}));
      keys.position.y = 0.03;
      group.add(base, keys);
      return group;
    }
  },
  mouse: {
    id: 'mouse', name: 'Mouse', modelUrl: '/models/mouse.glb', originalY: 2.2,
    generateFallback: () => {
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.35), createMat(0x1e293b));
      body.position.y = 0.05; body.castShadow = true;
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.1), new THREE.MeshStandardMaterial({color: 0x000000, emissive: 0x38bdf8, emissiveIntensity: 0.8}));
      glow.rotation.x = -Math.PI / 2; glow.position.set(0, 0.11, -0.05);
      group.add(body, glow);
      return group;
    }
  }
};

const loader = new GLTFLoader();

export class FurnitureDatabase {
  
  static async spawn(type: string): Promise<THREE.Object3D> {
    const def = FurnitureCatalog[type];
    if (!def) throw new Error(`Unknown furniture type: ${type}`);

    try {
      const gltf = await loader.loadAsync(def.modelUrl);
      const model = gltf.scene;
      
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
             child.material = child.material.clone();
          }
          if (child.name.toLowerCase().includes('screen')) {
             child.userData.isCustomImage = true;
          }
        }
      });
      
      this.attachMetadata(model, def);
      return model;
      
    } catch (error) {
      const fallback = def.generateFallback();
      this.attachMetadata(fallback, def);
      return fallback;
    }
  }

  private static attachMetadata(object: THREE.Object3D, def: FurnitureDef) {
    object.userData = {
      isFurniture: true,
      id: def.id,
      name: def.name,
      originalY: def.originalY
    };
  }
}
