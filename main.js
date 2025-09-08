// Import Three.js and its modules from a single source
import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.152.2/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://unpkg.com/three@0.152.2/examples/jsm/loaders/DRACOLoader.js';

let scene, camera, renderer, plane;
let worker;
let decorativeObjects = [];
let targetPosition = null;
let gameWon = false;

let workerModel, unitModel, castleModel, towerModel, gateModel, wallModel;
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
const enemyBuildings = [];
const units = [];
const enemyUnits = [];
let lastEnemySpawnTime = 0;
const ENEMY_SPAWN_COOLDOWN = 5000; // 5 seconds

const MAP_WIDTH = 20;
const PLAYER_SIDE_Z_MAX = 0;
const PLAYER_BASE_TARGET = new THREE.Vector3(0, 0, -MAP_WIDTH / 3);
const ENEMY_BASE_TARGET = new THREE.Vector3(0, 0, MAP_WIDTH / 3);
const BASE_MAX_HEALTH = 100;
let enemyBaseHealth = BASE_MAX_HEALTH;
let playerBaseHealth = BASE_MAX_HEALTH;
const ATTACK_RADIUS = 2; // How close units get to the base

const CASTLE_UNIT_COOLDOWN = 5000;
const TOWER_UNIT_COOLDOWN = 10000;

const loader = new GLTFLoader();

// Початок області видимості глобальних функцій
function updateGoldDisplay() {
    document.getElementById('top-ui').innerText = `Gold: ${gold}`;
    checkButtonAvailability();
}

function updateEnemyBaseHealth() {
    const healthBar = document.getElementById('enemy-health-bar');
    const healthPercent = (enemyBaseHealth / BASE_MAX_HEALTH) * 100;
    healthBar.style.width = `${healthPercent}%`;
    healthBar.textContent = `${enemyBaseHealth}/${BASE_MAX_HEALTH}`;
}

function updatePlayerBaseHealth() {
    const healthBar = document.getElementById('player-health-bar');
    const healthPercent = (playerBaseHealth / BASE_MAX_HEALTH) * 100;
    healthBar.style.width = `${healthPercent}%`;
    healthBar.textContent = `${playerBaseHealth}/${BASE_MAX_HEALTH}`;
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
        
        console.log(`Successfully spawned ${unitType} at`, newUnit.position);
    } catch (error) {
        console.error('Error spawning unit:', error);
    }
}

function checkWinCondition() {
    if (enemyBaseHealth <= 0) {
        document.getElementById('win-screen').querySelector('p').textContent = 'You Win!';
        document.getElementById('win-screen').style.display = 'flex';
        return true;
    } else if (playerBaseHealth <= 0) {
        document.getElementById('win-screen').querySelector('p').textContent = 'Game Over!';
        document.getElementById('win-screen').style.display = 'flex';
        return true;
    }
    return false;
}

function spawnEnemyUnit() {
    // Don't spawn if no barracks exist yet
    if (enemyBuildings.length === 0) return;
    
    // Randomly select a barrack
    const barrack = enemyBuildings[Math.floor(Math.random() * enemyBuildings.length)];
    
    // Check if it's time to spawn a new unit from this barrack
    const currentTime = Date.now();
    if (currentTime - barrack.lastSpawnTime > barrack.spawnCooldown) {
        const unitType = barrack.unitType;
        const unitProps = UNIT_PROPERTIES[unitType];
        
        if (!unitProps || !unitProps.modelInstance) return;
        
        const newUnit = unitProps.modelInstance.clone();
        // Spawn near the barrack
        const spawnOffset = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            0,
            (Math.random() - 0.5) * 2
        ).normalize().multiplyScalar(2);
        
        newUnit.position.copy(barrack.object.position).add(spawnOffset);
        newUnit.unitType = unitType;
        newUnit.speed = unitProps.speed * 0.8; // Slightly slower than player units
        newUnit.damage = unitProps.damage;
        newUnit.target = PLAYER_BASE_TARGET.clone();
        newUnit.isAttacking = false;
        newUnit.attackCooldown = 0;
        newUnit.attackPosition = null;
        
        // Rotate unit to face the target
        newUnit.lookAt(newUnit.target);
        
        scene.add(newUnit);
        enemyUnits.push(newUnit);
        barrack.lastSpawnTime = currentTime;
    }
}

