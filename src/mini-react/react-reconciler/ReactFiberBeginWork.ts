import {
  ClassComponent,
  ContentReset,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  IndeterminateComponent,
  PerformedWork,
} from "../constants";
import { shouldSetTextContent } from "../react-dom";
import { cloneChildFibers, reconcileChildFibers } from "./ReactChildFibers";
import { renderWithHooks } from "./ReactFiberHooks";
import { cloneUpdateQueue, processUpdateQueue } from "./ReactUpdateQueue";

/**
 * 1. 标记 didReceiveUpdate
 * 2. 清除 wip.lanes
 * 3. 根据 wip.tag 分发处理函数
 */
let didReceiveUpdate = false;
export function beginWork(current: any, workInProgress: any) {
  console.log(">>> begin work", workInProgress);
  // 下面if else流程设置 didReceiveUpdate 的值
  // 首次渲染， didReceiveUpdate 应为false
  if (current !== null) {
    const oldProps = current.memoizedProps;
    const newProps = workInProgress.pendingProps;

    // 制作浅比较
    if (oldProps !== newProps) {
      // If props or context changed, mark the fiber as having performed work.
      // This may be unset if the props are determined to be equal later (memo).
      didReceiveUpdate = true;
    } else {
      didReceiveUpdate = false;
      // This fiber does not have any pending work. Bailout without entering
      // the begin phase. There's still some bookkeeping we that needs to be done
      // in this optimized path, mostly pushing stuff onto the stack.
      switch (workInProgress.tag) {
        case HostRoot:
          // pushHostRootContext(workInProgress);
          // resetHydrationState();
          break;
        case HostComponent:
          // pushHostContext(workInProgress);
          break;
      }

      console.log("bailout...");
      // return bailoutOnAlreadyFinishedWork(current, workInProgress);
    }
  } else {
    didReceiveUpdate = false;
  }

  switch (workInProgress.tag) {
    case IndeterminateComponent: {
      return mountIndeterminateComponent(workInProgress, workInProgress.type);
    }
    case FunctionComponent: {
      const Component = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      const resolvedProps =
        workInProgress.elementType === Component
          ? unresolvedProps
          : resolveDefaultProps(Component, unresolvedProps);
      return updateFunctionComponent(
        current,
        workInProgress,
        Component,
        resolvedProps
        // renderLanes
      );
    }
    case HostRoot:
      return updateHostRoot(current, workInProgress);
    case HostComponent:
      return updateHostComponent(current, workInProgress);
    case HostText:
      return null;
  }
}
function bailoutOnAlreadyFinishedWork(
  current: any,
  workInProgress: any
  // renderLanes: Lanes,
): any {
  if (current !== null) {
    // Reuse previous dependencies
    workInProgress.dependencies = current.dependencies;
  }

  // markSkippedUpdateLanes(workInProgress.lanes);

  // Check if the children have any pending work.
  // This fiber doesn't have work, but its subtree does. Clone the child
  // fibers and continue.
  cloneChildFibers(current, workInProgress);
  return workInProgress.child;
}

export function markWorkInProgressReceivedUpdate() {
  didReceiveUpdate = true;
}
/**
 * 1. 执行函数组件函数体， 获取value(children)
 * 2. 确认 wip.tag 为 FunctionComponent
 *   (先设置tag为IndeterminateComponent， 再转为FunctionComponent是因为有个特殊情况， 但在这个特殊情况的if分支上有注释说要删除， 所以我暂时不去管)
 * 3. 调用 reconcileChildren 得到 wip.child
 * 4. 返回 wip.child
 */
function mountIndeterminateComponent(workInProgress: any, Component: any) {
  // 这里的pendingProps是jsx上的对应节点的props
  const props = workInProgress.pendingProps;

  let value;

  // hooks??
  // 之前有提到过, 如果一个fiber的tag = IndeterminateComponent = 2, 其实就是一个函数组件
  // 暂时理解为调用函数组件进行渲染, 得到的应该是一个jsx对象
  // 在我学习的例子里, 是下面这样的对象
  // $$typeof: Symbol(react.element)
  // key: null
  // props: {className: 'App', children: {…}}
  // ref: null
  // type: "div"
  // _owner: FiberNode {tag: 2, key: null, stateNode: null, elementType: ƒ, type: ƒ, …}
  // _store: {validated: false}
  // _self: null
  // _source: null
  value = renderWithHooks(null, workInProgress, Component, props);
  // React DevTools reads this flag.
  // wip flags是上一轮创建wip这个fiber时设置的, 此处应该是 Placement = 3;
  workInProgress.flags |= PerformedWork;

  // Proceed under the assumption that this is a function component
  // 这边确定了是一个 FunctionComponent , 也就是 IndeterminateComponent => FunctionComponent
  workInProgress.tag = FunctionComponent;

  // 创建下一个节点
  reconcileChildren(null, workInProgress, value);
  // 返回下一个节点
  return workInProgress.child;
}

