import {
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
export function beginWork(current: any, workInProgress: any) {
  switch (workInProgress.tag) {
    case IndeterminateComponent: {
      return mountIndeterminateComponent(workInProgress, workInProgress.type);
    }
    case FunctionComponent: {
      const Component = workInProgress.type;
      const resolvedProps = workInProgress.pendingProps;
      return updateFunctionComponent(
        current,
        workInProgress,
        Component,
        resolvedProps
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

  const nextChildren = renderWithHooks(null, workInProgress, Component, props);
  // React DevTools reads this flag.
  // wip flags是上一轮创建wip这个fiber时设置的, 此处应该是 Placement = 3;
  workInProgress.flags |= PerformedWork;

  // Proceed under the assumption that this is a function component
  // 这边确定了是一个 FunctionComponent , 也就是 IndeterminateComponent => FunctionComponent
  workInProgress.tag = FunctionComponent;

  // 创建下一个节点
  reconcileChildren(null, workInProgress, nextChildren);
  // 返回下一个节点
  return workInProgress.child;
}

function updateFunctionComponent(
  current: any,
  workInProgress: any,
  Component: any,
  nextProps: any
) {
  const nextChildren = renderWithHooks(
    current,
    workInProgress,
    Component,
    nextProps
  );

  // React DevTools reads this flag.
  workInProgress.flags |= PerformedWork;
  reconcileChildren(current, workInProgress, nextChildren);

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
  console.log(workInProgress.type, workInProgress.flags);
  return workInProgress.child;
}

/**
 * 1. 根据 wip.updateQueue, 计算 nextState
 * 2. 调用 reconcileChildren, 生成 wip.child
 * 3. 返回 wip.child
 */
function updateHostRoot(current: any, workInProgress: any) {
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

  if (nextChildren === prevChildren) {
    // bailout
    // return null;
    cloneChildFibers(current, workInProgress);
    return workInProgress.child;
  }

  // 初次渲染时
  // 这里创建第一个wip下第一个节点
  reconcileChildren(current, workInProgress, nextChildren);

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
