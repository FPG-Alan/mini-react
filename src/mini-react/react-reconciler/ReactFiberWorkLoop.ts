import {
  Callback,
  ContentReset,
  Deletion,
  HostRoot,
  Incomplete,
  NoFlags,
  Passive,
  PerformedWork,
  Placement,
  PlacementAndUpdate,
  Snapshot,
  Update,
} from "../constants";
import { createWorkInProgress } from "./ReactFiber";
import { beginWork } from "./ReactFiberBeginWork";
import {
  commitBeforeMutationLifeCycles,
  commitPlacement,
  commitResetTextContent,
  commitWork,
  commitLifeCycles as commitLayoutEffectOnFiber,
  commitDeletion,
} from "./ReactFiberCommitWork";
import { completeWork } from "./ReactFiberCompleteWork";

export const NoContext = /*             */ 0b0000000;
const BatchedContext = /*               */ 0b0000001;
const EventContext = /*                 */ 0b0000010;
const DiscreteEventContext = /*         */ 0b0000100;
const LegacyUnbatchedContext = /*       */ 0b0001000;
const RenderContext = /*                */ 0b0010000;
const CommitContext = /*                */ 0b0100000;
export const RetryAfterError = /*       */ 0b1000000;

export const ImmediatePriority = 99;
export const UserBlockingPriority = 98;
export const NormalPriority = 97;
export const LowPriority = 96;
export const IdlePriority = 95;
// NoPriority is the absence of priority. Also React-only.
export const NoPriority = 90;

// Describes where we are in the React execution stack
let executionContext = NoContext;
// The root we're working on
let workInProgressRoot: any = null;
// The fiber we're working on
let workInProgress: any = null;

// FiberRoot | null
let rootDoesHavePassiveEffects: boolean = false;
let rootWithPendingPassiveEffects: any = null;
let pendingPassiveHookEffectsMount: Array<any> = [];
let pendingPassiveHookEffectsUnmount: Array<any> = [];

// Fiber | null
let nextEffect: any = null;

export function scheduleUpdateOnFiber(fiber: any) {
  const root = findRootOfFiber(fiber);

  if (root === null) {
    return null;
  }

  performSyncWorkOnRoot(root);
}

/**
 * 根据sourceFiber.return向上循环， 直到找到HostRoot fiber
 */
function findRootOfFiber(sourceFiber: any): any {
  // Walk the parent path to the root and update the child expiration time.
  let node = sourceFiber;
  // 第一次渲染时， sourceFiber是 host root fiber, 这个fiber没有return
  // host root fiber的stateNode是fiber root node， fiber root node的current是 host root fiber
  let parent = sourceFiber.return;

  // 第一次渲染时， 跳过这个循环（没有父级）
  // 若存在parent（fiber.return）
  while (parent !== null) {
    node = parent;
    // 向上查找
    parent = parent.return;
  }

  // 初次渲染时， node.tag === HostRoot
  // 其他情况下， node.tag也应该是HostRoot(经过上面的while循环)
  if (node.tag === HostRoot) {
    const root = node.stateNode;
    return root;
  } else {
    return null;
  }
}

function performSyncWorkOnRoot(fiberRoot: any) {
  renderRootSync(fiberRoot);
  const finishedWork = fiberRoot.current.alternate;
  fiberRoot.finishedWork = finishedWork;

  console.log(finishedWork);
  // commit 阶段
  commitRootImpl(fiberRoot);
  console.log("do not go gentle into that good night");
}

// render 阶段
// ----------------------------------------------------------------------------------
function renderRootSync(fiberRoot: any) {
  // If the root or lanes have changed, throw out the existing stack
  // and prepare a fresh one. Otherwise we'll continue where we left off.
  // 第一次渲染时， workInProgressRoot 为null, workInProgressRootRenderLanes 为NoLanes = 0, 执行这个分支
  // 主要是生成workInProgress, 另外设置root上的一些属性
  if (workInProgressRoot !== fiberRoot) {
    prepareFreshStack(fiberRoot);
  }

  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }

  // Set this to null to indicate there's no in-progress render.
  workInProgressRoot = null;
}

function performUnitOfWork(unitOfWork: any) {
  const current = unitOfWork.alternate;
  // next 应该是 unitOfWork.child
  let next = beginWork(current, unitOfWork);

  unitOfWork.memoizedProps = unitOfWork.pendingProps;
  if (next === null) {
    // 没有 child 节点了, 深度优先搜索触底了
    completeUnitOfWork(unitOfWork);
  } else {
    // 循环， 第一次到达这里时， next应该是 host fiber root 的child, 事实上是我们的应用的根节点对应的fiber节点，
    workInProgress = next;
  }
}

