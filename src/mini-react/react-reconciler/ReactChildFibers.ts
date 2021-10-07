import {
  Deletion,
  HostText,
  Placement,
  REACT_ELEMENT_TYPE,
} from "../constants";
import {
  createFiberFromElement,
  createFiberFromText,
  createWorkInProgress,
} from "./ReactFiber";

/**
 * @param shouldTrackSideEffects update时需要追踪副作用， 初次mount时不需要
 *
 * diff 算法入口
 */
export function reconcileChildFibers(
  returnFiber: any,
  currentFirstChild: any,
  newChild: any,
  shouldTrackSideEffects: boolean
) {
  // Handle object types
  const isObject = typeof newChild === "object" && newChild !== null;
  console.log("reconcileChildFibers", newChild);
  if (isObject) {
    // 初次渲染时， newChild.$$typeof = REACT_ELEMENT_TYPE = Symbol(react.element)
    switch (newChild.$$typeof) {
      case REACT_ELEMENT_TYPE:
        console.log("????");
        return placeSingleChild(
          reconcileSingleElement(returnFiber, currentFirstChild, newChild),
          shouldTrackSideEffects
        );
    }
  }

  if (typeof newChild === "string" || typeof newChild === "number") {
    return placeSingleChild(
      reconcileSingleTextNode(returnFiber, currentFirstChild, "" + newChild),
      shouldTrackSideEffects
    );
  }

  if (Array.isArray(newChild)) {
    return reconcileChildrenArray(
      returnFiber,
      currentFirstChild,
      newChild,
      shouldTrackSideEffects
    );
  }

  // Remaining cases are all treated as empty.
  return deleteRemainingChildren(returnFiber, currentFirstChild);
}

function placeSingleChild(newFiber: any, shouldTrackSideEffects: boolean) {
  // This is simpler for the single child case. We only need to do a
  // placement for inserting new children.
  // 标记一下， 这是一个还没有mount的fiber节点
  if (shouldTrackSideEffects && newFiber.alternate === null) {
    newFiber.flags = Placement;
  }
  return newFiber;
}

function reconcileSingleElement(
  returnFiber: any,
  currentFirstChild: any,
  element: any
) {
  console.log("diff 算法在单一元素上调度");
  const key = element.key;
  let child = currentFirstChild;
  // 初次渲染， child应该为null
  while (child !== null) {
    // TODO: If key === null and child.key === null, then this only applies to
    // the first item in the list.
    if (child.key === key) {
      if (child.elementType === element.type) {
        // 删掉除child外所有的兄弟组件
        // 这里要删掉兄弟组件， 因为此次更新是 `singleElement`...
        deleteRemainingChildren(returnFiber, child.sibling);
        // 复用之前的fiber
        const existing = useFiber(child, element.props);
        existing.return = returnFiber;

        return existing;
      }
      // Didn't match.
      // 这里要删掉兄弟组件， 因为此次更新是 `singleElement`...
      deleteRemainingChildren(returnFiber, child);
      break;
    } else {
      deleteChild(returnFiber, child);
    }
    child = child.sibling;
  }

  // 得到一个新fiber， 对应elements上第一层， 下面层级的elements被赋值给 created.pendingProps上
  // 这样的结构: created.pendingProps.children = elements...
  const created = createFiberFromElement(element, returnFiber.mode);
  created.return = returnFiber;
  return created;
}

function reconcileSingleTextNode(
  returnFiber: any,
  currentFirstChild: any,
  textContent: any
) {
  // There's no need to check for keys on text nodes since we don't have a
  // way to define them.
  if (currentFirstChild !== null && currentFirstChild.tag === HostText) {
    // We already have an existing node so let's just update it and delete
    // the rest.
    deleteRemainingChildren(returnFiber, currentFirstChild.sibling);
    const existing = useFiber(currentFirstChild, textContent);
    existing.return = returnFiber;
    return existing;
  }
  // The existing first child is not a text node so we need to create one
  // and delete the existing ones.
  deleteRemainingChildren(returnFiber, currentFirstChild);
  const created = createFiberFromText(textContent, returnFiber.mode);
  created.return = returnFiber;
  return created;
}

