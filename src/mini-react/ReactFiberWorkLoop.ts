import {
  Callback,
  ContentReset,
  Deletion,
  Incomplete,
  NoFlags,
  PerformedWork,
  Placement,
  Update,
} from "./constants";
import { createWorkInProgress } from "./ReactFiber";
import { beginWork } from "./ReactFiberBeginWork";
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
let pendingPassiveEffectsRenderPriority = NoPriority;
let rootDoesHavePassiveEffects: boolean = false;
let rootWithPendingPassiveEffects: any = null;
let pendingPassiveHookEffectsMount: Array<any> = [];
let pendingPassiveHookEffectsUnmount: Array<any> = [];
let pendingPassiveProfilerEffects: Array<any> = [];

let rootsWithPendingDiscreteUpdates: Set<any> | null = null;

// null | Fiber
let focusedInstanceHandle: any = null;
let shouldFireAfterActiveInstanceBlur = false;

// Fiber | null
let nextEffect: any = null;

export function performSyncWorkOnRoot(fiberRoot: any) {
  renderRootSync(fiberRoot);
  const finishedWork = fiberRoot.current.alternate;
  fiberRoot.finishedWork = finishedWork;

  // commit 阶段
  commitRootImpl(fiberRoot);

  // Before exiting, make sure there's a callback scheduled for the next
  // pending level.
  // ensureRootIsScheduled(fiberRoot);
}

// render 阶段
// ----------------------------------------------------------------------------------
export function renderRootSync(fiberRoot: any) {
  // 暂时不懂， 跳过不看
  //  const prevDispatcher = pushDispatcher();

  // If the root or lanes have changed, throw out the existing stack
  // and prepare a fresh one. Otherwise we'll continue where we left off.
  // 第一次渲染时， workInProgressRoot 为null, workInProgressRootRenderLanes 为NoLanes = 0, 执行这个分支
  // 主要是生成workInProgress, 另外设置root上的一些属性
  if (workInProgressRoot !== fiberRoot) {
    prepareFreshStack(fiberRoot);

    // 暂时不懂
    // startWorkOnPendingInteractions(root, lanes);
  }

  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }

  // Set this to null to indicate there's no in-progress render.
  workInProgressRoot = null;
}

function performUnitOfWork(unitOfWork: any) {
  // The current, flushed, state of this fiber is the alternate. Ideally
  // nothing should rely on this, but relying on it here means that we don't
  // need an additional field on the work in progress.
  // 在第一次渲染的过程中， 每一次current都为null
  const current = unitOfWork.alternate;

  // next 应该是 unitOfWork.child
  let next = beginWork(current, unitOfWork);

  unitOfWork.memoizedProps = unitOfWork.pendingProps;
  if (next === null) {
    // If this doesn't spawn new work, complete the current work.

    // 没有 child 节点了, 深度优先搜索触底了
    // (completeUnitOfWork 还有可能产生新的工作)...
    completeUnitOfWork(unitOfWork);
  } else {
    // 循环， 第一次到达这里时， next应该是 host fiber root 的child, 事实上是我们的应用的根节点对应的fiber节点，
    // 对应学习的例子里， 这个fiber节点对应 <App>...</App>
    workInProgress = next;
  }
}