// 因为是深度优先搜索, 首次渲染时, 第一个到达这里的 unitOfWork 应该是fiber最深层的节点
function completeUnitOfWork(unitOfWork: any) {
  let completedWork = unitOfWork;
  do {
    // The current, flushed, state of this fiber is the alternate. Ideally
    // nothing should rely on this, but relying on it here means that we don't
    // need an additional field on the work in progress.
    // 如果是首次渲染， 这里的completedWork.alternate应该为null
    const current = completedWork.alternate;
    // 父级， 应该存在
    const returnFiber = completedWork.return;

    // Check if the work completed or if something threw.
    // 正常情况下应该是NoFlags = 0, 按位与后应该是NoFlags
    if ((completedWork.flags & Incomplete) === NoFlags) {
      // 生成dom， 并挂载到fiber.stateNode上
      // 对于tag = IndeterminateComponent / FunctionComponent / ClassComponent 之类的 “非宿主环境提供的组件”， 基本就是什么都不做
      completeWork(current, completedWork);
      if (
        returnFiber !== null &&
        // Do not append effects to parents if a sibling failed to complete
        // 判断父级是否在Incomplete状态(父级在这个状态说明有个兄弟节点没有完成)
        (returnFiber.flags & Incomplete) === NoFlags
      ) {
        // Append all the effects of the subtree and this fiber onto the effect
        // list of the parent. The completion order of the children affects the
        // side-effect order.
        // 在父级上append当前节点的副作用
        // 这是一个链表

        // 若父级还没有effect链表， 直接把子级的链表给父级
        if (returnFiber.firstEffect === null) {
          returnFiber.firstEffect = completedWork.firstEffect;
        }

        if (completedWork.lastEffect !== null) {
          if (returnFiber.lastEffect !== null) {
            returnFiber.lastEffect.nextEffect = completedWork.firstEffect;
          }
          returnFiber.lastEffect = completedWork.lastEffect;
        }

        // If this fiber had side-effects, we append it AFTER the children's
        // side-effects. We can perform certain side-effects earlier if needed,
        // by doing multiple passes over the effect list. We don't want to
        // schedule our own side-effect on our own list because if end up
        // reusing children we'll schedule this effect onto itself since we're
        // at the end.
        const flags = completedWork.flags;

        // Skip both NoWork and PerformedWork tags when creating the effect
        // list. PerformedWork effect is read by React DevTools but shouldn't be
        // committed.
        // 如果当前fiber节点的flags不是NoFlags或PerformedWork， 把这个节点本身加到父级的副作用列表上
        if (flags > PerformedWork) {
          if (returnFiber.lastEffect !== null) {
            returnFiber.lastEffect.nextEffect = completedWork;
          } else {
            returnFiber.firstEffect = completedWork;
          }
          returnFiber.lastEffect = completedWork;
        }
      }
    }

    const siblingFiber = completedWork.sibling;
    if (siblingFiber !== null) {
      // If there is more work to do in this returnFiber, do that next.
      workInProgress = siblingFiber;
      return;
    }
    // Otherwise, return to the parent
    completedWork = returnFiber;
    // Update the next thing we're working on in case something throws.
    // 这里没有return， 因此还在complete过程中
    workInProgress = completedWork;
  } while (completedWork !== null);
}
// ----------------------------------------------------------------------------------

// commit 阶段
// ----------------------------------------------------------------------------------

