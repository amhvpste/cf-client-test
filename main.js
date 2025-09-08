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
const buildingCosts = {
    castle: 400,
    tower: 200
};

const buildings = [];
const units = [];

const MAP_WIDTH = 20;
const PLAYER_SIDE_Z_MAX = 0;
const ENEMY_BASE_TARGET = new THREE.Vector3(0, 0, MAP_WIDTH / 4);
const PLAYER_BASE_TARGET = new THREE.Vector3(0, 0, -MAP_WIDTH / 4);
const ENEMY_BASE_MAX_HEALTH = 100;
let enemyBaseHealth = ENEMY_BASE_MAX_HEALTH;
const UNIT_DAMAGE = 5;

const CASTLE_UNIT_COOLDOWN = 5000;
const TOWER_UNIT_COOLDOWN = 10000;

const loader = new GLTFLoader();

// Початок області видимості глобальних функцій
function updateGoldDisplay() {
    document.getElementById('gold-display').innerText = `gold: ${gold}`;
    checkButtonAvailability();
}

function updateUnitCount() {
    document.getElementById('unit-count').innerText = `units on map: ${units.length}`;
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
    
    console.log(`Спавн юніта з будівлі типу: ${building.type}.`);
    const newUnit = unitModel.clone();
    newUnit.position.copy(building.object.position);
    newUnit.target = ENEMY_BASE_TARGET.clone();
    newUnit.hasAttacked = false;
    scene.add(newUnit);
    units.push(newUnit);
    updateUnitCount();
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


function loadModels() {
    return new Promise((resolve) => {
        let loadedCount = 0;
        const totalModels = 5;

        const handleLoad = (gltf, modelType) => {
            console.log(`Модель '${modelType}' успішно завантажена.`);
            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const maxDimension = Math.max(size.x, size.y, size.z);
            const scaleFactor = 1.5 / maxDimension;

            model.scale.multiplyScalar(scaleFactor);
            
            if (modelType === 'worker') {
                workerModel = model;
                workerModel.rotation.y = Math.PI / 2;
            } else if (modelType === 'unit') {
                unitModel = model;
                unitModel.rotation.y = Math.PI / 2;
            } else if (modelType === 'castle') {
                castleModel = model;
            } else if (modelType === 'tower') {
                towerModel = model;
            } else if (modelType === 'gate') {
                gateModel = model;
            }

            loadedCount++;
            if (loadedCount === totalModels) {
                console.log("Усі моделі завантажено!");
                resolve();
            }
        };

        loader.load('worker2.glb', (gltf) => handleLoad(gltf, 'worker'), undefined, (error) => console.error('Помилка завантаження worker2.glb', error));
        loader.load('test-unit.glb', (gltf) => handleLoad(gltf, 'unit'), undefined, (error) => console.error('Помилка завантаження test-unit.glb', error));
        loader.load('castle_fort_01.glb', (gltf) => handleLoad(gltf, 'castle'), undefined, (error) => console.error('Помилка завантаження castle_fort_01.glb', error));
        loader.load('tower1.glb', (gltf) => handleLoad(gltf, 'tower'), undefined, (error) => console.error('Помилка завантаження tower1.glb', error));
        loader.load('castle_gate_01.glb', (gltf) => handleLoad(gltf, 'gate'), undefined, (error) => console.error('Помилка завантаження castle_gate_01.glb', error));
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

function animate() {
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
            const building = currentBuildingModel.clone();
            building.position.copy(targetPosition);
            
            const buildingType = getSelectedBuildingType();
            
            buildings.push({
                object: building,
                lastSpawnTime: Date.now(),
                type: buildingType
            });
            scene.add(building);
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
            unit.position.add(direction.multiplyScalar(0.05));
            // Check if unit reached enemy base
            if (unit.position.distanceTo(ENEMY_BASE_TARGET) < 2 && !unit.hasAttacked) {
                unit.hasAttacked = true;
                enemyBaseHealth = Math.max(0, enemyBaseHealth - UNIT_DAMAGE);
                updateEnemyBaseHealth();
                scene.remove(unit);
                const index = units.indexOf(unit);
                if (index > -1) {
                    units.splice(index, 1);
                }
                checkWinCondition();
            }
        }
    }

    renderer.render(scene, camera);
}

loadModels().then(() => {
    init();
    animate();
});