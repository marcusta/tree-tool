// The tree drawn with three.js: a look at its shape and branching while the sliders move. The light is three.js'
// own and the pack's pictures are not here (they stay in the user's Unity project), so colour is judged in Unity.
// Space: the generator is z-up, so the camera's up is z.
import {
    AmbientLight, BufferAttribute, BufferGeometry, CanvasTexture, Color, DirectionalLight, DoubleSide, HemisphereLight, Mesh,
    MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, RepeatWrapping, Scene, SRGBColorSpace, TextureLoader, WebGLRenderer,
    type Texture,
} from 'three';
import type { TreeMesh } from '@tree-tool/trees/generator';

export interface View { yawDeg: number; pitchDeg: number; distanceM: number; targetZ: number }

const BARK = 0x7a5a48, LEAVES = 0x4a6b33;

/** Stand-in foliage for a tree whose leaf picture is in a pack, scattered over the whole atlas so every card shows a
 *  loose cluster instead of a flat square: small leaves, or tufts of needles for a conifer. */
function standIn(needles: boolean): Texture {
    const size = 512, c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    let s = 12345;
    const rnd = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296;
    if (needles) {
        g.lineCap = 'round';
        for (let i = 0; i < 260; i++) {
            const x = rnd() * size, y = rnd() * size, len = 14 + rnd() * 16, dir = rnd() * Math.PI * 2;
            for (let k = 0; k < 14; k++) {
                const a = dir + (rnd() - 0.5) * 2.4, l = len * (0.6 + rnd() * 0.4);
                g.strokeStyle = `hsl(${95 + rnd() * 25}, ${30 + rnd() * 20}%, ${18 + rnd() * 14}%)`;
                g.lineWidth = 1.6 + rnd() * 1.2;
                g.beginPath();
                g.moveTo(x, y);
                g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
                g.stroke();
            }
        }
    } else for (let i = 0; i < 1400; i++) {
        const x = rnd() * size, y = rnd() * size, r = 5 + rnd() * 9;
        g.save();
        g.translate(x, y);
        g.rotate(rnd() * Math.PI * 2);
        g.fillStyle = `hsl(${90 + rnd() * 30}, ${35 + rnd() * 20}%, ${22 + rnd() * 16}%)`;
        g.beginPath();
        g.ellipse(0, 0, r, r * 0.42, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
    }
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.wrapS = t.wrapT = RepeatWrapping;
    return t;
}

export function createPreview(canvas: HTMLCanvasElement, view: View, onView: () => void) {
    const renderer = new WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    const scene = new Scene();
    scene.background = new Color(0x9fc4ea);
    const camera = new PerspectiveCamera(40, 1, 0.1, 600);
    camera.up.set(0, 0, 1);
    scene.add(new HemisphereLight(0xcfe2ff, 0x6a7a4a, 1.8), new AmbientLight(0xffffff, 0.35));
    const sun = new DirectionalLight(0xfff2dc, 2.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.position.set(40, -50, 60);
    Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 35, bottom: -5, near: 1, far: 200 });
    scene.add(sun, sun.target);
    const ground = new Mesh(new PlaneGeometry(300, 300), new MeshStandardMaterial({ color: 0x5f7f3a, roughness: 1 }));
    ground.receiveShadow = true;
    scene.add(ground);

    const stand = { leaves: standIn(false), needles: standIn(true) };
    let standInFor: Texture = stand.leaves;
    const bark = new MeshStandardMaterial({ color: BARK, roughness: 0.95 });
    const leaves = new MeshStandardMaterial({ color: 0xffffff, map: standInFor, roughness: 0.9, side: DoubleSide, alphaTest: 0.45 });
    const tree = new Mesh(new BufferGeometry(), [bark, leaves]);
    tree.castShadow = tree.receiveShadow = true;
    scene.add(tree);

    const loader = new TextureLoader();
    let urls: { bark: string | null; leaves: string | null; needles: boolean } = { bark: null, leaves: null, needles: false };
    /** Pictures for the two materials, by URL (null: flat bark, stand-in leaves or needles). */
    function setPictures(barkUrl: string | null, leavesUrl: string | null, needles: boolean): void {
        if (barkUrl === urls.bark && leavesUrl === urls.leaves && needles === urls.needles) return;
        urls = { bark: barkUrl, leaves: leavesUrl, needles };
        standInFor = needles ? stand.needles : stand.leaves;
        const set = (m: MeshStandardMaterial, url: string | null, fallback: Texture | null, colour: number) => {
            if (m.map && m.map !== stand.leaves && m.map !== stand.needles) m.map.dispose();
            m.map = fallback;
            m.color.set(fallback ? 0xffffff : colour);
            m.needsUpdate = true;
            if (!url) return;
            loader.load(url, t => {
                if ((m === bark ? urls.bark : urls.leaves) !== url) { t.dispose(); return; }
                t.wrapS = t.wrapT = RepeatWrapping;
                t.colorSpace = SRGBColorSpace;
                m.map = t;
                m.color.set(0xffffff);
                m.needsUpdate = true;
            });
        };
        set(bark, barkUrl, null, BARK);
        set(leaves, leavesUrl, standInFor, LEAVES);
    }

    function show(mesh: TreeMesh): void {
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new BufferAttribute(new Float32Array(mesh.positions), 3));
        geometry.setAttribute('normal', new BufferAttribute(new Float32Array(mesh.normals), 3));
        geometry.setAttribute('uv', new BufferAttribute(new Float32Array(mesh.uv), 2));
        geometry.setIndex([...mesh.bark, ...mesh.leaves]);
        geometry.addGroup(0, mesh.bark.length, 0);
        geometry.addGroup(mesh.bark.length, mesh.leaves.length, 1);
        tree.geometry.dispose();
        tree.geometry = geometry;
    }

    /** The whole tree in view: its height, and its crown's reach on a narrow screen. */
    function frame(heightM: number, reachM: number): void {
        resize();
        view.targetZ = heightM * 0.48;
        view.distanceM = Math.max(4, heightM * 2.3, reachM * 3.2 / Math.max(0.3, Math.min(1, camera.aspect)));
        view.pitchDeg = 8;
        onView();
    }

    function place(): void {
        const yaw = view.yawDeg * Math.PI / 180, pitch = view.pitchDeg * Math.PI / 180;
        camera.position.set(Math.sin(yaw) * Math.cos(pitch) * view.distanceM, -Math.cos(yaw) * Math.cos(pitch) * view.distanceM,
            view.targetZ + Math.sin(pitch) * view.distanceM);
        camera.lookAt(0, 0, view.targetZ);
    }

    function resize(): void {
        const w = canvas.clientWidth, h = canvas.clientHeight, r = renderer.getPixelRatio();
        if (canvas.width !== Math.floor(w * r) || canvas.height !== Math.floor(h * r)) {
            renderer.setSize(w, h, false);
            camera.aspect = w / Math.max(1, h);
            camera.updateProjectionMatrix();
        }
    }

    /** A square picture of the current view, at most `px` wide: the model's preview.png. */
    function snapshot(px = 768): Promise<Blob> {
        resize();
        place();
        renderer.render(scene, camera);
        const side = Math.min(canvas.width, canvas.height), out = document.createElement('canvas');
        out.width = out.height = Math.min(px, side);
        out.getContext('2d')!.drawImage(canvas, (canvas.width - side) / 2, (canvas.height - side) / 2, side, side, 0, 0, out.width, out.height);
        return new Promise((ok, fail) => out.toBlob(b => b ? ok(b) : fail(Error('no picture')), 'image/png'));
    }

    // drag turns, shift-drag or right-drag lifts, wheel zooms
    let drag: { x: number; y: number; lift: boolean } | null = null;
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, lift: e.button === 2 || e.shiftKey }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.x = e.clientX; drag.y = e.clientY;
        if (drag.lift) view.targetZ = Math.max(0, view.targetZ + dy * view.distanceM * 0.002);
        else {
            view.yawDeg = (view.yawDeg - dx * 0.4 + 360) % 360;
            view.pitchDeg = Math.min(89, Math.max(-20, view.pitchDeg + dy * 0.3));
        }
        onView();
    });
    canvas.addEventListener('pointerup', () => { drag = null; });
    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        view.distanceM = Math.min(400, Math.max(2, view.distanceM * Math.exp(e.deltaY * 0.0015)));
        onView();
    }, { passive: false });

    const loop = () => { requestAnimationFrame(loop); resize(); place(); renderer.render(scene, camera); };
    loop();
    return { show, setPictures, frame, snapshot };
}
