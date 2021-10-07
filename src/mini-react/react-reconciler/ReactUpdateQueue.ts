import {
  Callback,
  CaptureUpdate,
  DidCapture,
  ForceUpdate,
  ReplaceState,
  ShouldCapture,
  UpdateState,
} from "../constants";

export function cloneUpdateQueue(current: any, workInProgress: any) {
  // Clone the update queue from current. Unless it's already a clone.
  const queue = workInProgress.updateQueue;
  const currentQueue = current.updateQueue;
  if (queue === currentQueue) {
    // 这里是浅拷贝， 后面处理更新队列的时候需要注意
    // 修改workInProgress.updateQueue.shared会影响到current.updateQueue.shared
    const clone = {
      baseState: currentQueue.baseState,
      firstBaseUpdate: currentQueue.firstBaseUpdate,
      lastBaseUpdate: currentQueue.lastBaseUpdate,
      shared: currentQueue.shared,
      effects: currentQueue.effects,
    };
    workInProgress.updateQueue = clone;
  }
}

/**
 * 多个update压入之后形成一个循环链表, 过程如下
 * -------------------------------
 * 只有一个update时
 * pending
 *  |
 * up1 ---> up1
 * --------------------------------
 * 两个update:
 *        pending
 *           |
 * up1 ---> up2
 *  ^--------|
 * --------------------------------
 * 三个update:
 *                 pending
 *                    |
 * up1 ---> up2 ---> up3
 *  ^-----------------|
 *
 * 以此类推
 */
