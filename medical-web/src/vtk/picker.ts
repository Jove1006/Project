/** 模型拾取器：通过 interactor 事件系统实现点击拾取，自动区分点击与拖拽 */
import vtkCellPicker from '@kitware/vtk.js/Rendering/Core/CellPicker';

export interface PickerOptions {
  renderer: any;
  interactor: any;
  findIndex: (actor: any) => number;
  onPick: (index: number) => void;
  /** 返回 true 时跳过本次拾取（用于标注模式等场景） */
  guard?: () => boolean;
}

export function setupPicker(options: PickerOptions): { cleanup: () => void } {
  const { renderer, interactor, findIndex, onPick } = options;

  const picker = vtkCellPicker.newInstance();
  picker.setPickFromList(false);
  picker.setTolerance(0.005);

  let downX = 0;
  let downY = 0;

  const subPress = interactor.onLeftButtonPress((callData: any) => {
    downX = callData.position.x;
    downY = callData.position.y;
  });

  const subRelease = interactor.onLeftButtonRelease((callData: any) => {
    if (options.guard?.()) return; // 标注模式下跳过卡片拾取

    const upX = callData.position.x;
    const upY = callData.position.y;

    const dx = upX - downX;
    const dy = upY - downY;
    if (Math.sqrt(dx * dx + dy * dy) > 5) return;

    picker.pick([upX, upY, 0], renderer);

    const actors = picker.getActors?.() ?? [];
    const pickedActor = actors.length > 0 ? actors[0] : null;
    onPick(pickedActor ? findIndex(pickedActor) : -1);
  });

  return {
    cleanup() {
      subPress.unsubscribe();
      subRelease.unsubscribe();
      picker.delete();
    },
  };
}
