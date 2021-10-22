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
      container,
      current: root,
    };

    container[FIBER_ROOT_BINDER] = fiberRoot;
  } else {
    fiberRoot.current = root;
  }

  root.stateNode = fiberRoot;
  // 调度更新
  updateOnFiber(root);
}

function updateOnFiber(fiber: Fiber) {
  console.log("update on fiber");
  // 找到root
  const root = findRootFiber(fiber);

  if (root) {
    let wipRoot: Fiber = { ...root };
    let wipFiber: Fiber | null = wipRoot;
    // 开始深度优先遍历
    while (wipFiber) {
      // beignWork
      const nextChild = beginWorkOnFiber(wipFiber);

      if (nextChild) {
        wipFiber = nextChild;
      } else {
        // completeWork
        wipFiber = completeWorkOnFiber(wipFiber);
      }
    }
    // commitWork
    console.log(wipRoot);

    (wipRoot.stateNode as FiberRoot).container.appendChild(
      wipRoot.child?.child?.stateNode as HTMLElement
    );
    (wipRoot.stateNode as FiberRoot).current = wipRoot;
  }
}

function beginWorkOnFiber(wipFiber: Fiber): Fiber | null {
  if (wipFiber.tags === "HostRoot" && wipFiber.pendingProps) {
    const childFiber = createFiber(wipFiber.pendingProps);
    childFiber.return = wipFiber;
    wipFiber.child = childFiber;
    return childFiber;
  }

  if (wipFiber.tags === "FunctionComponent") {
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

function completeWorkOnFiber(wipFiber: Fiber) {
  let currentFiber: Fiber | null = wipFiber;
  while (currentFiber) {
    if (currentFiber.tags === "HostTextNode") {
      currentFiber.stateNode = document.createTextNode(wipFiber.pendingProps);
    }

    if (currentFiber.tags === "HostComponent") {
      currentFiber.stateNode = document.createElement(
        currentFiber.type as string
      );

      // 把他子级的dom全部都append进来
      appendAllChildren(currentFiber);
    }

    if (currentFiber.slibing) {
      return currentFiber.slibing;
    } else {
      currentFiber = currentFiber.return;
    }
  }

  return null;
}

function appendAllChildren(fiber: Fiber) {
  if (fiber.stateNode) {
    let currentChild = fiber.child;
    while (currentChild) {
      if (
        currentChild.stateNode &&
        (currentChild.tags === "HostTextNode" ||
          currentChild.tags === "HostComponent")
      ) {
        (fiber.stateNode as HTMLElement).appendChild(
          currentChild.stateNode as HTMLElement
        );
      }
      currentChild = currentChild.slibing;
    }
  }
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
