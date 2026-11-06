// env_pilflip.js — Royal Waterways (Pilflip Lore Environment)
// Karakteristik Lore:
// 1. Gorong-gorong saluran pembuangan kota Hallownest (Royal Sewer Tunnels)
// 2. Pipa-pipa drainase melengkung besar dengan katup putar kuno (Pipes & Valves)
// 3. Saluran air / parit basah tempat Pilflip merayap dan membalik badan (Drainage Canals)
// 4. Jeruji besi saluran pembuangan & bebatuan bata kuno berlumut lembab (Iron Grates)
// 5. Tetesan air menetes dan kabut lembab biru/kelabu (Water Droplets & Humid Mist)

const vsSource = `
    attribute vec3 aPos;
    attribute vec3 aNor;
    attribute vec3 aCol;
    uniform mat4 uMV, uP;
    uniform mat3 uN;
    uniform float uOutline;
    varying vec3 vN, vC;
    varying float vDepth;
    void main() {
        vec3 p = aPos + aNor * uOutline;
        vec4 vp = uMV * vec4(p, 1.0);
        gl_Position = uP * vp;
        vN = uN * aNor;
        vC = aCol;
        vDepth = -vp.z;
    }
`;

const fsSource = `
    precision mediump float;
    uniform float uAlpha, uUseFlat, uGlow;
    uniform vec3 uFlat;
    varying vec3 vN, vC;
    varying float vDepth;
    void main() {
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        vec3 light = normalize(vec3(0.35, 0.80, 0.45));
        float d = max(dot(n, light), 0.0);
        float toon = d < 0.22 ? 0.40 : (d < 0.65 ? 0.75 : 1.05);
        vec3 c = vC * toon + vC * uGlow * 0.6;
        c = mix(c, uFlat, uUseFlat);
        
        // Depth fog biru lembab Royal Waterways
        vec3 fog = vec3(0.08, 0.12, 0.16);
        float f = clamp((vDepth - 8.0) / 45.0, 0.0, 0.75);
        c = mix(c, fog, f);
        gl_FragColor = vec4(c, uAlpha);
    }
`;

const vsParticle = `
    attribute vec3 aPos;
    attribute float aSize;
    attribute vec4 aCol;
    uniform mat4 uMV, uP;
    varying vec4 vCol;
    void main() {
        vec4 vp = uMV * vec4(aPos, 1.0);
        gl_Position = uP * vp;
        gl_PointSize = aSize * (150.0 / max(1.0, -vp.z));
        vCol = aCol;
    }
`;

const fsParticle = `
    precision mediump float;
    varying vec4 vCol;
    void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.08, d) * vCol.a;
        gl_FragColor = vec4(vCol.rgb, a);
    }
`;

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const rad = (d) => d * Math.PI / 180;

function makeM(t, ops) {
    const m = mat4.create();
    mat4.translate(m, m, t);
    (ops || []).forEach(([ax, a]) => {
        if (ax === 'x') mat4.rotateX(m, m, a);
        if (ax === 'y') mat4.rotateY(m, m, a);
        if (ax === 'z') mat4.rotateZ(m, m, a);
        if (ax === 's') mat4.scale(m, m, a);
    });
    return m;
}

