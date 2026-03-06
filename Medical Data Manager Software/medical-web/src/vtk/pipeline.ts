import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkRenderer from '@kitware/vtk.js/Rendering/Core/Renderer';
import vtkRenderWindow from '@kitware/vtk.js/Rendering/Core/RenderWindow';
import vtkRenderWindowInteractor from '@kitware/vtk.js/Rendering/Core/RenderWindowInteractor';
import vtkOpenGLRenderWindow from '@kitware/vtk.js/Rendering/OpenGL/RenderWindow';
import { setupInteraction } from './interaction';

type RendererInstance = ReturnType<typeof vtkRenderer.newInstance>;
type RenderWindowInstance = ReturnType<typeof vtkRenderWindow.newInstance>;
type OpenGLRenderWindowInstance = ReturnType<typeof vtkOpenGLRenderWindow.newInstance>;
type InteractorInstance = ReturnType<typeof vtkRenderWindowInteractor.newInstance>;

export interface PipelineOptions {
  background?: [number, number, number, number];
}

export interface RenderPipeline {
  renderer: RendererInstance;
  renderWindow: RenderWindowInstance;
  openGLRenderWindow: OpenGLRenderWindowInstance;
  interactor: InteractorInstance;
  /** 进入拖拽模式布局：左键留给拖拽，右键旋转 */
  enterDragLayout: () => void;
  /** 退出拖拽模式布局，恢复正常 */
  exitDragLayout: () => void;
  resize: () => void;
  cleanup: () => void;
}

/** 创建 VTK 渲染管线（Renderer + RenderWindow + OpenGL + Interactor） */
export function createRenderPipeline(
  container: HTMLElement,
  options?: PipelineOptions,
): RenderPipeline {
  const bg = options?.background ?? [0, 0, 0, 0] as [number, number, number, number];

  const renderer = vtkRenderer.newInstance();
  renderer.setBackground(...bg);

  const renderWindow = vtkRenderWindow.newInstance();
  renderWindow.addRenderer(renderer);

  const openGLRenderWindow = vtkOpenGLRenderWindow.newInstance();
  renderWindow.addView(openGLRenderWindow);

  const vtkCanvas = openGLRenderWindow.getCanvas();
  if (vtkCanvas) {
    const ctx = vtkCanvas.getContext('webgl2', {
      preserveDrawingBuffer: false,
      depth: true,
      alpha: true,
      powerPreference: 'high-performance',
      antialias: true,
    });
    if (ctx) {
      console.log('[VTK] MSAA pre-create: OK, samples:', ctx.getParameter(ctx.SAMPLES));
    } else {
      console.warn('[VTK] MSAA pre-create: FAILED, falling back to default context');
    }
  }

  openGLRenderWindow.setContainer(container);

  const resize = () => applyResize(openGLRenderWindow, container);
  resize();

  const interactor = vtkRenderWindowInteractor.newInstance();
  interactor.setView(openGLRenderWindow);
  interactor.initialize();

  const interaction = setupInteraction(interactor, container);

  let disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    interaction.cleanup();
    interactor.delete();
    openGLRenderWindow.delete();
    renderWindow.delete();
    renderer.delete();
  };

  return {
    renderer,
    renderWindow,
    openGLRenderWindow,
    interactor,
    enterDragLayout: interaction.enterDragLayout,
    exitDragLayout: interaction.exitDragLayout,
    resize,
    cleanup,
  };
}

function applyResize(glrw: OpenGLRenderWindowInstance, container: HTMLElement): void {
  const { width, height } = container.getBoundingClientRect();
  glrw.setSize(Math.round(width), Math.round(height));
}
