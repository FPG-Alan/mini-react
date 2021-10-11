import { HostRoot } from "../../constants";
import { internalContainerInstanceKey, internalInstanceKey } from "../index";
import { getNearestMountedFiber } from "../../react-reconciler/ReactFiberTreeReflection";

const listenEvents = new Set();
/**
 * 使用原生事件替代react的合成事件
 * 也是在container上进行代理， 事件触发之后的操作跟react是一样的(findNearestFiber...)
 */
export function ensureListeningTo(
  rootContainerElement: any = document,
  propKey: string,
  domElement: Element
) {
  propKey = propKey.toLowerCase();
  if (listenEvents.has(propKey)) {
    return;
  } else {
    if (rootContainerElement === document) {
      rootContainerElement =
        rootContainerElement.getElementsByTagName("body")[0];
    }

    rootContainerElement.addEventListener(
      propKey.split("on")[1],
      eventHandler.bind(null, propKey.split("on")[1])
    );
  }
}

function eventHandler(type: string, e: Event) {
  const propKey = `on${type.replace(/^\S/, (s) => s.toUpperCase())}`;
  //   const path = e.composedPath();

  //   for (let i = 0, l = path.length; i < l; i++) {
  //     console.dir(path[i]);

  //     const
  //   }

  const nativeEventTarget = getEventTarget(e);
  let targetInst = getClosestInstanceFromNode(nativeEventTarget);

  //

  if (targetInst !== null) {
    const nearestMounted = getNearestMountedFiber(targetInst);
    if (nearestMounted === null) {
      // This tree has been unmounted already. Dispatch without a target.
      targetInst = null;
    } else {
      const tag = nearestMounted.tag;
      if (tag === HostRoot) {
        targetInst = null;
      } else if (nearestMounted !== targetInst) {
        // If we get an event (ex: img onload) before committing that
        // component's mount, ignore it for now (that is, treat it as if it was an
        // event on a non-React tree). We might also consider queueing events and
        // dispatching them after the mount.
        targetInst = null;
      }
    }
  }

  while (targetInst) {
    if (targetInst.pendingProps?.[propKey]) {
      // targetInst.pendingProps?.propKey()
      const eventHandler = targetInst.pendingProps[propKey];
      eventHandler(e);
    }
    targetInst = targetInst.return;
  }
  //   dispatchEventForPluginEventSystem(
  //     domEventName,
  //     eventSystemFlags,
  //     nativeEvent,
  //     targetInst,
  //     targetContainer
  //   );
  // We're not blocked on anything.
  return null;
}

/**
 * Gets the target node from a native browser event by accounting for
 * inconsistencies in browser DOM APIs.
 *
 * @param {object} nativeEvent Native browser event.
 * @return {DOMEventTarget} Target node.
 */
const TEXT_NODE = 3;
function getEventTarget(nativeEvent: any) {
  // Fallback to nativeEvent.srcElement for IE9
  // https://github.com/facebook/react/issues/12506
  let target = nativeEvent.target || nativeEvent.srcElement || window;

  // Normalize SVG <use> element events #4963
  if (target.correspondingUseElement) {
    target = target.correspondingUseElement;
  }

  // Safari may fire events on text nodes (Node.TEXT_NODE is 3).
  // @see http://www.quirksmode.org/js/events_properties.html
  return target.nodeType === TEXT_NODE ? target.parentNode : target;
}

// Given a DOM node, return the closest HostComponent or HostText fiber ancestor.
// If the target node is part of a hydrated or not yet rendered subtree, then
// this may also return a SuspenseComponent or HostRoot to indicate that.
// Conceptually the HostRoot fiber is a child of the Container node. So if you
// pass the Container node as the targetNode, you will not actually get the
// HostRoot back. To get to the HostRoot, you need to pass a child of it.
// The same thing applies to Suspense boundaries.
export function getClosestInstanceFromNode(targetNode: Node): any {
  let targetInst = (targetNode as any)[internalInstanceKey];
  if (targetInst) {
    // Don't return HostRoot or SuspenseComponent here.
    return targetInst;
  }
  // If the direct event target isn't a React owned DOM node, we need to look
  // to see if one of its parents is a React owned DOM node.
  let parentNode = targetNode.parentNode;
  while (parentNode) {
    // We'll check if this is a container root that could include
    // React nodes in the future. We need to check this first because
    // if we're a child of a dehydrated container, we need to first
    // find that inner container before moving on to finding the parent
    // instance. Note that we don't check this field on  the targetNode
    // itself because the fibers are conceptually between the container
    // node and the first child. It isn't surrounding the container node.
    // If it's not a container, we check if it's an instance.
    targetInst =
      (parentNode as any)[internalContainerInstanceKey] ||
      (parentNode as any)[internalInstanceKey];
    if (targetInst) {
      return targetInst;
    }
    targetNode = parentNode;
    parentNode = targetNode.parentNode;
  }
  return null;
}