function updateEnemyUnits(delta) {
    for (let i = enemyUnits.length - 1; i >= 0; i--) {
        const unit = enemyUnits[i];
        const distance = unit.position.distanceTo(unit.target);

        if (distance > 0.5) {
            const direction = new THREE.Vector3().subVectors(unit.target, unit.position).normalize();
            unit.position.add(direction.multiplyScalar(unit.speed));
            
            // Check if unit reached player base
            if (!unit.isAttacking && unit.position.distanceTo(PLAYER_BASE_TARGET) < ATTACK_RADIUS + 1) {
                unit.isAttacking = true;
                // Find a position around the player base for this unit
                const angle = (enemyUnits.filter(u => u.isAttacking).length / 8) * Math.PI * 2;
                unit.attackPosition = new THREE.Vector3(
                    PLAYER_BASE_TARGET.x + Math.cos(angle) * ATTACK_RADIUS,
                    0,
                    PLAYER_BASE_TARGET.z + Math.sin(angle) * ATTACK_RADIUS
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
                    playerBaseHealth = Math.max(0, playerBaseHealth - unit.damage);
                    updatePlayerBaseHealth();
                    unit.attackCooldown = 1000; // 1 second cooldown
                    
                    // Check if player base is destroyed
                    if (playerBaseHealth <= 0) {
                        checkWinCondition();
                        // Remove all units when base is destroyed
                        scene.remove(unit);
                        enemyUnits.splice(i, 1);
                        continue;
                    }
                }
            }
        }
        
        // Rotate unit to face movement direction
        if (unit.target) {
            unit.lookAt(unit.target);
        }
    }
}

function createEnemyBarracks() {
    console.log('Creating enemy barracks...');
    
    // Create first barrack after 2 seconds
    setTimeout(() => {
        if (gameWon || !towerModel) {
            console.log('Game won or tower model not loaded, skipping barrack creation');
            return;
        }
        
        // Random position on enemy side (z > 0)
        const x = (Math.random() - 0.5) * (MAP_WIDTH * 0.8);
        const z = MAP_WIDTH / 6 + Math.random() * (MAP_WIDTH / 3);
        
        console.log(`Creating first enemy barrack at (${x}, 0, ${z})`);
        
        try {
            const barrack = {
                object: towerModel.clone(),
                type: 'tower',
                lastSpawnTime: 0,
                spawnCooldown: TOWER_UNIT_COOLDOWN * 1.5, // Slower than player's towers
                unitType: UNIT_TYPES.RAM // Enemy barracks spawn RAM units
            };
            
            // Position and scale the barrack
            barrack.object.position.set(x, 0, z);
            barrack.object.rotation.y = Math.PI; // Face towards player base
            
            // Add to scene and array
            scene.add(barrack.object);
            enemyBuildings.push(barrack);
            
            console.log('First enemy barrack created successfully');
            
        } catch (error) {
            console.error('Error creating first enemy barrack:', error);
        }
        
    }, 2000); // First barrack after 2 seconds
    
    // Create second barrack after 5 seconds
    setTimeout(() => {
        if (gameWon || !towerModel) {
            console.log('Game won or tower model not loaded, skipping second barrack creation');
            return;
        }
        
        // Random position on enemy side (z > 0)
        const x = (Math.random() - 0.5) * (MAP_WIDTH * 0.8);
        const z = MAP_WIDTH / 6 + Math.random() * (MAP_WIDTH / 3);
        
        console.log(`Creating second enemy barrack at (${x}, 0, ${z})`);
        
        try {
            const barrack = {
                object: towerModel.clone(),
                type: 'tower',
                lastSpawnTime: 0,
                spawnCooldown: TOWER_UNIT_COOLDOWN * 1.5, // Slower than player's towers
                unitType: UNIT_TYPES.BALLISTA // Second barrack spawns BALLISTA units
            };
            
            // Position and scale the barrack
            barrack.object.position.set(x, 0, z);
            barrack.object.rotation.y = Math.PI; // Face towards player base
            
            // Add to scene and array
            scene.add(barrack.object);
            enemyBuildings.push(barrack);
            
            console.log('Second enemy barrack created successfully');
            
        } catch (error) {
            console.error('Error creating second enemy barrack:', error);
        }
        
    }, 5000); // Second barrack after 5 seconds
}