function buildSurface(fn, nu, nv, o) {
    const M = o.m || mat4.create();
    const N = mat3.create();
    mat3.normalFromMat4(N, M);
    const pos = [], nor = [], col = [], idx = [];
    const e = 1e-3;

    for (let i = 0; i <= nu; i++) {
        for (let j = 0; j <= nv; j++) {
            const u = i / nu, v = j / nv;
            const p = fn(u, v);
            const uc = Math.min(1 - e, Math.max(e, u));
            const vc = Math.min(1 - e, Math.max(e, v));
            const pu = sub3(fn(uc + e, vc), fn(uc - e, vc));
            const pv = sub3(fn(uc, vc + e), fn(uc, vc - e));
            const n = cross3(pu, pv);

            pos.push(
                M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12],
                M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13],
                M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14]
            );
            const nn = norm3([
                N[0] * n[0] + N[3] * n[1] + N[6] * n[2],
                N[1] * n[0] + N[4] * n[1] + N[7] * n[2],
                N[2] * n[0] + N[5] * n[1] + N[8] * n[2]
            ]);
            nor.push(nn[0], nn[1], nn[2]);
            const c = typeof o.color === 'function' ? o.color(u, v) : o.color;
            col.push(c[0], c[1], c[2]);
        }
    }

    for (let i = 0; i < nu; i++) {
        for (let j = 0; j < nv; j++) {
            const a = i * (nv + 1) + j, b = a + nv + 1, c = a + 1, d = b + 1;
            idx.push(a, b, c, b, d, c);
        }
    }

    if (o.auto) {
        const cnt = pos.length / 3;
        let cx = 0, cy = 0, cz = 0;
        for (let k = 0; k < cnt; k++) { cx += pos[3 * k]; cy += pos[3 * k + 1]; cz += pos[3 * k + 2]; }
        cx /= cnt; cy /= cnt; cz /= cnt;
        let s = 0;
        for (let k = 0; k < cnt; k++) s += nor[3 * k] * (pos[3 * k] - cx) + nor[3 * k + 1] * (pos[3 * k + 1] - cy) + nor[3 * k + 2] * (pos[3 * k + 2] - cz);
        if (s < 0) {
            for (let k = 0; k < nor.length; k++) nor[k] = -nor[k];
            for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
        }
    }

    return {
        pos, nor, col, idx,
        outline: o.outline || 0, alpha: o.alpha || 1, glow: o.glow || 0,
        idlePivot: o.idlePivot || null, idleFn: o.idleFn || null
    };
}

// ===================== GEOMETRI ROYAL WATERWAYS =====================

// 1. Pipa Drainase Logam Besar (Sewer Pipe Cylinder)
function drainagePipe(r, len, flangeR = 1.15) {
    return (u, v) => {
        // Cincin pengikat pipa di kedua ujungnya
        const isEnd = (u < 0.1 || u > 0.9);
        const rad = r * (isEnd ? flangeR : 1.0);
        return [rad * Math.cos(v * TAU), len * (u - 0.5), rad * Math.sin(v * TAU)];
    };
}

// 2. Belokan Siku Pipa Drainase Melengkung (Elbow Pipe Curve)
function elbowPipe(rPipe, rBend, arcAng) {
    return (u, v) => {
        const theta = u * arcAng;
        const phi = v * TAU;
        const cx = rBend * Math.cos(theta);
        const cy = rBend * Math.sin(theta);
        const nx = Math.cos(theta), ny = Math.sin(theta);
        const x = cx + rPipe * Math.cos(phi) * nx;
        const y = cy + rPipe * Math.cos(phi) * ny;
        const z = rPipe * Math.sin(phi);
        return [x, y, z];
    };
}

// 3. Katup Putar Roda Saluran Air (Pipe Valve Wheel)
function valveWheel(rWheel, rTube) {
    return (u, v) => {
        const theta = u * TAU, phi = v * TAU;
        return [
            (rWheel + rTube * Math.cos(phi)) * Math.cos(theta),
            rTube * Math.sin(phi),
            (rWheel + rTube * Math.cos(phi)) * Math.sin(theta)
        ];
    };
}

// 4. Parit Saluran Air Lembab (Waterway Trench)
function waterTrench(w, len, depth) {
    return (u, v) => {
        const x = (u - 0.5) * w;
        const z = (v - 0.5) * len;
        // Parit cekung U di tengah
        const y = -depth * (1.0 - Math.pow(u * 2.0 - 1.0, 4.0));
        return [x, y, z];
    };
}