export function enqueueUpdate(fiber: any, update: any) {
  const updateQueue = fiber.updateQueue;
  if (updateQueue === null) {
    // Only occurs if the fiber has been unmounted.
    return;
  }

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

/**
 * 这里对[wip/current].updateQueue.shared上的循环链表进行操作
 * 最终算出一个baseState存放在workInProgress.updateQueue上
 */
// Global state that is reset at the beginning of calling `processUpdateQueue`.
// It should only be read right after calling `processUpdateQueue`, via
// `checkHasForceUpdateAfterProcessing`.
let hasForceUpdate = false;
export function processUpdateQueue(
  workInProgress: any,
  props: any,
  instance: any
) {
  // This is always non-null on a ClassComponent or HostRoot
  const queue = workInProgress.updateQueue;

  hasForceUpdate = false;

  let firstBaseUpdate = queue.firstBaseUpdate;
  let lastBaseUpdate = queue.lastBaseUpdate;

  // Check if there are pending updates. If so, transfer them to the base queue.
  let pendingQueue = queue.shared.pending;
  if (pendingQueue !== null) {
    queue.shared.pending = null;

    // The pending queue is circular. Disconnect the pointer between first
    // and last so that it's non-circular.
    // 解开循环链表
    // 一个指针（pendingQueue）, 直接获得队列的头和尾
    const lastPendingUpdate = pendingQueue;
    const firstPendingUpdate = lastPendingUpdate.next;

    // 这里解开头尾链接
    lastPendingUpdate.next = null;

    // 若存在3个pendingUpdate, 当前示意图如下
    //
    // lastPendingUpdate
    //        |
    //       up3      up1 --> up2
    //        ^--------|-------|
    //                 |
    //         firstPendingQueue
    //
    // 这之后我们就得到了一个单向链表 firstPendingQueue = up1 -> up2 -> up3 = lastPendingUpdate

    // Append pending updates to base queue
    // 把上面的单向链表接到 baseUpdate 单向链表后面
    if (lastBaseUpdate === null) {
      // 之前没有更新队列
      firstBaseUpdate = firstPendingUpdate;
    } else {
      // pending 单向列表接到 lastBaseUpdate 上
      lastBaseUpdate.next = firstPendingUpdate;
    }
    // lastBaseUpdate指针移动到新的更新队列队尾
    lastBaseUpdate = lastPendingUpdate;

    // If there's a` current queue, and it's different from the base queue, then
    // we need to transfer the updates to that queue, too. Because the base
    // queue is a singly-linked list with no cycles, we can append to both
    // lists and take advantage of structural sharing.
    // TODO: Pass `current as argument
    const current = workInProgress.alternate;
    if (current !== null) {
      // This is always non-null on a ClassComponent or HostRoot
      // 若存在current, 对current.updateQueue做类似的操作(firstBaseUpdate, lastBaseUpdate两个指针分别指向头/尾的单向链表)
      // 这里有个疑问， 为何要对current做同样的操作? wip在构建完成之后不是直接替代了current吗?
      const currentQueue = current.updateQueue;
      const currentLastBaseUpdate = currentQueue.lastBaseUpdate;
      if (currentLastBaseUpdate !== lastBaseUpdate) {
        if (currentLastBaseUpdate === null) {
          currentQueue.firstBaseUpdate = firstPendingUpdate;
        } else {
          currentLastBaseUpdate.next = firstPendingUpdate;
        }
        currentQueue.lastBaseUpdate = lastPendingUpdate;
      }
    }
  }

  // These values may change as we process the queue.
  if (firstBaseUpdate !== null) {
    // Iterate through the list of updates to compute the result.
    let newState = queue.baseState;

    let newBaseState = null;
    let newFirstBaseUpdate = null;
    let newLastBaseUpdate = null;

    let update = firstBaseUpdate;
    do {
      const updateEventTime = update.eventTime;
      if (newLastBaseUpdate !== null) {
        const clone = {
          eventTime: updateEventTime,

          tag: update.tag,
          payload: update.payload,
          callback: update.callback,

          next: null,
        };
        newLastBaseUpdate = (newLastBaseUpdate as any).next = clone;
      }

      // Process this update.
      // 初次渲染时， newState = update.payload, 一个包含key = elements, value为jsx elements数组的对象

      // newState在初次渲染时就是update.payload = {elements: jsx...}
      newState = getStateFromUpdate(
        workInProgress,
        queue,
        update,
        newState,
        props,
        instance
      );

      console.log(newState);

      // 初次渲染， callBack为null
      const callback = update.callback;
      if (callback !== null) {
        workInProgress.flags |= Callback;
        const effects = queue.effects;
        if (effects === null) {
          queue.effects = [update];
        } else {
          effects.push(update);
        }
      }
      // 链表向后遍历， 第一次渲染时这个链表只有一个元素， 因此下一个update为null
      update = update.next;
      if (update === null) {
        // 这个pendingQueue已经在进入这个函数之后被设置为null了
        pendingQueue = queue.shared.pending;
        if (pendingQueue === null) {
          // 没有更新了， 跳出循环
          break;
        } else {
          // 暂时不管这里的逻辑
          // An update was scheduled from inside a reducer. Add the new
          // pending updates to the end of the list and keep processing.
          const lastPendingUpdate = pendingQueue;
          // Intentionally unsound. Pending updates form a circular list, but we
          // unravel them when transferring them to the base queue.
          const firstPendingUpdate = lastPendingUpdate.next;
          lastPendingUpdate.next = null;
          update = firstPendingUpdate;
          queue.lastBaseUpdate = lastPendingUpdate;
          queue.shared.pending = null;
        }
      }
    } while (true);

    // 初次渲染走这里， newBaseState得到值为newState
    if (newLastBaseUpdate === null) {
      newBaseState = newState;
    }

    queue.baseState = newBaseState;
    // 这两个值在初次渲染时都为null
    // 因为初次渲染时， queue单向链表只有一个值， 上面的while循环得到baseState之后这个链表就被消耗掉了
    queue.firstBaseUpdate = newFirstBaseUpdate;
    queue.lastBaseUpdate = newLastBaseUpdate;

    // 赋值memoizedState
    workInProgress.memoizedState = newState;
  }
}

function getStateFromUpdate(
  workInProgress: any,
  queue: any,
  update: any,
  prevState: any,
  nextProps: any,
  instance: any
) {
  // 初次渲染， tag为 UpdateState = 0
  switch (update.tag) {
    case ReplaceState: {
      const payload = update.payload;
      if (typeof payload === "function") {
        // Updater function
        const nextState = payload.call(instance, prevState, nextProps);
        return nextState;
      }
      // State object
      return payload;
    }
    case CaptureUpdate: {
      workInProgress.flags =
        (workInProgress.flags & ~ShouldCapture) | DidCapture;
    }
    // Intentional fallthrough
    case UpdateState: {
      console.log(update.payload);
      const payload = update.payload;
      let partialState;
      if (typeof payload === "function") {
        // Updater function
        partialState = payload.call(instance, prevState, nextProps);
      } else {
        // Partial state object
        partialState = payload;
      }
      if (partialState === null || partialState === undefined) {
        // Null and undefined are treated as no-ops.
        return prevState;
      }
      // Merge the partial state and the previous state.
      return Object.assign({}, prevState, partialState);
    }
    case ForceUpdate: {
      hasForceUpdate = true;
      return prevState;
    }
  }
  return prevState;
}

export function commitUpdateQueue(
  finishedWork: any,
  finishedQueue: any,
  instance: any
): void {
  // Commit the effects
  const effects = finishedQueue.effects;
  finishedQueue.effects = null;
  if (effects !== null) {
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      const callback = effect.callback;
      if (callback !== null) {
        effect.callback = null;
        callback(instance);
      }
    }
  }
}