function reconcileChildrenArray(
  returnFiber: any,
  currentFirstChild: any,
  newChildren: any,
  shouldTrackSideEffects: boolean
) {
  // This algorithm can't optimize by searching from both ends since we
  // don't have backpointers on fibers. I'm trying to see how far we can get
  // with that model. If it ends up not being worth the tradeoffs, we can
  // add it later.

  // Even with a two ended optimization, we'd want to optimize for the case
  // where there are few changes and brute force the comparison instead of
  // going for the Map. It'd like to explore hitting that path first in
  // forward-only mode and only go for the Map once we notice that we need
  // lots of look ahead. This doesn't handle reversal as well as two ended
  // search but that's unusual. Besides, for the two ended optimization to
  // work on Iterables, we'd need to copy the whole set.

  // In this first iteration, we'll just live with hitting the bad case
  // (adding everything to a Map) in for every insert/move.

  // If you change this code, also update reconcileChildrenIterator() which
  // uses the same algorithm.

  let resultingFirstChild: any = null;
  let previousNewFiber: any = null;

  let oldFiber = currentFirstChild;
  let lastPlacedIndex = 0;
  let newIdx = 0;
  let nextOldFiber = null;
  for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
    // 这个不太懂
    if (oldFiber.index > newIdx) {
      nextOldFiber = oldFiber;
      oldFiber = null;
    } else {
      //
      nextOldFiber = oldFiber.sibling;
    }
    const newFiber = updateSlot(returnFiber, oldFiber, newChildren[newIdx]);
    // key 不相同， 直接退出第一个循环
    if (newFiber === null) {
      // TODO: This breaks on empty slots like null children. That's
      // unfortunate because it triggers the slow path all the time. We need
      // a better way to communicate whether this was a miss or null,
      // boolean, undefined, etc.
      if (oldFiber === null) {
        oldFiber = nextOldFiber;
      }
      break;
    }

    // updateSlot 新建了一个节点， 旧节点就删掉了
    if (shouldTrackSideEffects) {
      if (oldFiber && newFiber.alternate === null) {
        // We matched the slot, but we didn't reuse the existing fiber, so we
        // need to delete the existing child.
        deleteChild(returnFiber, oldFiber);
      }
    }

    lastPlacedIndex = placeChild(
      newFiber,
      lastPlacedIndex,
      newIdx,
      shouldTrackSideEffects
    );
    if (previousNewFiber === null) {
      // TODO: Move out of the loop. This only happens for the first run.
      resultingFirstChild = newFiber;
    } else {
      // TODO: Defer siblings if we're not at the right index for this slot.
      // I.e. if we had null values before, then we want to defer this
      // for each null value. However, we also don't want to call updateSlot
      // with the previous one.
      // 新的fiber也串起来
      previousNewFiber.sibling = newFiber;
    }
    previousNewFiber = newFiber;
    oldFiber = nextOldFiber;
  }

  // 如果newChildren已经循环完了， 那么剩下的oldFiber都应该被标记删除
  if (newIdx === newChildren.length) {
    // We've reached the end of the new children. We can delete the rest.
    deleteRemainingChildren(returnFiber, oldFiber);
    return resultingFirstChild;
  }

  // 如果oldChildren已经循环完了, 那么剩下的newChild都应该是插入
  if (oldFiber === null) {
    // If we don't have any more existing children we can choose a fast path
    // since the rest will all be insertions.
    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = createChild(returnFiber, newChildren[newIdx]);
      if (newFiber === null) {
        continue;
      }
      lastPlacedIndex = placeChild(
        newFiber,
        lastPlacedIndex,
        newIdx,
        shouldTrackSideEffects
      );
      if (previousNewFiber === null) {
        // TODO: Move out of the loop. This only happens for the first run.
        resultingFirstChild = newFiber;
      } else {
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
    }
    return resultingFirstChild;
  }

  // Add all children to a key map for quick lookups.
  const existingChildren = mapRemainingChildren(returnFiber, oldFiber);

  // Keep scanning and use the map to restore deleted items as moves.
  for (; newIdx < newChildren.length; newIdx++) {
    const newFiber = updateFromMap(
      existingChildren,
      returnFiber,
      newIdx,
      newChildren[newIdx]
    );
    if (newFiber !== null) {
      if (shouldTrackSideEffects) {
        if (newFiber.alternate !== null) {
          // The new fiber is a work in progress, but if there exists a
          // current, that means that we reused the fiber. We need to delete
          // it from the child list so that we don't add it to the deletion
          // list.
          existingChildren.delete(
            newFiber.key === null ? newIdx : newFiber.key
          );
        }
      }
      lastPlacedIndex = placeChild(
        newFiber,
        lastPlacedIndex,
        newIdx,
        shouldTrackSideEffects
      );
      if (previousNewFiber === null) {
        resultingFirstChild = newFiber;
      } else {
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
    }
  }

  if (shouldTrackSideEffects) {
    // Any existing children that weren't consumed above were deleted. We need
    // to add them to the deletion list.
    existingChildren.forEach((child: any) => deleteChild(returnFiber, child));
  }

  return resultingFirstChild;
}