function updateFunctionComponent(
  current: any,
  workInProgress: any,
  Component: any,
  nextProps: any
) {
  // let context;
  // if (!disableLegacyContext) {
  //   const unmaskedContext = getUnmaskedContext(workInProgress, Component, true);
  //   context = getMaskedContext(workInProgress, unmaskedContext);
  // }

  let nextChildren;
  // prepareToReadContext(workInProgress, renderLanes);
  nextChildren = renderWithHooks(
    current,
    workInProgress,
    Component,
    nextProps
    // context,
    // renderLanes,
  );

  // if (current !== null && !didReceiveUpdate) {
  //   bailoutHooks(current, workInProgress, renderLanes);
  //   return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  // }

  // React DevTools reads this flag.
  workInProgress.flags |= PerformedWork;
  reconcileChildren(current, workInProgress, nextChildren);

  console.log("updateFunctionComponent get called...", workInProgress);

  return workInProgress.child;
}

/**
 * 基本上。。。。
 * 1. 调用 reconcileChildren 得到 wip.child
 * 2. 返回 wip.child
 */
function updateHostComponent(current: any, workInProgress: any) {
  const type = workInProgress.type;
  const nextProps = workInProgress.pendingProps;
  const prevProps = current !== null ? current.memoizedProps : null;

  let nextChildren = nextProps.children;
  const isDirectTextChild = shouldSetTextContent(type, nextProps);

  if (isDirectTextChild) {
    // We special case a direct text child of a host node. This is a common
    // case. We won't handle it as a reified child. We will instead handle
    // this in the host environment that also has access to this prop. That
    // avoids allocating another HostText fiber and traversing it.
    nextChildren = null;
  } else if (prevProps !== null && shouldSetTextContent(type, prevProps)) {
    // If we're switching from a direct text child to a normal child, or to
    // empty, we need to schedule the text content to be reset.
    workInProgress.flags |= ContentReset;
  }

  reconcileChildren(current, workInProgress, nextChildren);
  return workInProgress.child;
}

/**
 * 1. 根据 wip.updateQueue, 计算 nextState
 * 2. 调用 reconcileChildren, 生成 wip.child
 * 3. 返回 wip.child
 */
function updateHostRoot(current: any, workInProgress: any) {
  console.log(">>> begin work on host root");
  const nextProps = workInProgress.pendingProps;
  const prevState = workInProgress.memoizedState;
  const prevChildren = prevState !== null ? prevState.element : null;
  cloneUpdateQueue(current, workInProgress);
  processUpdateQueue(workInProgress, nextProps, null);
  // nextState 就是上一步 processUpdateQueue 根据wip.updateQueue 算出来的
  // 初次渲染时就是updateQueue.pendingUpdate.payload
  const nextState = workInProgress.memoizedState;
  // Caution: React DevTools currently depends on this property
  // being called "element".
  const nextChildren = nextState.element;
  console.log(nextChildren);
  // 初次渲染不走这个
  if (nextChildren === prevChildren) {
    // bailout
    // return null;
    cloneChildFibers(current, workInProgress);
    return workInProgress.child;
  }

  // 初次渲染时
  // 这里创建第一个wip下第一个节点
  reconcileChildren(current, workInProgress, nextChildren);

  console.log(workInProgress.child);
  // 返回wip.child, 开始对wip tree进行深度优先遍历， 对每个节点进行 beginWork 工作
  return workInProgress.child;
}

export function reconcileChildren(
  current: any,
  workInProgress: any,
  nextChildren: any
) {
  if (current === null) {
    // If this is a fresh new component that hasn't been rendered yet, we
    // won't update its child set by applying minimal side-effects. Instead,
    // we will add them all to the child before it gets rendered. That means
    // we can optimize this reconciliation pass by not tracking side-effects.
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      null,
      nextChildren,
      false
    );
  } else {
    // If the current child is the same as the work in progress, it means that
    // we haven't yet started any work on these children. Therefore, we use
    // the clone algorithm to create a copy of all the current children.

    // If we had any progressed work already, that is invalid at this point so
    // let's throw it out.
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      current.child,
      nextChildren,
      true
    );
  }
}

export function resolveDefaultProps(Component: any, baseProps: Object): Object {
  if (Component && Component.defaultProps) {
    // Resolve default props. Taken from ReactElement
    const props = Object.assign({}, baseProps);
    const defaultProps = Component.defaultProps;
    for (const propName in defaultProps) {
      if ((props as any)[propName] === undefined) {
        (props as any)[propName] = defaultProps[propName];
      }
    }
    return props;
  }
  return baseProps;
}