function restartGame() {
    // Reset game state
    enemyBaseHealth = BASE_MAX_HEALTH;
    playerBaseHealth = BASE_MAX_HEALTH;
    updateEnemyBaseHealth();
    updatePlayerBaseHealth();
    gold = 1000;
    updateGoldDisplay();
    
    // Clear existing units and buildings
    units.length = 0;
    buildings.length = 0;
    enemyUnits.length = 0;
    
    // Remove enemy buildings from scene
    enemyBuildings.forEach(barrack => {
        scene.remove(barrack.object);
    });
    enemyBuildings.length = 0;
    
    // Hide win screen
    document.getElementById('win-screen').style.display = 'none';
    gameWon = false;
    
    // Reset spawn timers
    lastEnemySpawnTime = 0;
    
    // Create enemy barracks
    createEnemyBarracks();
}

// Add these variables at the top with other global variables
let decorativeModels = {
    groundHills: null,
    rocksLarge: null,
    treeLarge: null,
    treeLog: null
};

function loadDecorativeModels() {
    try {
        const modelLoader = new GLTFLoader();
        modelLoader.setPath('assets/models/');
        
        // Configure texture loading
        modelLoader.manager.onStart = function (url, itemsLoaded, itemsTotal) {
            console.log('Loading model: ' + url);
        };
        
        modelLoader.manager.onError = function (url) {
            console.error('Error loading model: ' + url);
        };
        
        // Configure DRACO loader for compressed models
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        modelLoader.setDRACOLoader(dracoLoader);
        
        // Function to handle model loading
        const onLoad = (gltf, modelType) => {
            try {
                const model = gltf.scene;
                
                // Update color management for the model
                model.traverse((child) => {
                    if (child.isMesh && child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        materials.forEach(mat => {
                            if (mat.map) {
                                mat.map.colorSpace = THREE.SRGBColorSpace;
                                mat.needsUpdate = true;
                            }
                            if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
                            if (mat.aoMap) mat.aoMap.colorSpace = THREE.SRGBColorSpace;
                            if (mat.normalMap) mat.normalMap.colorSpace = THREE.NoColorSpace;
                        });
                    }
                });
                // Assign to the correct property in decorativeModels
                switch(modelType) {
                    case 'groundHills': decorativeModels.groundHills = model; break;
                    case 'rocksLarge': decorativeModels.rocksLarge = model; break;
                    case 'treeLarge': decorativeModels.treeLarge = model; break;
                    case 'treeLog': decorativeModels.treeLog = model; break;
                }
                createMapDecorations();
            } catch (error) {
                console.error(`Error processing ${modelType}:`, error);
            }
        };
    
        // Load ground hills
        modelLoader.load('ground-hills.glb', (gltf) => {
            onLoad(gltf, 'groundHills');
        }, undefined, (error) => {
            console.error('Error loading ground-hills.glb:', error);
        });
        
        // Load large rocks
        modelLoader.load('rocks-large.glb', (gltf) => {
            onLoad(gltf, 'rocksLarge');
        }, undefined, (error) => {
            console.error('Error loading rocks-large.glb:', error);
        });
        
        // Load large trees
        modelLoader.load('tree-large.glb', (gltf) => {
            onLoad(gltf, 'treeLarge');
        }, undefined, (error) => {
            console.error('Error loading tree-large.glb:', error);
        });
        
        // Load tree logs
        modelLoader.load('tree-log.glb', (gltf) => {
            onLoad(gltf, 'treeLog');
        }, undefined, (error) => {
            console.error('Error loading tree-log.glb:', error);
        });
    } catch (error) {
        console.error('Error in loadDecorativeModels:', error);
    }
}

