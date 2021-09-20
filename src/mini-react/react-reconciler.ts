import {
  BlockingMode,
  BlockingRoot,
  ConcurrentMode,
  ConcurrentRoot,
  HostRoot,
  NoFlags,
  NoMode,
  UpdateState,
} from "./constants";
import { renderRootSync } from "./rende-stage";

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

/**
 * 1. 获得 eventTime
 * 2. 获得 update lane
 * 3. 创建 update 对象
 * 4. update 对象进入fiber.updateQueue.pending
 * 5. 调用 scheduleUpdateOnFiber, 开始调度更新
 */
export function updateContainer(children: any, fiberRoot: any) {
  // 这里的current应该是HostFiberRoot
  const hostFiber = fiberRoot.current;

  const update: any = {
    tag: UpdateState,
    payload: { children },
    callback: null,

    next: null,
  };

  //   enqueueUpdate(current, update);
  const updateQueue = hostFiber.updateQueue;
  if (updateQueue !== null) {
    const sharedQueue = updateQueue.shared;
    const pending = sharedQueue.pending;
    if (pending === null) {
      // This is the first update. Create a circular list.
      update.next = update;
    } else {
      update.next = pending.next;
      pending.next = update;
    }
    sharedQueue.pending = update;
  }

  //   scheduleUpdateOnFiber(hostFiber);
  performSyncWorkOnRoot(fiberRoot);
}

export function performSyncWorkOnRoot(fiberRoot: any) {
  renderRootSync(fiberRoot);
  const finishedWork = fiberRoot.current.alternate;
  fiberRoot.finishedWork = finishedWork;

  // commit 阶段
  commitRoot(fiberRoot);

  // Before exiting, make sure there's a callback scheduled for the next
  // pending level.
  ensureRootIsScheduled(fiberRoot);
}