// 因为是深度优先搜索, 首次渲染时, 第一个到达这里的 unitOfWork 应该是fiber最深层的节点
// 在我用于学习的例子里， 这个fiber节点是一个tag = HostText = 6 文本节点 ("count is: ")
function completeUnitOfWork(unitOfWork: any) {
  // Attempt to complete the current unit of work, then move to the next
  // sibling. If there are no more siblings, return to the parent fiber.
  // 完成当前节点的工作
  // 移动到sibling, 若sibling不存在则移动到当前节点的父级
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
      let next;
      // 生成dom的， 并挂载到fiber.stateNode上
      // 对于tag = IndeterminateComponent / FunctionComponent / ClassComponent 之类的 “非宿主环境提供的组件”， 基本就是什么都不做
      next = completeWork(current, completedWork);

      // 上面说completeUnitOfWork可能会产生新的工作就是这里了
      if (next !== null) {
        // Completing this fiber spawned new work. Work on that next.
        workInProgress = next;
        return;
      }

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
        // 为啥要这样暂时也不知道
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
  const lanes = root.finishedLanes;

  if (finishedWork === null) {
    return null;
  }
  root.finishedWork = null;

  // commitRoot never returns a continuation; it always finishes synchronously.
  // So we can clear these now to allow a new callback to be scheduled.
  root.callbackNode = null;

  // Clear already finished discrete updates in case that a later call of
  // `flushDiscreteUpdates` starts a useless render pass which may cancels
  // a scheduled timeout.
  // if (rootsWithPendingDiscreteUpdates !== null) {
  //   if (
  //     !hasDiscreteLanes(remainingLanes) &&
  //     rootsWithPendingDiscreteUpdates.has(root)
  //   ) {
  //     rootsWithPendingDiscreteUpdates.delete(root);
  //   }
  // }

  if (root === workInProgressRoot) {
    // We can reset these now that they are finished.
    workInProgressRoot = null;
    workInProgress = null;
  } else {
    // This indicates that the last root we worked on is not the same one that
    // we're committing now. This most commonly happens when a suspended root
    // times out.
  }

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
    // let previousLanePriority;

    const prevExecutionContext = executionContext;
    executionContext |= CommitContext;

    // Reset this to null before calling lifecycles
    // ReactCurrentOwner.current = null;

    // The commit phase is broken into several sub-phases. We do a separate pass
    // of the effect list for each phase: all mutation effects come before all
    // layout effects, and so on.

    // The first phase a "before mutation" phase. We use this phase to read the
    // state of the host tree right before we mutate it. This is where
    // getSnapshotBeforeUpdate is called.
    // 处理一些dom相关的特例， 暂时不懂， 暂时忽略
    // focusedInstanceHandle = prepareForCommit(root.containerInfo);
    shouldFireAfterActiveInstanceBlur = false;

    nextEffect = firstEffect;
    do {
      try {
        commitBeforeMutationEffects();
      } catch (error) {
        // captureCommitPhaseError(nextEffect, error);
        nextEffect = nextEffect.nextEffect;
      }
    } while (nextEffect !== null);

    // We no longer need to track the active instance fiber
    // focusedInstanceHandle = null;

    // The next phase is the mutation phase, where we mutate the host tree.
    nextEffect = firstEffect;
    do {
      try {
        commitMutationEffects(root);
      } catch (error) {
        // captureCommitPhaseError(nextEffect, error);
        nextEffect = nextEffect.nextEffect;
      }
    } while (nextEffect !== null);

    // if (shouldFireAfterActiveInstanceBlur) {
    //   afterActiveInstanceBlur();
    // }
    // resetAfterCommit(root.containerInfo);

    // The work-in-progress tree is now the current tree. This must come after
    // the mutation phase, so that the previous tree is still current during
    // componentWillUnmount, but before the layout phase, so that the finished
    // work is current during componentDidMount/Update.
    root.current = finishedWork;

    // The next phase is the layout phase, where we call effects that read
    // the host tree after it's been mutated. The idiomatic use case for this is
    // layout, but class component lifecycles also fire here for legacy reasons.
    // 切换fiber树
    nextEffect = firstEffect;
    do {
      try {
        commitLayoutEffects(root);
      } catch (error) {
        nextEffect = nextEffect.nextEffect;
      }
    } while (nextEffect !== null);

    nextEffect = null;

    // Tell Scheduler to yield at the end of the frame, so the browser has an
    // opportunity to paint.
    requestPaint();

    executionContext = prevExecutionContext;
  } else {
    // No effects.
    // 没有副作用， 直接切换fiber树
    root.current = finishedWork;
    // Measure these anyway so the flamegraph explicitly shows that there were
    // no effects.
    // TODO: Maybe there's a better way to report this.
  }

  const rootDidHavePassiveEffects = rootDoesHavePassiveEffects;

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

  // Read this again, since an effect might have updated it
  // remainingLanes = root.pendingLanes;

  // Check if there's remaining work on this root

  // Always call this before exiting `commitRoot`, to ensure that any
  // additional work on this root is scheduled.
  ensureRootIsScheduled(root, window.performance.now());

  if ((executionContext & LegacyUnbatchedContext) !== NoContext) {
    // This is a legacy edge case. We just committed the initial mount of
    // a ReactDOM.render-ed root inside of batchedUpdates. The commit fired
    // synchronously, but layout updates should be deferred until the end
    // of the batch.
    return null;
  }

  // If layout work was scheduled, flush it now.
  flushSyncCallbackQueue();

  return null;
}