function createChild(returnFiber: any, newChild: any) {
  if (typeof newChild === "string" || typeof newChild === "number") {
    // Text nodes don't have keys. If the previous node is implicitly keyed
    // we can continue to replace it without aborting even if it is not a text
    // node.
    const created = createFiberFromText("" + newChild, returnFiber.mode);
    created.return = returnFiber;
    return created;
  }

  if (typeof newChild === "object" && newChild !== null) {
    switch (newChild.$$typeof) {
      case REACT_ELEMENT_TYPE: {
        const created = createFiberFromElement(newChild, returnFiber.mode);
        //   created.ref = coerceRef(returnFiber, null, newChild);
        created.return = returnFiber;
        return created;
      }
    }
  }

  return null;
}

function updateTextNode(returnFiber: any, current: any, textContent: any) {
  if (current === null || current.tag !== HostText) {
    // Insert
    const created = createFiberFromText(textContent, returnFiber.mode);
    created.return = returnFiber;
    return created;
  } else {
    // Update
    const existing = useFiber(current, textContent);
    existing.return = returnFiber;
    return existing;
  }
}
function updateElement(returnFiber: any, current: any, element: any) {
  if (current !== null) {
    if (current.elementType === element.type) {
      // Move based on index
      const existing = useFiber(current, element.props);
      // existing.ref = coerceRef(returnFiber, current, element);
      existing.return = returnFiber;
      return existing;
    }
  }
  // Insert
  const created = createFiberFromElement(element, returnFiber.mode);
  // created.ref = coerceRef(returnFiber, current, element);
  created.return = returnFiber;
  return created;
}

/**
 * 三种可能
 * 1. key 不相同 => null
 * 2. key 相同， 且type相同 => 复用的fiber节点(alternate = oldFiber)
 * 3. key 相同， 但type不同 => 新建的fiber节点
 */
function updateSlot(returnFiber: any, oldFiber: any, newChild: any) {
  // Update the fiber if the keys match, otherwise return null.

  const key = oldFiber !== null ? oldFiber.key : null;

  if (typeof newChild === "string" || typeof newChild === "number") {
    // Text nodes don't have keys. If the previous node is implicitly keyed
    // we can continue to replace it without aborting even if it is not a text
    // node.
    if (key !== null) {
      return null;
    }
    return updateTextNode(returnFiber, oldFiber, "" + newChild);
  }

  if (typeof newChild === "object" && newChild !== null) {
    switch (newChild.$$typeof) {
      case REACT_ELEMENT_TYPE: {
        if (newChild.key === key) {
          return updateElement(returnFiber, oldFiber, newChild);
        } else {
          return null;
        }
      }
    }

    // if (isArray(newChild) || getIteratorFn(newChild)) {
    //   if (key !== null) {
    //     return null;
    //   }

    //   return updateFragment(returnFiber, oldFiber, newChild, lanes, null);
    // }
  }
  return null;
}