function commitRootImpl(root: any) {
  do {
    // `flushPassiveEffects` will call `flushSyncUpdateQueue` at the end, which
    // means `flushPassiveEffects` will sometimes result in additional
    // passive effects. So we need to keep flushing in a loop until there are
    // no more pending effects.
    // TODO: Might be better if `flushPassiveEffects` did not automatically
    // flush synchronous work at the end, to avoid factoring hazards like this.
    flushPassiveEffects();
  } while (rootWithPendingPassiveEffects !== null);

  const finishedWork = root.finishedWork;

  if (finishedWork === null) {
    return null;
  }

  root.finishedWork = null;
  workInProgressRoot = null;
  workInProgress = null;

  // Get the list of effects.
  let firstEffect;

  if (finishedWork.flags > PerformedWork) {
    // 如果 host root存在副作用
    // A fiber's effect list consists only of its children, not itself. So if
    // the root has an effect, we need to add it to the end of the list. The
    // resulting list is the set that would belong to the root's parent, if it
    // had one; that is, all the effects in the tree including the root.
    if (finishedWork.lastEffect !== null) {
      // 如果host root上有副作用链(render complete阶段链接的来自child)， 把自己添加到副作用链后
      finishedWork.lastEffect.nextEffect = finishedWork;
      firstEffect = finishedWork.firstEffect;
    } else {
      // 如果host root上没有副作用链， 自己就是第一个副作用(不言自明)
      firstEffect = finishedWork;
    }
  } else {
    // There is no effect on the root.
    // 如果root fiber没有副作用， 第一个副作用就是其上的副作用链上的第一个
    // 这里root fiber 的副作用链可能也不存在
    firstEffect = finishedWork.firstEffect;
  }
  // 如果存在第一个副作用， 对副作用链的循环开始
  if (firstEffect !== null) {
    nextEffect = firstEffect;
    do {
      try {
        commitBeforeMutationEffects();
      } catch (error) {
        nextEffect = nextEffect.nextEffect;
      }
    } while (nextEffect !== null);

    // The next phase is the mutation phase, where we mutate the host tree.
    nextEffect = firstEffect;
    do {
      try {
        commitMutationEffects(root);
      } catch (error) {
        nextEffect = nextEffect.nextEffect;
      }
    } while (nextEffect !== null);

    // The work-in-progress tree is now the current tree. This must come after
    // the mutation phase, so that the previous tree is still current during
    // componentWillUnmount, but before the layout phase, so that the finished
    // work is current during componentDidMount/Update.
    // 切换fiber树
    root.current = finishedWork;

    // The next phase is the layout phase, where we call effects that read
    // the host tree after it's been mutated. The idiomatic use case for this is
    // layout, but class component lifecycles also fire here for legacy reasons.
    nextEffect = firstEffect;
    do {
      try {
        commitLayoutEffects(root);
      } catch (error) {
        nextEffect = nextEffect.nextEffect;
      }
    } while (nextEffect !== null);

    nextEffect = null;
  } else {
    // No effects.
    // 没有副作用， 直接切换fiber树
    root.current = finishedWork;
  }
  if (rootDoesHavePassiveEffects) {
    // This commit has passive effects. Stash a reference to them. But don't
    // schedule a callback until after flushing layout work.
    rootDoesHavePassiveEffects = false;
    rootWithPendingPassiveEffects = root;
  } else {
    // We are done with the effect chain at this point so let's clear the
    // nextEffect pointers to assist with GC. If we have passive effects, we'll
    // clear this in flushPassiveEffects.
    nextEffect = firstEffect;
    // 删除工作
    while (nextEffect !== null) {
      const nextNextEffect: any = nextEffect.nextEffect;
      nextEffect.nextEffect = null;
      if (nextEffect.flags & Deletion) {
        detachFiberAfterEffects(nextEffect);
      }
      nextEffect = nextNextEffect;
    }
  }

  flushPassiveEffects();
  return null;
}

/**
 * 1. 调用 getSnapShotBeforeUpdate 生命周期函数
 * 2. 异步调度 uesEffect
 */
function commitBeforeMutationEffects() {
  while (nextEffect !== null) {
    const current = nextEffect.alternate;

    const flags = nextEffect.flags;
    if ((flags & Snapshot) !== NoFlags) {
      commitBeforeMutationLifeCycles(current, nextEffect);
    }
    if ((flags & Passive) !== NoFlags) {
      // If there are passive effects, schedule a callback to flush at
      // the earliest opportunity.
      if (!rootDoesHavePassiveEffects) {
        rootDoesHavePassiveEffects = true;
      }
    }
    nextEffect = nextEffect.nextEffect;
  }
}
/**
 * commit 第二阶段
 * 1. 解绑ref
 * 2. 根据 fiber flags对dom进行操作(插入/更新/删除)
 * 3. 上一步 fiber flags == Update = 4 时会执行 useLayoutEffect hook 的销毁函数
 */
function commitMutationEffects(root: any) {
  // TODO: Should probably move the bulk of this function to commitWork.
  while (nextEffect !== null) {
    const flags = nextEffect.flags;

    if (flags & ContentReset) {
      commitResetTextContent(nextEffect);
    }

    // The following switch statement is only concerned about placement,
    // updates, and deletions. To avoid needing to add a case for every possible
    // bitmap value, we remove the secondary effects from the effect tag and
    // switch on that value.
    const primaryFlags = flags & (Placement | Update | Deletion);

    switch (primaryFlags) {
      case Placement: {
        commitPlacement(nextEffect);
        // Clear the "placement" from effect tag so that we know that this is
        // inserted, before any life-cycles like componentDidMount gets called.
        // TODO: findDOMNode doesn't rely on this any more but isMounted does
        // and isMounted is deprecated anyway so we should be able to kill this.
        nextEffect.flags &= ~Placement;
        break;
      }
      case PlacementAndUpdate: {
        // Placement
        commitPlacement(nextEffect);
        // Clear the "placement" from effect tag so that we know that this is
        // inserted, before any life-cycles like componentDidMount gets called.
        nextEffect.flags &= ~Placement;

        // Update
        const current = nextEffect.alternate;
        commitWork(current, nextEffect);
        break;
      }
      case Update: {
        const current = nextEffect.alternate;
        commitWork(current, nextEffect);
        break;
      }
      case Deletion: {
        commitDeletion(root, nextEffect);
        break;
      }
    }

    nextEffect = nextEffect.nextEffect;
  }
}
/**
 * commit 第三阶段, 此时dom操作已经做完了
 * 1. 赋值给ref
 * 2. 根据fiber.tag执行对应生命周期函数(componentDidMount / Update)或者useLayoutEffect回调
 */
