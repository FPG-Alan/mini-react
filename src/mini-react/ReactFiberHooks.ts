// The work-in-progress fiber. I've named it differently to distinguish it from
// the work-in-progress hook.
let currentlyRenderingFiber = null;

// Hooks are stored as a linked list on the fiber's memoizedState field. The
// current hook list is the list that belongs to the current fiber. The
// work-in-progress hook list is a new list that will be added to the
// work-in-progress fiber.

// Hooks 用链表结构， 存贮在fiber's memoizedState字段
// Hook | null
let currentHook = null;
// Hook | null
let workInProgressHook = null;

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

  // 直接执行组件函数, 得到一个 jsx object
  let children = Component(props);

  currentlyRenderingFiber = null;

  currentHook = null;
  workInProgressHook = null;

  didScheduleRenderPhaseUpdate = false;

  return children;
}