/**
 * 0. 首先设置这个child fiber.index = newIndex
 * 1. 若不需要追踪副作用， 原样返回 lastPlacedIndex
 * 2. 若没有alternate(说明不是复用的节点)， 标记 flags = Placement
 * 3. 若有alternate(复用节点)
 *  3.1 旧节点的 index < lastPlacedIndex, 标记 flags = Placement, 原样返回 lastPlacedIndex
 *  3.2 旧节点的 index >= lastPlacedIndex 返回旧节点的 index (作为新的 lastPlacedIndex)
 */
function placeChild(
  newFiber: any,
  lastPlacedIndex: number,
  newIndex: number,
  shouldTrackSideEffects: boolean
) {
  newFiber.index = newIndex;
  if (!shouldTrackSideEffects) {
    // Noop.
    return lastPlacedIndex;
  }
  const current = newFiber.alternate;
  if (current !== null) {
    const oldIndex = current.index;
    if (oldIndex < lastPlacedIndex) {
      // This is a move.
      newFiber.flags = Placement;
      return lastPlacedIndex;
    } else {
      // This item can stay in place.
      return oldIndex;
    }
  } else {
    // This is an insertion.
    newFiber.flags = Placement;
    return lastPlacedIndex;
  }
}

/**
 * 旧 fiber 节点由链表结构转换成map结构，
 * key 是 fiber.key 或 fiber.index
 * value 是 fiber
 */
function mapRemainingChildren(returnFiber: any, currentFirstChild: any) {
  // Add the remaining children to a temporary map so that we can find them by
  // keys quickly. Implicit (null) keys get added to this set with their index
  // instead.
  const existingChildren = new Map();

  let existingChild = currentFirstChild;
  while (existingChild !== null) {
    if (existingChild.key !== null) {
      existingChildren.set(existingChild.key, existingChild);
    } else {
      existingChildren.set(existingChild.index, existingChild);
    }
    existingChild = existingChild.sibling;
  }
  return existingChildren;
}

/**
 * 从 map 结构的旧children节点中找到新child对应的旧节点(可能为null)
 * 调用 updateElement 获取一个新fiber节点
 */
function updateFromMap(
  existingChildren: any,
  returnFiber: any,
  newIdx: any,
  newChild: any
) {
  if (typeof newChild === "string" || typeof newChild === "number") {
    // Text nodes don't have keys, so we neither have to check the old nor
    // new node for the key. If both are text nodes, they match.
    const matchedFiber = existingChildren.get(newIdx) || null;
    return updateTextNode(returnFiber, matchedFiber, "" + newChild);
  }

  if (typeof newChild === "object" && newChild !== null) {
    switch (newChild.$$typeof) {
      case REACT_ELEMENT_TYPE: {
        const matchedFiber =
          existingChildren.get(newChild.key === null ? newIdx : newChild.key) ||
          null;
        return updateElement(returnFiber, matchedFiber, newChild);
      }
    }
  }
  return null;
}

function deleteRemainingChildren(returnFiber: any, currentFirstChild: any) {
  // TODO: For the shouldClone case, this could be micro-optimized a bit by
  // assuming that after the first child we've already added everything.
  let childToDelete = currentFirstChild;
  while (childToDelete !== null) {
    deleteChild(returnFiber, childToDelete);
    childToDelete = childToDelete.sibling;
  }
  return null;
}

function useFiber(fiber: any, pendingProps: any) {
  // We currently set sibling to null and index to 0 here because it is easy
  // to forget to do before returning it. E.g. for the single child case.
  const clone = createWorkInProgress(fiber, pendingProps);
  clone.index = 0;
  clone.sibling = null;
  return clone;
}

function deleteChild(returnFiber: any, childToDelete: any) {
  // Deletions are added in reversed order so we add it to the front.
  // At this point, the return fiber's effect list is empty except for
  // deletions, so we can just append the deletion to the list. The remaining
  // effects aren't added until the complete phase. Once we implement
  // resuming, this may not be true.
  const last = returnFiber.lastEffect;
  if (last !== null) {
    last.nextEffect = childToDelete;
    returnFiber.lastEffect = childToDelete;
  } else {
    returnFiber.firstEffect = returnFiber.lastEffect = childToDelete;
  }
  childToDelete.nextEffect = null;
  childToDelete.flags = Deletion;
}
