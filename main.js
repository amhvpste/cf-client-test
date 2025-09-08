import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, plane;
let worker;
let targetPosition = null;
let gameWon = false;

let workerModel, unitModel, castleModel, towerModel, gateModel;
let currentBuildingModel;
const cameraOffset = new THREE.Vector3(0, 5, -5);

let gold = 1000;
const UNIT_TYPES = {
    RAM: 'ram',
    BALLISTA: 'ballista'
};

// Initialize unit properties with null model instances
const UNIT_PROPERTIES = {
    [UNIT_TYPES.RAM]: {
        damage: 2,
        model: 'ram',
        modelInstance: null,  // Will be set when model loads
        speed: 0.05
    },
    [UNIT_TYPES.BALLISTA]: {
        damage: 10,
        model: 'ballista',
        modelInstance: null,  // Will be set when model loads
        speed: 0.03
    }
};

const buildingCosts = {
    castle: 400,
    tower: 200
};

const buildingUnitTypes = {
    castle: UNIT_TYPES.BALLISTA,
    tower: UNIT_TYPES.RAM
};

const buildings = [];
const units = [];

const MAP_WIDTH = 20;
const PLAYER_SIDE_Z_MAX = 0;
const ENEMY_BASE_TARGET = new THREE.Vector3(0, 0, MAP_WIDTH / 4);
const PLAYER_BASE_TARGET = new THREE.Vector3(0, 0, -MAP_WIDTH / 4);
const ENEMY_BASE_MAX_HEALTH = 100;
let enemyBaseHealth = ENEMY_BASE_MAX_HEALTH;
const ATTACK_RADIUS = 2; // How close units get to the base

const CASTLE_UNIT_COOLDOWN = 5000;
const TOWER_UNIT_COOLDOWN = 10000;

const loader = new GLTFLoader();

// Початок області видимості глобальних функцій
function updateGoldDisplay() {
    document.getElementById('gold-display').innerText = `gold: ${gold}`;
    checkButtonAvailability();
}

function updateUnitCount() {
    document.getElementById('unit-count').innerText = `units: ${units.length}`;
}

function updateEnemyBaseHealth() {
    const healthBar = document.getElementById('enemy-health-bar');
    const healthPercent = (enemyBaseHealth / ENEMY_BASE_MAX_HEALTH) * 100;
    healthBar.style.width = `${healthPercent}%`;
    healthBar.textContent = `${enemyBaseHealth}/${ENEMY_BASE_MAX_HEALTH}`;
}

function checkButtonAvailability() {
    if (gold >= buildingCosts.castle) {
        document.getElementById('build-castle').classList.remove('disabled');
    } else {
        document.getElementById('build-castle').classList.add('disabled');
    }
    if (gold >= buildingCosts.tower) {
        document.getElementById('build-tower').classList.remove('disabled');
    } else {
        document.getElementById('build-tower').classList.add('disabled');
    }
}

function selectBuilding(type) {
    if (type === 'castle') {
        currentBuildingModel = castleModel;
    } else if (type === 'tower') {
        currentBuildingModel = towerModel;
    }
}

function getSelectedBuildingType() {
    if (currentBuildingModel === castleModel) {
        return 'castle';
    }
    return 'tower';
}

function spawnUnit(building) {
    if (gameWon) return;
    
    const unitType = buildingUnitTypes[building.type];
    const unitProps = UNIT_PROPERTIES[unitType];
    
    // Check if the model is loaded
    if (!unitProps || !unitProps.modelInstance) {
        console.error(`Cannot spawn unit: Model not loaded for unit type ${unitType}`);
        return;
    }
    
    console.log(`Spawning ${unitType} unit from ${building.type} building.`);
    
    try {
        const newUnit = unitProps.modelInstance.clone();
        newUnit.position.copy(building.object.position);
        newUnit.unitType = unitType;
        newUnit.speed = unitProps.speed;
        newUnit.damage = unitProps.damage;
        newUnit.target = ENEMY_BASE_TARGET.clone();
        newUnit.isAttacking = false;
        newUnit.attackCooldown = 0;
        newUnit.attackPosition = null;
        
        scene.add(newUnit);
        units.push(newUnit);
        updateUnitCount();
        
        console.log(`Successfully spawned ${unitType} at`, newUnit.position);
    } catch (error) {
        console.error('Error spawning unit:', error);
    }
}

