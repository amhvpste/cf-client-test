# Create directories
$directories = @(
    "assets\models",
    "assets\textures",
    "assets\ui",
    "assets\icons"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}

# Move 3D model files
$modelFiles = @(
    "barracks.gltf.glb",
    "castle_fort_01.glb",
    "castle_gate_01.glb",
    "chest.glb",
    "coin.glb",
    "flag.glb",
    "ground-hills.glb",
    "ground.glb",
    "rocks-large.glb",
    "siege-ballista.glb",
    "siege-ram.glb",
    "test-unit.glb",
    "tower1.glb",
    "tree-large.glb",
    "tree-log.glb",
    "wall_01.glb",
    "worker2.glb"
)

foreach ($file in $modelFiles) {
    if (Test-Path $file) {
        Move-Item -Path $file -Destination "assets\models\" -Force
    }
}

# Move texture files
$textureFiles = @(
    "background-test.jpg",
    "castle_atlas.png",
    "castle_atlas_addons.png",
    "castle_foliage.png"
)

foreach ($file in $textureFiles) {
    if (Test-Path $file) {
        Move-Item -Path $file -Destination "assets\textures\" -Force
    }
}

# Move icon files
$iconFiles = @(
    "castle_icon.png",
    "tower_icon.png",
    "units_icon.png"
)

foreach ($file in $iconFiles) {
    if (Test-Path $file) {
        Move-Item -Path $file -Destination "assets\icons\" -Force
    }
}

Write-Host "Files have been organized successfully!"
