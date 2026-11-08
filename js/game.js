// Main Game Controller for Excavator Numbers Game
// Designed for Toddlers (Age 3): Zero penalty, rich multisensory feedback, huge touch areas

class ExcavatorGame {
    constructor() {
        this.container = document.getElementById('game-container');
        this.currentMode = 5; // 默认 1-5 模式 (可选 3: 1-3, 5: 1-5, 9: 1-9)
        this.targetNumber = null;
        this.stars = 0;
        this.maxStars = 5;
        this.isBusy = false; // 是否在播放挖掘动画中

        this.mounds = []; // 当前场上的数字泥堆
        this.collectedNumbers = [];

        this.initThree();
        this.buildEnvironment();
        this.initControls();
        this.initRaycaster();

        // 窗口自适应
        window.addEventListener('resize', () => this.onResize());

        // 启动主渲染循环
        this.clock = new THREE.Clock();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    initThree() {
        // 场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb); // 晴朗蔚蓝天空
        this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.015);

        // 相机 (俯视侧前方黄金视角，完美展现挖掘机与前方数字)
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 500);
        this.camera.position.set(-9, 8.5, 14);

        // 渲染器
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.container.appendChild(this.renderer.domElement);

        // 灯光系统 (明亮温暖的施工工地日照)
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xd4a373, 0.85);
        hemiLight.position.set(0, 50, 0);
        this.scene.add(hemiLight);

        const sunLight = new THREE.DirectionalLight(0xfff7e6, 1.4);
        sunLight.position.set(20, 35, 20);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 100;
        const d = 20;
        sunLight.shadow.camera.left = -d;
        sunLight.shadow.camera.right = d;
        sunLight.shadow.camera.top = d;
        sunLight.shadow.camera.bottom = -d;
        sunLight.shadow.bias = -0.0005;
        this.scene.add(sunLight);

        // 创建高精度 3D 机械挖掘机
        this.excavator = new Excavator3D(this.scene);
        this.excavator.root.position.set(0, 0, 0);
        this.excavator.setJoints(0.35, 0.75, 0.35, 0);

        // 礼花粒子系统数组
        this.confettiParticles = [];
    }

    initControls() {
        // OrbitControls 供自由拖拽把玩挖掘机
        if (THREE.OrbitControls) {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // 限制不能看到地底
            this.controls.minDistance = 6;
            this.controls.maxDistance = 28;
            this.controls.target.set(0, 1.5, 4);
        }
    }

    // 搭建施工现场环境 (地面、警示桩、远景)
    buildEnvironment() {
        // 1. 夯实黄土地面 (有细微工程压痕色泽)
        const groundGeo = new THREE.PlaneGeometry(120, 120);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0xc49a45,
            roughness: 0.9,
            metalness: 0.05
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // 2. 施工安全警示锥桶 (Traffic Cones)
        const coneGeo = new THREE.ConeGeometry(0.35, 0.85, 16);
        const coneMatOrange = new THREE.MeshStandardMaterial({ color: 0xff5500, roughness: 0.4 });
        const coneMatWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });

        // 环形摆放一圈警戒线锥桶
        const conePositions = [
            [-8, 0.42, 9], [-4, 0.42, 10], [0, 0.42, 10.5], [4, 0.42, 10], [8, 0.42, 9],
            [-8, 0.42, -5], [-4, 0.42, -6], [0, 0.42, -6.5], [4, 0.42, -6], [8, 0.42, -5]
        ];
        conePositions.forEach(([x, y, z]) => {
            const cone = new THREE.Mesh(coneGeo, coneMatOrange);
            cone.position.set(x, y, z);
            cone.castShadow = true;
            // 白条纹
            const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.2, 16), coneMatWhite);
            stripe.position.set(0, -0.05, 0);
            cone.add(stripe);
            this.scene.add(cone);
        });

        // 3. 远方施工小山丘与白云
        this.buildDistantScenery();
    }

    buildDistantScenery() {
        // 远方沙丘
        for (let i = 0; i < 7; i++) {
            const hillGeo = new THREE.SphereGeometry(12 + Math.random() * 8, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.45);
            const hillMat = new THREE.MeshLambertMaterial({ color: 0xba8c3e });
            const hill = new THREE.Mesh(hillGeo, hillMat);
            const angle = (i / 7) * Math.PI * 2;
            hill.position.set(Math.cos(angle) * 45, -2, Math.sin(angle) * 45);
            this.scene.add(hill);
        }

        // 天空卡通大白云 (蓬松球体组合)
        for (let c = 0; c < 6; c++) {
            const cloud = new THREE.Group();
            const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
            for (let b = 0; b < 5; b++) {
                const puff = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 2.5, 8, 8), cloudMat);
                puff.position.set((b - 2) * 2.2, Math.sin(b) * 1.0, (Math.random() - 0.5) * 2);
                cloud.add(puff);
            }
            cloud.position.set(
                (Math.random() - 0.5) * 80,
                22 + Math.random() * 10,
                -30 + (Math.random() - 0.5) * 50
            );
            this.scene.add(cloud);
        }
    }

    // 交互光线投射器 (Raycaster - 专为触摸优化)
    initRaycaster() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        const handlePointer = (clientX, clientY) => {
            if (this.isBusy) return;
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            // 收集所有泥堆可点击物体
            const clickables = [];
            this.mounds.forEach(m => {
                clickables.push(m.hitBox);
            });

            const intersects = this.raycaster.intersectObjects(clickables, true);
            if (intersects.length > 0) {
                const hit = intersects[0].object.userData.mound;
                if (hit) {
                    this.onNumberClicked(hit);
                }
            }
        };

        this.renderer.domElement.addEventListener('pointerdown', (e) => {
            // 区分点击和拖拽旋转视角
            this.downPos = { x: e.clientX, y: e.clientY };
        });

        this.renderer.domElement.addEventListener('pointerup', (e) => {
            if (!this.downPos) return;
            const dist = Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y);
            if (dist < 10) { // 轻微触碰算点击
                handlePointer(e.clientX, e.clientY);
            }
            this.downPos = null;
        });
    }

    // 设置关卡模式 (3: 1-3, 5: 1-5, 9: 1-9)
    setMode(mode) {
        this.currentMode = mode;
        this.stars = 0;
        this.updateStarUI();
        this.nextRound();
    }

    // 开始新一轮题目
    nextRound() {
        if (this.isBusy) return;

        // 清理场上现存泥堆
        this.clearMounds();

        // 决定本次备选数字集合
        // 比如 mode=3 时从 [1, 2, 3] 挑；mode=5 时显示 3~4 个；mode=9 时显示 4~5 个
        let pool = [];
        for (let i = 1; i <= this.currentMode; i++) pool.push(i);

        // 随机选择目标数字
        const targetIdx = Math.floor(Math.random() * pool.length);
        this.targetNumber = pool[targetIdx];

        // 挑选出 3 个展示的数字（必须包含 targetNumber）
        let candidates = [this.targetNumber];
        pool.splice(targetIdx, 1);
        pool.sort(() => Math.random() - 0.5);

        const countToShow = this.currentMode === 3 ? 3 : (this.currentMode === 5 ? 3 : 4);
        while (candidates.length < countToShow && pool.length > 0) {
            candidates.push(pool.pop());
        }
        // 打乱位置
        candidates.sort(() => Math.random() - 0.5);

        // 生成 3D 泥堆与数字
        this.spawnMounds(candidates);

        // 更新 UI 提示牌
        this.updatePromptUI();

        // 语音报题
        setTimeout(() => {
            window.soundManager.speak(`小工友，请帮我挖出数字 ${this.targetNumber} 吧！`);
        }, 300);
    }

    clearMounds() {
        this.mounds.forEach(m => {
            this.scene.remove(m.group);
            // 释放材质与几何
            m.group.traverse(child => {
                if (child.geometry) child.geometry.dispose();
            });
        });
        this.mounds = [];
    }

    // 生成多个 3D 泥堆与数字
    spawnMounds(candidates) {
        // 根据数量呈扇形分布在挖掘机正前方 (Z 轴 5~8 距离)
        const num = candidates.length;
        const totalSpan = num === 3 ? 6.5 : 8.5;
        const startX = -totalSpan / 2;
        const stepX = totalSpan / (num - 1);

        // 糖果色彩盘
        const colors = [
            0xff4757, // 1 鲜红
            0x2ed573, // 2 翠绿
            0x1e90ff, // 3 蔚蓝
            0xffa502, // 4 暖橙
            0x9b59b6, // 5 紫罗兰
            0x00d2d3, // 6 青碧
            0xff6b81, // 7 樱粉
            0x70a1ff, // 8 冰蓝
            0xeccc68  // 9 明黄
        ];

        candidates.forEach((val, idx) => {
            const x = startX + idx * stepX + (Math.random() - 0.5) * 0.4;
            const z = 6.2 + Math.abs(x) * 0.25; // 略微内弧形包围

            const moundGroup = new THREE.Group();
            moundGroup.position.set(x, 0, z);

            // 1. 黄土泥堆 (饱满圆滑半球)
            const moundGeo = new THREE.SphereGeometry(1.6, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
            const moundMat = new THREE.MeshStandardMaterial({
                color: 0x966835,
                roughness: 0.95
            });
            const moundMesh = new THREE.Mesh(moundGeo, moundMat);
            moundMesh.scale.set(1.0, 0.55, 1.0);
            moundMesh.castShadow = true;
            moundMesh.receiveShadow = true;
            moundGroup.add(moundMesh);

            // 泥堆周围散落 3~4 块小石子
            for (let s = 0; s < 4; s++) {
                const stoneGeo = new THREE.DodecahedronGeometry(0.18 + Math.random() * 0.12);
                const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6e6e6e, roughness: 0.8 });
                const stone = new THREE.Mesh(stoneGeo, stoneMat);
                const a = Math.random() * Math.PI * 2;
                const r = 1.2 + Math.random() * 0.4;
                stone.position.set(Math.cos(a) * r, 0.12, Math.sin(a) * r);
                moundGroup.add(stone);
            }

            // 2. 3D 立体数字铭牌 (利用 Canvas 生成精致的圆角发光数字牌)
            const badge = this.createNumberBadge(val, colors[(val - 1) % colors.length]);
            badge.position.set(0, 1.35, 0);
            moundGroup.add(badge);

            // 3. 巨大隐形点击热区 (极其适合3岁小宝宝粗大点击)
            const hitGeo = new THREE.SphereGeometry(1.8, 8, 8);
            const hitMat = new THREE.MeshBasicMaterial({ visible: false });
            const hitBox = new THREE.Mesh(hitGeo, hitMat);
            hitBox.position.set(0, 1.0, 0);
            moundGroup.add(hitBox);

            const moundObj = {
                number: val,
                group: moundGroup,
                badge: badge,
                hitBox: hitBox,
                pos: new THREE.Vector3(x, 0, z),
                isTarget: val === this.targetNumber
            };
            hitBox.userData = { mound: moundObj };

            // 入场弹跳动画 (GSAP)
            moundGroup.position.y = -2;
            moundGroup.scale.set(0.01, 0.01, 0.01);
            this.scene.add(moundGroup);

            gsap.to(moundGroup.position, {
                y: 0,
                duration: 0.6,
                delay: idx * 0.12,
                ease: "back.out(1.7)"
            });
            gsap.to(moundGroup.scale, {
                x: 1, y: 1, z: 1,
                duration: 0.6,
                delay: idx * 0.12,
                ease: "back.out(1.7)"
            });

            this.mounds.push(moundObj);
        });
    }

    // 创建立体的数字糖果徽章 (使用双面纹理柱体 + 金边)
    createNumberBadge(num, hexColor) {
        const group = new THREE.Group();

        // 绘制高分辨率数字 Canvas
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // 圆角矩形背景 (带兼容 polyfill)
        ctx.fillStyle = '#' + hexColor.toString(16).padStart(6, '0');
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(16, 16, 224, 224, 48);
        } else {
            // Polyfill for older iPads/browsers
            const x = 16, y = 16, w = 224, h = 224, r = 48;
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        }
        ctx.fill();

        // 内发光白边
        ctx.lineWidth = 14;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // 数字文本
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 140px "Comic Sans MS", "Arial Rounded MT Bold", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // 投影
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 8;
        ctx.fillText(num, 128, 134);

        const tex = new THREE.CanvasTexture(canvas);

        // 立体圆牌
        const diskGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.22, 32);
        diskGeo.rotateX(Math.PI / 2);

        const sideMat = new THREE.MeshStandardMaterial({
            color: 0xffd700, // 金色包边
            roughness: 0.3,
            metalness: 0.6
        });
        const faceMat = new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.2,
            metalness: 0.1
        });

        const disk = new THREE.Mesh(diskGeo, [sideMat, faceMat, faceMat]);
        disk.castShadow = true;
        group.add(disk);

        return group;
    }

    // 点击数字后的核心响应
    onNumberClicked(mound) {
        if (this.isBusy) return;

        if (mound.number === this.targetNumber) {
            // === 答对了！执行超酷全套挖掘机动画 ===
            this.handleCorrectPick(mound);
        } else {
            // === 点错了：零惩罚、温柔提醒 + 提示正确数字 ===
            this.handleWrongPick(mound);
        }
    }

    // 正确选中的超爽全流程
    handleCorrectPick(mound) {
        this.isBusy = true;
        window.soundManager.startEngine();
        window.soundManager.setEngineRev(true);

        const targetPos = mound.pos.clone();
        // 计算面向目标的角度
        const targetAngle = Math.atan2(targetPos.x, targetPos.z);

        const tl = gsap.timeline();

        // 1. 挖掘机旋转转向目标
        tl.to(this.excavator.angles, {
            bodyRot: targetAngle,
            duration: 0.7,
            ease: "power2.inOut",
            onUpdate: () => {
                this.excavator.setJoints(
                    this.excavator.angles.boom,
                    this.excavator.angles.arm,
                    this.excavator.angles.bucket,
                    this.excavator.angles.bodyRot
                );
            }
        });

        // 2. 挖掘机开向泥堆 (向前行驶一小段)
        const stopDistance = 3.6;
        const driveDist = targetPos.length() - stopDistance;
        const driveX = Math.sin(targetAngle) * driveDist;
        const driveZ = Math.cos(targetAngle) * driveDist;

        tl.to(this.excavator.root.position, {
            x: driveX,
            z: driveZ,
            duration: 1.0,
            ease: "power1.inOut",
            onComplete: () => {
                window.soundManager.setEngineRev(false);
                window.soundManager.playHydraulic();
            }
        }, "-=0.2");

        // 3. 机械臂准备姿态 (大臂上扬、铲斗张开准备入土)
        tl.to(this.excavator.angles, {
            boom: 0.6,
            arm: 0.4,
            bucket: 0.2,
            duration: 0.6,
            ease: "power1.out",
            onUpdate: () => this.syncExcavatorJoints()
        });

        // 4. 猛力下铲！(大臂下压、小臂收拢、铲斗猛扣入土中)
        tl.to(this.excavator.angles, {
            boom: 0.15,
            arm: 1.15,
            bucket: 0.9,
            duration: 0.55,
            ease: "back.in(1.2)",
            onUpdate: () => this.syncExcavatorJoints(),
            onComplete: () => {
                // 触土瞬间！
                window.soundManager.playDirtDig();
                this.excavator.createDirtBurst(mound.pos);
                this.shakeCamera();

                // 将数字徽章“吸附”并装入铲斗内！
                mound.badge.position.set(0, 0, 0);
                this.excavator.bucketHoldPoint.add(mound.badge);
            }
        });

        // 5. 扬臂举起战利品！(高高举起数字，向小外甥展示)
        tl.to(this.excavator.angles, {
            boom: 0.75,
            arm: 0.5,
            bucket: 0.6,
            duration: 0.8,
            ease: "power2.out",
            onUpdate: () => this.syncExcavatorJoints(),
            onComplete: () => {
                // 庆祝音效与胜利呼唤
                window.soundManager.playSuccess();
                window.soundManager.playHorn();
                this.spawnConfetti(this.excavator.bucketHoldPoint);
                window.soundManager.speak(`哇！挖到 ${this.targetNumber} 啦！太棒了！`);

                // 增加星星
                this.stars++;
                this.updateStarUI();
            }
        });

        // 6. 停留 1.5 秒让小孩尽情欣赏
        tl.to({}, { duration: 1.5 });

        // 7. 挖掘机退回原位，数字飞入收集箱
        tl.to(this.excavator.root.position, {
            x: 0, z: 0,
            duration: 0.8,
            ease: "power1.inOut"
        });
        tl.to(this.excavator.angles, {
            bodyRot: 0,
            boom: 0.35,
            arm: 0.75,
            bucket: 0.35,
            duration: 0.8,
            ease: "power2.inOut",
            onUpdate: () => this.syncExcavatorJoints(),
            onComplete: () => {
                this.isBusy = false;
                if (this.stars >= this.maxStars) {
                    this.triggerVictoryParty();
                } else {
                    this.nextRound();
                }
            }
        }, "-=0.6");
    }

    // 选错时的友好处理
    handleWrongPick(mound) {
        this.isBusy = true;
        window.soundManager.playOops();

        // 挖掘机像小宠物一样轻轻摇摇头
        const origRot = this.excavator.angles.bodyRot;
        gsap.timeline({
            onComplete: () => {
                this.isBusy = false;
            }
        })
        .to(this.excavator.angles, { bodyRot: origRot + 0.15, duration: 0.12, onUpdate: () => this.syncExcavatorJoints() })
        .to(this.excavator.angles, { bodyRot: origRot - 0.15, duration: 0.12, onUpdate: () => this.syncExcavatorJoints() })
        .to(this.excavator.angles, { bodyRot: origRot + 0.1, duration: 0.1, onUpdate: () => this.syncExcavatorJoints() })
        .to(this.excavator.angles, { bodyRot: origRot, duration: 0.1, onUpdate: () => this.syncExcavatorJoints() });

        // 语音温柔提示
        window.soundManager.speak(`这是数字 ${mound.number} 呀，我们要找的是 ${this.targetNumber} 呢，再仔细看一看～`);

        // 目标数字发光跳动提示
        const targetMound = this.mounds.find(m => m.number === this.targetNumber);
        if (targetMound && targetMound.badge) {
            gsap.timeline()
                .to(targetMound.badge.position, { y: 2.1, duration: 0.25, yoyo: true, repeat: 3, ease: "power1.inOut" })
                .to(targetMound.badge.scale, { x: 1.3, y: 1.3, z: 1.3, duration: 0.25, yoyo: true, repeat: 3 });
        }
    }

    syncExcavatorJoints() {
        this.excavator.setJoints(
            this.excavator.angles.boom,
            this.excavator.angles.arm,
            this.excavator.angles.bucket,
            this.excavator.angles.bodyRot
        );
    }

    // 镜头轻微破土震动
    shakeCamera() {
        const origY = this.camera.position.y;
        gsap.to(this.camera.position, {
            y: origY - 0.4,
            duration: 0.06,
            yoyo: true,
            repeat: 3,
            ease: "sine.inOut"
        });
    }

    // 喷发彩色小纸屑礼花 (Confetti Particles)
    spawnConfetti(sourceGroup) {
        const colors = [0xff4757, 0x2ed573, 0xffa502, 0x1e90ff, 0xffd32a, 0xff5252];
        const worldPos = new THREE.Vector3();
        sourceGroup.getWorldPosition(worldPos);

        for (let i = 0; i < 45; i++) {
            const geo = new THREE.PlaneGeometry(0.18, 0.18);
            const color = colors[Math.floor(Math.random() * colors.length)];
            const mat = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide });
            const confetti = new THREE.Mesh(geo, mat);

            confetti.position.copy(worldPos);
            const angle = Math.random() * Math.PI * 2;
            const speed = 3.0 + Math.random() * 5.0;

            confetti.userData = {
                vx: Math.cos(angle) * speed,
                vy: 4.0 + Math.random() * 5.0,
                vz: Math.sin(angle) * speed,
                rx: (Math.random() - 0.5) * 15,
                ry: (Math.random() - 0.5) * 15,
                age: 0
            };

            this.scene.add(confetti);
            this.confettiParticles.push(confetti);
        }
    }

    // 通关大派对 (5颗星全部集满)
    triggerVictoryParty() {
        this.isBusy = true;
        window.soundManager.playCelebrationFanfare();
        window.soundManager.speak(`太棒啦！集满五颗星星！挖掘机大队长通关啦！`);

        // 挖掘机原地开心地连续转圈、扬起大臂开合铲斗跳舞！
        gsap.timeline({
            repeat: 2,
            onComplete: () => {
                this.isBusy = false;
                document.getElementById('victory-modal').classList.remove('hidden');
            }
        })
        .to(this.excavator.angles, {
            bodyRot: Math.PI * 2,
            boom: 0.8,
            arm: 0.3,
            bucket: 0.8,
            duration: 1.8,
            ease: "none",
            onUpdate: () => this.syncExcavatorJoints()
        })
        .set(this.excavator.angles, { bodyRot: 0 });

        // 持续放 3 秒大烟花
        for (let t = 0; t < 6; t++) {
            setTimeout(() => {
                window.soundManager.playHorn();
                this.spawnConfetti(this.excavator.cabGroup);
            }, t * 500);
        }
    }

    // 更新界面提示牌
    updatePromptUI() {
        const numElem = document.getElementById('target-number-display');
        if (numElem) {
            numElem.textContent = this.targetNumber;
            // 放大呼吸动画
            numElem.classList.remove('pop-anim');
            void numElem.offsetWidth; // 触发 reflow
            numElem.classList.add('pop-anim');
        }
    }

    // 更新星星进度条
    updateStarUI() {
        const starContainer = document.getElementById('star-container');
        if (!starContainer) return;
        starContainer.innerHTML = '';
        for (let i = 0; i < this.maxStars; i++) {
            const span = document.createElement('span');
            span.className = i < this.stars ? 'star star-filled' : 'star star-empty';
            span.innerHTML = '★';
            starContainer.appendChild(span);
        }
    }

    // 每一帧渲染循环
    animate() {
        requestAnimationFrame(this.animate);

        const delta = this.clock.getDelta();

        // 更新挖掘机（粒子、警示灯、微振动）
        if (this.excavator) {
            this.excavator.update(delta, this.isBusy);
        }

        // 更新礼花纸屑
        for (let i = this.confettiParticles.length - 1; i >= 0; i--) {
            const c = this.confettiParticles[i];
            c.userData.age += delta;
            if (c.userData.age > 2.5) {
                this.scene.remove(c);
                c.geometry.dispose();
                c.material.dispose();
                this.confettiParticles.splice(i, 1);
                continue;
            }
            c.userData.vy -= 9.8 * delta; // 重力
            c.position.x += c.userData.vx * delta;
            c.position.y += c.userData.vy * delta;
            c.position.z += c.userData.vz * delta;
            c.rotation.x += c.userData.rx * delta;
            c.rotation.y += c.userData.ry * delta;
        }

        // 泥堆上的数字缓动自转
        this.mounds.forEach(m => {
            if (m.badge && m.badge.parent === m.group) {
                m.badge.rotation.y += delta * 0.8;
            }
        });

        // 轨道控制器更新
        if (this.controls) {
            this.controls.update();
        }

        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        if (!this.container) return;
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }
}

// 页面加载完成后启动
window.addEventListener('DOMContentLoaded', () => {
    window.game = new ExcavatorGame();
});
