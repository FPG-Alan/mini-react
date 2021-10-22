type JSX = {
  type: string | Function;
  props: Record<string, unknown> | null;
  children: Array<JSX> | null;
};

// type FiberFlags
type FiberRoot = {
  current: Fiber;
  container: HTMLElement;
};
type Fiber = {
  // diff
  type: JSX["type"];
  key: string | number;
  index: number;

  tags: "HostComponent" | "FunctionComponent" | "HostRoot" | "HostTextNode";
  flags: number;

  // 链表
  return: Fiber | null;
  slibing: Fiber | null;
  child: Fiber | null;

  // 更新
  pendingProps: any;
  memoizedProps: any;
  memoizedState: any;

  stateNode: FiberRoot | HTMLElement | Text | null;

  current: Fiber | null;
  alternate: Fiber | null;
};
