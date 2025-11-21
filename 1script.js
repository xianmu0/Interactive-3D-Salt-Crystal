// 3D晶体结构模型查看器
// 支持 NaCl 和 PCl5 模型

let scene, camera, renderer, controls;
let currentModel = 'nacl'; // 当前显示的模型
let ions = [];
let bonds = [];
let lights = [];

// 等待 Three.js 和 OrbitControls 加载完成
function init() {
    if (typeof THREE === 'undefined') {
        console.error('Three.js 未加载！');
        document.body.innerHTML += '<div style="color:white;padding:20px;">错误：Three.js 未加载。请检查网络连接。</div>';
        return;
    }

    console.log('Three.js 已加载，版本:', THREE.REVISION);

    // 场景、相机、渲染器
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a); // 深空黑背景

    const container = document.getElementById('canvas-container');
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(15, 15, 15);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 防止页面滚动干扰3D交互
    document.addEventListener('touchmove', (e) => {
        // 如果在canvas区域触摸，阻止页面滚动
        const target = e.target;
        if (target === renderer.domElement || renderer.domElement.contains(target)) {
            e.preventDefault();
        }
        // 如果是下拉菜单，允许滚动
        if (target.closest('#model-select')) {
            return; // 不阻止下拉菜单的默认行为
        }
    }, { passive: false });
    
    // 防止双击缩放
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, { passive: false });

    // 轨道控制器（支持鼠标和触控）
    if (typeof THREE.OrbitControls !== 'undefined') {
        try {
            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.minDistance = 5;
            controls.maxDistance = 50;
            controls.enablePan = true;
            // 确保触控支持启用
            controls.enableRotate = true;
            controls.enableZoom = true;
            
            // 触控配置（根据 Three.js 版本不同可能有所不同）
            if (THREE.TOUCH) {
                controls.touches = {
                    ONE: THREE.TOUCH.ROTATE,
                    TWO: THREE.TOUCH.DOLLY_PAN
                };
            }
            
            // 防止页面滚动干扰
            renderer.domElement.style.touchAction = 'none';
            
            console.log('OrbitControls 初始化成功（支持触控）');
        } catch (e) {
            console.error('OrbitControls 初始化失败:', e);
            setupFallbackControls();
        }
    } else {
        setupFallbackControls();
    }

    // 柔和光照设置
    setupLights();

    // 模型切换事件
    document.getElementById('model-select').addEventListener('change', (e) => {
        switchModel(e.target.value);
    });

    // 创建初始模型
    switchModel('nacl');

    // 动画循环
    function animate() {
        requestAnimationFrame(animate);
        
        if (controls) {
            controls.update();
        }
        
        renderer.render(scene, camera);
    }

    animate();

    // 响应窗口大小变化
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// 设置光照
function setupLights() {
    // 清空现有光源
    lights.forEach(light => scene.remove(light));
    lights = [];

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    lights.push(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight1.position.set(10, 10, 5);
    directionalLight1.castShadow = true;
    directionalLight1.shadow.mapSize.width = 2048;
    directionalLight1.shadow.mapSize.height = 2048;
    scene.add(directionalLight1);
    lights.push(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight2.position.set(-10, -5, -5);
    scene.add(directionalLight2);
    lights.push(directionalLight2);

    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(0, 0, 10);
    scene.add(pointLight);
    lights.push(pointLight);
}

// 备用控制（鼠标和触控）
function setupFallbackControls() {
    console.warn('OrbitControls 不可用，将使用备用控制（支持触控）');
    
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    
    // 触控相关变量
    let touchStartDistance = 0;
    let touchStartZoom = 15;
    let lastTouchCenter = { x: 0, y: 0 };
    let lastRotation = { x: 0, y: 0 };
    
    // 获取两点之间的距离
    function getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // 获取两点中心
    function getTouchCenter(touches) {
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2
        };
    }
    
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.style.touchAction = 'none'; // 防止默认触摸行为
    
    // 鼠标事件
    renderer.domElement.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
            renderer.domElement.style.cursor = 'grabbing';
            e.preventDefault();
        }
    }, { passive: false });
    
    renderer.domElement.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;
            scene.rotation.y += deltaX * 0.01;
            scene.rotation.x += deltaY * 0.01;
            previousMousePosition = { x: e.clientX, y: e.clientY };
            e.preventDefault();
        }
    }, { passive: false });
    
    renderer.domElement.addEventListener('mouseup', () => {
        isDragging = false;
        renderer.domElement.style.cursor = 'grab';
    });
    
    renderer.domElement.addEventListener('mouseleave', () => {
        isDragging = false;
        renderer.domElement.style.cursor = 'grab';
    });
    
    renderer.domElement.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = 1 + e.deltaY * 0.001;
        camera.position.multiplyScalar(factor);
        if (camera.position.length() < 5) camera.position.normalize().multiplyScalar(5);
        if (camera.position.length() > 50) camera.position.normalize().multiplyScalar(50);
    }, { passive: false });
    
    // 触控事件
    renderer.domElement.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
            // 单指旋转
            previousMousePosition = { 
                x: e.touches[0].clientX, 
                y: e.touches[0].clientY 
            };
            isDragging = true;
        } else if (e.touches.length === 2) {
            // 双指缩放
            touchStartDistance = getTouchDistance(e.touches);
            touchStartZoom = camera.position.length();
            lastTouchCenter = getTouchCenter(e.touches);
        }
    }, { passive: false });
    
    renderer.domElement.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && isDragging) {
            // 单指旋转
            const deltaX = e.touches[0].clientX - previousMousePosition.x;
            const deltaY = e.touches[0].clientY - previousMousePosition.y;
            scene.rotation.y += deltaX * 0.01;
            scene.rotation.x += deltaY * 0.01;
            previousMousePosition = { 
                x: e.touches[0].clientX, 
                y: e.touches[0].clientY 
            };
        } else if (e.touches.length === 2) {
            // 双指缩放
            const currentDistance = getTouchDistance(e.touches);
            const zoomFactor = touchStartDistance / currentDistance;
            const newZoom = touchStartZoom * zoomFactor;
            
            if (newZoom >= 5 && newZoom <= 50) {
                camera.position.normalize().multiplyScalar(newZoom);
            }
            
            // 双指平移（可选）
            const currentCenter = getTouchCenter(e.touches);
            const deltaX = (currentCenter.x - lastTouchCenter.x) * 0.01;
            const deltaY = (currentCenter.y - lastTouchCenter.y) * 0.01;
            camera.position.x -= deltaX;
            camera.position.y += deltaY;
            lastTouchCenter = currentCenter;
        }
    }, { passive: false });
    
    renderer.domElement.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (e.touches.length === 0) {
            isDragging = false;
        } else if (e.touches.length === 1) {
            // 从双指变为单指，更新触摸位置
            previousMousePosition = { 
                x: e.touches[0].clientX, 
                y: e.touches[0].clientY 
            };
        }
    }, { passive: false });
    
    renderer.domElement.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        isDragging = false;
    }, { passive: false });
}

