// env_crossroads.js — Hollow Knight Storyline Environment
// Tema: "The Sealed Grounds & Infected Mineshaft" (Kisah Utama Lore Hollow Knight)
// 1. The Giant Black Egg: Telur hitam raksasa termeterai tempat mengurung The Hollow Knight & Infection
// 2. The Three Dreamer Masks: Tiga topeng meterai batu putih (Lurien, Monomon, Herrah) di permukaan Black Egg
// 3. The King's Massive Chains: Rantai raksasa Sang Raja Pucat (Pale King) yang menahan Black Egg dari langit-langit
// 4. Multi-Tier Mineshaft Platforms: 4 Lantai perancah kayu & pilar batu tambang yang mengelilingi kuil
// 5. The Radiance Infection Pustules: Kantung gelembung oranye infeksi bercahaya yang tumbuh di dinding batu & kayu
// 6. Jalur Rel Tambang & Gerobak Tambang Tua (Infected Minecart)
// 7. Atmosfer Partikel: Debu infeksi oranye berkilau & partikel void melayang halus
// 8. Visual: Toon cel-shading + outline kartun hitam tajam, smooth idle animations

// ===================== SHADERS =====================
const vsSource = `
    attribute vec3 aPos;
    attribute vec3 aNor;
    attribute vec3 aCol;
    uniform mat4 uMV;
    uniform mat4 uP;
    uniform mat3 uN;
    uniform float uOutline;
    varying vec3 vN;
    varying vec3 vC;
    varying vec3 vWorld;
    varying float vDepth;
    void main(void) {
        vec3 p = aPos + aNor * uOutline;
        vec4 vp = uMV * vec4(p, 1.0);
        gl_Position = uP * vp;
        vN = uN * aNor;
        vC = aCol;
        vWorld = aPos;
        vDepth = -vp.z;
    }
`;

const fsSource = `
    precision mediump float;
    uniform float uAlpha;
    uniform float uUseFlat;
    uniform vec3 uFlat;
    uniform float uGlow;
    varying vec3 vN;
    varying vec3 vC;
    varying vec3 vWorld;
    varying float vDepth;
    void main(void) {
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        
        // Pencahayaan atmosferik Hollow Knight (cahaya atas + pendar infeksi oranye)
        vec3 mainLight = normalize(vec3(0.35, 0.85, 0.45));
        float d = max(dot(n, mainLight), 0.0);
        
        // Toon shading 3 tingkat tegas
        float toon = d < 0.22 ? 0.38 : (d < 0.65 ? 0.72 : 1.05);
        vec3 color = vC * toon;
        
        // Pendaran magis untuk kantung infeksi oranye & lentera
        color += vC * uGlow * 0.85;
        color = mix(color, uFlat, uUseFlat);
        
        // Depth Fog gua poros kuil (hitam kebiruan gelap bernuansa Void)
        vec3 fogColor = vec3(0.06, 0.07, 0.11);
        float fogFactor = clamp((vDepth - 8.0) / 48.0, 0.0, 0.75);
        color = mix(color, fogColor, fogFactor);

        gl_FragColor = vec4(color, uAlpha);
    }
`;

