import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  IndeterminateComponent,
  Snapshot,
  Update,
} from "../constants";
import {
  createInstance,
  createTextInstance,
  finalizeInitialChildren,
  prepareUpdate,
} from "../react-dom";

export function completeWork(current: any, workInProgress: any) {
  const newProps = workInProgress.pendingProps;

  switch (workInProgress.tag) {
    case IndeterminateComponent:
    case FunctionComponent:
      return null;
    case HostRoot: {
      // 初次渲染， current是没有child的
      // wip倒是有， 此时wip比current完整
      if (current === null || current.child === null) {
        // Schedule an effect to clear this container at the start of the next commit.
        // This handles the case of React rendering into a container with previous children.
        // It's also safe to do for updates too, because current.child would only be null
        // if the previous render was null (so the the container would already be empty).
        // 这里HostRoot的flags其实就是Snapshot, 这个会影响后面effectList的生成和commit阶段的工作
        workInProgress.flags |= Snapshot;
      }

      return null;
    }
    case HostComponent: {
      const type = workInProgress.type;

      if (current !== null && workInProgress.stateNode != null) {
        updateHostComponent(current, workInProgress, type, newProps);
      } else {
        if (!newProps) {
          // This can happen when we abort work.
          return null;
        }

        const instance = createInstance(type, newProps, workInProgress);

        // 递归 workInProgress ， 所有 HostComponent 或 HostText 在此时dom append to parent
        // 这里不太懂， 为何在这个时候append？
        // 这似乎是commit阶段的工作？

        appendAllChildren(instance, workInProgress);

        workInProgress.stateNode = instance;

        // Certain renderers require commit-time effects for initial mount.
        // (eg DOM renderer supports auto-focus for certain elements).
        // Make sure such renderers get scheduled for later work.
        // 特殊情况暂时跳过
        if (finalizeInitialChildren(instance, type, newProps, undefined)) {
          // Tag the fiber with an update effect. This turns a Placement into
          // a PlacementAndUpdate.
          workInProgress.flags |= Update;
        }
      }
      return null;
    }
    case HostText: {
      // 在我学习的例子中， 第一次应该来到这个分支
      const newText = newProps;

      if (current && workInProgress.stateNode != null) {
        const oldText = current.memoizedProps;
        // If we have an alternate, that means this is an update and we need
        // to schedule a side-effect to do the updates.
        if (oldText !== newText) {
          workInProgress.flags |= Update;
        }
      } else {
        // 创建Dom节点， 赋值给wip的stateNode
        workInProgress.stateNode = createTextInstance(newText, workInProgress);
      }

      return null;
    }
  }
}

function updateHostComponent(
  current: any,
  workInProgress: any,
  type: any,
  newProps: any
) {
  // If we have an alternate, that means this is an update and we need to
  // schedule a side-effect to do the updates.
  const oldProps = current.memoizedProps;
  if (oldProps === newProps) {
    // In mutation mode, this is sufficient for a bailout because
    // we won't touch this node even if children changed.
    return;
  }

  // If we get updated because one of our children updated, we don't
  // have newProps so we'll have to reuse them.
  // TODO: Split the update API as separate for the props vs. children.
  // Even better would be if children weren't special cased at all tho.
  const instance = workInProgress.stateNode;
  // TODO: Experiencing an error where oldProps is null. Suggests a host
  // component is hitting the resume path. Figure out why. Possibly
  // related to `hidden`.
  const updatePayload = prepareUpdate(instance, type, oldProps, newProps);
  // TODO: Type this specific to this type of component.
  workInProgress.updateQueue = updatePayload;
  if (updatePayload) {
    workInProgress.flags |= Update;
  }
}

function appendAllChildren(parent: Element, workInProgress: any) {
  // We only have the top Fiber that was created but we need recurse down its
  // children to find all the terminal nodes.
  let node = workInProgress.child;
  while (node !== null) {
    if (node.tag === HostComponent || node.tag === HostText) {
      // complete 阶段是冒泡的
      // 所以执行到这， 可以直接appendChild stateNode 到 parent
      // 因为若wip child存在hostComp嵌套, node.stateNode在此之前肯定已经appendChild了
      // 所以这里可以认为是一个性能优化的地方, 最后我们在commit阶段可以只appendChild HostRoot 的dom
      parent.appendChild(node.stateNode);
    } else if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === workInProgress) {
      return;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === workInProgress) {
        return;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}