// 清除当前模型
function clearModel() {
    ions.forEach(ion => scene.remove(ion));
    bonds.forEach(bond => scene.remove(bond));
    ions = [];
    bonds = [];
}

// 切换模型
function switchModel(modelType) {
    clearModel();
    currentModel = modelType;
    
    // 更新UI
    const title = document.getElementById('model-title');
    const naclLegend = document.getElementById('nacl-legend');
    const pcl5Legend = document.getElementById('pcl5-legend');
    
    if (modelType === 'nacl') {
        title.textContent = 'NaCl 晶体结构';
        naclLegend.style.display = 'block';
        pcl5Legend.style.display = 'none';
        createNaClCrystal();
        // 重置相机位置
        camera.position.set(15, 15, 15);
        camera.lookAt(0, 0, 0);
    } else if (modelType === 'pcl5') {
        title.textContent = 'PCl₅ 分子结构';
        naclLegend.style.display = 'none';
        pcl5Legend.style.display = 'block';
        createPCl5Molecule();
        // 重置相机位置
        camera.position.set(10, 10, 10);
        camera.lookAt(0, 0, 0);
    }
    
    if (controls) {
        controls.target.set(0, 0, 0);
        controls.update();
    }
}

// 创建化学键的辅助函数
function createBond(start, end, radius = 0.15) {
    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    
    const bondGeometry = new THREE.CylinderGeometry(radius, radius, 1, 16);
    const bondMaterial = new THREE.MeshPhongMaterial({
        color: 0x888888,
        shininess: 50
    });
    
    const bond = new THREE.Mesh(bondGeometry, bondMaterial);
    bond.position.copy(midPoint);
    
    // 旋转圆柱体指向正确的方向
    const up = new THREE.Vector3(0, 1, 0);
    const axis = new THREE.Vector3().crossVectors(up, direction);
    
    if (axis.length() > 0.001) {
        axis.normalize();
        const angle = Math.acos(Math.max(-1, Math.min(1, up.dot(direction.normalize()))));
        bond.setRotationFromAxisAngle(axis, angle);
    } else if (direction.y < 0) {
        bond.rotateX(Math.PI);
    }
    
    bond.scale.y = length;
    return bond;
}

