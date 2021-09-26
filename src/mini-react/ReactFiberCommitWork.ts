import {
  Block,
  ClassComponent,
  ForwardRef,
  FunctionComponent,
  HostComponent,
  HostPortal,
  HostRoot,
  HostText,
  IncompleteClassComponent,
  SimpleMemoComponent,
  Snapshot,
} from "./constants";
import { clearContainer } from "./react-dom";

/**
 * 1. 对 ClassComponent， 调用 getSnapshotBeforeUpdate
 * 2. 对 HostRoot， 如果fiber.flags 包含 Snapshot，清除其Dom内容
 */
export function commitBeforeMutationLifeCycles(
  current: any,
  finishedWork: any
) {
  switch (finishedWork.tag) {
    case FunctionComponent:
    case ForwardRef:
    case SimpleMemoComponent:
    case Block: {
      return;
    }
    case ClassComponent: {
      if (finishedWork.flags & Snapshot) {
        if (current !== null) {
          const prevProps = current.memoizedProps;
          const prevState = current.memoizedState;
          const instance = finishedWork.stateNode;
          // We could update instance props and state here,
          // but instead we rely on them being set during last render.
          // TODO: revisit this when we implement resuming.
          const snapshot = instance.getSnapshotBeforeUpdate(
            finishedWork.elementType === finishedWork.type
              ? prevProps
              : resolveDefaultProps(finishedWork.type, prevProps),
            prevState
          );
          instance.__reactInternalSnapshotBeforeUpdate = snapshot;
        }
      }
      return;
    }
    case HostRoot: {
      if (finishedWork.flags & Snapshot) {
        const root = finishedWork.stateNode;
        clearContainer(root.containerInfo);
      }
      return;
    }
    case HostComponent:
    case HostText:
    case HostPortal:
    case IncompleteClassComponent:
      // Nothing to do for these component types
      return;
  }
}
