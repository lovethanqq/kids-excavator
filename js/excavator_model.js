// High-Detail Articulated 3D Excavator Generator for Three.js
// Features full hydraulic kinematics, dual-track chassis, realistic cabin, and exhaust particle smoke

class Excavator3D {
    constructor(scene) {
        this.scene = scene;
        this.root = new THREE.Group();
        this.scene.add(this.root);

        // Materials definition
        this.initMaterials();

        // Mechanical Hierarchies
        this.tracksGroup = new THREE.Group();
        this.cabGroup = new THREE.Group();
        this.boomGroup = new THREE.Group();
        this.armGroup = new THREE.Group();
        this.bucketGroup = new THREE.Group();

        // Smoke particles pool
        this.smokeParticles = [];
        this.lastSmokeTime = 0;

        // Current Joint angles
        this.angles = {
            bodyRot: 0,
            boom: 0.35,      // 大臂抬升弧度
            arm: 0.8,        // 小臂弯曲弧度
            bucket: 0.4      // 铲斗翻转弧度
        };

        // Build all detailed modules
        this.buildChassis();
        this.buildUpperBody();
        this.buildFrontArmSystem();

        // Connect groups
        this.root.add(this.tracksGroup);
        this.root.add(this.cabGroup);

        // Beacon light reference
        this.beaconLight = null;
        this.beaconAngle = 0;
        this.headlights = [];

        // Track animation offset
        this.trackOffset = 0;
    }

