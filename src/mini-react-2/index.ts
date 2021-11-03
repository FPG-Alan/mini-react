import {
  createFiber,
  createRootFiber,
  Deletion,
  NoFlags,
  Placement,
  Update,
} from "./fiber";

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
const DeltionEffects: Fiber[] = [];
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

let render_number = 0;
export function updateOnFiber(fiber: Fiber) {
  console.log("update on fiber");

  render_number++;
  // 找到root
  const root = findRootFiber(fiber);

  if (root) {
    let wipRoot: Fiber = {
      ...root,

      firstEffect: null,
      alternate: root,
      debug: { _render_number_: render_number },
    };
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

    commitWorkOnRoot(wipRoot);
  }
}

function beginWorkOnFiber(wipFiber: Fiber): Fiber | null {
  if (wipFiber.tags === "HostRoot" && wipFiber.pendingProps) {
    const childFiber = createFiber(wipFiber.pendingProps);
    childFiber.return = wipFiber;

    childFiber.alternate = wipFiber.alternate?.child || null;
    // 第一次渲染时， 打上 Placement 标记
    if (!wipFiber.alternate?.child) {
      console.log("第一次渲染， 打上标记");
      childFiber.flags = Placement;
    }

    // 我的diff没有写好， 这里暂时粗暴的每次都全量更新

    // childFiber.flags = Placement;

    wipFiber.child = childFiber;
    return childFiber;
  }

  if (wipFiber.tags === "FunctionComponent") {
    const element = (wipFiber.type as Function)(
      wipFiber.pendingProps,
      wipFiber
    );
    const child = diffChildren(element, wipFiber) || null;
    wipFiber.child = child;
    return child;
  }

  if (wipFiber.tags === "HostComponent" && wipFiber.pendingProps) {
    const child =
      diffChildren(wipFiber.pendingProps.children, wipFiber) || null;
    wipFiber.child = child;
    return child;
  }

  return null;
}

function completeWorkOnFiber(wipFiber: Fiber) {
  let currentFiber: Fiber | null = wipFiber;
  while (currentFiber) {
    if (currentFiber.tags === "HostTextNode") {
      // if (currentFiber.alternate) {
      //   if (currentFiber.alternate.pendingProps !== currentFiber.pendingProps) {
      //     currentFiber.flags |= Update;
      //   }
      // } else {
      //   currentFiber.stateNode = document.createTextNode(wipFiber.pendingProps);
      // }
      currentFiber.stateNode = document.createTextNode(wipFiber.pendingProps);
    }

    // 粗暴的方案就是没有update， 只有placement
    if (currentFiber.tags === "HostComponent") {
      currentFiber.stateNode = document.createElement(
        currentFiber.type as string
      );

      // 把他子级的dom全部都append进来
      appendAllChildren(currentFiber);
    }

    const parent = currentFiber.return;

    // 处理Effect List
    if (parent && currentFiber.firstEffect && currentFiber.lastEffect) {
      // 双指针一定同时存在， 因此有firstEffect就代表父级已经存在副作用链了
      if (parent.firstEffect && parent.lastEffect) {
        parent.lastEffect.nextEffect = currentFiber.firstEffect;
        parent.lastEffect = currentFiber.lastEffect;
      } else {
        // 父级没有副作用链
        parent.firstEffect = currentFiber.firstEffect;
        parent.lastEffect = currentFiber.lastEffect;
      }
    }

    // 处理自身
    if (currentFiber.flags > NoFlags) {
      // 自身存在副作用
      if (parent) {
        if (parent.firstEffect && parent.lastEffect) {
          parent.lastEffect.nextEffect = currentFiber;
          parent.lastEffect = currentFiber;
        } else {
          parent.firstEffect = currentFiber;
          parent.lastEffect = currentFiber;
        }
      }
    }

    if (currentFiber.slibing) {
      return currentFiber.slibing;
    } else {
      currentFiber = currentFiber.return;
    }
  }

  return null;
}

