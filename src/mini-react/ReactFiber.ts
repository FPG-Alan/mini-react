import {
  BlockingMode,
  BlockingRoot,
  ClassComponent,
  ConcurrentMode,
  ConcurrentRoot,
  HostComponent,
  HostRoot,
  HostText,
  IndeterminateComponent,
  NoFlags,
  NoMode,
} from "./constants";

export function createFiberRoot(containerInfo: HTMLElement, tag: number) {
  const root: any = {
    tag,
    containerInfo,
    pendingChildren: null,
    current: null,
    pingCache: null,
    finishedWork: null,
    // timeoutHandle = noTimeout,
    context: null,
    pendingContext: null,

    callbackNode: null,
    // callbackPriority = NoLanePriority,
    // eventTimes = createLaneMap(NoLanes);
    // expirationTimes = createLaneMap(NoTimestamp);

    // pendingLanes = NoLanes;
    // suspendedLanes = NoLanes;
    // pingedLanes = NoLanes;
    // expiredLanes = NoLanes;
    // mutableReadLanes = NoLanes;
    // finishedLanes = NoLanes;

    // entangledLanes = NoLanes;
    // entanglements = createLaneMap(NoLanes);
  };

  const uninitializedFiber: any = createHostRootFiber(tag);
  root.current = uninitializedFiber;
  uninitializedFiber.stateNode = root;

  const queue = {
    baseState: uninitializedFiber.memoizedState,
    firstBaseUpdate: null,
    lastBaseUpdate: null,
    shared: {
      pending: null,
    },
    effects: null,
  };
  uninitializedFiber.updateQueue = queue;

  return root;
}

export function createHostRootFiber(tag: number) {
  let mode;
  if (tag === ConcurrentRoot) {
    mode = ConcurrentMode | BlockingMode;
  } else if (tag === BlockingRoot) {
    mode = BlockingMode;
  } else {
    mode = NoMode;
  }

  //   return createFiber(HostRoot, null, null, mode);

  return {
    // Instance
    tag: HostRoot,
    key: null,
    elementType: null,
    type: null,
    stateNode: null,

    // Fiber
    return: null,
    child: null,
    sibling: null,
    index: 0,

    ref: null,

    pendingProps: null,
    memoizedProps: null,
    updateQueue: null,
    memoizedState: null,
    dependencies: null,

    mode,

    // Effects
    flags: NoFlags,
    nextEffect: null,

    firstEffect: null,
    lastEffect: null,

    // lanes:NoLanes,
    // childLanes:NoLanes,

    alternate: null,
  };
}
export function createWorkInProgress(current: any, pendingProps: any) {
  let workInProgress = current.alternate;
  if (workInProgress === null) {
    // 双缓冲池技术
    // We use a double buffering pooling technique because we know that we'll
    // only ever need at most two versions of a tree. We pool the "other" unused
    // node that we're free to reuse. This is lazily created to avoid allocating
    // extra objects for things that are never updated. It also allow us to
    // reclaim the extra memory if needed.
    workInProgress = {
      // Instance
      tag: current.tag,
      key: current.key,
      elementType: current.elementType,
      type: current.type,
      stateNode: current.stateNode,

      // Fiber
      return: null,
      child: null,
      sibling: null,
      index: 0,

      ref: null,

      pendingProps: pendingProps,
      memoizedProps: null,
      updateQueue: null,
      memoizedState: null,
      dependencies: null,

      mode: current.mode,

      // Effects
      flags: NoFlags,
      nextEffect: null,

      firstEffect: null,
      lastEffect: null,

      // lanes:NoLanes,
      // childLanes:NoLanes,

      alternate: current,
    };
    current.alternate = workInProgress;
  } else {
    workInProgress.pendingProps = pendingProps;
    // Needed because Blocks store data on type.
    workInProgress.type = current.type;

    // We already have an alternate.
    // Reset the effect tag.
    workInProgress.flags = NoFlags;

    // The effect list is no longer valid.
    workInProgress.nextEffect = null;
    workInProgress.firstEffect = null;
    workInProgress.lastEffect = null;
  }

  // workInProgress.childLanes = current.childLanes;
  // workInProgress.lanes = current.lanes;

  workInProgress.child = current.child;
  workInProgress.memoizedProps = current.memoizedProps;
  workInProgress.memoizedState = current.memoizedState;
  workInProgress.updateQueue = current.updateQueue;

  // These will be overridden during the parent's reconciliation
  workInProgress.sibling = current.sibling;
  workInProgress.index = current.index;
  workInProgress.ref = current.ref;

  return workInProgress;
}
export function createFiberFromElement(element: any, mode: any) {
  let owner = null;
  const type = element.type;
  const key = element.key;
  const pendingProps = element.props;
  const fiber = createFiberFromTypeAndProps(
    type,
    key,
    pendingProps,
    owner,
    mode
  );
  return fiber;
}

export function createFiberFromTypeAndProps(
  type: any,
  key: any,
  pendingProps: any,
  owner: any,
  mode: any
) {
  // 这里先给一个tag, 意为还不确定的组件
  let fiberTag = IndeterminateComponent;
  // The resolved type is set if we know what the final type will be. I.e. it's not lazy.
  let resolvedType = type;
  if (typeof type === "function") {
    // 如果有原型函数，且原型函数上有 isReactComponent 属性， 可以判断这是一个类组件
    if (shouldConstruct(type)) {
      fiberTag = ClassComponent;
    }
  } else if (typeof type === "string") {
    fiberTag = HostComponent;
  }

  // 如果没能解析出type， resolvedType就是一开始的type
  // 目前我所知的情况下, 如果这里没有解析出不同的结果, fiberTag为初始值 IndeterminateComponent = 2, 其实就是函数组件

  return {
    // Instance
    tag: fiberTag,
    key,
    elementType: type,
    type: resolvedType,
    stateNode: null,

    // Fiber
    return: null,
    child: null,
    sibling: null,
    index: 0,

    ref: null,

    pendingProps,
    memoizedProps: null,
    updateQueue: null,
    memoizedState: null,
    dependencies: null,

    mode,

    // Effects
    flags: NoFlags,
    nextEffect: null,

    firstEffect: null,
    lastEffect: null,

    // lanes:NoLanes,
    // childLanes:NoLanes,

    alternate: null,
  };
}

export function createFiberFromText(content: any, mode: any) {
  return {
    // Instance
    tag: HostText,
    key: null,
    elementType: null,
    type: null,
    stateNode: null,

    // Fiber
    return: null,
    child: null,
    sibling: null,
    index: 0,

    ref: null,

    pendingProps: content,
    memoizedProps: null,
    updateQueue: null,
    memoizedState: null,
    dependencies: null,

    mode,

    // Effects
    flags: NoFlags,
    nextEffect: null,

    firstEffect: null,
    lastEffect: null,

    alternate: null,
  };
}

function shouldConstruct(Component: Function) {
  const prototype = Component.prototype;
  return !!(prototype && prototype.isReactComponent);
}
