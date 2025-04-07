import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GUI } from 'https://unpkg.com/three@0.156.1/examples/jsm/libs/lil-gui.module.min.js';

let scene, camera, renderer, controls;
let modelPath = '3dmodel/'; // Update this to your model directory
let modelFile = 'shoe/scene.glb'; // Update this to your actual GLB file

let gui;
let modelParts = [];
let explodeAmount = 0;
let showSkeleton = false;
let transparentMode = false;

// Initialize the scene
function init() {
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x444444);
  
  // Create camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 2;
  
  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);
  
  // Add controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  
  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);
  
  // Handle window resize
  window.addEventListener('resize', onWindowResize);
  
  // Load the GLB model
  loadModel();
}

// Load GLB model
function loadModel() {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://unpkg.com/three@0.156.1/examples/jsm/libs/draco/');
  
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  
  gltfLoader.load(
    modelPath + modelFile,
    function(gltf) {
      const model = gltf.scene;
      
      // Center the model
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.x = -center.x;
      model.position.y = -center.y;
      model.position.z = -center.z;
      
      scene.add(model);
      console.log('Model loaded successfully!');
      
      // Print model info
      inspectModel(gltf);
      
      // Show model's bounding box
      const helper = new THREE.Box3Helper(box, 0xffff00);
      scene.add(helper);
      
      // Store original positions for explode feature
      collectModelParts(model);
      
      // Create GUI controls
      createGUI(model);
      
      // If the model has animations, log them
      if (gltf.animations && gltf.animations.length) {
        console.log(`Found ${gltf.animations.length} animations:`, gltf.animations);
        
        // Create animation mixer and play first animation
        const mixer = new THREE.AnimationMixer(model);
        const action = mixer.clipAction(gltf.animations[0]);
        action.play();
        
        // Store mixer for use in animation loop
        window.mixer = mixer;
      }
    },
    function(xhr) {
      console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    function(error) {
      console.error('Error loading model:', error);
    }
  );
}

// Collect all meshes for explode view
function collectModelParts(model) {
  modelParts = [];
  model.traverse((node) => {
    if (node.isMesh) {
      // Store original position
      node.userData.originalPosition = node.position.clone();
      node.userData.originalParent = node.parent;
      node.userData.originalCenter = new THREE.Vector3();
      
      // Compute center in world space
      const geometry = node.geometry;
      geometry.computeBoundingBox();
      const center = new THREE.Vector3();
      geometry.boundingBox.getCenter(center);
      node.localToWorld(center);
      node.userData.centerWorld = center.clone();
      
      modelParts.push(node);
    }
  });
}

// Create GUI controls
function createGUI(model) {
  // Remove existing GUI if present
  if (gui) gui.destroy();
  
  gui = new GUI();
  
  const viewFolder = gui.addFolder('View Controls');
  viewFolder.add({ wireframe: false }, 'wireframe').onChange((value) => {
    model.traverse((node) => {
      if (node.isMesh) {
        node.material.wireframe = value;
        node.material.needsUpdate = true;
      }
    });
  });
  
  viewFolder.add({ showAxes: false }, 'showAxes').onChange((value) => {
    const existing = scene.getObjectByName('axesHelper');
    if (existing && !value) {
      scene.remove(existing);
    } else if (!existing && value) {
      const axesHelper = new THREE.AxesHelper(5);
      axesHelper.name = 'axesHelper';
      scene.add(axesHelper);
    }
  });
  
  // X-ray view (transparency)
  viewFolder.add({ xRayView: false }, 'xRayView').onChange((value) => {
    transparentMode = value;
    model.traverse((node) => {
      if (node.isMesh) {
        node.material.transparent = value;
        node.material.opacity = value ? 0.3 : 1.0;
        node.material.depthWrite = !value;
        node.material.needsUpdate = true;
      }
    });
  });
  
  // Explode view
  viewFolder.add({ explode: 0 }, 'explode', 0, 2, 0.01).onChange((value) => {
    explodeAmount = value;
    explodeModel(value);
  });
  
  // Part visibility
  const partsFolder = gui.addFolder('Model Parts');
  const parts = {};
  
  model.traverse((node) => {
    if (node.isMesh) {
      const name = node.name || `Part ${Object.keys(parts).length + 1}`;
      parts[name] = true;
      
      partsFolder.add(parts, name).onChange((visible) => {
        node.visible = visible;
      });
    }
  });

  viewFolder.add({ listModelTree: () => {} }, 'listModelTree').name('List Model Tree').onChange(() => {
    logModelTree(model);
  });
  
  viewFolder.open();
  partsFolder.open();
}

function logModelTree(object, depth = 0) {
  const indent = '  '.repeat(depth);
  console.log(`${indent}${object.name || 'unnamed'} (${object.type})`);
  object.children.forEach((child) => {
    logModelTree(child, depth + 1);
  });
}

// Explode model parts
function explodeModel(amount) {
  modelParts.forEach((part) => {
    if (part.userData.centerWorld) {
      // Create an explode direction from the model center to the part center
      const explodeDir = part.userData.centerWorld.clone();
      explodeDir.normalize();
      
      // Move the part along this direction
      part.position.copy(part.userData.originalPosition.clone())
                   .add(explodeDir.multiplyScalar(amount));
    }
  });
}

// Detailed model inspection function
function inspectModel(gltf) {
  console.group('GLB Model Details');
  
  // Analyze model structure
  let meshCount = 0;
  let materialCount = 0;
  let textureCount = 0;
  const materials = {};
  
  gltf.scene.traverse((node) => {
    console.log(node.name || 'unnamed', node.type);
    
    if (node.isMesh) {
      meshCount++;
      console.log(`Mesh: ${node.name}, vertices: ${node.geometry.attributes.position.count}`);
      
      // Material inspection
      if (node.material) {
        if (!materials[node.material.uuid]) {
          materials[node.material.uuid] = node.material;
          materialCount++;
        }
        
        console.log(`Material: ${node.material.name || 'unnamed'}, type: ${node.material.type}`);
        console.log('Material properties:', {
          color: node.material.color?.getHexString(),
          roughness: node.material.roughness,
          metalness: node.material.metalness,
          map: node.material.map ? 'present' : 'none'
        });
        
        // Count textures
        if (node.material.map) textureCount++;
        if (node.material.normalMap) textureCount++;
        if (node.material.roughnessMap) textureCount++;
        if (node.material.metalnessMap) textureCount++;
      }
    }
  });
  
  // Log model statistics
  console.log('Model Statistics:', {
    meshes: meshCount,
    materials: materialCount,
    textures: textureCount
  });
  
  // Get model dimensions
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = box.getSize(new THREE.Vector3());
  console.log('Model dimensions:', {
    width: size.x,
    height: size.y,
    depth: size.z
  });
  
  console.groupEnd();
}

// Add key controls to toggle wireframe mode
document.addEventListener('keydown', (event) => {
  if (event.key === 'w') {
    // Toggle wireframe mode
    scene.traverse((node) => {
      if (node.isMesh && node.material) {
        node.material.wireframe = !node.material.wireframe;
        node.material.needsUpdate = true;
      }
    });
  }
  
  // Toggle axes helper with 'a' key
  if (event.key === 'a') {
    const existing = scene.getObjectByName('axesHelper');
    if (existing) {
      scene.remove(existing);
    } else {
      const axesHelper = new THREE.AxesHelper(5);
      axesHelper.name = 'axesHelper';
      scene.add(axesHelper);
    }
  }
});

// Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Update animation loop to handle mixer animations
function animate() {
  requestAnimationFrame(animate);
  
  // Update animation mixer if it exists
  if (window.mixer) {
    window.mixer.update(0.01);
  }
  
  controls.update();
  renderer.render(scene, camera);
}

// Initialize everything
init();
animate();