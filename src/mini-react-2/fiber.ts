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

  alternate: null,

  firstEffect: null,
  lastEffect: null,
  nextEffect: null,
};
// You can change the rest (and add more).
export const NoFlags = /*                      */ 0b000000000000000000;
export const Placement = /*                    */ 0b000000000000000010;
export const Update = /*                       */ 0b000000000000000100;
export const PlacementAndUpdate = /*           */ 0b000000000000000110;
export const Deletion = /*                     */ 0b000000000000001000;
export const Snapshot = /*                     */ 0b000000000100000000;
export const Passive = /*                      */ 0b000000001000000000;
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
