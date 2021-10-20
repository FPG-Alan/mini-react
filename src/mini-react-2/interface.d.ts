type JSX = {
  type: string | Function;
  props: Record<string, unknown> | null;
  children: Array<JSX> | null;
};

// type FiberFlags

type Fiber = {
  // diff
  type: JSX["type"];
  key: string | number;
  index: number;

  tags: "HostComponent" | "FunctionComponent" | "HostRoot";
  flags: number;

  // 链表
  return: Fiber;
  slibing: Fiber;
  child: Fiber;

  // 更新
  pendingProps: JSX["props"];
  memoizedProps: JSX["props"];

  stateNode: HTMLElement | null;

  current: Fiber;
  alternate: Fiber;
};