function buildWaterways() {
    const parts = [];

    // Palet Warna Khas Royal Waterways
    const PIPE_IRON   = [0.22, 0.28, 0.36];     // Logam pipa biru keabuan
    const PIPE_RUST   = [0.38, 0.32, 0.26];     // Karat pada sambungan pipa
    const SLIME_GREEN = [0.18, 0.35, 0.26];     // Lumut lendir basah gorong-gorong
    const SEWER_BRICK = [0.15, 0.18, 0.24];     // Dinding bata basah
    const WATER_DARK  = [0.12, 0.35, 0.48];     // Genangan air limbah basah berpantul
    const VALVE_BRASS = [0.65, 0.45, 0.25];     // Roda katup kuningan tua

    // 1. TEROWONGAN BATA GORONG-GORONG (Main Sewer Brick Tunnel)
    // Dinding lengkung terowongan
    parts.push(buildSurface((u, v) => {
        const theta = (u * 0.8 + 0.1) * Math.PI;
        const r = 6.8;
        const z = (v - 0.5) * 20.0;
        return [r * Math.cos(theta), r * Math.sin(theta) - 2.0, z];
    }, 24, 20, {
        color: (u, v) => {
            const bricks = Math.sin(u * 28.0) * Math.sin(v * 24.0);
            return bricks > 0.3 ? [0.18, 0.22, 0.28] : SEWER_BRICK;
        }
    }));

    // 2. LANTAI PARIT SALURAN AIR & JALAN SETAPAK (Walkway & Trench)
    // Tempat Pilflip merayap di pinggir saluran
    [-3.8, 3.8].forEach((wx, idx) => {
        parts.push(buildSurface((u, v) => {
            const x = (u - 0.5) * 3.6;
            const z = (v - 0.5) * 18.0;
            const y = 0.4 * (1.0 - 0.15 * Math.sin(u * Math.PI));
            return [x, y, z];
        }, 12, 16, {
            m: makeM([wx, -2.4, 0]),
            outline: 0.035, auto: true,
            color: (u, v) => (Math.sin(u * 16.0 + v * 10.0) > 0.35 ? SLIME_GREEN : SEWER_BRICK)
        }));
    });

    // Parit Air di Tengah (Tempat genangan air mengalir)
    parts.push(buildSurface(waterTrench(4.4, 18.0, 1.2), 16, 18, {
        m: makeM([0, -2.5, 0]),
        outline: 0.03, auto: true, color: SEWER_BRICK
    }));

    // Permukaan Air Limbah Biru Gelap Mengalir
    parts.push(buildSurface((u, v) => {
        const x = (u - 0.5) * 4.2;
        const z = (v - 0.5) * 18.0;
        const wave = Math.sin(u * 10.0 + v * 12.0) * 0.08;
        return [x, wave, z];
    }, 16, 20, {
        m: makeM([0, -3.2, 0]),
        outline: 0.0, glow: 0.5, color: WATER_DARK,
        idlePivot: [0, -3.2, 0],
        idleFn: (t) => [['s', [1.0, 1.0 + 0.08 * Math.sin(t * 2.5), 1.0]]]
    }));

    // 3. JARINGAN PIPA-PIPA DRAINASE BESAR (Sewer Pipes)
    // Pipa Raksasa Horizontal di Belakang
    parts.push(buildSurface(drainagePipe(1.4, 18.0, 1.15), 18, 22, {
        m: makeM([0, 1.8, -4.5], [['z', Math.PI / 2]]),
        outline: 0.04, auto: true, color: PIPE_IRON
    }));

    // Pipa Melengkung Siku Turun ke Bawah (Elbow Pipe Drain)
    parts.push(buildSurface(elbowPipe(0.85, 2.2, rad(90)), 16, 18, {
        m: makeM([-3.8, 1.8, -3.0], [['z', rad(90)], ['x', rad(90)]]),
        outline: 0.035, auto: true, color: PIPE_RUST
    }));

    // Pipa Tegak Samping Kanan
    parts.push(buildSurface(drainagePipe(0.65, 8.5, 1.2), 12, 16, {
        m: makeM([5.2, 0.5, -2.5]),
        outline: 0.03, auto: true, color: PIPE_IRON
    }));

    // 4. KATUP PUTAR RODA AIR (Valves)
    // Katup besar di pipa kanan
    const valvePos = [5.2, 1.2, -1.8];
    parts.push(buildSurface(valveWheel(0.65, 0.08), 16, 8, {
        m: makeM(valvePos, [['x', Math.PI / 2]]),
        outline: 0.025, auto: true, color: VALVE_BRASS,
        idlePivot: valvePos,
        idleFn: (t) => [['y', 0.05 * Math.sin(t * 1.5)]]
    }));
    // Poros silinder katup
    parts.push(buildSurface(drainagePipe(0.08, 0.6), 6, 8, {
        m: makeM([valvePos[0], valvePos[1], valvePos[2] - 0.3], [['x', Math.PI / 2]]),
        outline: 0.02, auto: true, color: PIPE_IRON
    }));

    // 5. JERUJI BESI SALURAN PEMBUANGAN (Iron Grates)
    [-1.2, 1.2].forEach(gx => {
        for (let b = -4; b <= 4; b++) {
            parts.push(buildSurface(drainagePipe(0.04, 1.6), 6, 6, {
                m: makeM([gx, -3.1, b * 0.35]),
                outline: 0.015, auto: true, color: [0.18, 0.20, 0.24]
            }));
        }
    });

    return parts;
}

