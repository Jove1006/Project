export interface BoneMaterialConfig {
  color: [number, number, number];
  ambient: number;
  diffuse: number;
  specular: number;
  specularPower: number;
  roughness?: number;
  metallic?: number;
}

export const BONE_MATERIAL: BoneMaterialConfig = {
  color: [1.0, 1.0, 1.0],
  ambient: 0.1,
  diffuse: 1.0,
  specular: 0.05,
  specularPower: 8,
  roughness: 0.5,
  metallic: 0.0,
};

/** 应用材质到 VTK Actor 属性对象 */
export function applyMaterial(property: any, material: BoneMaterialConfig = BONE_MATERIAL): void {
  if (property.setInterpolationToPhong) {
    property.setInterpolationToPhong();
  }
  property.setColor(...material.color);
  property.setAmbient(material.ambient);
  property.setDiffuse(material.diffuse);
  property.setSpecular(material.specular);
  property.setSpecularPower(material.specularPower);
  if (material.roughness !== undefined && property.setRoughness) {
    property.setRoughness(material.roughness);
  }
  if (material.metallic !== undefined && property.setMetallic) {
    property.setMetallic(material.metallic);
  }
}