function commitLayoutEffects(root: any) {
  // TODO: Should probably move the bulk of this function to commitWork.
  while (nextEffect !== null) {
    const flags = nextEffect.flags;

    if (flags & Update) {
      const current = nextEffect.alternate;
      commitLayoutEffectOnFiber(root, current, nextEffect);
    }
    nextEffect = nextEffect.nextEffect;
  }
}

// ================================================================
export function enqueuePendingPassiveHookEffectMount(
  fiber: any,
  effect: any
): void {
  pendingPassiveHookEffectsMount.push(effect, fiber);
  if (!rootDoesHavePassiveEffects) {
    rootDoesHavePassiveEffects = true;
  }
}

export function enqueuePendingPassiveHookEffectUnmount(
  fiber: any,
  effect: any
): void {
  pendingPassiveHookEffectsUnmount.push(effect, fiber);

  if (!rootDoesHavePassiveEffects) {
    rootDoesHavePassiveEffects = true;
  }
}

export function flushPassiveEffects(): boolean {
  // Returns whether passive effects were flushed.
  return flushPassiveEffectsImpl();
}

function flushPassiveEffectsImpl() {
  if (rootWithPendingPassiveEffects === null) {
    return false;
  }

  const root = rootWithPendingPassiveEffects;

  rootWithPendingPassiveEffects = null;

  const prevExecutionContext = executionContext;
  executionContext |= CommitContext;

  // It's important that ALL pending passive effect destroy functions are called
  // before ANY passive effect create functions are called.
  // Otherwise effects in sibling components might interfere with each other.
  // e.g. a destroy function in one component may unintentionally override a ref
  // value set by a create function in another component.
  // Layout effects have the same constraint.

  // First pass: Destroy stale passive effects.
  const unmountEffects = pendingPassiveHookEffectsUnmount;
  pendingPassiveHookEffectsUnmount = [];
  for (let i = 0; i < unmountEffects.length; i += 2) {
    const effect = unmountEffects[i];
    const fiber = unmountEffects[i + 1];
    const destroy = effect.destroy;
    effect.destroy = undefined;

    if (typeof destroy === "function") {
      try {
        destroy();
      } catch (error) {
        // invariant(fiber !== null, "Should be working on an effect.");
        // captureCommitPhaseError(fiber, error);
      }
    }
  }
  // Second pass: Create new passive effects.
  const mountEffects = pendingPassiveHookEffectsMount;
  pendingPassiveHookEffectsMount = [];
  for (let i = 0; i < mountEffects.length; i += 2) {
    const effect = mountEffects[i];
    const fiber = mountEffects[i + 1];
    try {
      const create = effect.create;
      effect.destroy = create();
    } catch (error) {
      // invariant(fiber !== null, "Should be working on an effect.");
      // captureCommitPhaseError(fiber, error);
    }
  }

  // Note: This currently assumes there are no passive effects on the root fiber
  // because the root is not part of its own effect list.
  // This could change in the future.
  let effect = root.current.firstEffect;
  while (effect !== null) {
    const nextNextEffect = effect.nextEffect;
    // Remove nextEffect pointer to assist GC
    effect.nextEffect = null;
    if (effect.flags & Deletion) {
      detachFiberAfterEffects(effect);
    }
    effect = nextNextEffect;
  }

  executionContext = prevExecutionContext;

  // flushSyncCallbackQueue();

  // If additional passive effects were scheduled, increment a counter. If this
  // exceeds the limit, we'll fire a warning.

  return true;
}
// ----------------------------------------------------------------------------------

// 设置root上的一些属性
// 设置该文件内的全局属性， 包括workInProgress等
function prepareFreshStack(root: any) {
  root.finishedWork = null;

  workInProgressRoot = root;
  // 创建wip fiber， 基本就是复制root.current
  workInProgress = createWorkInProgress(root.current, null);
}

function detachFiberAfterEffects(fiber: any): void {
  fiber.sibling = null;
  fiber.stateNode = null;
}