// Partikel tetesan uap air lembab dan gelembung air
function createWaterwaysParticles(gl, count) {
    const pos = [], sizes = [], colors = [], speeds = [];
    for (let i = 0; i < count; i++) {
        pos.push(
            (Math.random() - 0.5) * 14.0,
            (Math.random() - 0.5) * 10.0 - 0.5,
            (Math.random() - 0.5) * 12.0
        );
        sizes.push(1.8 + Math.random() * 3.2);
        // Tetesan air lembab biru & pendar hijau lumut basah
        const isBlue = Math.random() > 0.4;
        if (isBlue) colors.push(0.35, 0.72, 0.95, 0.45 + Math.random() * 0.35);
        else colors.push(0.30, 0.85, 0.55, 0.35 + Math.random() * 0.35);
        speeds.push(0.15 + Math.random() * 0.25, Math.random() * TAU);
    }
    const mk = (data, usage = gl.STATIC_DRAW) => {
        const b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), usage);
        return b;
    };
    return {
        count, rawPos: pos, speeds,
        posBuf: mk(pos, gl.DYNAMIC_DRAW), sizeBuf: mk(sizes), colBuf: mk(colors),
        update(dt, t) {
            for (let i = 0; i < count; i++) {
                // Tetesan air turun perlahan ke bawah
                this.rawPos[i * 3 + 1] -= this.speeds[i * 2] * dt;
                this.rawPos[i * 3] += Math.sin(t * 1.2 + this.speeds[i * 2 + 1]) * 0.12 * dt;
                if (this.rawPos[i * 3 + 1] < -4.0) {
                    this.rawPos[i * 3 + 1] = 4.5;
                    this.rawPos[i * 3] = (Math.random() - 0.5) * 14.0;
                }
            }
            gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(this.rawPos));
        }
    };
}

function getIdleMatrix(mesh, time) {
    const out = mat4.create();
    if (!mesh.idleFn || !mesh.idlePivot) return out;
    const piv = mesh.idlePivot;
    mat4.translate(out, out, piv);
    mesh.idleFn(time).forEach(([ax, val]) => {
        if (ax === 'x') mat4.rotateX(out, out, val);
        else if (ax === 'y') mat4.rotateY(out, out, val);
        else if (ax === 'z') mat4.rotateZ(out, out, val);
        else if (ax === 's') mat4.scale(out, out, val);
    });
    mat4.translate(out, out, [-piv[0], -piv[1], -piv[2]]);
    return out;
}

