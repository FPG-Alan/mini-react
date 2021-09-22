import { Incomplete, NoFlags, PerformedWork } from "./constants";
import { createWorkInProgress } from "./ReactFiber";
import { beginWork } from "./ReactFiberBeginWork";
import { completeWork } from "./ReactFiberCompleteWork";

// The root we're working on
let workInProgressRoot: any = null;
// The fiber we're working on
let workInProgress: any = null;

export function performSyncWorkOnRoot(fiberRoot: any) {
  renderRootSync(fiberRoot);
  const finishedWork = fiberRoot.current.alternate;
  fiberRoot.finishedWork = finishedWork;

  // commit 阶段
  commitRoot(fiberRoot);

  // Before exiting, make sure there's a callback scheduled for the next
  // pending level.
  // ensureRootIsScheduled(fiberRoot);
}
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

// 设置root上的一些属性
// 设置该文件内的全局属性， 包括workInProgress等
function prepareFreshStack(root: any) {
  root.finishedWork = null;

  workInProgressRoot = root;
  // 创建wip fiber， 基本就是复制root.current
  workInProgress = createWorkInProgress(root.current, null);
}