const vsParticle = `
    attribute vec3 aPos;
    attribute float aSize;
    attribute vec4 aCol;
    uniform mat4 uMV;
    uniform mat4 uP;
    varying vec4 vCol;
    void main() {
        vec4 vp = uMV * vec4(aPos, 1.0);
        gl_Position = uP * vp;
        gl_PointSize = aSize * (170.0 / max(1.0, -vp.z));
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

// ===================== MATH HELPERS =====================
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

// ===================== PARAMETRIC MESH BUILDER =====================
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

    if (o.flipNormals) {
        for (let k = 0; k < nor.length; k++) nor[k] = -nor[k];
        for (let k = 0; k < idx.length; k += 3) {
            const tmp = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = tmp;
        }
    }

    if (o.auto) {
        const cnt = pos.length / 3;
        let cx = 0, cy = 0, cz = 0;
        for (let k = 0; k < cnt; k++) { cx += pos[3 * k]; cy += pos[3 * k + 1]; cz += pos[3 * k + 2]; }
        cx /= cnt; cy /= cnt; cz /= cnt;
        let s = 0;
        for (let k = 0; k < cnt; k++) {
            s += nor[3 * k] * (pos[3 * k] - cx) + nor[3 * k + 1] * (pos[3 * k + 1] - cy) + nor[3 * k + 2] * (pos[3 * k + 2] - cz);
        }
        if (s < 0) {
            for (let k = 0; k < nor.length; k++) nor[k] = -nor[k];
            for (let k = 0; k < idx.length; k += 3) {
                const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t;
            }
        }
    }

    return {
        pos, nor, col, idx,
        outline: o.outline || 0, alpha: o.alpha || 1, glow: o.glow || 0,
        idlePivot: o.idlePivot || null,
        idleFn: o.idleFn || null
    };
}

// ===================== FORMULA BENTUK GEOMETRI LORE =====================

// 1. Bentuk Telur Raksasa (The Black Egg)
// Permukaan bulat telur paraboloid/ovoid
function eggShape(rX, rY, rZ) {
    return (u, v) => {
        const theta = u * Math.PI, phi = v * TAU;
        // Profil runcing ke atas khas telur
        const taper = 1.0 - 0.22 * Math.cos(theta);
        const x = rX * Math.sin(theta) * Math.cos(phi) * taper;
        const y = rY * Math.cos(theta);
        const z = rZ * Math.sin(theta) * Math.sin(phi) * taper;
        return [x, y, z];
    };
}

// 2. Kantung Gelembung Infeksi Oranye (Infection Pustule Sac)
function infectionSac(r) {
    return (u, v) => {
        const theta = u * Math.PI, phi = v * TAU;
        // Permukaan gelembung cembung tak beraturan
        const bump = 1.0 + 0.12 * Math.sin(theta * 4.0) * Math.cos(phi * 3.0);
        return [
            r * bump * Math.sin(theta) * Math.cos(phi),
            r * bump * Math.cos(theta),
            r * bump * Math.sin(theta) * Math.sin(phi)
        ];
    };
}

// 3. Cincin Rantai Besi Raksasa (Giant King's Chain Link)
function chainLink(rRing, rTube, stretch = 1.6) {
    return (u, v) => {
        const theta = u * TAU, phi = v * TAU;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        // Regangkan elips agar menjadi rantai lonjong
        const px = (rRing + rTube * Math.cos(phi)) * cosT;
        const py = (rRing * stretch + rTube * Math.cos(phi)) * sinT;
        const pz = rTube * Math.sin(phi);
        return [px, py, pz];
    };
}

// 4. Balok Kayu Lantai Tambang (Wooden Beam Plank)
function boxBeam(w, h, d) {
    return (u, v) => {
        const x = (u - 0.5) * w;
        const z = (v - 0.5) * d;
        const y = h * 0.5 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
        return [x, y, z];
    };
}

// 5. Tiang Kayu Tambang (Timber Mine Prop)
function timberPost(r, len, rough = 0.05) {
    return (u, v) => {
        const n = 1.0 + rough * Math.sin(v * TAU * 4.0 + u * 12.0);
        return [r * n * Math.cos(v * TAU), len * (u - 0.5), r * n * Math.sin(v * TAU)];
    };
}

// 6. Topeng Meterai Dreamer (The Dreamer Stone Seal Mask)
function dreamerMask(rx, ry, rz) {
    return (u, v) => {
        const theta = u * Math.PI * 0.5, phi = v * TAU;
        return [
            rx * Math.sin(theta) * Math.cos(phi),
            ry * Math.sin(theta) * Math.sin(phi),
            rz * Math.cos(theta)
        ];
    };
}

// ===================== MEMBANGUN AREA STORYLINE =====================
function buildStorylineMineshaft() {
    const parts = [];

    // Palet Warna Storyline Hollow Knight
    const EGG_OBSIDIAN = [0.12, 0.13, 0.17];     // Batu obsidian hitam Black Egg
    const INFECTION_OR = [0.98, 0.52, 0.12];     // Oranye pekat Radiance Infection
    const INFECTION_GL = [1.00, 0.72, 0.22];     // Pendaran oranye terang gelembung
    const CHAIN_RUST   = [0.22, 0.24, 0.30];     // Besi rantai kuno Hallownest
    const WOOD_DK      = [0.20, 0.15, 0.12];     // Kayu tua tambang
    const WOOD_MID     = [0.30, 0.22, 0.16];     // Papan lantai kayu tambang
    const STONE_CAVE   = [0.15, 0.17, 0.22];     // Dinding gua batu tambang
    const STONE_SEAL   = [0.82, 0.85, 0.90];     // Topeng Dreamer putih pucat
    const METAL_RAIL   = [0.32, 0.35, 0.42];     // Rel besi tambang

    // ----------------------------------------------------
    // [A] THE GIANT BLACK EGG (Pusat Kuil Meterai di Poros Tambang)
    // ----------------------------------------------------
    const eggPos = [0, 0.4, -2.5];

    // Badan Kuil Telur Hitam Raksasa
    parts.push(buildSurface(eggShape(3.8, 5.2, 3.8), 28, 36, {
        m: makeM(eggPos),
        outline: 0.045, auto: true,
        color: (u, v) => {
            // Garis retakan infeksi oranye merembes di kulit telur
            const crack = Math.sin(u * 22.0 + Math.cos(v * 16.0) * 3.0);
            return crack > 0.82 ? INFECTION_OR : EGG_OBSIDIAN;
        },
        idlePivot: eggPos,
        // Telur berdenyut halus oleh energi Radiance di dalamnya
        idleFn: (t) => {
            const pulse = 1.0 + 0.018 * Math.sin(t * 2.0);
            return [['s', [pulse, pulse, pulse]]];
        }
    }));

    // ----------------------------------------------------
    // [B] THE THREE DREAMER MASKS (Meterai Monomon, Lurien, Herrah)
    // Tiga topeng batu putih besar di permukaan depan Black Egg
    // ----------------------------------------------------
    const dreamerSeals = [
        // Topeng Atas Tengah (Lurien the Watcher)
        { p: [ 0.0, eggPos[1] + 1.8, eggPos[2] + 3.1], rx: 0.55, ry: 0.75, rz: 0.28 },
        // Topeng Kiri Bawah (Monomon the Teacher)
        { p: [-1.4, eggPos[1] - 0.4, eggPos[2] + 3.0], rx: 0.65, ry: 0.55, rz: 0.28 },
        // Topeng Kanan Bawah (Herrah the Beast)
        { p: [ 1.4, eggPos[1] - 0.4, eggPos[2] + 3.0], rx: 0.68, ry: 0.60, rz: 0.28 }
    ];

    dreamerSeals.forEach((seal, sIdx) => {
        // Bentuk cangkang topeng meterai putih
        parts.push(buildSurface(dreamerMask(seal.rx, seal.ry, seal.rz), 14, 18, {
            m: makeM(seal.p, [['x', rad(-10)]]),
            outline: 0.03, auto: true, color: STONE_SEAL,
            idlePivot: seal.p,
            idleFn: (t) => [['s', [1.0 + 0.02 * Math.sin(t * 1.8 + sIdx), 1.0 + 0.02 * Math.sin(t * 1.8 + sIdx), 1.0]]]
        }));

        // Dua mata hitam kosong pada topeng
        [-0.18, 0.18].forEach(eyeX => {
            parts.push(buildSurface(dreamerMask(0.10, 0.14, 0.08), 8, 10, {
                m: makeM([seal.p[0] + eyeX, seal.p[1] + 0.08, seal.p[2] + 0.26]),
                outline: 0.0, auto: true, color: [0.04, 0.04, 0.06]
            }));
        });
    });

    // ----------------------------------------------------
    // [C] THE KING'S MASSIVE CHAINS (Rantai Raksasa Penahan Black Egg)
    // Menggantung dari langit-langit atap tambang mengikat telur
    // ----------------------------------------------------
    const chainPaths = [
        { start: [-3.2,  7.8, -1.8], end: [-2.2,  2.8, -2.2] },
        { start: [ 3.2,  7.8, -1.8], end: [ 2.2,  2.8, -2.2] },
        { start: [ 0.0,  8.0, -0.5], end: [ 0.0,  3.8, -1.5] }
    ];

    chainPaths.forEach((cp, cIdx) => {
        const nLinks = 7;
        for (let l = 0; l < nLinks; l++) {
            const frac = l / nLinks;
            const px = lerp(cp.start[0], cp.end[0], frac);
            const py = lerp(cp.start[1], cp.end[1], frac);
            const pz = lerp(cp.start[2], cp.end[2], frac);
            const isRot = (l % 2 === 0);

            parts.push(buildSurface(chainLink(0.38, 0.10, 1.5), 10, 12, {
                m: makeM([px, py, pz], [['x', isRot ? rad(25) : rad(115)], ['y', isRot ? rad(10) : 0]]),
                outline: 0.025, auto: true, color: CHAIN_RUST,
                idlePivot: cp.start,
                idleFn: (t) => [['z', 0.015 * Math.sin(t * 1.5 + cIdx)]]
            }));
        }
    });

    // ----------------------------------------------------
    // [D] MULTI-TIER MINESHAFT FLOORS (Lantai Bertingkat Poros Tambang)
    // 4 Lantai perancah kayu mengitari Kuil Telur Hitam
    // ----------------------------------------------------
    const floors = [
        // Lantai 1 (Dasar Tambang - Sangat Luas)
        { x: 0, y: -4.2, z: 0.8, w: 18.0, d: 7.5, planks: 14 },
        // Lantai 2 (Tingkat Kanan Menengah & Jalur Rel)
        { x: 3.2, y: -1.8, z: 1.2, w: 11.5, d: 4.8, planks: 9 },
        // Lantai 3 (Tingkat Kiri Menengah - Menghadap Black Egg)
        { x: -3.0, y: 0.8, z: 1.2, w: 10.5, d: 4.6, planks: 8 },
        // Lantai 4 (Tingkat Atas Jembatan Gantung)
        { x: 1.2, y: 3.6, z: 0.4, w: 8.5, d: 3.8, planks: 6 }
    ];

    floors.forEach((fl, fIdx) => {
        for (let p = 0; p < fl.planks; p++) {
            const pz = fl.z + (p / (fl.planks - 1) - 0.5) * fl.d;
            parts.push(buildSurface(boxBeam(fl.w * 0.98, 0.22, fl.d / fl.planks * 0.92), 14, 6, {
                m: makeM([fl.x, fl.y, pz]),
                outline: 0.03, auto: true,
                color: (p % 2 === 0) ? WOOD_MID : WOOD_DK,
                idlePivot: [fl.x, fl.y, fl.z],
                idleFn: (t) => [['z', 0.003 * Math.sin(t * 1.4 + fIdx + p * 0.3)]]
            }));
        }

        // Balok penopang lantai
        [-fl.w * 0.35, fl.w * 0.35].forEach(bx => {
            parts.push(buildSurface(timberPost(0.18, fl.d * 0.98), 8, 10, {
                m: makeM([fl.x + bx, fl.y - 0.22, fl.z], [['x', Math.PI / 2]]),
                outline: 0.03, auto: true, color: WOOD_DK
            }));
        });
    });

    // ----------------------------------------------------
    // [E] TIANG PENOPANG & TANGGA KAYU TAMBANG (Scaffolds & Ladders)
    // ----------------------------------------------------
    const pillars = [
        { x: -2.0, yB: -4.2, yT: -1.8, z: 1.8, r: 0.24 },
        { x:  4.5, yB: -4.2, yT: -1.8, z: 1.8, r: 0.24 },
        { x: -1.2, yB: -1.8, yT:  0.8, z: 1.6, r: 0.22 },
        { x: -5.8, yB: -4.2, yT:  0.8, z: 0.8, r: 0.26 },
        { x:  0.5, yB:  0.8, yT:  3.6, z: 0.8, r: 0.22 },
        { x:  4.8, yB: -1.8, yT:  3.6, z: 0.6, r: 0.26 },
        { x: -3.8, yB:  0.8, yT:  8.0, z: -0.8, r: 0.28 },
        { x:  3.0, yB:  3.6, yT:  8.0, z: -0.8, r: 0.26 }
    ];

    pillars.forEach((pil, idx) => {
        const height = pil.yT - pil.yB;
        const midY = (pil.yT + pil.yB) * 0.5;
        parts.push(buildSurface(timberPost(pil.r, height, 0.06), 12, 14, {
            m: makeM([pil.x, midY, pil.z]),
            outline: 0.035, auto: true, color: WOOD_DK,
            idlePivot: [pil.x, pil.yB, pil.z],
            idleFn: (t) => [['z', 0.004 * Math.sin(t * 1.2 + idx)]]
        }));
    });

    // Tangga Penghubung Lantai
    const ladders = [
        { x: 0.2, yB: -4.2, yT: -1.8, z: 2.2 },
        { x: -1.8, yB: -1.8, yT:  0.8, z: 1.8 },
        { x: 1.5, yB:  0.8, yT:  3.6, z: 1.0 }
    ];

    ladders.forEach(lad => {
        const h = lad.yT - lad.yB;
        const midY = (lad.yT + lad.yB) * 0.5;
        [-0.32, 0.32].forEach(lx => {
            parts.push(buildSurface(timberPost(0.06, h), 6, 8, {
                m: makeM([lad.x + lx, midY, lad.z]),
                outline: 0.02, auto: true, color: WOOD_MID
            }));
        });
        const rungs = Math.floor(h / 0.36);
        for (let r = 1; r < rungs; r++) {
            const ry = lad.yB + r * 0.36;
            parts.push(buildSurface(timberPost(0.04, 0.64), 6, 6, {
                m: makeM([lad.x, ry, lad.z], [['z', Math.PI / 2]]),
                outline: 0.015, auto: true, color: WOOD_DK
            }));
        }
    });

    // ----------------------------------------------------
    // [F] THE INFECTION SACS (Kantung Gelembung Oranye Radiance)
    // Tumbuh di dinding gua, tiang perancah, dan lantai tambang
    // ----------------------------------------------------
    const infectionClusters = [
        // Kluster di lantai bawah dekat rel
        { p: [ 5.2, -1.6, 1.2], r: 0.55 },
        { p: [ 5.6, -1.4, 0.8], r: 0.38 },
        { p: [ 4.8, -1.5, 1.5], r: 0.42 },
        // Kluster besar di dinding batu kiri
        { p: [-5.8,  1.2, 0.2], r: 0.72 },
        { p: [-5.2,  1.5, 0.6], r: 0.48 },
        { p: [-6.2,  0.8, 0.8], r: 0.45 },
        // Kluster di lantai dasar
        { p: [-3.8, -4.0, 1.2], r: 0.60 },
        { p: [-3.2, -3.8, 1.6], r: 0.42 },
        // Kluster yang merayap di dekat Black Egg
        { p: [ 1.8, -3.8, -0.8], r: 0.65 },
        { p: [ 2.4, -3.5, -0.4], r: 0.40 },
        // Menetes dari atap tambang atas
        { p: [-2.2,  7.6, -0.5], r: 0.58 },
        { p: [ 3.5,  7.4, -0.2], r: 0.50 }
    ];

    infectionClusters.forEach((sac, iIdx) => {
        parts.push(buildSurface(infectionSac(sac.r), 12, 16, {
            m: makeM(sac.p),
            outline: 0.03, auto: true, glow: 1.0,
            color: (u) => [INFECTION_OR[0] * (0.85 + 0.25 * u), INFECTION_OR[1] * (0.85 + 0.25 * u), INFECTION_OR[2]],
            idlePivot: sac.p,
            // Kantung infeksi berdenyut bernapas khas The Radiance Infection
            idleFn: (t) => {
                const pulse = 1.0 + 0.08 * Math.sin(t * 3.2 + iIdx * 1.3);
                return [['s', [pulse, pulse * 1.05, pulse]]];
            }
        }));
    });

    // ----------------------------------------------------
    // [G] JALUR REL & GEROBAK TAMBANG (Minecart on Rails)
    // ----------------------------------------------------
    const railY = -1.8 + 0.15;
    [-0.55, 0.55].forEach(rx => {
        parts.push(buildSurface(timberPost(0.05, 9.5), 6, 16, {
            m: makeM([3.2 + rx, railY, 1.2], [['x', Math.PI / 2]]),
            outline: 0.02, auto: true, color: METAL_RAIL
        }));
    });

    // Gerobak tambang besi
    const cartPos = [3.2, railY + 0.45, 1.8];
    parts.push(buildSurface((u, v) => {
        const w = 1.3 * (0.85 + 0.15 * u);
        const d = 1.8 * (0.85 + 0.15 * u);
        const theta = v * TAU;
        return [w * 0.5 * Math.cos(theta), 0.65 * (u - 0.5), d * 0.5 * Math.sin(theta)];
    }, 12, 16, {
        m: makeM(cartPos),
        outline: 0.035, auto: true, color: [0.28, 0.30, 0.36]
    }));
    // 4 Roda gerobak
    [[-0.58, -0.6], [0.58, -0.6], [-0.58, 0.6], [0.58, 0.6]].forEach(wp => {
        parts.push(buildSurface(timberPost(0.22, 0.08), 8, 8, {
            m: makeM([cartPos[0] + wp[0], cartPos[1] - 0.28, cartPos[2] + wp[1]], [['z', Math.PI / 2]]),
            outline: 0.02, auto: true, color: [0.20, 0.22, 0.26]
        }));
    });
    // Kantung infeksi meluber dari dalam gerobak tambang
    parts.push(buildSurface(infectionSac(0.42), 10, 12, {
        m: makeM([cartPos[0], cartPos[1] + 0.25, cartPos[2]]),
        outline: 0.025, auto: true, glow: 1.0, color: INFECTION_GL,
        idlePivot: cartPos,
        idleFn: (t) => {
            const p = 1.0 + 0.06 * Math.sin(t * 3.5);
            return [['s', [p, p, p]]];
        }
    }));

    // Dinding batu gua tambang belakang
    parts.push(buildSurface((u, v) => {
        const x = (u - 0.5) * 28.0;
        const y = (v - 0.5) * 24.0;
        const d = -6.5 + Math.sin(u * 6.0) * Math.cos(v * 4.0) * 0.8;
        return [x, y, d];
    }, 28, 28, {
        color: STONE_CAVE
    }));

    return parts;
}

// ===================== SISTEM PARTIKEL SPORA INFEKSI & VOID =====================
function createStorylineParticles(gl, count) {
    const pos = [], sizes = [], colors = [], speeds = [];
    for (let i = 0; i < count; i++) {
        pos.push(
            (Math.random() - 0.5) * 18.0,
            (Math.random() - 0.5) * 14.0 + 1.0,
            (Math.random() - 0.5) * 10.0 - 0.5
        );
        sizes.push(2.0 + Math.random() * 3.8);
        
        // Dua jenis partikel: Spora Oranye Infeksi Radiance & Debu Putih Jiwa
        const isOrange = Math.random() > 0.35;
        if (isOrange) {
            colors.push(0.98, 0.55, 0.12, 0.60 + Math.random() * 0.35); // Oranye Infeksi
        } else {
            colors.push(0.85, 0.90, 0.98, 0.35 + Math.random() * 0.35); // Putih Jiwa
        }
        speeds.push(0.14 + Math.random() * 0.26, Math.random() * TAU);
    }

    const mk = (data, usage = gl.STATIC_DRAW) => {
        const b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), usage);
        return b;
    };

    return {
        count, rawPos: pos, speeds,
        posBuf: mk(pos, gl.DYNAMIC_DRAW),
        sizeBuf: mk(sizes),
        colBuf: mk(colors),
        update: function(dt, t) {
            for (let i = 0; i < count; i++) {
                const spd = this.speeds[i * 2];
                const ph = this.speeds[i * 2 + 1];
                this.rawPos[i * 3 + 1] += spd * dt;
                this.rawPos[i * 3] += Math.sin(t * 1.2 + ph) * 0.18 * dt;
                if (this.rawPos[i * 3 + 1] > 8.5) {
                    this.rawPos[i * 3 + 1] = -5.0;
                    this.rawPos[i * 3] = (Math.random() - 0.5) * 18.0;
                }
            }
            gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(this.rawPos));
        }
    };
}

// ===================== MATRIKS IDLE HALUS =====================
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

// ===================== WEBGL MAIN =====================
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

    const rawParts = buildStorylineMineshaft();
    rawParts.sort((a, b) => (a.alpha < 1) - (b.alpha < 1));

    const meshes = rawParts.map(m => {
        const lines = [];
        for (let k = 0; k < m.idx.length; k += 3) {
            const a = m.idx[k], b = m.idx[k + 1], c = m.idx[k + 2];
            lines.push(a, b, b, c, c, a);
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

    const particles = createStorylineParticles(gl, 150);

    // Kontrol Kamera Vertikal & Halus
    const DEF = { yaw: -0.18, pitch: 0.15, zoom: 1.15 };
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

        // Latar langit tambang gelap Void
        gl.clearColor(0.07, 0.08, 0.11, 1.0);
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

        // 1. Render Objek Lingkungan
        gl.useProgram(prog);
        gl.uniformMatrix4fv(loc.P, false, proj);

        meshes.forEach(m => {
            mat4.multiply(mvm, baseMV, getIdleMatrix(m, time));
            mat3.normalFromMat4(nm, mvm);
            gl.uniformMatrix4fv(loc.MV, false, mvm);
            gl.uniformMatrix3fv(loc.N, false, nm);
            gl.uniform1f(loc.glow, m.glow);
            gl.uniform1f(loc.useFlat, 0);

            // Pass 1: Outline Kartun Hitam
            if (m.outline > 0) {
                gl.enable(gl.CULL_FACE);
                gl.cullFace(gl.FRONT);
                gl.uniform1f(loc.outline, m.outline);
                gl.uniform1f(loc.alpha, 1.0);
                gl.uniform1f(loc.useFlat, 1.0);
                gl.uniform3f(loc.flat, 0.04, 0.04, 0.06);
                bindMesh(m, m.idx);
                gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
                gl.disable(gl.CULL_FACE);
                gl.uniform1f(loc.useFlat, 0.0);
            }

            // Pass 2: Permukaan Berwarna dengan Toon Shading & Glow
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

        // 2. Render Partikel Spora Oranye & Debu Void
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