function main() {
    const canvas = document.querySelector('#glcanvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) { alert('Browser Anda tidak mendukung WebGL.'); return; }

    const prog = initProg(gl, vsSource, fsSource);
    const progP = initProg(gl, vsParticle, fsParticle);
    if (!prog) return;

    const loc = {
        pos: gl.getAttribLocation(prog, 'aPos'),
        nor: gl.getAttribLocation(prog, 'aNor'),
        col: gl.getAttribLocation(prog, 'aCol'),
        P: gl.getUniformLocation(prog, 'uP'),
        MV: gl.getUniformLocation(prog, 'uMV'),
        N: gl.getUniformLocation(prog, 'uN'),
        outline: gl.getUniformLocation(prog, 'uOutline'),
        alpha: gl.getUniformLocation(prog, 'uAlpha'),
        useFlat: gl.getUniformLocation(prog, 'uUseFlat'),
        flat: gl.getUniformLocation(prog, 'uFlat'),
        glow: gl.getUniformLocation(prog, 'uGlow')
    };

    const locP = progP ? {
        pos: gl.getAttribLocation(progP, 'aPos'),
        size: gl.getAttribLocation(progP, 'aSize'),
        col: gl.getAttribLocation(progP, 'aCol'),
        P: gl.getUniformLocation(progP, 'uP'),
        MV: gl.getUniformLocation(progP, 'uMV')
    } : null;

    const mkBuf = (tgt, data, Type) => {
        const b = gl.createBuffer();
        gl.bindBuffer(tgt, b);
        gl.bufferData(tgt, new Type(data), gl.STATIC_DRAW);
        return b;
    };

    const rawParts = buildWaterways();
    rawParts.sort((a, b) => (a.alpha < 1) - (b.alpha < 1));

    const meshes = rawParts.map(m => {
        const lines = [];
        for (let k = 0; k < m.idx.length; k += 3) {
            lines.push(m.idx[k], m.idx[k + 1], m.idx[k + 1], m.idx[k + 2], m.idx[k + 2], m.idx[k]);
        }
        return {
            pos: mkBuf(gl.ARRAY_BUFFER, m.pos, Float32Array),
            nor: mkBuf(gl.ARRAY_BUFFER, m.nor, Float32Array),
            col: mkBuf(gl.ARRAY_BUFFER, m.col, Float32Array),
            idx: mkBuf(gl.ELEMENT_ARRAY_BUFFER, m.idx, Uint16Array),
            lidx: mkBuf(gl.ELEMENT_ARRAY_BUFFER, lines, Uint16Array),
            count: m.idx.length, lcount: lines.length,
            outline: m.outline, alpha: m.alpha, glow: m.glow,
            idlePivot: m.idlePivot, idleFn: m.idleFn
        };
    });

    const particles = createWaterwaysParticles(gl, 140);

    const DEF = { yaw: -0.15, pitch: 0.16, zoom: 1.15 };
    let yaw = DEF.yaw, pitch = DEF.pitch, zoom = DEF.zoom;
    let targetYaw = yaw, targetPitch = pitch, targetZoom = zoom;
    let dragging = false, lx = 0, ly = 0, time = 0;

    canvas.addEventListener('mousedown', e => { dragging = true; lx = e.clientX; ly = e.clientY; });
    window.addEventListener('mouseup', () => dragging = false);
    window.addEventListener('mousemove', e => {
        if (!dragging) return;
        targetYaw += (e.clientX - lx) * 0.007;
        targetPitch = Math.max(-0.45, Math.min(0.85, targetPitch + (e.clientY - ly) * 0.007));
        lx = e.clientX; ly = e.clientY;
    });
    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        targetZoom = Math.max(0.40, Math.min(2.5, targetZoom * Math.exp(e.deltaY * 0.001)));
    }, { passive: false });

    function bindMesh(m, idxBuf) {
        gl.bindBuffer(gl.ARRAY_BUFFER, m.pos);
        gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(loc.pos);
        gl.bindBuffer(gl.ARRAY_BUFFER, m.nor);
        gl.vertexAttribPointer(loc.nor, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(loc.nor);
        gl.bindBuffer(gl.ARRAY_BUFFER, m.col);
        gl.vertexAttribPointer(loc.col, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(loc.col);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    }

    let last = 0;
    function render(now) {
        const dt = Math.min(0.05, (now - last) * 0.001);
        last = now;
        time += dt;

        yaw += (targetYaw - yaw) * 0.12;
        pitch += (targetPitch - pitch) * 0.12;
        zoom += (targetZoom - zoom) * 0.12;

        particles.update(dt, time);

        if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
        }
        gl.viewport(0, 0, canvas.width, canvas.height);

        // Latar gorong-gorong lembab Royal Waterways
        gl.clearColor(0.07, 0.10, 0.14, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const proj = mat4.create();
        const aspect = canvas.width / canvas.height;
        mat4.perspective(proj, rad(45), aspect, 0.1, 120);

        const fit = Math.max(4.8, 5.0 / aspect) / Math.tan(rad(22.5)) * 1.05;
        const dist = fit * zoom;
        const baseMV = mat4.create();
        mat4.translate(baseMV, baseMV, [0, 0, -dist]);
        mat4.rotateX(baseMV, baseMV, pitch);
        mat4.rotateY(baseMV, baseMV, yaw);
        mat4.translate(baseMV, baseMV, [0, -0.4, 0]);

        const mvm = mat4.create(), nm = mat3.create();

        gl.useProgram(prog);
        gl.uniformMatrix4fv(loc.P, false, proj);

        meshes.forEach(m => {
            mat4.multiply(mvm, baseMV, getIdleMatrix(m, time));
            mat3.normalFromMat4(nm, mvm);
            gl.uniformMatrix4fv(loc.MV, false, mvm);
            gl.uniformMatrix3fv(loc.N, false, nm);
            gl.uniform1f(loc.glow, m.glow);
            gl.uniform1f(loc.useFlat, 0);

            if (m.outline > 0) {
                gl.enable(gl.CULL_FACE);
                gl.cullFace(gl.FRONT);
                gl.uniform1f(loc.outline, m.outline);
                gl.uniform1f(loc.alpha, 1.0);
                gl.uniform1f(loc.useFlat, 1.0);
                gl.uniform3f(loc.flat, 0.03, 0.05, 0.06);
                bindMesh(m, m.idx);
                gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
                gl.disable(gl.CULL_FACE);
                gl.uniform1f(loc.useFlat, 0.0);
            }

            gl.uniform1f(loc.outline, 0.0);
            gl.uniform1f(loc.alpha, m.alpha);
            if (m.alpha < 1.0) {
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                gl.depthMask(false);
            }
            bindMesh(m, m.idx);
            gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
            if (m.alpha < 1.0) {
                gl.disable(gl.BLEND);
                gl.depthMask(true);
            }
        });

        if (progP && locP) {
            gl.useProgram(progP);
            gl.uniformMatrix4fv(locP.P, false, proj);
            gl.uniformMatrix4fv(locP.MV, false, baseMV);

            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
            gl.depthMask(false);

            gl.bindBuffer(gl.ARRAY_BUFFER, particles.posBuf);
            gl.vertexAttribPointer(locP.pos, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(locP.pos);

            gl.bindBuffer(gl.ARRAY_BUFFER, particles.sizeBuf);
            gl.vertexAttribPointer(locP.size, 1, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(locP.size);

            gl.bindBuffer(gl.ARRAY_BUFFER, particles.colBuf);
            gl.vertexAttribPointer(locP.col, 4, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(locP.col);

            gl.drawArrays(gl.POINTS, 0, particles.count);

            gl.disable(gl.BLEND);
            gl.depthMask(true);
        }

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

function initProg(gl, vsSrc, fsSrc) {
    const mk = (t, s) => {
        const sh = gl.createShader(t);
        gl.shaderSource(sh, s);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(sh)); gl.deleteShader(sh); return null;
        }
        return sh;
    };
    const vs = mk(gl.VERTEX_SHADER, vsSrc), fs = mk(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(p)); return null;
    }
    return p;
}

window.onload = main;