function checkWinCondition() {
    if (enemyBaseHealth <= 0 && !gameWon) {
        gameWon = true;
        document.getElementById('win-screen').style.display = 'flex';
    }
}

function restartGame() {
    window.location.reload();
}
// Кінець області видимості глобальних функцій


function createModelViewer(model, containerId, size = 1, rotation = { x: 0, y: 0, z: 0 }) {
    const container = document.getElementById(containerId);
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    const renderer = new THREE.WebGLRenderer({ 
        alpha: true, 
        antialias: true,
        preserveDrawingBuffer: true
    });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    
    const scene = new THREE.Scene();
    scene.background = null;
    
    // Use OrthographicCamera for UI elements
    const aspect = width / height;
    const camera = new THREE.OrthographicCamera(
        -aspect, aspect, 1, -1, 0.1, 1000
    );
    camera.position.z = 5;
    camera.lookAt(0, 0, 0);
    
    // Add better lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);
    
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight1.position.set(1, 1, 1);
    scene.add(directionalLight1);
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-1, -1, -1);
    scene.add(directionalLight2);
    
    const modelInstance = model.clone();
    scene.add(modelInstance);
    
    // Center and scale the model
    const box = new THREE.Box3().setFromObject(modelInstance);
    const center = box.getCenter(new THREE.Vector3());
    const modelSize = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
    const scale = 1.5 / maxDim;
    
    modelInstance.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    modelInstance.scale.set(scale, scale, scale);
    modelInstance.rotation.set(rotation.x, rotation.y, rotation.z);
    
    // Add a small rotation animation
    function animate() {
        requestAnimationFrame(animate);
        modelInstance.rotation.y += 0.01;
        renderer.render(scene, camera);
    }
    
    animate();
    
    return {
        updateModel: (newModel) => {
            scene.remove(modelInstance);
            const newInstance = newModel.clone();
            scene.add(newInstance);
            
            const newBox = new THREE.Box3().setFromObject(newInstance);
            const newCenter = newBox.getCenter(new THREE.Vector3());
            const newModelSize = newBox.getSize(new THREE.Vector3());
            const newMaxDim = Math.max(newModelSize.x, newModelSize.y, newModelSize.z);
            const newScale = 1.5 / newMaxDim;
            
            newInstance.position.set(-newCenter.x * newScale, -newCenter.y * newScale, -newCenter.z * newScale);
            newInstance.scale.set(newScale, newScale, newScale);
            newInstance.rotation.set(rotation.x, rotation.y, rotation.z);
            
            modelInstance = newInstance;
        }
    };
}

