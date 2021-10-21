import { createFiber, createRootFiber } from "./fiber";

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
export function render(
  jsxObj: JSX,
  container: HTMLElement & { [FIBER_ROOT_BINDER]?: FiberRoot }
) {
  // 清空container
  container.innerHTML = "";
  // 转化第一个fiber节点(jsx - fiber)
  const root = createRootFiber(jsxObj);
  // 创建root fiber
  let fiberRoot = container[FIBER_ROOT_BINDER];
  if (!fiberRoot) {
    fiberRoot = {
      current: root,
    };

    container[FIBER_ROOT_BINDER] = fiberRoot;
  } else {
    fiberRoot.current = root;
  }
  // 调度更新
  updateOnFiber(root);
}

function updateOnFiber(fiber: Fiber) {
  console.log("update on fiber");
  // 找到root
  const root = findRootFiber(fiber);

  if (root) {
    let wipRoot = { ...root };
    let wipFiber: Fiber | null = wipRoot;
    while (wipFiber) {
      wipFiber = workOnFiber(wipFiber);
    }

    console.log(wipRoot);
  }

  // 开始深度优先遍历
  // beignWork
  // completeWork
  // commitWork
}

function workOnFiber(wipFiber: Fiber): Fiber | null {
  if (wipFiber.tags === "HostRoot" && wipFiber.pendingProps) {
    const childFiber = createFiber(wipFiber.pendingProps);
    childFiber.return = wipFiber;
    wipFiber.child = childFiber;
    return childFiber;
  }

  if (wipFiber.tags === "FunctionComponent") {
    console.log("wip is function component");
    console.log(wipFiber);
    const element = (wipFiber.type as Function)(wipFiber.pendingProps);
    const child = diffChildren(element, wipFiber);
    wipFiber.child = child;
    return child;
  }

  if (wipFiber.tags === "HostComponent" && wipFiber.pendingProps) {
    const child = diffChildren(wipFiber.pendingProps.children, wipFiber);
    wipFiber.child = child;
    return child;
  }

  return null;
}

/**
 * 目前其实没有任何diff算法，
 * 只是在创建某一层的fiber链表结构
 */
function diffChildren(element: JSX, returnFiber: Fiber): Fiber {
  if (element) {
    if (Array.isArray(element)) {
      let prevChild: Fiber | null = null;
      let firstChild: Fiber | null = null;
      for (let i = 0, l = element.length; i < l; i += 1) {
        const child = createFiber(element[i]);
        child.return = returnFiber;
        if (prevChild) {
          (prevChild as Fiber).slibing = child;
        }
        if (!firstChild) {
          firstChild = child;
        }

        prevChild = child;
      }

      return firstChild!;
    }

    const child = createFiber(element);
    child.return = returnFiber;
    return child;
  }
}

function findRootFiber(fiber: Fiber): Fiber | null {
  if (fiber.tags === "HostRoot") {
    return fiber;
  }

  let pontentialRoot = fiber.return;
  while (pontentialRoot) {
    if (pontentialRoot.tags === "HostRoot") {
      return pontentialRoot;
    }
    pontentialRoot = pontentialRoot.return;
  }

  return null;
}