function commitBeforeMutationEffects() {
  while (nextEffect !== null) {
    const current = nextEffect.alternate;

    if (!shouldFireAfterActiveInstanceBlur && focusedInstanceHandle !== null) {
      if ((nextEffect.flags & Deletion) !== NoFlags) {
        if (doesFiberContain(nextEffect, focusedInstanceHandle)) {
          shouldFireAfterActiveInstanceBlur = true;
          beforeActiveInstanceBlur();
        }
      } else {
        // TODO: Move this out of the hot path using a dedicated effect tag.
        if (
          nextEffect.tag === SuspenseComponent &&
          isSuspenseBoundaryBeingHidden(current, nextEffect) &&
          doesFiberContain(nextEffect, focusedInstanceHandle)
        ) {
          shouldFireAfterActiveInstanceBlur = true;
          beforeActiveInstanceBlur();
        }
      }
    }

    const flags = nextEffect.flags;
    if ((flags & Snapshot) !== NoFlags) {
      setCurrentDebugFiberInDEV(nextEffect);

      commitBeforeMutationEffectOnFiber(current, nextEffect);

      resetCurrentDebugFiberInDEV();
    }
    if ((flags & Passive) !== NoFlags) {
      // If there are passive effects, schedule a callback to flush at
      // the earliest opportunity.
      if (!rootDoesHavePassiveEffects) {
        rootDoesHavePassiveEffects = true;
        scheduleCallback(NormalSchedulerPriority, () => {
          flushPassiveEffects();
          return null;
        });
      }
    }
    nextEffect = nextEffect.nextEffect;
  }
}

function commitMutationEffects(root: any) {
  // TODO: Should probably move the bulk of this function to commitWork.
  while (nextEffect !== null) {
    const flags = nextEffect.flags;

    if (flags & ContentReset) {
      commitResetTextContent(nextEffect);
    }

    // if (flags & Ref) {
    //   const current = nextEffect.alternate;
    //   if (current !== null) {
    //     commitDetachRef(current);
    //   }
    //   if (enableScopeAPI) {
    //     // TODO: This is a temporary solution that allowed us to transition away
    //     // from React Flare on www.
    //     if (nextEffect.tag === ScopeComponent) {
    //       commitAttachRef(nextEffect);
    //     }
    //   }
    // }

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

function commitLayoutEffects(root: any) {
  // TODO: Should probably move the bulk of this function to commitWork.
  while (nextEffect !== null) {
    const flags = nextEffect.flags;

    if (flags & Update) {
      const current = nextEffect.alternate;
      commitLayoutEffectOnFiber(root, current, nextEffect);
    }

    // if (flags & Ref) {
    //   commitAttachRef(nextEffect);
    // }

    nextEffect = nextEffect.nextEffect;
  }
}

export function flushPassiveEffects(): boolean {
  // Returns whether passive effects were flushed.
  if (pendingPassiveEffectsRenderPriority !== NoPriority) {
    const priorityLevel =
      pendingPassiveEffectsRenderPriority > NormalPriority
        ? NormalPriority
        : pendingPassiveEffectsRenderPriority;
    pendingPassiveEffectsRenderPriority = NoPriority;
    return runWithPriority(priorityLevel, flushPassiveEffectsImpl);
  }
  return false;
}

function flushPassiveEffectsImpl() {
  if (rootWithPendingPassiveEffects === null) {
    return false;
  }

  const root = rootWithPendingPassiveEffects;
  // const lanes = pendingPassiveEffectsLanes;
  rootWithPendingPassiveEffects = null;
  // pendingPassiveEffectsLanes = NoLanes;

  // invariant(
  //   (executionContext & (RenderContext | CommitContext)) === NoContext,
  //   "Cannot flush passive effects while already rendering."
  // );

  const prevExecutionContext = executionContext;
  executionContext |= CommitContext;
  const prevInteractions = pushInteractions(root);

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

  flushSyncCallbackQueue();

  // If additional passive effects were scheduled, increment a counter. If this
  // exceeds the limit, we'll fire a warning.
  // nestedPassiveUpdateCount =
  //   rootWithPendingPassiveEffects === null ? 0 : nestedPassiveUpdateCount + 1;

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