// 生成NaCl晶体结构（3x3x3单元）
function createNaClCrystal() {
    const UNIT_CELL_SIZE = 2;
    const ION_RADIUS_NA = 0.4;
    const ION_RADIUS_CL = 0.5;
    const COLOR_NA = 0x9b59b6; // 紫色
    const COLOR_CL = 0x2ecc71; // 绿色
    const BOND_RADIUS = 0.15; // 键的半径（加粗以明显显示）

    // 创建几何体和材质
    const naGeometry = new THREE.SphereGeometry(ION_RADIUS_NA, 32, 32);
    const naMaterial = new THREE.MeshPhongMaterial({
        color: COLOR_NA,
        shininess: 100,
        specular: 0x222222
    });

    const clGeometry = new THREE.SphereGeometry(ION_RADIUS_CL, 32, 32);
    const clMaterial = new THREE.MeshPhongMaterial({
        color: COLOR_CL,
        shininess: 100,
        specular: 0x222222
    });

    const ionPositions = new Map();
    const gridSize = 3;

    // 遍历所有单元
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            for (let k = 0; k < gridSize; k++) {
                const offsetX = (i - gridSize / 2 + 0.5) * UNIT_CELL_SIZE;
                const offsetY = (j - gridSize / 2 + 0.5) * UNIT_CELL_SIZE;
                const offsetZ = (k - gridSize / 2 + 0.5) * UNIT_CELL_SIZE;
                
                const positions = [
                    { type: 'na', x: 0, y: 0, z: 0 },
                    { type: 'na', x: 0.5, y: 0.5, z: 0 },
                    { type: 'na', x: 0.5, y: 0, z: 0.5 },
                    { type: 'na', x: 0, y: 0.5, z: 0.5 },
                    { type: 'cl', x: 0.5, y: 0, z: 0 },
                    { type: 'cl', x: 0, y: 0.5, z: 0 },
                    { type: 'cl', x: 0, y: 0, z: 0.5 },
                    { type: 'cl', x: 0.5, y: 0.5, z: 0.5 }
                ];
                
                positions.forEach(pos => {
                    const x = offsetX + (pos.x - 0.25) * UNIT_CELL_SIZE;
                    const y = offsetY + (pos.y - 0.25) * UNIT_CELL_SIZE;
                    const z = offsetZ + (pos.z - 0.25) * UNIT_CELL_SIZE;
                    
                    const key = `${Math.round(x * 100)}_${Math.round(y * 100)}_${Math.round(z * 100)}`;
                    if (ionPositions.has(key)) return;
                    
                    const ionMesh = pos.type === 'na' 
                        ? new THREE.Mesh(naGeometry, naMaterial)
                        : new THREE.Mesh(clGeometry, clMaterial);
                    
                    ionMesh.position.set(x, y, z);
                    ionMesh.castShadow = true;
                    ionMesh.receiveShadow = true;
                    
                    scene.add(ionMesh);
                    ions.push(ionMesh);
                    
                    ionPositions.set(key, {
                        mesh: ionMesh,
                        type: pos.type,
                        position: new THREE.Vector3(x, y, z)
                    });
                });
            }
        }
    }
    
    // 创建化学键（连接最近邻的相反电荷离子）
    const createdBonds = new Set();
    const bondDistance = UNIT_CELL_SIZE / 2;
    const tolerance = 0.2;
    
    ionPositions.forEach((ion1, key1) => {
        ionPositions.forEach((ion2, key2) => {
            if (key1 === key2 || ion1.type === ion2.type) return;
            
            const distance = ion1.position.distanceTo(ion2.position);
            
            if (Math.abs(distance - bondDistance) < tolerance) {
                const bondKey = key1 < key2 ? `${key1}_${key2}` : `${key2}_${key1}`;
                
                if (createdBonds.has(bondKey)) return;
                
                createdBonds.add(bondKey);
                
                const bond = createBond(ion1.position, ion2.position, BOND_RADIUS);
                scene.add(bond);
                bonds.push(bond);
            }
        });
    });
    
    console.log(`✓ NaCl: 创建了 ${ions.length} 个离子和 ${bonds.length} 条化学键`);
}

