import { ReactCurrentDispatcher } from "../react/ReactHooks";
import { markWorkInProgressReceivedUpdate } from "./ReactFiberBeginWork";
import { scheduleUpdateOnFiber } from "./ReactFiberWorkLoop";

export const NoFlags = /*  */ 0b000;

// Represents whether effect should fire.
export const HasEffect = /* */ 0b001;

// Represents the phase in which the effect (not the clean-up) fires.
export const Layout = /*    */ 0b010;
export const Passive = /*   */ 0b100;

// The work-in-progress fiber. I've named it differently to distinguish it from
// the work-in-progress hook.
let currentlyRenderingFiber: any = null;

// Hooks are stored as a linked list on the fiber's memoizedState field. The
// current hook list is the list that belongs to the current fiber. The
// work-in-progress hook list is a new list that will be added to the
// work-in-progress fiber.

// Hooks 用链表结构， 存贮在fiber's memoizedState字段
// Hook | null
let currentHook: any = null;
// Hook | null
let workInProgressHook: any = null;

// Whether an update was scheduled at any point during the render phase. This
// does not get reset if we do another render pass; only when we're completely
// finished evaluating this component. This is an optimization so we know
// whether we need to clear render phase updates after a throw.
let didScheduleRenderPhaseUpdate = false;

// Where an update was scheduled only during the current render pass. This
// gets reset after each attempt.
// TODO: Maybe there's some way to consolidate this with
// `didScheduleRenderPhaseUpdate`. Or with `numberOfReRenders`.
let didScheduleRenderPhaseUpdateDuringThisPass = false;

export function renderWithHooks(
  // null
  current: any,
  workInProgress: any,
  // 这里是函数组件， 其实就是wip.type
  Component: any,
  // wip.props
  props: any
) {
  currentlyRenderingFiber = workInProgress;

  // 为何这边就已经清空 memoizedState 和 updateQueue 了?
  workInProgress.memoizedState = null;
  workInProgress.updateQueue = null;

  // 设置当前的state dispatch
  // 若不是渲染的函数组件， 这个dispatch就是null了
  ReactCurrentDispatcher.current =
    current === null || current.memoizedState === null
      ? HooksDispatcherOnMount
      : HooksDispatcherOnUpdate;

  // 直接执行组件函数, 得到一个 jsx object
  let children = Component(props);

  currentlyRenderingFiber = null;

  currentHook = null;
  workInProgressHook = null;

  didScheduleRenderPhaseUpdate = false;

  return children;
}

export type ReactPriorityLevel = 99 | 98 | 97 | 96 | 95 | 90;

type Update<S, A> = {
  action: A;
  eagerReducer: ((state: S, action: A) => S) | null;
  eagerState: S | null;
  next: Update<S, A> | null;
  priority?: ReactPriorityLevel;
};

type UpdateQueue<S, A> = {
  pending: Update<S, A> | null;
  dispatch: ((action: A) => any) | null;
  lastRenderedReducer: ((state: S, action: A) => S) | null;
  lastRenderedState: S | null;
};

export type Hook = {
  memoizedState: any;
  baseState: any;
  baseQueue: Update<any, any> | null;
  queue: UpdateQueue<any, any> | null;
  next: Hook | null;
};

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,

    baseState: null,
    baseQueue: null,
    queue: null,

    next: null,
  };

  if (workInProgressHook === null) {
    // This is the first hook in the list
    currentlyRenderingFiber.memoizedState = workInProgressHook = hook;
  } else {
    // Append to the end of the list
    workInProgressHook = workInProgressHook.next = hook;
  }
  return workInProgressHook;
}

function updateWorkInProgressHook(): Hook {
  // This function is used both for updates and for re-renders triggered by a
  // render phase update. It assumes there is either a current hook we can
  // clone, or a work-in-progress hook from a previous render pass that we can
  // use as a base. When we reach the end of the base list, we must switch to
  // the dispatcher used for mounts.
  let nextCurrentHook: null | Hook;
  if (currentHook === null) {
    const current = currentlyRenderingFiber.alternate;
    if (current !== null) {
      nextCurrentHook = current.memoizedState;
    } else {
      nextCurrentHook = null;
    }
  } else {
    nextCurrentHook = currentHook.next;
  }

  let nextWorkInProgressHook: null | Hook;
  if (workInProgressHook === null) {
    nextWorkInProgressHook = currentlyRenderingFiber.memoizedState;
  } else {
    nextWorkInProgressHook = workInProgressHook.next;
  }

  if (nextWorkInProgressHook !== null) {
    // There's already a work-in-progress. Reuse it.
    workInProgressHook = nextWorkInProgressHook;
    nextWorkInProgressHook = workInProgressHook.next;

    currentHook = nextCurrentHook;
  } else {
    // Clone from the current hook.

    if (!(nextCurrentHook !== null)) {
      throw new Error("Rendered more hooks than during the previous render.");
    }

    currentHook = nextCurrentHook;

    const newHook: Hook = {
      memoizedState: currentHook.memoizedState,

      baseState: currentHook.baseState,
      baseQueue: currentHook.baseQueue,
      queue: currentHook.queue,

      next: null,
    };

    if (workInProgressHook === null) {
      // This is the first hook in the list.
      currentlyRenderingFiber.memoizedState = workInProgressHook = newHook;
    } else {
      // Append to the end of the list.
      workInProgressHook = workInProgressHook.next = newHook;
    }
  }
  return workInProgressHook;
}

