import vtkSTLReader from '@kitware/vtk.js/IO/Geometry/STLReader';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkCleanPolyData from '@kitware/vtk.js/Filters/Core/CleanPolyData';
import vtkWindowedSincPolyDataFilter from '@kitware/vtk.js/Filters/General/WindowedSincPolyDataFilter';
import vtkPolyDataNormals from '@kitware/vtk.js/Filters/Core/PolyDataNormals';
import { applyMaterial } from './material';
import { computeVolume } from './volume';
import { hexToRgb, rgbToHex } from '../utils/color';
import type { LoadedModelInfo } from '../types/model';

export type { LoadedModelInfo } from '../types/model';

type VtkObj = { delete(): void };
type Bundle = { actor: ReturnType<typeof vtkActor.newInstance>; parts: VtkObj[] };

/** STL 加载器：Reader → Clean → Smooth → Normals → Mapper → Actor */
export class STLLoader {
  private renderer: { addActor(a: any): void; removeActor(a: any): void };
  private bundles: Bundle[] = [];

  constructor(renderer: STLLoader['renderer']) {
    this.renderer = renderer;
  }

  loadSTL(arrayBuffer: ArrayBuffer, colorHex?: string): LoadedModelInfo {
    const reader = vtkSTLReader.newInstance();
    reader.parseAsArrayBuffer(arrayBuffer);

    const origData = reader.getOutputData();
    console.log(`[VTK] STL parsed — Points: ${origData.getNumberOfPoints()}, Cells: ${origData.getNumberOfCells()}`);

    const cleaner = vtkCleanPolyData.newInstance({ toleranceIsAbsolute: false, tolerance: 0.0 });
    cleaner.setInputConnection(reader.getOutputPort());
    cleaner.update();

    const cleanedData = cleaner.getOutputData();
    console.log(`[VTK] After CleanPolyData — Points: ${cleanedData.getNumberOfPoints()} (was ${origData.getNumberOfPoints()}), Cells: ${cleanedData.getNumberOfCells()}`);

    const smoother = vtkWindowedSincPolyDataFilter.newInstance({
      numberOfIterations: 15, passBand: 0.1, featureAngle: 30,
      featureEdgeSmoothing: false, boundarySmoothing: true,
      nonManifoldSmoothing: false, normalizeCoordinates: false,
    });
    smoother.setInputData(cleanedData);

    const normals = vtkPolyDataNormals.newInstance({
      computePointNormals: true, computeCellNormals: false,
    });
    normals.setInputConnection(smoother.getOutputPort());
    normals.update();

    const finalData = normals.getOutputData();
    console.log(`[VTK] After smooth+normals — Points: ${finalData.getNumberOfPoints()}, HasNormals: ${!!finalData.getPointData().getNormals()}`);

    const mapper = vtkMapper.newInstance({ scalarVisibility: false });
    mapper.setInputConnection(normals.getOutputPort());

    const actor = vtkActor.newInstance();
    actor.setMapper(mapper);
    applyMaterial(actor.getProperty());
    if (colorHex) actor.getProperty().setColor(...hexToRgb(colorHex));

    this.renderer.addActor(actor);
    const index = this.bundles.length;
    this.bundles.push({ actor, parts: [reader, cleaner, smoother, normals, mapper, actor] });

    return { volume: computeVolume(normals.getOutputData()), index };
  }

  setColor(index: number, hexColor: string): void {
    this.bundles[index]?.actor.getProperty().setColor(...hexToRgb(hexColor));
  }

  setOpacity(index: number, opacity: number): void {
    this.bundles[index]?.actor.getProperty().setOpacity(opacity);
  }

  getColorHex(index: number): string {
    if (!this.bundles[index]) return '#ffffff';
    const [r, g, b] = this.bundles[index].actor.getProperty().getColor();
    return rgbToHex(r, g, b);
  }

  getActor(index: number): any | null {
    return this.bundles[index]?.actor ?? null;
  }

  findIndexByActor(actor: any): number {
    return this.bundles.findIndex(b => b.actor === actor);
  }

  cleanup(): void {
    for (const { actor, parts } of this.bundles) {
      this.renderer.removeActor(actor);
      parts.forEach(p => p.delete());
    }
    this.bundles = [];
  }
}
