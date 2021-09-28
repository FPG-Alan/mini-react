import { UpdateState } from "./constants";
import { performSyncWorkOnRoot } from "./ReactFiberWorkLoop";
import { enqueueUpdate } from "./ReactUpdateQueue";

/**
 * 1. 获得 eventTime
 * 2. 获得 update lane
 * 3. 创建 update 对象
 * 4. update 对象进入fiber.updateQueue.pending
 * 5. 调用 scheduleUpdateOnFiber, 开始调度更新
 */
export function updateContainer(children: any, fiberRoot: any) {
  // 这里的current应该是HostFiberRoot
  const hostFiber = fiberRoot.current;

  const update: any = {
    tag: UpdateState,
    payload: { element: children },
    callback: null,

    next: null,
  };

  enqueueUpdate(hostFiber, update);
  performSyncWorkOnRoot(fiberRoot);
}
