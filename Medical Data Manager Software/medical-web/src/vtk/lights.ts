import vtkLight from '@kitware/vtk.js/Rendering/Core/Light';

type V3 = [number, number, number];

const LIGHTS = [
  { offset: [1, 1, 1] as V3, intensity: 1.2 },
  { offset: [-1, 0.5, 0] as V3, intensity: 0.8 },
  { offset: [0, -1, -1] as V3, intensity: 0.8 },
];

const v3 = (v?: number[]): V3 => v?.length! >= 3 ? [v![0], v![1], v![2]] as V3 : [0, 0, 0];
const norm = (v: V3): V3 => { const l = Math.hypot(...v) || 1; return v.map(c => c / l) as V3; };
const sub = (a: V3, b: V3): V3 => a.map((v, i) => v - b[i]!) as V3;
const add = (a: V3, b: V3): V3 => a.map((v, i) => v + b[i]!) as V3;
const mul = (v: V3, s: number): V3 => v.map(c => c * s) as V3;
const cross = (a: V3, b: V3): V3 => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

/** 三点光源系统，跟随相机方向更新 */
export function setupLights(renderer: any) {
  renderer.removeAllLights();

  const handles = LIGHTS.map(({ offset, intensity }) => {
    const light = vtkLight.newInstance();
    light.setIntensity(intensity);
    light.setLightTypeToSceneLight();
    light.setPositional(false);
    renderer.addLight(light);
    return { light, offset };
  });

  const updateFromCamera = () => {
    const cam = renderer.getActiveCamera?.();
    if (!cam) return;

    const pos = v3(cam.getPosition?.()), fp = v3(cam.getFocalPoint?.()), vu = v3(cam.getViewUp?.());
    const fwd = norm(sub(fp, pos));
    const right = norm(cross(fwd, vu));
    const up = norm(cross(right, fwd));
    const sf = Math.max(Math.hypot(...sub(fp, pos)) * 0.6, 1);

    for (const { light, offset: [r, u, f] } of handles) {
      const worldPos = add(fp, mul(add(add(mul(right, r), mul(up, u)), mul(fwd, f)), sf));
      light.setPosition(...worldPos);
      light.setFocalPoint(...fp);
    }
  };

  updateFromCamera();
  return { updateFromCamera };
}
