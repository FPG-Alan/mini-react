export function createElement(
  type: JSX["type"],
  props?: Record<string, unknown>,
  children?: JSX[]
): JSX {
  return {
    type,
    props: props || null,
    children: children || null,
  };
}

const FIBER_ROOT_BINDER = "mini_react_fiber_root";
export function render(jsxObj: JSX, container: HTMLElement) {
  // 清空container
  container.innerHTML = "";
  // 创建root fiber

  // 转化第一个fiber节点(jsx - fiber)

  // 调度更新
}

function updateOnFiber(fiber: Fiber) {
  // 找到root
  // 开始深度优先遍历
  // beignWork
  // completeWork
  // commitWork
}
