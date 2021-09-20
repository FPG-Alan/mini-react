// The root we're working on
let workInProgressRoot: any = null;
// The fiber we're working on
let workInProgress: any = null;

export function renderRootSync(fiberRoot: any) {
  // 暂时不懂， 跳过不看
  //  const prevDispatcher = pushDispatcher();

  // If the root or lanes have changed, throw out the existing stack
  // and prepare a fresh one. Otherwise we'll continue where we left off.
  // 第一次渲染时， workInProgressRoot 为null, workInProgressRootRenderLanes 为NoLanes = 0, 执行这个分支
  // 主要是生成workInProgress, 另外设置root上的一些属性
  if (workInProgressRoot !== root) {
    prepareFreshStack(root, lanes);

    // 暂时不懂
    startWorkOnPendingInteractions(root, lanes);
  }

  workLoopSync();

  // Set this to null to indicate there's no in-progress render.
  workInProgressRoot = null;
}

function workLoopSync() {
  // Already timed out, so perform work without checking if we need to yield.
  // sync lane, 也可以说是一个超时的任务， 所以这里就不去检查是不是应该暂停了
  // 下面的while循环就是一个同步任务
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
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