// 生成PCl5分子结构（三角双锥）
function createPCl5Molecule() {
    const COLOR_P = 0xe67e22; // 橙色
    const COLOR_CL = 0x2ecc71; // 绿色
    const BOND_RADIUS = 0.12; // 键的半径
    
    // PCl5的键长（缩放后）
    const EQUATORIAL_BOND_LENGTH = 2.0; // 赤道键长
    const AXIAL_BOND_LENGTH = 2.1; // 轴向键长（稍长）
    
    // 原子半径
    const RADIUS_P = 0.6;
    const RADIUS_CL = 0.5;
    
    // 创建几何体和材质
    const pGeometry = new THREE.SphereGeometry(RADIUS_P, 32, 32);
    const pMaterial = new THREE.MeshPhongMaterial({
        color: COLOR_P,
        shininess: 100,
        specular: 0x222222
    });
    
    const clGeometry = new THREE.SphereGeometry(RADIUS_CL, 32, 32);
    const clMaterial = new THREE.MeshPhongMaterial({
        color: COLOR_CL,
        shininess: 100,
        specular: 0x222222
    });
    
    // 中心P原子
    const pAtom = new THREE.Mesh(pGeometry, pMaterial);
    pAtom.position.set(0, 0, 0);
    pAtom.castShadow = true;
    pAtom.receiveShadow = true;
    scene.add(pAtom);
    ions.push(pAtom);
    
    const pPosition = new THREE.Vector3(0, 0, 0);
    const clPositions = [];
    
    // 3个赤道Cl原子（在xy平面上，形成等边三角形）
    for (let i = 0; i < 3; i++) {
        const angle = (i * 2 * Math.PI / 3) - Math.PI / 6; // 旋转起始角度
        const x = EQUATORIAL_BOND_LENGTH * Math.cos(angle);
        const y = EQUATORIAL_BOND_LENGTH * Math.sin(angle);
        const z = 0;
        
        const clAtom = new THREE.Mesh(clGeometry, clMaterial);
        clAtom.position.set(x, y, z);
        clAtom.castShadow = true;
        clAtom.receiveShadow = true;
        scene.add(clAtom);
        ions.push(clAtom);
        
        clPositions.push(new THREE.Vector3(x, y, z));
        
        // 创建P-Cl键（赤道）
        const bond = createBond(pPosition, new THREE.Vector3(x, y, z), BOND_RADIUS);
        scene.add(bond);
        bonds.push(bond);
    }
    
    // 2个轴向Cl原子（一个在上方，一个在下方）
    const axialCl1 = new THREE.Mesh(clGeometry, clMaterial);
    axialCl1.position.set(0, 0, AXIAL_BOND_LENGTH);
    axialCl1.castShadow = true;
    axialCl1.receiveShadow = true;
    scene.add(axialCl1);
    ions.push(axialCl1);
    
    const axialCl2 = new THREE.Mesh(clGeometry, clMaterial);
    axialCl2.position.set(0, 0, -AXIAL_BOND_LENGTH);
    axialCl2.castShadow = true;
    axialCl2.receiveShadow = true;
    scene.add(axialCl2);
    ions.push(axialCl2);
    
    // 创建P-Cl键（轴向）
    const bond1 = createBond(pPosition, new THREE.Vector3(0, 0, AXIAL_BOND_LENGTH), BOND_RADIUS);
    scene.add(bond1);
    bonds.push(bond1);
    
    const bond2 = createBond(pPosition, new THREE.Vector3(0, 0, -AXIAL_BOND_LENGTH), BOND_RADIUS);
    scene.add(bond2);
    bonds.push(bond2);
    
    console.log(`✓ PCl5: 创建了 ${ions.length} 个原子和 ${bonds.length} 条化学键`);
}

// 页面加载完成后初始化
window.addEventListener('load', () => {
    let attempts = 0;
    const maxAttempts = 50;
    const checkThree = setInterval(() => {
        if (typeof THREE !== 'undefined') {
            clearInterval(checkThree);
            init();
        } else {
            attempts++;
            if (attempts >= maxAttempts) {
                clearInterval(checkThree);
                console.error('Three.js 加载超时');
                document.body.innerHTML += '<div style="color:white;padding:20px;background:red;">错误：Three.js 加载超时。请刷新页面重试。</div>';
            }
        }
    }, 100);
});