function createMapDecorations() {
    // Only proceed if all models are loaded
    if (!decorativeModels.groundHills || !decorativeModels.rocksLarge || 
        !decorativeModels.treeLarge || !decorativeModels.treeLog) {
        return;
    }
    
    // Clear any existing decorative objects
    decorativeObjects.forEach(obj => {
        scene.remove(obj);
    });
    decorativeObjects = [];
    
    // Define green zone boundaries (neutral zone in the middle)
    const mapWidth = MAP_WIDTH * 0.8;  // 80% of map width
    const zoneWidth = MAP_WIDTH / 3;   // Width of each zone
    const neutralZoneZStart = -zoneWidth / 2;  // Start of green zone (Z axis)
    const neutralZoneZEnd = zoneWidth / 2;     // End of green zone (Z axis)
    
    // Add ground hills (fewer, larger elements)
    for (let i = 0; i < 5; i++) {
        const hill = decorativeModels.groundHills.clone();
        const scale = 0.5 + Math.random() * 0.5;
        
        hill.scale.set(scale, scale, scale);
        
        // Position randomly in the green zone
        const x = (Math.random() - 0.5) * mapWidth;
        const z = neutralZoneZStart + Math.random() * (neutralZoneZEnd - neutralZoneZStart);
        
        hill.position.set(x, 0, z);
        hill.rotation.y = Math.random() * Math.PI * 2;
        
        scene.add(hill);
        decorativeObjects.push(hill);
    }
    
    // Add large rocks (more elements)
    for (let i = 0; i < 15; i++) {
        const rock = decorativeModels.rocksLarge.clone();
        const scale = 0.3 + Math.random() * 0.4;
        
        rock.scale.set(scale, scale, scale);
        
        // Position randomly in the green zone
        const x = (Math.random() - 0.5) * mapWidth;
        const z = neutralZoneZStart + Math.random() * (neutralZoneZEnd - neutralZoneZStart);
        
        rock.position.set(x, 0, z);
        rock.rotation.y = Math.random() * Math.PI * 2;
        
        scene.add(rock);
        decorativeObjects.push(rock);
    }
    
    // Add large trees (medium number of elements)
    for (let i = 0; i < 10; i++) {
        const tree = decorativeModels.treeLarge.clone();
        const scale = 0.8 + Math.random() * 0.4;
        
        tree.scale.set(scale, scale, scale);
        
        // Position randomly in the green zone, but avoid the center path
        let x, z;
        do {
            x = (Math.random() - 0.5) * mapWidth;
            z = neutralZoneZStart + Math.random() * (neutralZoneZEnd - neutralZoneZStart);
        } while (Math.abs(x) < 2); // Keep trees away from the center path
        
        tree.position.set(x, 0, z);
        tree.rotation.y = Math.random() * Math.PI * 2;
        
        scene.add(tree);
        decorativeObjects.push(tree);
    }
    
    console.log('Map decorations created in the green zone');
}
// Кінець області видимості глобальних функцій