function loadModels() {
    return new Promise((resolve) => {
        let loadedCount = 0;
        const totalModels = 7; // Updated to include the wall model

        const handleLoad = (gltf, modelType) => {
            const model = gltf.scene;
            // Scale model to fit in the scene
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const maxDimension = Math.max(size.x, size.y, size.z);
            const scaleFactor = 1.5 / maxDimension;

            model.scale.multiplyScalar(scaleFactor);
            
            if (modelType === 'worker') {
                workerModel = model;
                workerModel.rotation.y = Math.PI / 2;
            } else if (modelType === 'ram') {
                UNIT_PROPERTIES[UNIT_TYPES.RAM].modelInstance = model;
                model.rotation.y = Math.PI / 2;
            } else if (modelType === 'ballista') {
                UNIT_PROPERTIES[UNIT_TYPES.BALLISTA].modelInstance = model;
                model.rotation.y = Math.PI / 2;
            } else if (modelType === 'castle') {
                castleModel = model;
            } else if (modelType === 'tower') {
                towerModel = model;
            } else if (modelType === 'gate') {
                gateModel = model;
            }

            loadedCount++;
            if (loadedCount === totalModels) {
                console.log("All models loaded successfully!");
                resolve();
            }
        };

        // Load worker model
        loader.load('assets/models/worker2.glb', 
            (gltf) => handleLoad(gltf, 'worker'), 
            undefined, 
            (error) => {
                console.error('Error loading worker2.glb:', error);
                loadedCount++;
                if (loadedCount >= totalModels) resolve();
            }
        );
        
        // Load siege ram model
        loader.load('assets/models/siege-ram.glb', 
            (gltf) => {
                try {
                    const model = gltf.scene;
                    // Scale model to fit in the scene
                    const box = new THREE.Box3().setFromObject(model);
                    const size = box.getSize(new THREE.Vector3());
                    const maxDimension = Math.max(size.x, size.y, size.z);
                    const scaleFactor = 1.5 / maxDimension;
                    model.scale.multiplyScalar(scaleFactor);
                    model.rotation.y = Math.PI / 2;
                    
                    // Assign to unit properties
                    UNIT_PROPERTIES[UNIT_TYPES.RAM].modelInstance = model;
                    console.log('Siege ram model loaded successfully');
                } catch (error) {
                    console.error('Error processing siege ram model:', error);
                } finally {
                    loadedCount++;
                    if (loadedCount >= totalModels) resolve();
                }
            },
            undefined,
            (error) => {
                console.error('Error loading siege-ram.glb:', error);
                loadedCount++;
                if (loadedCount >= totalModels) resolve();
            }
        );
        
        // Load siege ballista model
        loader.load('assets/models/siege-ballista.glb', 
            (gltf) => {
                try {
                    const model = gltf.scene;
                    // Scale model to fit in the scene
                    const box = new THREE.Box3().setFromObject(model);
                    const size = box.getSize(new THREE.Vector3());
                    const maxDimension = Math.max(size.x, size.y, size.z);
                    const scaleFactor = 1.5 / maxDimension;
                    model.scale.multiplyScalar(scaleFactor);
                    model.rotation.y = Math.PI / 2;
                    
                    // Assign to unit properties
                    UNIT_PROPERTIES[UNIT_TYPES.BALLISTA].modelInstance = model;
                    console.log('Siege ballista model loaded successfully');
                } catch (error) {
                    console.error('Error processing siege ballista model:', error);
                } finally {
                    loadedCount++;
                    if (loadedCount >= totalModels) resolve();
                }
            },
            undefined,
            (error) => {
                console.error('Error loading siege-ballista.glb:', error);
                loadedCount++;
                if (loadedCount >= totalModels) resolve();
            }
        );
        
                // Load other models
        loader.load('assets/models/castle_fort_01.glb', 
            (gltf) => handleLoad(gltf, 'castle'), 
            undefined, 
            (error) => {
                console.error('Error loading castle_fort_01.glb:', error);
                // Even if loading fails, we need to continue
                loadedCount++;
                if (loadedCount >= totalModels) resolve();
            }
        );
        
        loader.load('assets/models/tower1.glb', 
            (gltf) => handleLoad(gltf, 'tower'), 
            undefined, 
            (error) => {
                console.error('Error loading tower1.glb:', error);
                loadedCount++;
                if (loadedCount >= totalModels) resolve();
            }
        );
        
        loader.load('assets/models/castle_gate_01.glb', 
            (gltf) => handleLoad(gltf, 'gate'), 
            undefined, 
            (error) => {
                console.error('Error loading castle_gate_01.glb:', error);
                loadedCount++;
                if (loadedCount >= totalModels) resolve();
            }
        );
        
        loader.load('assets/models/wall_01.glb', 
            (gltf) => handleLoad(gltf, 'wall'), 
            undefined, 
            (error) => {
                console.error('Error loading wall_01.glb:', error);
                loadedCount++;
                if (loadedCount >= totalModels) resolve();
            }
        );
    });
}

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 15, -20);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    renderer.setClearColor(0x87ceeb);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);

    const planeGeometry = new THREE.PlaneGeometry(MAP_WIDTH, MAP_WIDTH / 2);
    const playerPlaneMaterial = new THREE.MeshLambertMaterial({ color: 0x228b22, side: THREE.DoubleSide });
    const enemyPlaneMaterial = new THREE.MeshLambertMaterial({ color: 0x8b0000, side: THREE.DoubleSide });
    
    const playerPlane = new THREE.Mesh(planeGeometry, playerPlaneMaterial);
    playerPlane.rotation.x = Math.PI / 2;
    playerPlane.position.z = -MAP_WIDTH / 4;
    scene.add(playerPlane);

    const enemyPlane = new THREE.Mesh(planeGeometry, enemyPlaneMaterial);
    enemyPlane.rotation.x = Math.PI / 2;
    enemyPlane.position.z = MAP_WIDTH / 4;
    scene.add(enemyPlane);

    const gridHelper = new THREE.GridHelper(MAP_WIDTH, MAP_WIDTH, 0xaaaaaa, 0xaaaaaa);
    scene.add(gridHelper);

    const playerGate = gateModel.clone();
    playerGate.position.copy(PLAYER_BASE_TARGET);
    scene.add(playerGate);

    const enemyGate = gateModel.clone();
    enemyGate.position.copy(ENEMY_BASE_TARGET);
    scene.add(enemyGate);

    worker = workerModel.clone();
    worker.position.set(0, 0, -MAP_WIDTH / 4);
    scene.add(worker);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    document.getElementById('build-castle').addEventListener('click', () => selectBuilding('castle'));
    document.getElementById('build-tower').addEventListener('click', () => selectBuilding('tower'));
    document.getElementById('restart-button').addEventListener('click', restartGame);

    currentBuildingModel = castleModel;

    function onMouseClick(event) {
        if (gameWon) return;

        const menu = document.getElementById('menu');
        const menuRect = menu.getBoundingClientRect();
        if (event.clientX >= menuRect.left && event.clientX <= menuRect.right &&
            event.clientY >= menuRect.top && event.clientY <= menuRect.bottom) {
            return;
        }

        const buildingType = getSelectedBuildingType();
        if (gold >= buildingCosts[buildingType]) {
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);

            const intersects = raycaster.intersectObject(playerPlane);

            if (intersects.length > 0) {
                const clickPoint = intersects[0].point;
                targetPosition = clickPoint;
                targetPosition.y = 0;
                gold -= buildingCosts[buildingType];
                updateGoldDisplay();
            } else {
                alert('Ви можете будувати тільки на своїй стороні!');
            }
        } else {
            alert('Недостатньо золота!');
        }
    }
    
    setInterval(() => {
        if (!gameWon) {
            gold += 25;
            updateGoldDisplay();
        }
    }, 5000);

    // Initialize model viewers after models are loaded
    setTimeout(() => {
        if (wallModel) createModelViewer(wallModel, 'gold-model', 1.5, { x: 0, y: 0, z: 0 });
        if (workerModel) createModelViewer(workerModel, 'unit-model', 1.5, { x: 0, y: 0, z: 0 });
        if (gateModel) createModelViewer(gateModel, 'back-model', 1, { x: 0, y: Math.PI/4, z: 0 });
    }, 500);
    
    updateGoldDisplay();
    updateUnitCount();
    updateEnemyBaseHealth();

    window.addEventListener('click', onMouseClick, false);
    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

