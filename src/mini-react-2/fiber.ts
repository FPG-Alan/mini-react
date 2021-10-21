const baseFiber = {
  type: "",
  key: "",
  index: 0,

  flags: 0,

  return: null,
  slibing: null,
  child: null,

  pendingProps: null,
  memoizedProps: null,
  memoizedState: null,

  stateNode: null,

  current: null,
  alternate: null,
};
function createRootFiber(element: JSX): Fiber {
  return {
    ...baseFiber,
    tags: "HostRoot",

    pendingProps: element,
  };
}

function createFiber(element: JSX | string): Fiber {
  if (typeof element === "string") {
    return {
      ...baseFiber,
      pendingProps: element,
      tags: "HostTextNode",
    };
  }
  return {
    ...baseFiber,
    type: element.type,
    pendingProps: element.props,
    tags:
      (typeof element.type === "string" && "HostComponent") ||
      "FunctionComponent",
  };
}

export { createRootFiber, createFiber };
