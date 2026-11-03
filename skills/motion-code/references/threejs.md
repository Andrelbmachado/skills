# Three.js for motion (r183+; distilled from the threejs-* skills)

Adds to `3d.md` (time model, clips, camera moves, seekable R3F, cleanup, budget) and `principles.md` (timing/easing); no repeats. Imports: `three/addons/...`, never `three/examples/jsm`.

| Topic (## heading) | Source skill(s) |
|---|---|
| Deterministic time, Procedural | animation, fundamentals, performance |
| Clips/mixer, Skeletal and morph | animation, geometry |
| Camera rigs, Interaction | fundamentals, interaction |
| Lighting and shadows | lighting |
| PBR materials, Animated shaders | materials, shaders |
| Post-processing | postprocessing |
| Textures and color space | textures, loaders |
| R3F | react-three-fiber |
| Performance and dispose | performance, geometry, fundamentals |
| Loading and asset pipeline | loaders, asset-pipeline |
| Common traps | all |

## Deterministic time

`THREE.Clock` is deprecated (r183). `THREE.Timer` replaces it but follows the wall clock: fine live, wrong for frame-exact video.

| Need | Do | Avoid |
|---|---|---|
| Live loop | `timer = new THREE.Timer(); timer.connect(document)`; per frame `timer.update()` first, then `getDelta()`/`getElapsed()`; `renderer.setAnimationLoop` | `getElapsedTime()` then `getDelta()` (second is ~0, mixer stalls); `requestAnimationFrame` |
| Video | pure `render(t)`, `t = frame / fps` | Timer, `performance.now()`, `+= dt` |
| Smoothing | `x = target + (x0 - target) * Math.exp(-lambda * t)` | `MathUtils.damp` in render (path dependent, live only) |
| Random / physics | seeded RNG; analytic `p0 + v*t + g*t*t/2` or a pre-simulated fixed-step table indexed by t | `Math.random()`, variable-dt stepping |

Frame order: `mixer.setTime(t)` -> procedural overrides -> camera -> render (the mixer overwrites anything a clip animates). Capture loop and probes: `video-render.md`, `qa.md`.

## Clips, mixer, actions

```js
const mixer = new THREE.AnimationMixer(root)
const a = mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, 'Walk')).play()
a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true   // hold last pose; also LoopRepeat, LoopPingPong
a.timeScale = 1.2                                          // negative = reverse
mixer.setTime(t)                                           // absolute seek: zeroes action times, then update(t)
```

| Task | Call |
|---|---|
| Crossfade | `idle.crossFadeTo(walk, 0.4, true)` (true warps timeScales to match cycle length) |
| One-sided | `walk.reset().fadeIn(0.4).play(); idle.fadeOut(0.4)` (not both forms) |
| Blend space | both playing; `idle.setEffectiveWeight(1-k); run.setEffectiveWeight(k)` |
| Additive layer | `THREE.AnimationUtils.makeClipAdditive(clip)` (breathing, lean) |
| Subrange / teardown | `AnimationUtils.subclip(clip, name, f0, f1, fps)`; `mixer.stopAllAction(); mixer.uncacheRoot(root)` |

Schedule fades at setup so `setTime(t)` replays them. Tracks in code: `VectorKeyframeTrack('.position', times, xyz)`, `QuaternionKeyframeTrack('.quaternion', ...)` (no Euler flips); `values.length === times.length * valueSize` or `play()` hangs; `track.setInterpolation(THREE.InterpolateSmooth)` (Linear | Smooth | Discrete | Bezier).

## Skeletal and morph

```js
const skinned = root.getObjectByProperty('type', 'SkinnedMesh')
const head = skinned.skeleton.bones.find(b => b.name === 'Head')
mixer.setTime(t); head.rotation.y = Math.sin(t) * 0.3   // override AFTER the mixer
handBone.add(prop)                                       // attach = parent to the bone
mesh.morphTargetInfluences[mesh.morphTargetDictionary.smile] = w
```

- Clone characters with `SkeletonUtils.clone` (`Object3D.clone()` shares the skeleton). Skinned bounds are computed once: a far-travelling clip gets culled at screen edge; call `skinned.computeBoundingSphere()` after the mixer or set `frustumCulled = false`.
- Morph keyframes: `NumberKeyframeTrack('.morphTargetInfluences[smile]', ...)`, never a String track; after adding `morphAttributes` by hand call `mesh.updateMorphTargets()`.
- Seamless loop: integer cycles per loop, `sin(2*PI*k*t/T)`; stagger children by phase (`ph = i*0.08`), not speed.

## Camera rigs

Moves, dolly zoom, iso angles: `3d.md`. Extras:

- Lens: `camera.setFocalLength(mm)`. 24-28 dramatic, 50 neutral, 85-135 product/portrait; a longer lens from farther away looks more premium.
- Rig as hierarchy `rig (pos/yaw) -> pitchNode -> camera`: no gimbal, easy crane/orbit. Call `lookAt` after positioning, every frame, at an animated target (own easing = focus pulls, drift).
- Path: `new THREE.CatmullRomCurve3(pts, false, 'centripetal')`; `camera.position.copy(curve.getPointAt(ease(u)))` (arc-length uniform). Ease u, not coordinates; blend orientations with `q.slerpQuaternions(qA, qB, ease(u))`.
- After changing `fov/near/far/aspect/zoom` call `camera.updateProjectionMatrix()`; keep `near` 0.1+. Shake: `patterns.md`.
- OrbitControls is preview-only: `enabled = false` in deterministic renders. R3F: drei `<OrbitControls makeDefault/>`, `CameraControls`, `Bounds`.

## Lighting and shadows

| Light | Role | Typical |
|---|---|---|
| Key `DirectionalLight` | shape, only shadow caster | 2-3, 35-45 deg off-axis, above eye line |
| Fill (hemisphere / IBL) | lifts shadows, key:fill 2:1 to 4:1 | 0.3-0.8, no shadows |
| Rim / back | separation | 1-2, behind subject |
| `scene.environment` HDR | reflections + ambient, best look per cost | `scene.environmentIntensity` 0.3-1 |

- Point/Spot are candela with inverse-square falloff: `new PointLight(0xffffff, 100, 20)` (1 is invisible). Warm `#ffd9b0` key vs cool `#8fb4ff` rim reads cinematic.

```js
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap  // PCFSoftShadowMap deprecated r182; VSM: no PointLight
key.castShadow = true; key.shadow.mapSize.set(2048, 2048)
Object.assign(key.shadow.camera, { left:-6, right:6, top:6, bottom:-6, near:0.5, far:30 }); key.shadow.camera.updateProjectionMatrix()
key.shadow.normalBias = 0.02; key.shadow.bias = -0.0001; key.shadow.radius = 3   // acne: normalBias first
```

Costs: each caster re-draws geometry (6 passes per point light); adding/removing lights or toggling `castShadow` recompiles materials (hide with `intensity = 0`). Static scenes: `shadow.autoUpdate = false; shadow.needsUpdate = true`. Cheap grounding: blurred gradient plane or drei `<ContactShadows frames={1}/>`.

## PBR materials

- `MeshStandardMaterial`: `roughness`, `metalness`, `map`, `normalMap`, `emissive`+`emissiveIntensity`. glTF ORM: ao=R, rough=G, metal=B; with maps keep scalar roughness/metalness at 1 (they multiply). Metals need an environment.
- `MeshPhysicalMaterial`: `clearcoat`, `transmission`+`thickness`+`ior` (glass: `roughness 0, transmission 1, thickness 0.5, ior 1.5`), `sheen`, `iridescence`, `anisotropy`. Transmission costs an extra pass: use sparingly. `MeshBasicMaterial` + `toneMapped: false` keeps exact brand colors.
- Animate by property (`color.lerpColors`, `emissiveIntensity`, `opacity` with `transparent: true` from creation). Changing `transparent`, `side`, `blending`, `vertexColors`, or adding/removing a map after first render needs `material.needsUpdate = true` (recompile): never per frame. Glows/particles: `depthWrite: false`, `AdditiveBlending`.

## Animated shaders

Uniforms come from absolute `t`, never a self-incrementing counter:

```js
const mat = new THREE.ShaderMaterial({ transparent: true, vertexShader, fragmentShader,
  uniforms: { uTime: { value: 0 }, uProgress: { value: 0 } } })
// seek(t): mat.uniforms.uTime.value = t; mat.uniforms.uProgress.value = ease(clamp01(t / 2))
```

Rules: no uniform named `position/normal/uv/modelViewMatrix/cameraPosition`; ShaderMaterial ignores `material.opacity` (declare `uOpacity`); on `InstancedMesh` multiply `instanceMatrix`. End the fragment shader with both includes or mid-tones render dark and tone mapping is skipped:

```glsl
gl_FragColor = vec4(col, a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
```

```glsl
// vertex wave (subdivided plane): p.z += sin(p.x * 5.0 + uTime) * 0.2;
// fresnel, ONE space (world): vN = normalize(mat3(modelMatrix)*normal); vW = (modelMatrix*vec4(position,1.)).xyz;
float f = pow(1.0 - max(dot(normalize(cameraPosition - vW), normalize(vN)), 0.0), 3.0);
// dissolve with glowing edge
float n = texture(uNoise, vUv).r;  if (n < uProgress) discard;
col = mix(col, vec3(1.0, 0.5, 0.1) * 3.0, 1.0 - smoothstep(uProgress, uProgress + 0.08, n));  // >1 feeds bloom

```

- Extend PBR via `material.onBeforeCompile`; per-instance phase/speed via `InstancedBufferAttribute` (many animated particles, one draw call). Debug: `renderer.debug.onShaderError`.

## Post-processing

Every pass is a full-screen draw; bloom and DOF are heaviest. For video spend the budget (full-res bloom, MSAA).

```js
renderer.setPixelRatio(1)   // BEFORE creating the composer (it copies the ratio)
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 }))
composer.addPass(new RenderPass(scene, camera))
composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.8, 0.5, 0.85)) // strength, radius, threshold
composer.addPass(new SMAAPass())                   // linear AA, before OutputPass
composer.addPass(new OutputPass())                 // tone mapping + sRGB happen ONLY here
// resize: renderer.setSize(w,h); composer.setSize(w,h)
```

| Effect | Notes |
|---|---|
| Bloom | threshold 0.85-1 with HDR emissive (`emissiveIntensity` > 1) so only lights glow; strength 0.3-1.2, radius 0.3-0.8. Selective: second composer, `composer.renderToScreen = false` (on the composer, not the pass) |
| DOF | `BokehPass(scene, camera, { focus, aperture: 0.025, maxblur: 0.01 })`; rack focus: `bokeh.uniforms.focus.value = camera.position.distanceTo(subject.position)` |
| Vignette / grain | `ShaderPass(VignetteShader)` offset ~1, darkness 0.6-1; `FilmPass(0.35, false)` time comes from the composer delta: `composer.render(1 / fps)` for reproducible grain |
| AA | SMAA before OutputPass; FXAAPass after it; composer buffers are not MSAA (use the `samples` target) |

- No `OutputPass` = flat/uneven image. `renderer.setEffects([...])` needs `outputBufferType: HalfFloatType`, no OutputPass, and gives FilmPass NaN time.
- pmndrs `postprocessing` / `@react-three/postprocessing` (not in source skills): `<EffectComposer>` merges effects into one `EffectPass` (cheaper): `<Bloom mipmapBlur intensity luminanceThreshold/>`, `<DepthOfField focusDistance focalLength bokehScale/>`, `<Vignette/>`, `<Noise/>`, `<ToneMapping/>`.

## Textures and color space

| Texture | `colorSpace` |
|---|---|
| map, emissiveMap, specular color, LDR matcap, canvas/video as color | `SRGBColorSpace` |
| normal, roughness, metalness, ao, alpha, displacement, masks, noise | default `NoColorSpace` |

- GLTFLoader sets these itself; manual `TextureLoader` color maps need `SRGBColorSpace` (else washed out). `encoding`/`sRGBEncoding` are gone.
- `tex.anisotropy = renderer.capabilities.getMaxAnisotropy()` for floors at grazing angles (flythroughs). To skip mipmaps set `generateMipmaps = false` and `minFilter = LinearFilter`. HDR loaders set linear themselves.
- Env: `hdr.mapping = THREE.EquirectangularReflectionMapping; scene.environment = hdr` (no manual PMREM); without `mapping`, `scene.background` is a flat quad. `backgroundBlurriness`/`backgroundIntensity` tune the backdrop apart from lighting.

## R3F

Seekable `frameloop="never"` + `advance`: `3d.md`.

- `useFrame((state, delta) => ...)`: scale by delta, mutate refs, never `setState` per frame. A positive `renderPriority` means you call `gl.render` (else black). `state.clock.elapsedTime` is fine live; the Canvas Clock deprecation warning is not your bug. Video: own `timeRef`.
- `frameloop="demand"` + `invalidate()` after imperative changes: stills/hover only.
- `<Canvas dpr={[1,2]} shadows="percentage" gl={{ preserveDrawingBuffer: true }}>` (boolean `shadows` = deprecated type; buffer flag needed for screenshots); `flat` disables default ACES.
- drei: `useGLTF` (suspends, caches, Draco/meshopt wired), `useAnimations(gltf.animations, ref)` -> `actions.Walk.reset().fadeIn(0.3).play()`, `Float`, `Bounds`, `Environment`, `Instances`; live easing `maath` `easing.damp3(ref.position, target, 0.25, delta)`.
- Reuse a character: `useMemo(() => SkeletonUtils.clone(scene), [scene])` + `<primitive object/>`. R3F disposes JSX-created objects on unmount, NOT `primitive`, prop-passed or cached `useGLTF/useTexture` assets. R3F 9 <-> React 19, 8 <-> 18.

## Performance and dispose

Read after `render()` (counters reset at its start): `renderer.info.render.{calls,triangles}`, `.memory.{geometries,textures}`. Multi-render frames: `info.autoReset = false`, `info.reset()` once per frame.

| Lever | Do |
|---|---|
| Draw calls | `InstancedMesh` (one geometry+material; many `setMatrixAt`, ONE `instanceMatrix.needsUpdate = true`), `BatchedMesh` (many geometries, needs `addInstance`), `mergeGeometries` for static |
| Fill rate | live `setPixelRatio(Math.min(dpr, 2))`; video: exact size, ratio 1; fewer post passes |
| Loop CPU | no `new Vector3/Color/Matrix4` per frame; static objects `matrixAutoUpdate = false; updateMatrix()` |


`material.dispose()` does not free textures; `Object3D.dispose()` ignores children, geometry, materials:

```js
const disposeTree = r => r.traverse(o => { o.geometry?.dispose()
  for (const m of [o.material ?? []].flat()) { Object.values(m).forEach(v => v?.isTexture && v.dispose()); m.dispose() } })
// teardown: setAnimationLoop(null); disposeTree(scene); composer?.dispose(); renderer.dispose()
```

Leak test: `info.memory.textures/geometries` must drop after disposal (`__probe`, `qa.md`).

## Loading and asset pipeline

```js
const loader = new GLTFLoader()
  .setDRACOLoader(new DRACOLoader())                        // geometry
  .setMeshoptDecoder(MeshoptDecoder)                        // three/addons/libs/meshopt_decoder.module.js
  .setKTX2Loader(new KTX2Loader().detectSupport(renderer))  // ONE shared instance
const gltf = await loader.loadAsync(url)
```

- Decoders load from the three package by default; a missing one throws at load. `npx @gltf-transform/cli inspect model.glb`; `optimize in.glb out.glb --compress draco --texture-compress webp --texture-size 2048` (`ktx2` for VRAM; `--compress` is geometry only). Await loads + `compileAsync` before capture (`window.__ready`, `video-render.md`).
- Normalize imports with `Box3().setFromObject(m)`; convert FBX/OBJ to glTF in Blender.

## Interaction, WebGPU

- Hover/click motion: raycast on pointer events (explicit list + `layers`), set a target, let a damped value chase it. DOM labels: `vec.project(camera)`.
- WebGPU: `three/webgpu`, `await renderer.init()`. ShaderMaterial/onBeforeCompile do not work there; use node materials (`positionNode = positionLocal.add(...)`). TSL `time` follows the wall clock: for video drive your own `uniform(t)`. Post = `RenderPipeline` + `pass()`; `bloom()` returns only the glow (add it to the scene color). Keep WebGLRenderer for GLSL projects.

## Common traps

- Determinism: Timer/Clock/`performance.now()`/`Math.random()` in a render path; `getElapsedTime()`+`getDelta()` in one frame; `+= dt`; FilmPass/TSL `time` on the wall clock; fades issued live; OrbitControls alive in capture; overrides before `mixer.update`; first-frame hitches (shader compile, uploads) without `compileAsync` + warm-up render.
- Dispose: `material.dispose()` leaves textures; `Object3D.dispose()` is per object; R3F keeps `primitive`/cached assets; remove listeners, `setAnimationLoop(null)`.

- Color space: color maps without `SRGBColorSpace` (washed out) or data maps tagged sRGB; ShaderMaterial missing the two output includes; `envMapIntensity` vs `scene.environmentIntensity`; HDR without `EquirectangularReflectionMapping`.
- Tone mapping: ONE place (renderer `ACESFilmic`/`AgX`/`Neutral` + `toneMappingExposure`, `OutputPass`, or the pmndrs effect); two doubles it. Bloom on LDR glows everything: use `emissiveIntensity` > 1 and raise the threshold.
- Misc: `layers.set(1)` hides from layer 0 (use `enable`); `RGBELoader` -> `HDRLoader`; `PostProcessing` -> `RenderPipeline`; black glTF = no lights/environment; black headless canvas = GPU flags (`3d.md`).