type BasicStateAction<S> = (state: S) => S | S;
type Dispatch<A> = (state: A) => void;

// useState 实际上就是一个特殊的useReduce
// 特殊在， 他默认有一个reduce函数， 这个函数的action可以是直接值， 或者函数
// 下面两个hook等价
// const [count, setCount] = useState(0)
// const [count, setCount] = useReduce((state, action) => (typeof action === 'function' ? action(state) : action), 0)
function basicStateReducer<S>(state: S, action: BasicStateAction<S>): S {
  return typeof action === "function" ? action(state) : action;
}

function mountState<S>(
  initialState: (() => S) | S
): [S, Dispatch<BasicStateAction<S>>] {
  const hook = mountWorkInProgressHook();
  if (typeof initialState === "function") {
    initialState = (initialState as Function)();
  }
  hook.memoizedState = hook.baseState = initialState;
  const queue = (hook.queue = {
    pending: null,
    dispatch: null,
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: initialState,
  });
  const dispatch: Dispatch<BasicStateAction<S>> = ((queue as any).dispatch =
    dispatchAction.bind(null, currentlyRenderingFiber, queue));
  return [hook.memoizedState, dispatch];
}

function updateState<S>(
  initialState: (() => S) | S
): [S, Dispatch<BasicStateAction<S>>] {
  return updateReducer(basicStateReducer, initialState);
}

function updateReducer<S, I, A>(
  reducer: (state: S, action: A) => S,
  initialArg: I,
  init?: (initialState: I) => S
): [S, Dispatch<A>] {
  const hook = updateWorkInProgressHook();
  const queue = hook.queue;

  if (!(queue !== null)) {
    throw new Error(
      "Should have a queue. This is likely a bug in React. Please file an issue."
    );
  }

  queue.lastRenderedReducer = reducer;

  const current: Hook = currentHook;

  // The last rebase update that is NOT part of the base state.
  let baseQueue = current.baseQueue;

  // The last pending update that hasn't been processed yet.
  const pendingQueue = queue.pending;
  if (pendingQueue !== null) {
    // We have new updates that haven't been processed yet.
    // We'll add them to the base queue.
    if (baseQueue !== null) {
      // Merge the pending queue and the base queue.
      const baseFirst = baseQueue.next;
      const pendingFirst = pendingQueue.next;
      baseQueue.next = pendingFirst;
      pendingQueue.next = baseFirst;
    }
    current.baseQueue = baseQueue = pendingQueue;
    queue.pending = null;
  }

  if (baseQueue !== null) {
    // We have a queue to process.
    const first = baseQueue.next;
    let newState = current.baseState;

    let newBaseState = null;
    let newBaseQueueFirst = null;
    let newBaseQueueLast = null;
    let update = first;
    do {
      // const updateLane = update.lane;
      // This update does have sufficient priority.

      if (newBaseQueueLast !== null) {
        const clone: Update<S, A> = {
          // This update is going to be committed so we never want uncommit
          // it. Using NoLane works because 0 is a subset of all bitmasks, so
          // this will never be skipped by the check above.
          // lane: NoLane,
          action: update!.action,
          eagerReducer: update!.eagerReducer,
          eagerState: update!.eagerState,
          next: null,
        };
        newBaseQueueLast = (newBaseQueueLast as any).next = clone;
      }

      // Process this update.
      if (update!.eagerReducer === reducer) {
        // If this update was processed eagerly, and its reducer matches the
        // current reducer, we can use the eagerly computed state.
        newState = update!.eagerState;
      } else {
        const action = update!.action;
        newState = reducer(newState, action);
      }
      update = update!.next;
    } while (update !== null && update !== first);

    if (newBaseQueueLast === null) {
      newBaseState = newState;
    } else {
      (newBaseQueueLast as any).next = newBaseQueueFirst;
    }

    // Mark that the fiber performed work, but only if the new state is
    // different from the current state.
    if (!is(newState, hook.memoizedState)) {
      markWorkInProgressReceivedUpdate();
    }

    hook.memoizedState = newState;
    hook.baseState = newBaseState;
    hook.baseQueue = newBaseQueueLast;

    queue.lastRenderedState = newState;
  }

  const dispatch: any = queue.dispatch;
  return [hook.memoizedState, dispatch];
}