function createModelViewer(model, containerId, size = 1, rotation = { x: 0, y: 0, z: 0 }) {
    const container = document.getElementById(containerId);
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    const renderer = new THREE.WebGLRenderer({ 
        alpha: true, 
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
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
        loader.load('assets/models/tower-slant-roof.glb', 
            (gltf) => handleLoad(gltf, 'castle'), 
            undefined, 
            (error) => {
                console.error('Error loading tower-slant-roof.glb:', error);
                // Even if loading fails, we need to continue
                loadedCount++;
                if (loadedCount >= totalModels) resolve();
            }
        );
        
        loader.load('assets/models/tower-square-roof.glb', 
            (gltf) => {
                console.log('Successfully loaded tower model');
                handleLoad(gltf, 'tower');
                // Log the model properties
                const model = gltf.scene;
                console.log('Tower model scale:', model.scale);
                console.log('Tower model position:', model.position);
                console.log('Tower model rotation:', model.rotation);
            }, 
            (xhr) => {
                console.log('Loading tower model: ' + (xhr.loaded / xhr.total * 100) + '% loaded');
            },
            (error) => {
                console.error('Error loading tower-square-roof.glb:', error);
                loadedCount++;
                if (loadedCount >= totalModels) resolve();
            }
        );
        
        loader.load('assets/models/bridge-straight.glb', 
            (gltf) => handleLoad(gltf, 'gate'), 
            undefined, 
            (error) => {
                console.error('Error loading bridge-straight.glb:', error);
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

    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: 'high-performance',
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x87ceeb);
    // Use the new color management API
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);

    const planeWidth = MAP_WIDTH;
    const zoneDepth = MAP_WIDTH / 3;
    
    // Синя зона гравця (ліва частина)
    const playerPlaneMaterial = new THREE.MeshLambertMaterial({ color: 0x1e90ff, side: THREE.DoubleSide });
    const playerPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(planeWidth, zoneDepth),
        playerPlaneMaterial
    );
    playerPlane.rotation.x = Math.PI / 2;
    playerPlane.position.z = -MAP_WIDTH / 3; // Ліва частина
    scene.add(playerPlane);
    
    // Зелена нейтральна зона (центр)
    const neutralPlaneMaterial = new THREE.MeshLambertMaterial({ color: 0x00aa00, side: THREE.DoubleSide });
    const neutralPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(planeWidth, zoneDepth),
        neutralPlaneMaterial
    );
    neutralPlane.rotation.x = Math.PI / 2;
    neutralPlane.position.z = 0; // Центр
    scene.add(neutralPlane);

    // Червона зона ворога (права частина)
    const enemyPlaneMaterial = new THREE.MeshLambertMaterial({ color: 0xaa0000, side: THREE.DoubleSide });
    const enemyPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(planeWidth, zoneDepth),
        enemyPlaneMaterial
    );
    enemyPlane.rotation.x = Math.PI / 2;
    enemyPlane.position.z = MAP_WIDTH / 3; // Права частина
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
    worker.position.set(0, 0, -MAP_WIDTH / 3); // Переміщуємо робочого на синю зону
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

    // Initialize model viewers after models are loaded (only if containers exist)
    setTimeout(() => {
        const unitModelContainer = document.getElementById('unit-model');
        const backModelContainer = document.getElementById('back-model');
        
        if (workerModel && unitModelContainer) {
            createModelViewer(workerModel, 'unit-model', 1.5, { x: 0, y: 0, z: 0 });
        }
        if (gateModel && backModelContainer) {
            createModelViewer(gateModel, 'back-model', 1, { x: 0, y: Math.PI/4, z: 0 });
        }
    }, 500);
    
    // Load decorative models
    loadDecorativeModels();
    
    updateGoldDisplay();
    updatePlayerBaseHealth();
    updateEnemyBaseHealth();
    
    // Create decorative elements
    createMapDecorations();
    
    // Create enemy barracks
    createEnemyBarracks();

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

    // Spawn enemy units periodically
    const currentTime = Date.now();
    if (currentTime - lastEnemySpawnTime > ENEMY_SPAWN_COOLDOWN) {
        spawnEnemyUnit();
        lastEnemySpawnTime = currentTime;
    }
    
    // Update enemy units
    updateEnemyUnits(delta);

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

    // Use the already defined currentTime variable
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