let clock = new THREE.Clock();

function animate() {
    const delta = clock.getDelta();
    requestAnimationFrame(animate);

    if (gameWon) {
        renderer.render(scene, camera);
        return;
    }

    const newCameraPosition = worker.position.clone().add(cameraOffset);
    camera.position.lerp(newCameraPosition, 0.05);
    camera.lookAt(worker.position);

    if (targetPosition) {
        worker.lookAt(targetPosition);

        const distance = worker.position.distanceTo(targetPosition);
        
        if (distance > 0.1) {
            const direction = new THREE.Vector3().subVectors(targetPosition, worker.position).normalize();
            worker.position.add(direction.multiplyScalar(0.05));
        } else {
            const buildingType = getSelectedBuildingType();
            const building = {
                object: currentBuildingModel.clone(),
                type: buildingType,
                lastSpawnTime: 0,
                spawnCooldown: buildingType === 'castle' ? CASTLE_UNIT_COOLDOWN : TOWER_UNIT_COOLDOWN,
                unitType: buildingUnitTypes[buildingType]
            };
            
            building.object.position.copy(targetPosition);
            buildings.push(building);
            scene.add(building.object);
            
            console.log(`Placed ${buildingType} building that will spawn ${building.unitType} units`);
            targetPosition = null;
        }
    }

    const currentTime = Date.now();
    for (const building of buildings) {
        const cooldown = (building.type === 'castle') ? CASTLE_UNIT_COOLDOWN : TOWER_UNIT_COOLDOWN;
        if (currentTime - building.lastSpawnTime > cooldown) {
            spawnUnit(building);
            building.lastSpawnTime = currentTime;
        }
    }

    for (let i = units.length - 1; i >= 0; i--) {
        const unit = units[i];
        
        const distance = unit.position.distanceTo(unit.target);

        if (distance > 0.5) {
            const direction = new THREE.Vector3().subVectors(unit.target, unit.position).normalize();
            unit.position.add(direction.multiplyScalar(unit.speed));
            // Check if unit reached enemy base
            if (!unit.isAttacking && unit.position.distanceTo(ENEMY_BASE_TARGET) < ATTACK_RADIUS + 1) {
                unit.isAttacking = true;
                // Find a position around the base for this unit
                const angle = (units.filter(u => u.isAttacking).length / 8) * Math.PI * 2; // Spread units in a circle
                unit.attackPosition = new THREE.Vector3(
                    ENEMY_BASE_TARGET.x + Math.cos(angle) * ATTACK_RADIUS,
                    0,
                    ENEMY_BASE_TARGET.z + Math.sin(angle) * ATTACK_RADIUS
                );
            }
            
            if (unit.isAttacking) {
                // If we have an attack position, move to it
                if (unit.attackPosition) {
                    const direction = new THREE.Vector3().subVectors(unit.attackPosition, unit.position);
                    if (direction.length() > 0.1) {
                        direction.normalize();
                        unit.position.add(direction.multiplyScalar(0.05));
                    }
                }
                
                // Deal damage every second
                unit.attackCooldown -= delta * 1000; // Convert delta to milliseconds
                if (unit.attackCooldown <= 0) {
                    enemyBaseHealth = Math.max(0, enemyBaseHealth - unit.damage);
                    updateEnemyBaseHealth();
                    unit.attackCooldown = 1000; // 1 second cooldown
                    
                    // Check if base is destroyed
                    if (enemyBaseHealth <= 0) {
                        checkWinCondition();
                        // Remove all units when base is destroyed
                        scene.remove(unit);
                        const index = units.indexOf(unit);
                        if (index > -1) {
                            units.splice(index, 1);
                        }
                    }
                }
            }
        }
    }

    renderer.render(scene, camera);
}

// Start loading models and then initialize the game
loadModels().then(() => {
    console.log('All models loaded, initializing game...');
    console.log('Worker model:', workerModel ? 'Loaded' : 'Missing');
    console.log('Castle model:', castleModel ? 'Loaded' : 'Missing');
    console.log('Tower model:', towerModel ? 'Loaded' : 'Missing');
    console.log('Gate model:', gateModel ? 'Loaded' : 'Missing');
    
    // Verify all required models are loaded
    if (!workerModel || !castleModel || !towerModel || !gateModel) {
        console.error('Error: Some models failed to load. Please check the console for errors.');
        return;
    }
    
    init();
    animate();
}).catch(error => {
    console.error('Error loading models:', error);
});