    initMaterials() {
        // 经典工程亮黄（CAT Yellow），PBR光泽
        this.matYellow = new THREE.MeshStandardMaterial({
            color: 0xf5a623,
            roughness: 0.32,
            metalness: 0.25,
            flatShading: false
        });

        // 辅助深黄
        this.matYellowDark = new THREE.MeshStandardMaterial({
            color: 0xd98214,
            roughness: 0.4,
            metalness: 0.2
        });

        // 黑色/深灰重工业钢构件
        this.matDarkSteel = new THREE.MeshStandardMaterial({
            color: 0x222629,
            roughness: 0.55,
            metalness: 0.55
        });

        // 履带与橡胶管
        this.matRubber = new THREE.MeshStandardMaterial({
            color: 0x181818,
            roughness: 0.85,
            metalness: 0.1
        });

        // 镀铬镜面活塞杆（高反光金属）
        this.matChrome = new THREE.MeshStandardMaterial({
            color: 0xf0f3f6,
            roughness: 0.08,
            metalness: 0.95
        });

        // 驾驶室通透天蓝防爆玻璃
        this.matGlass = new THREE.MeshPhysicalMaterial({
            color: 0x80d8ff,
            transparent: true,
            opacity: 0.5,
            roughness: 0.1,
            metalness: 0.1,
            transmission: 0.6,
            ior: 1.5
        });

        // 发光 LED 前车灯
        this.matLight = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xfff6cf,
            emissiveIntensity: 1.2,
            roughness: 0.2
        });

        // 警示旋转黄灯
        this.matBeacon = new THREE.MeshStandardMaterial({
            color: 0xff7700,
            emissive: 0xff5500,
            emissiveIntensity: 1.5,
            transparent: true,
            opacity: 0.85
        });

        // 警示黑黄条纹贴板
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffb300';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#1e1e1e';
        for (let i = -128; i < 256; i += 32) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + 32, 128);
            ctx.lineTo(i + 16, 128);
            ctx.lineTo(i - 16, 0);
            ctx.fill();
        }
        const stripeTex = new THREE.CanvasTexture(canvas);
        stripeTex.wrapS = THREE.RepeatWrapping;
        stripeTex.wrapT = THREE.RepeatWrapping;
        this.matStripes = new THREE.MeshStandardMaterial({
            map: stripeTex,
            roughness: 0.4
        });
    }

    // 1. 底盘与双履带系统 (Dual Track Assembly)
    buildChassis() {
        const chassisCenter = new THREE.Mesh(
            new THREE.BoxGeometry(2.4, 0.6, 2.8),
            this.matDarkSteel
        );
        chassisCenter.position.y = 0.65;
        chassisCenter.castShadow = true;
        chassisCenter.receiveShadow = true;
        this.tracksGroup.add(chassisCenter);

        // 回转支承底座外圈
        const slewRing = new THREE.Mesh(
            new THREE.CylinderGeometry(1.2, 1.25, 0.25, 32),
            this.matDarkSteel
        );
        slewRing.position.y = 0.95;
        this.tracksGroup.add(slewRing);

        // 左右两条履带
        const leftTrack = this.createTrackUnit(1.55);
        const rightTrack = this.createTrackUnit(-1.55);
        this.tracksGroup.add(leftTrack);
        this.tracksGroup.add(rightTrack);
    }

    createTrackUnit(xPos) {
        const group = new THREE.Group();
        group.position.set(xPos, 0, 0);

        // 履带环形主体 (带圆角长条)
        const trackLength = 4.6;
        const trackHeight = 1.0;
        const trackWidth = 0.85;

        // 侧面黄色金属防撞侧梁
        const sideBeam = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.6, trackLength - 0.6),
            this.matYellowDark
        );
        sideBeam.position.set(xPos > 0 ? 0.42 : -0.42, 0.6, 0);
        sideBeam.castShadow = true;
        group.add(sideBeam);

        // 前后两颗大张紧驱动轮 (Sprocket & Idler)
        const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, trackWidth - 0.1, 24);
        wheelGeo.rotateZ(Math.PI / 2);

        const frontWheel = new THREE.Mesh(wheelGeo, this.matDarkSteel);
        frontWheel.position.set(0, 0.55, trackLength * 0.38);
        frontWheel.castShadow = true;
        group.add(frontWheel);

        const rearWheel = new THREE.Mesh(wheelGeo, this.matDarkSteel);
        rearWheel.position.set(0, 0.55, -trackLength * 0.38);
        rearWheel.castShadow = true;
        group.add(rearWheel);

        // 中间 4 个小承重支重轮 (Rollers)
        const rollerGeo = new THREE.CylinderGeometry(0.24, 0.24, trackWidth - 0.15, 16);
        rollerGeo.rotateZ(Math.PI / 2);
        for (let i = -1.2; i <= 1.2; i += 0.8) {
            const roller = new THREE.Mesh(rollerGeo, this.matDarkSteel);
            roller.position.set(0, 0.32, i);
            group.add(roller);
        }

        // 上方 2 个托带轮
        for (let i of [-0.8, 0.8]) {
            const topRoller = new THREE.Mesh(rollerGeo, this.matDarkSteel);
            topRoller.position.set(0, 0.85, i);
            group.add(topRoller);
        }

        // 外层橡胶/合金履带带体 (由履带底片拼出饱满机械感)
        const beltGeo = new THREE.BoxGeometry(trackWidth, 0.12, trackLength - 0.9);
        const bottomBelt = new THREE.Mesh(beltGeo, this.matRubber);
        bottomBelt.position.set(0, 0.08, 0);
        bottomBelt.receiveShadow = true;
        group.add(bottomBelt);

        const topBelt = new THREE.Mesh(beltGeo, this.matRubber);
        topBelt.position.set(0, 1.05, 0);
        topBelt.castShadow = true;
        group.add(topBelt);

        // 前后弯弧段履带板
        for (let a = 0; a < Math.PI; a += Math.PI / 6) {
            const shoeGeo = new THREE.BoxGeometry(trackWidth, 0.1, 0.32);
            // 前轮弧
            const shoeF = new THREE.Mesh(shoeGeo, this.matRubber);
            shoeF.position.set(
                0,
                0.55 + Math.cos(a) * 0.52,
                trackLength * 0.38 + Math.sin(a) * 0.52
            );
            shoeF.rotation.x = -a;
            group.add(shoeF);

            // 后轮弧
            const shoeR = new THREE.Mesh(shoeGeo, this.matRubber);
            shoeR.position.set(
                0,
                0.55 + Math.cos(a) * 0.52,
                -trackLength * 0.38 - Math.sin(a) * 0.52
            );
            shoeR.rotation.x = a;
            group.add(shoeR);
        }

        return group;
    }

    // 2. 上车身、驾驶舱与动力舱 (Cabin & Engine Compartment)
    buildUpperBody() {
        this.cabGroup.position.set(0, 1.1, 0);

        // 回转底盘上基座
        const upperBase = new THREE.Mesh(
            new THREE.BoxGeometry(3.1, 0.3, 4.4),
            this.matYellowDark
        );
        upperBase.position.set(0, 0.15, 0);
        upperBase.castShadow = true;
        this.cabGroup.add(upperBase);

        // 侧围黑黄反光防撞条
        const sideStripeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 4.3), this.matStripes);
        sideStripeL.position.set(1.56, 0.15, 0);
        this.cabGroup.add(sideStripeL);

        const sideStripeR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 4.3), this.matStripes);
        sideStripeR.position.set(-1.56, 0.15, 0);
        this.cabGroup.add(sideStripeR);

        // 发动机机舱 (机身右后侧与中后部)
        const engineBody = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 1.4, 2.7),
            this.matYellow
        );
        engineBody.position.set(0.65, 0.95, -0.65);
        engineBody.castShadow = true;
        this.cabGroup.add(engineBody);

        // 机罩弧度切角上盖
        const hoodCover = new THREE.Mesh(
            new THREE.CylinderGeometry(0.8, 0.8, 2.65, 16, 1, false, 0, Math.PI),
            this.matYellow
        );
        hoodCover.rotation.z = Math.PI / 2;
        hoodCover.rotation.y = Math.PI / 2;
        hoodCover.position.set(0.65, 1.65, -0.65);
        this.cabGroup.add(hoodCover);

        // 黑色散热进气格栅
        const grill = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 0.9, 1.8),
            this.matDarkSteel
        );
        grill.position.set(1.48, 1.0, -0.65);
        this.cabGroup.add(grill);

        // 尾部重型配重铁 (Counterweight)
        const counterweight = new THREE.Mesh(
            new THREE.BoxGeometry(3.08, 1.35, 0.9),
            this.matDarkSteel
        );
        counterweight.position.set(0, 0.95, -2.05);
        counterweight.castShadow = true;
        this.cabGroup.add(counterweight);

        // 配重后侧安全条纹
        const rearStripe = new THREE.Mesh(
            new THREE.BoxGeometry(2.9, 0.4, 0.05),
            this.matStripes
        );
        rearStripe.position.set(0, 0.85, -2.52);
        this.cabGroup.add(rearStripe);

        // 不锈钢排气管弯管
        const exhaust = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 0.9, 12),
            this.matChrome
        );
        exhaust.position.set(1.1, 2.0, -1.6);
        exhaust.rotation.x = 0.2;
        this.cabGroup.add(exhaust);
        this.exhaustTip = new THREE.Vector3(1.1, 2.45, -1.75); // 烟雾发射点

        // --- 驾驶室模块 (左侧 Cabin) ---
        const cab = new THREE.Group();
        cab.position.set(-0.85, 0.3, 0.3);

        // 驾驶室金属底座与后柱
        const cabFrame = new THREE.Mesh(
            new THREE.BoxGeometry(1.25, 1.7, 1.9),
            this.matYellow
        );
        cabFrame.position.set(0, 0.85, 0);
        cabFrame.castShadow = true;
        cab.add(cabFrame);

        // 大面积环视玻璃窗 (前挡、侧窗、顶窗)
        const frontWindow = new THREE.Mesh(
            new THREE.BoxGeometry(1.15, 1.3, 0.05),
            this.matGlass
        );
        frontWindow.position.set(0, 0.9, 0.96);
        frontWindow.rotation.x = -0.15;
        cab.add(frontWindow);

        const leftWindow = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 1.2, 1.5),
            this.matGlass
        );
        leftWindow.position.set(-0.64, 0.95, 0);
        cab.add(leftWindow);

        // 驾驶室内饰：黑色皮质工学座椅
        const seat = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.8, 0.6),
            this.matDarkSteel
        );
        seat.position.set(0, 0.6, -0.3);
        cab.add(seat);

        // 双液压手柄 (红色小圆头)
        for (let sx of [-0.22, 0.22]) {
            const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3), this.matDarkSteel);
            stick.position.set(sx, 0.8, 0.2);
            stick.rotation.x = 0.3;
            cab.add(stick);

            const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshStandardMaterial({ color: 0xe74c3c }));
            knob.position.set(sx, 0.95, 0.25);
            cab.add(knob);
        }

        // 车顶旋转警示爆闪灯 (Beacon Light)
        const beaconBase = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.15, 0.1, 16),
            this.matDarkSteel
        );
        beaconBase.position.set(-0.35, 1.75, -0.5);
        cab.add(beaconBase);

        const beaconDome = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.12, 0.22, 16),
            this.matBeacon
        );
        beaconDome.position.set(-0.35, 1.9, -0.5);
        cab.add(beaconDome);

        this.beaconLight = new THREE.PointLight(0xff7700, 1.8, 6);
        this.beaconLight.position.set(-0.35, 1.95, -0.5);
        cab.add(this.beaconLight);

        // 萌动超亮前大灯 (带灯杯和发光镜片)
        for (let hx of [-0.4, 0.4]) {
            const lampHousing = new THREE.Mesh(
                new THREE.CylinderGeometry(0.18, 0.22, 0.25, 16),
                this.matYellowDark
            );
            lampHousing.rotation.x = Math.PI / 2;
            lampHousing.position.set(hx, 1.6, 0.9);
            cab.add(lampHousing);

            const lampLens = new THREE.Mesh(
                new THREE.CircleGeometry(0.16, 16),
                this.matLight
            );
            lampLens.position.set(hx, 1.6, 1.03);
            cab.add(lampLens);

            // 前照聚光灯
            const spot = new THREE.SpotLight(0xfff7d6, 2.5, 18, Math.PI / 6, 0.3);
            spot.position.set(hx, 1.6, 1.1);
            spot.target.position.set(hx, 0, 8);
            cab.add(spot);
            cab.add(spot.target);
            this.headlights.push(spot);
        }

        this.cabGroup.add(cab);
    }

    // 3. 全液压机械臂系统 (Boom, Stick, Bucket & Cylinders)
    buildFrontArmSystem() {
        // 大臂连接基座 (销轴位于车身右前侧)
        const boomBaseMount = new THREE.Group();
        boomBaseMount.position.set(0.6, 0.45, 1.1);
        this.cabGroup.add(boomBaseMount);

        // 两个牢固的厚钢耳座
        for (let ox of [-0.35, 0.35]) {
            const lug = new THREE.Mesh(
                new THREE.BoxGeometry(0.12, 0.7, 0.8),
                this.matDarkSteel
            );
            lug.position.set(ox, 0.2, 0);
            boomBaseMount.add(lug);
        }

        // 大臂旋转根节点 (Pivot)
        this.boomPivot = new THREE.Group();
        this.boomPivot.position.set(0, 0.35, 0);
        boomBaseMount.add(this.boomPivot);

        // --- A. 大臂本体 (Boom) ---
        // 经典的下沉加高弯折工程大臂
        const boomPart1 = new THREE.Mesh(
            new THREE.BoxGeometry(0.55, 0.8, 3.2),
            this.matYellow
        );
        boomPart1.position.set(0, 0.8, 1.3);
        boomPart1.rotation.x = 0.5;
        boomPart1.castShadow = true;
        this.boomPivot.add(boomPart1);

        const boomPart2 = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.7, 3.4),
            this.matYellow
        );
        boomPart2.position.set(0, 1.7, 3.7);
        boomPart2.rotation.x = -0.45;
        boomPart2.castShadow = true;
        this.boomPivot.add(boomPart2);

        // 大臂与小臂铰链点 (Stick Pivot)
        this.armPivot = new THREE.Group();
        this.armPivot.position.set(0, 1.05, 5.0);
        this.boomPivot.add(this.armPivot);

        // --- B. 斗杆/小臂本体 (Stick / Arm) ---
        const armBeam = new THREE.Mesh(
            new THREE.BoxGeometry(0.42, 0.6, 3.2),
            this.matYellow
        );
        armBeam.position.set(0, -0.3, 1.3);
        armBeam.rotation.x = -0.55;
        armBeam.castShadow = true;
        this.armPivot.add(armBeam);

        // 小臂与铲斗铰链点 (Bucket Pivot)
        this.bucketPivot = new THREE.Group();
        this.bucketPivot.position.set(0, -1.05, 2.5);
        this.armPivot.add(this.bucketPivot);

        // --- C. 重型合金挖斗 (Bucket) ---
        this.buildHeavyBucket();

        // --- D. 真实液压油缸与镀铬活塞机构 ---
        this.buildHydraulicPistons(boomBaseMount);
    }

    buildHeavyBucket() {
        const bucketGroup = new THREE.Group();

        // 斗背弧板
        const bucketBack = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.15, 1.4),
            this.matDarkSteel
        );
        bucketBack.position.set(0, -0.4, 0.5);
        bucketBack.rotation.x = 0.8;
        bucketBack.castShadow = true;
        bucketGroup.add(bucketBack);

        // 斗底板
        const bucketBottom = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.15, 1.2),
            this.matDarkSteel
        );
        bucketBottom.position.set(0, -0.9, 0.1);
        bucketBottom.castShadow = true;
        bucketGroup.add(bucketBottom);

        // 左右侧板 (侧刃)
        for (let bx of [-0.6, 0.6]) {
            const sidePlate = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.9, 1.2),
                this.matYellowDark
            );
            sidePlate.position.set(bx, -0.6, 0.35);
            bucketGroup.add(sidePlate);
        }

        // 4 枚尖锐合金斗齿 (Teeth)
        for (let tx of [-0.45, -0.15, 0.15, 0.45]) {
            const tooth = new THREE.Mesh(
                new THREE.ConeGeometry(0.1, 0.45, 4),
                this.matChrome
            );
            tooth.rotation.x = -Math.PI / 3;
            tooth.position.set(tx, -1.0, 0.8);
            tooth.castShadow = true;
            bucketGroup.add(tooth);
        }

        // 铲斗上方挂载点（用于在挖中数字时，将发光数字平稳安放在挖斗内部）
        this.bucketHoldPoint = new THREE.Group();
        this.bucketHoldPoint.position.set(0, -0.4, 0.3);
        bucketGroup.add(this.bucketHoldPoint);

        this.bucketPivot.add(bucketGroup);
    }

    buildHydraulicPistons(boomBaseMount) {
        // 双主臂油缸 (Boom Cylinders)
        this.boomCylinders = [];
        for (let cx of [-0.42, 0.42]) {
            const cylGroup = new THREE.Group();
            cylGroup.position.set(cx, 0.05, 0.3);
            boomBaseMount.add(cylGroup);

            // 缸体 (黑色/深灰)
            const barrel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.12, 0.12, 1.8, 16),
                this.matDarkSteel
            );
            barrel.position.y = 0.9;
            cylGroup.add(barrel);

            // 镀铬镜面活塞杆
            const rod = new THREE.Mesh(
                new THREE.CylinderGeometry(0.07, 0.07, 1.7, 16),
                this.matChrome
            );
            rod.position.y = 1.6;
            cylGroup.add(rod);

            this.boomCylinders.push({ group: cylGroup, rod: rod });
        }
    }

    // 设置机械臂姿态 (Kinematics update)
    setJoints(boom, arm, bucket, bodyRot = null) {
        this.angles.boom = boom;
        this.angles.arm = arm;
        this.angles.bucket = bucket;
        if (bodyRot !== null) this.angles.bodyRot = bodyRot;

        // 应用角度
        this.boomPivot.rotation.x = -this.angles.boom;
        this.armPivot.rotation.x = this.angles.arm;
        this.bucketPivot.rotation.x = -this.angles.bucket;
        this.cabGroup.rotation.y = this.angles.bodyRot;

        // 自动计算主臂液压活塞伸缩
        const boomProgress = (this.angles.boom - 0.1) / 0.8;
        this.boomCylinders.forEach(c => {
            c.group.rotation.x = -this.angles.boom * 0.75;
            c.rod.position.y = 1.3 + boomProgress * 0.55;
        });
    }

    // 每帧循环更新：粒子、警示灯旋转、待机微颤
    update(delta, isMoving = false) {
        const time = performance.now() * 0.001;

        // 1. 车顶警示灯快速旋转与闪烁
        this.beaconAngle += delta * 14;
        if (this.beaconLight) {
            this.beaconLight.intensity = 1.4 + Math.sin(this.beaconAngle) * 0.8;
        }

        // 2. 柴油机怠速微颤震动 (让模型充满生命力)
        const rumble = isMoving ? 0.03 : 0.008;
        this.cabGroup.position.y = 1.1 + Math.sin(time * 30) * rumble;

        // 3. 排气管烟雾粒子系统 (Exhaust Smoke Particles)
        this.updateSmoke(time, delta, isMoving);
    }

    updateSmoke(time, delta, isMoving) {
        // 生成新烟圈
        const spawnInterval = isMoving ? 0.06 : 0.18;
        if (time - this.lastSmokeTime > spawnInterval) {
            this.lastSmokeTime = time;

            // 获取排气管顶端的全局世界坐标
            const tipWorld = new THREE.Vector3();
            if (this.exhaustTip) {
                const temp = this.exhaustTip.clone();
                this.cabGroup.localToWorld(temp);
                tipWorld.copy(temp);
            }

            const pGeo = new THREE.SphereGeometry(isMoving ? 0.18 : 0.12, 8, 8);
            const pMat = new THREE.MeshBasicMaterial({
                color: isMoving ? 0x999999 : 0xdddddd,
                transparent: true,
                opacity: 0.65
            });
            const p = new THREE.Mesh(pGeo, pMat);
            p.position.copy(tipWorld);
            p.userData = {
                vy: 0.8 + Math.random() * 0.4,
                vx: (Math.random() - 0.5) * 0.2,
                vz: -0.4 - Math.random() * 0.3,
                scaleSpeed: 2.2,
                opacity: 0.65,
                age: 0,
                maxAge: 1.4
            };
            this.scene.add(p);
            this.smokeParticles.push(p);
        }

        // 驱动并回收现有烟雾粒子
        for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
            const p = this.smokeParticles[i];
            p.userData.age += delta;
            if (p.userData.age >= p.userData.maxAge) {
                this.scene.remove(p);
                p.geometry.dispose();
                p.material.dispose();
                this.smokeParticles.splice(i, 1);
                continue;
            }

            p.position.y += p.userData.vy * delta;
            p.position.x += p.userData.vx * delta;
            p.position.z += p.userData.vz * delta;

            const scale = 1.0 + p.userData.age * p.userData.scaleSpeed;
            p.scale.set(scale, scale, scale);
            p.material.opacity = p.userData.opacity * (1 - p.userData.age / p.userData.maxAge);
        }
    }

    // 产生铲土时的破土碎屑粒子喷发 (Dirt Burst)
    createDirtBurst(pos) {
        for (let i = 0; i < 28; i++) {
            const size = 0.08 + Math.random() * 0.16;
            const geo = new THREE.DodecahedronGeometry(size);
            const color = Math.random() > 0.5 ? 0x8b5a2b : 0xa06d3b;
            const mat = new THREE.MeshLambertMaterial({ color: color });
            const chunk = new THREE.Mesh(geo, mat);
            chunk.position.copy(pos);
            chunk.position.x += (Math.random() - 0.5) * 0.8;
            chunk.position.z += (Math.random() - 0.5) * 0.8;
            chunk.castShadow = true;

            const speed = 2.5 + Math.random() * 3.5;
            const angle = Math.random() * Math.PI * 2;
            chunk.userData = {
                vx: Math.cos(angle) * speed * 0.6,
                vy: 2.0 + Math.random() * 4.0,
                vz: Math.sin(angle) * speed * 0.6,
                rotX: Math.random() * 8,
                rotY: Math.random() * 8,
                age: 0
            };
            this.scene.add(chunk);

            // 粒子下落与销毁
            const updateParticle = () => {
                chunk.userData.age += 0.03;
                chunk.userData.vy -= 9.8 * 0.03; // 重力
                chunk.position.x += chunk.userData.vx * 0.03;
                chunk.position.y += chunk.userData.vy * 0.03;
                chunk.position.z += chunk.userData.vz * 0.03;
                chunk.rotation.x += chunk.userData.rotX * 0.05;
                chunk.rotation.y += chunk.userData.rotY * 0.05;

                if (chunk.position.y <= 0.1) {
                    chunk.position.y = 0.1;
                    chunk.userData.vx *= 0.5;
                    chunk.userData.vz *= 0.5;
                }

                if (chunk.userData.age < 1.2) {
                    requestAnimationFrame(updateParticle);
                } else {
                    this.scene.remove(chunk);
                    chunk.geometry.dispose();
                    chunk.material.dispose();
                }
            };
            requestAnimationFrame(updateParticle);
        }
    }
}

window.Excavator3D = Excavator3D;