/**
 * inlined Object.is polyfill to avoid requiring consumers ship their own
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
 */
function is(x: any, y: any) {
  return (
    (x === y && (x !== 0 || 1 / x === 1 / y)) || (x !== x && y !== y) // eslint-disable-line no-self-compare
  );
}
function dispatchAction<S, A>(fiber: any, queue: UpdateQueue<S, A>, action: A) {
  // const eventTime = requestEventTime();
  // const lane = requestUpdateLane(fiber);

  const update: Update<S, A> = {
    // lane,
    action,
    eagerReducer: null,
    eagerState: null,
    next: null,
  };

  // Append the update to the end of the list.
  const pending = queue.pending;
  if (pending === null) {
    // This is the first update. Create a circular list.
    update.next = update;
  } else {
    update.next = pending.next;
    pending.next = update;
  }
  queue.pending = update;

  const alternate = fiber.alternate;
  if (
    fiber === currentlyRenderingFiber ||
    (alternate !== null && alternate === currentlyRenderingFiber)
  ) {
    // This is a render phase update. Stash it in a lazily-created map of
    // queue -> linked list of updates. After this render pass, we'll restart
    // and apply the stashed updates on top of the work-in-progress hook.
    didScheduleRenderPhaseUpdateDuringThisPass = didScheduleRenderPhaseUpdate =
      true;
  } else {
    if (
      // fiber.lanes === NoLanes &&
      alternate === null /* || alternate.lanes === NoLanes */
    ) {
      // The queue is currently empty, which means we can eagerly compute the
      // next state before entering the render phase. If the new state is the
      // same as the current state, we may be able to bail out entirely.
      const lastRenderedReducer = queue.lastRenderedReducer;
      if (lastRenderedReducer !== null) {
        let prevDispatcher;
        try {
          const currentState: S = queue.lastRenderedState as any;
          const eagerState = lastRenderedReducer(currentState, action);
          // Stash the eagerly computed state, and the reducer used to compute
          // it, on the update object. If the reducer hasn't changed by the
          // time we enter the render phase, then the eager state can be used
          // without calling the reducer again.
          update.eagerReducer = lastRenderedReducer;
          update.eagerState = eagerState;
          if (is(eagerState, currentState)) {
            // Fast path. We can bail out without scheduling React to re-render.
            // It's still possible that we'll need to rebase this update later,
            // if the component re-renders for a different reason and by that
            // time the reducer has changed.
            return;
          }
        } catch (error) {
          // Suppress the error. It will throw again in the render phase.
        }
      }
    }

    scheduleUpdateOnFiber(fiber);
  }
}

const HooksDispatcherOnMount = {
  // readContext,

  // useCallback: mountCallback,
  // useContext: readContext,
  // useEffect: mountEffect,
  // useImperativeHandle: mountImperativeHandle,
  // useLayoutEffect: mountLayoutEffect,
  // useMemo: mountMemo,
  // useReducer: mountReducer,
  // useRef: mountRef,
  useState: mountState,
  // useDebugValue: mountDebugValue,
  // useDeferredValue: mountDeferredValue,
  // useTransition: mountTransition,
  // useMutableSource: mountMutableSource,
  // useOpaqueIdentifier: mountOpaqueIdentifier,

  // unstable_isNewReconciler: enableNewReconciler,
};

const HooksDispatcherOnUpdate = {
  // readContext,

  // useCallback: updateCallback,
  // useContext: readContext,
  // useEffect: updateEffect,
  // useImperativeHandle: updateImperativeHandle,
  // useLayoutEffect: updateLayoutEffect,
  // useMemo: updateMemo,
  // useReducer: updateReducer,
  // useRef: updateRef,
  useState: updateState,
  // useDebugValue: updateDebugValue,
  // useDeferredValue: updateDeferredValue,
  // useTransition: updateTransition,
  // useMutableSource: updateMutableSource,
  // useOpaqueIdentifier: updateOpaqueIdentifier,

  // unstable_isNewReconciler: enableNewReconciler,
};