function commitWorkOnRoot(wipRoot: Fiber) {
  const firstEffect = wipRoot.firstEffect;

  if (firstEffect) {
    let effect: Fiber | null = firstEffect;
    // 直接mutation
    while (effect) {
      console.log(effect.flags);
      switch (effect.flags) {
        case Placement:
          const hostParent = getHostParent(effect);

          if (hostParent) {
            const container =
              (hostParent?.tags === "HostComponent" &&
                (hostParent.stateNode as HTMLElement)) ||
              (hostParent.stateNode as FiberRoot).container;

            insertNode(container, effect);
          }

          break;
        case Update:
          break;
        case Deletion:
          console.log("delete");
          if (
            effect.stateNode &&
            (effect.stateNode as HTMLElement).parentNode
          ) {
            (effect.stateNode as HTMLElement).parentNode?.removeChild(
              effect.stateNode as HTMLElement
            );
          }
          break;
        default:
          console.log("not support this flags");
          break;
      }
      effect = effect.nextEffect;
    }
  }

  if (DeltionEffects.length > 0) {
    for (let i = 0, l = DeltionEffects.length; i < l; i += 1) {
      const effect = DeltionEffects[i];
      if (effect.stateNode && (effect.stateNode as HTMLElement).parentNode) {
        (effect.stateNode as HTMLElement).parentNode?.removeChild(
          effect.stateNode as HTMLElement
        );
      }
    }

    DeltionEffects.splice(0, DeltionEffects.length);
  }

  wipRoot.firstEffect = null;
  wipRoot.lastEffect = null;
  (wipRoot.stateNode as FiberRoot).current = wipRoot;
}

function getHostParent(fiber: Fiber) {
  let parent = fiber.return;
  while (parent) {
    if (parent.tags === "HostComponent" || parent.tags === "HostRoot") {
      return parent;
    }
    parent = parent.return;
  }

  return parent;
}

function insertNode(container: HTMLElement, node: Fiber) {
  if (node.tags === "HostComponent" || node.tags === "HostTextNode") {
    container.appendChild(node.stateNode as HTMLElement);
  }

  if (node.tags === "FunctionComponent") {
    if (node.child) {
      insertNode(container, node.child);
      let slibing = node.child.slibing;

      while (slibing) {
        insertNode(container, slibing);
        slibing = slibing.slibing;
      }
    }
  }
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
function diffChildren(element: JSX, returnFiber: Fiber): Fiber | undefined {
  if (element) {
    if (Array.isArray(element)) {
      let prevChild: Fiber | null = null;
      let firstChild: Fiber | null = null;
      for (let i = 0, l = element.length; i < l; i += 1) {
        const child = createFiber(element[i]);
        child.return = returnFiber;
        // child.flags = Placement;
        if (prevChild) {
          (prevChild as Fiber).slibing = child;
        }
        if (!firstChild) {
          child.alternate = returnFiber.alternate?.child || null;
          firstChild = child;
        }

        prevChild = child;
      }

      if (returnFiber.alternate?.child) {
        firstChild!.flags = Placement;
        returnFiber.alternate.child.flags = Deletion;

        DeltionEffects.push(returnFiber.alternate.child);

        let sibling = returnFiber.alternate.child.slibing;
        // firstChild!.firstEffect = returnFiber.alternate.child;

        while (sibling) {
          sibling.flags = Deletion;
          DeltionEffects.push(sibling);
          // firstChild!.firstEffect!.nextEffect = sibling;
          sibling = sibling.slibing;
        }
      }

      return firstChild!;
    }

    const child = createFiber(element);
    child.return = returnFiber;

    if (returnFiber.alternate?.child) {
      child.flags = Placement;
      child.alternate = returnFiber.alternate.child;
      returnFiber.alternate.child.flags = Deletion;

      let sibling = returnFiber.alternate.child.slibing;

      while (sibling) {
        sibling.flags = Deletion;
        sibling = sibling.slibing;
      }
    } else {
      child.alternate = null;
    }
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
