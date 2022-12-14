import * as THREE from '//cdn.skypack.dev/three@0.130.1/build/three.module.js';

const WATER_WIDTH = 8.0;
const POOL_HEIGHT = 1.0;

// Colors
const black = new THREE.Color('black');
const white = new THREE.Color('white');

function loadFile(filename) {
    return new Promise((resolve, reject) => {
        const loader = new THREE.FileLoader();

        loader.load(filename, (data) => {
            resolve(data);
        });
    });
}

export class WaterSimulation {

    constructor(renderer) {
        const DETAIL_BITS = 128 * WATER_WIDTH;
        const WATER_SPEED = .002;   // could be changed

        this.renderer = renderer;

        this.ambientDropFreq = 40;    // could be changed
        this.step = 0;

        this._camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0, 2000);

        this._geometry = new THREE.PlaneBufferGeometry(WATER_WIDTH, WATER_WIDTH);

        this._textureA = new THREE.WebGLRenderTarget(DETAIL_BITS, DETAIL_BITS, { type: THREE.FloatType });
        this._textureB = new THREE.WebGLRenderTarget(DETAIL_BITS, DETAIL_BITS, { type: THREE.FloatType });
        this.texture = this._textureA;

        const shadersPromises = [
            loadFile('shaders/simulation/vertex.glsl'),
            loadFile('shaders/simulation/drop_fragment.glsl'),
            loadFile('shaders/simulation/normal_fragment.glsl'),
            loadFile('shaders/simulation/update_fragment.glsl'),
        ];

        this.loaded = Promise.all(shadersPromises)
            .then(([vertexShader, dropFragmentShader, normalFragmentShader, updateFragmentShader]) => {
                const dropMaterial = new THREE.RawShaderMaterial({
                    uniforms: {
                        center: { value: [0, 0] },
                        radius: { value: 0 },
                        strength: { value: 0 },
                        texture: { value: null },
                    },
                    vertexShader: vertexShader,
                    fragmentShader: dropFragmentShader,
                });

                const normalMaterial = new THREE.RawShaderMaterial({
                    uniforms: {
                        delta: { value: [WATER_SPEED, WATER_SPEED] },  // TODO: Remove this useless uniform and hardcode it in shaders?
                        texture: { value: null },
                    },
                    vertexShader: vertexShader,
                    fragmentShader: normalFragmentShader,
                });

                const updateMaterial = new THREE.RawShaderMaterial({
                    uniforms: {
                        delta: { value: [WATER_SPEED, WATER_SPEED] },  // TODO: Remove this useless uniform and hardcode it in shaders?
                        texture: { value: null },
                    },
                    vertexShader: vertexShader,
                    fragmentShader: updateFragmentShader,
                });

                this._dropMesh = new THREE.Mesh(this._geometry, dropMaterial);
                this._normalMesh = new THREE.Mesh(this._geometry, normalMaterial);
                this._updateMesh = new THREE.Mesh(this._geometry, updateMaterial);
            });
    }

    // Set frame frequency of random drops
    setAmbientDropFreq(ambientDropFreq) {
        this.ambientDropFreq = ambientDropFreq;
    }

    // Add a drop of water at the (x, y) coordinate
    addDrop(renderer, x, y, radius, strength) {
        this._dropMesh.material.uniforms['center'].value = [x, y];
        this._dropMesh.material.uniforms['radius'].value = radius;
        this._dropMesh.material.uniforms['strength'].value = strength;

        this._render(renderer, this._dropMesh);
    }

    addRandomDrop() {
        this.addDrop(
            this.renderer,
            Math.random() * WATER_WIDTH - WATER_WIDTH / 2.0, Math.random() * WATER_WIDTH - WATER_WIDTH / 2.0,
            0.03, 0.02
        );
    }

    stepSimulation(renderer, ambientDrops = false) {
        this.step++;
        if (ambientDrops && this.step > this.ambientDropFreq) {
            this.addRandomDrop();
            this.step = 0;
        }
        this._render(renderer, this._updateMesh);
    }

    updateNormals(renderer) {
        this._render(renderer, this._normalMesh);
    }

    _render(renderer, mesh) {
        // Swap textures
        const oldTexture = this.texture;
        const newTexture = this.texture === this._textureA ? this._textureB : this._textureA;

        mesh.material.uniforms['texture'].value = oldTexture.texture;
        renderer.setRenderTarget(newTexture);

        renderer.render(mesh, this._camera);

        this.texture = newTexture;
    }

}

export class Water {
    constructor(light, floor) {
        this.geometry = new THREE.CircleGeometry(WATER_WIDTH / 2, 200);

        const shadersPromises = [
            loadFile('shaders/water/vertex.glsl'),
            loadFile('shaders/water/fragment.glsl')
        ];

        this.loaded = Promise.all(shadersPromises)
            .then(([vertexShader, fragmentShader]) => {
                this.material = new THREE.RawShaderMaterial({
                    uniforms: {
                        light: { value: light },
                        floor: { value: floor },
                        water: { value: null },
                        causticTex: { value: null },
                        underwater: { value: false }
                    },
                    vertexShader: vertexShader,
                    fragmentShader: fragmentShader,
                });

                this.mesh = new THREE.Mesh(this.geometry, this.material);
                this.material.uniforms['floor'].value.wrapS = this.material.uniforms['floor'].value.wrapT = THREE.RepeatWrapping;
            });
    }

    draw(renderer, waterTexture, camera) {

        this.material.uniforms['water'].value = waterTexture;

        this.material.side = THREE.FrontSide;
        this.material.uniforms['underwater'].value = true;
        renderer.render(this.mesh, camera);

        this.material.side = THREE.BackSide;
        this.material.uniforms['underwater'].value = false;
        renderer.render(this.mesh, camera);
    }

}