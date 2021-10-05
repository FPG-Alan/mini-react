// We store most of the events in this module in pairs of two strings so we can re-use
// the code required to apply the same logic for event prioritization and that of the
// SimpleEventPlugin. This complicates things slightly, but the aim is to reduce code
// duplication (for which there would be quite a bit). For the events that are not needed
// for the SimpleEventPlugin (otherDiscreteEvents) we process them separately as an
// array of top level events.

import { DOCUMENT_NODE } from "../react-dom";
import {
  ANIMATION_END,
  ANIMATION_ITERATION,
  ANIMATION_START,
  DOMEventName,
  TRANSITION_END,
} from "./DOMEventNames";
import { allNativeEvents } from "./EventRegistry";
import {
  EventSystemFlags,
  IS_CAPTURE_PHASE,
  IS_NON_DELEGATED,
} from "./EventSystemFlags";

const discreteEventPairsForSimpleEventPlugin = [
  "cancel",
  "cancel",
  "click",
  "click",
  "close",
  "close",
  "contextmenu",
  "contextMenu",
  "copy",
  "copy",
  "cut",
  "cut",
  "auxclick",
  "auxClick",
  "dblclick",
  "doubleClick", // Careful!
  "dragend",
  "dragEnd",
  "dragstart",
  "dragStart",
  "drop",
  "drop",
  "focusin",
  "focus", // Careful!
  "focusout",
  "blur", // Careful!
  "input",
  "input",
  "invalid",
  "invalid",
  "keydown",
  "keyDown",
  "keypress",
  "keyPress",
  "keyup",
  "keyUp",
  "mousedown",
  "mouseDown",
  "mouseup",
  "mouseUp",
  "paste",
  "paste",
  "pause",
  "pause",
  "play",
  "play",
  "pointercancel",
  "pointerCancel",
  "pointerdown",
  "pointerDown",
  "pointerup",
  "pointerUp",
  "ratechange",
  "rateChange",
  "reset",
  "reset",
  "seeked",
  "seeked",
  "submit",
  "submit",
  "touchcancel",
  "touchCancel",
  "touchend",
  "touchEnd",
  "touchstart",
  "touchStart",
  "volumechange",
  "volumeChange",
];

const otherDiscreteEvents: Array<DOMEventName> = [
  "change",
  "selectionchange",
  "textInput",
  "compositionstart",
  "compositionend",
  "compositionupdate",
];

// prettier-ignore
const userBlockingPairsForSimpleEventPlugin: Array<string | DOMEventName> = [
  'drag', 'drag',
  'dragenter', 'dragEnter',
  'dragexit', 'dragExit',
  'dragleave', 'dragLeave',
  'dragover', 'dragOver',
  'mousemove', 'mouseMove',
  'mouseout', 'mouseOut',
  'mouseover', 'mouseOver',
  'pointermove', 'pointerMove',
  'pointerout', 'pointerOut',
  'pointerover', 'pointerOver',
  'scroll', 'scroll',
  'toggle', 'toggle',
  'touchmove', 'touchMove',
  'wheel', 'wheel',
];

// prettier-ignore
const continuousPairsForSimpleEventPlugin: Array<string | DOMEventName> = [
  'abort', 'abort',
  ANIMATION_END, 'animationEnd',
  ANIMATION_ITERATION, 'animationIteration',
  ANIMATION_START, 'animationStart',
  'canplay', 'canPlay',
  'canplaythrough', 'canPlayThrough',
  'durationchange', 'durationChange',
  'emptied', 'emptied',
  'encrypted', 'encrypted',
  'ended', 'ended',
  'error', 'error',
  'gotpointercapture', 'gotPointerCapture',
  'load', 'load',
  'loadeddata', 'loadedData',
  'loadedmetadata', 'loadedMetadata',
  'loadstart', 'loadStart',
  'lostpointercapture', 'lostPointerCapture',
  'playing', 'playing',
  'progress', 'progress',
  'seeking', 'seeking',
  'stalled', 'stalled',
  'suspend', 'suspend',
  'timeupdate', 'timeUpdate',
  TRANSITION_END, 'transitionEnd',
  'waiting', 'waiting',
];

/**
 * Turns
 * ['abort', ...]
 *
 * into
 *
 * topLevelEventsToReactNames = new Map([
 *   ['abort', 'onAbort'],
 * ]);
 *
 * and registers them.
 */
export type EventPriority = 0 | 1 | 2;
const eventPriorities = new Map();
function registerSimplePluginEventsAndSetTheirPriorities(
  eventTypes: Array<DOMEventName | string>,
  priority: EventPriority
): void {
  // As the event types are in pairs of two, we need to iterate
  // through in twos. The events are in pairs of two to save code
  // and improve init perf of processing this array, as it will
  // result in far fewer object allocations and property accesses
  // if we only use three arrays to process all the categories of
  // instead of tuples.
  // 步长为2
  for (let i = 0; i < eventTypes.length; i += 2) {
    const topEvent = eventTypes[i];
    const event = eventTypes[i + 1];
    const capitalizedEvent = event[0].toUpperCase() + event.slice(1);
    const reactName = "on" + capitalizedEvent;
    eventPriorities.set(topEvent, priority);
    topLevelEventsToReactNames.set(topEvent, reactName);
    registerTwoPhaseEvent(reactName, [topEvent]);
  }
}

function setEventPriorities(
  eventTypes: Array<DOMEventName>,
  priority: EventPriority
): void {
  for (let i = 0; i < eventTypes.length; i++) {
    eventPriorities.set(eventTypes[i], priority);
  }
}

// register simple events
// -------------------------------------------------------------------
registerSimplePluginEventsAndSetTheirPriorities(
  discreteEventPairsForSimpleEventPlugin,
  DiscreteEvent
);
registerSimplePluginEventsAndSetTheirPriorities(
  userBlockingPairsForSimpleEventPlugin,
  UserBlockingEvent
);
registerSimplePluginEventsAndSetTheirPriorities(
  continuousPairsForSimpleEventPlugin,
  ContinuousEvent
);
setEventPriorities(otherDiscreteEvents, DiscreteEvent);
// -------------------------------------------------------------------

// List of events that need to be individually attached to media elements.
const mediaEventTypes: Array<DOMEventName> = [
  "abort",
  "canplay",
  "canplaythrough",
  "durationchange",
  "emptied",
  "encrypted",
  "ended",
  "error",
  "loadeddata",
  "loadedmetadata",
  "loadstart",
  "pause",
  "play",
  "playing",
  "progress",
  "ratechange",
  "seeked",
  "seeking",
  "stalled",
  "suspend",
  "timeupdate",
  "volumechange",
  "waiting",
];

// We should not delegate these events to the container, but rather
// set them on the actual target element itself. This is primarily
// because these events do not consistently bubble in the DOM.
export const nonDelegatedEvents: Set<DOMEventName> = new Set([
  "cancel",
  "close",
  "invalid",
  "load",
  "scroll",
  "toggle",
  // In order to reduce bytes, we insert the above array of media events
  // into this Set. Note: the "error" event isn't an exclusive media event,
  // and can occur on other elements too. Rather than duplicate that event,
  // we just take it from the media events array.
  ...mediaEventTypes,
]);

const listeningMarker = "_reactListening" + Math.random().toString(36).slice(2);

export function listenToAllSupportedEvents(rootContainerElement: EventTarget) {
  if ((rootContainerElement as any)[listeningMarker]) {
    // Performance optimization: don't iterate through events
    // for the same portal container or root node more than once.
    // TODO: once we remove the flag, we may be able to also
    // remove some of the bookkeeping maps used for laziness.
    return;
  }
  (rootContainerElement as any)[listeningMarker] = true;
  allNativeEvents.forEach((domEventName) => {
    if (!nonDelegatedEvents.has(domEventName)) {
      listenToNativeEvent(domEventName, false, rootContainerElement, null);
    }
    listenToNativeEvent(domEventName, true, rootContainerElement, null);
  });
}

export function listenToNativeEvent(
  domEventName: DOMEventName,
  isCapturePhaseListener: boolean,
  rootContainerElement: EventTarget,
  targetElement: Element | null,
  eventSystemFlags: EventSystemFlags = 0
): void {
  let target = rootContainerElement;

  // selectionchange needs to be attached to the document
  // otherwise it won't capture incoming events that are only
  // triggered on the document directly.
  if (
    domEventName === "selectionchange" &&
    (rootContainerElement as any).nodeType !== DOCUMENT_NODE
  ) {
    target = (rootContainerElement as any).ownerDocument;
  }
  // If the event can be delegated (or is capture phase), we can
  // register it to the root container. Otherwise, we should
  // register the event to the target element and mark it as
  // a non-delegated event.
  if (
    targetElement !== null &&
    !isCapturePhaseListener &&
    nonDelegatedEvents.has(domEventName)
  ) {
    // For all non-delegated events, apart from scroll, we attach
    // their event listeners to the respective elements that their
    // events fire on. That means we can skip this step, as event
    // listener has already been added previously. However, we
    // special case the scroll event because the reality is that any
    // element can scroll.
    // TODO: ideally, we'd eventually apply the same logic to all
    // events from the nonDelegatedEvents list. Then we can remove
    // this special case and use the same logic for all events.
    if (domEventName !== "scroll") {
      return;
    }
    eventSystemFlags |= IS_NON_DELEGATED;
    target = targetElement;
  }
  const listenerSet = getEventListenerSet(target);
  const listenerSetKey = getListenerSetKey(
    domEventName,
    isCapturePhaseListener
  );
  // If the listener entry is empty or we should upgrade, then
  // we need to trap an event listener onto the target.
  if (!listenerSet.has(listenerSetKey)) {
    if (isCapturePhaseListener) {
      eventSystemFlags |= IS_CAPTURE_PHASE;
    }
    addTrappedEventListener(
      target,
      domEventName,
      eventSystemFlags,
      isCapturePhaseListener
    );
    listenerSet.add(listenerSetKey);
  }
}

function addTrappedEventListener(
  targetContainer: EventTarget,
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  isCapturePhaseListener: boolean,
  isDeferredListenerForLegacyFBSupport?: boolean
) {
  let listener = createEventListenerWrapperWithPriority(
    targetContainer,
    domEventName,
    eventSystemFlags
  );
  // If passive option is not supported, then the event will be
  // active and not passive.
  let isPassiveListener = undefined;
  if (passiveBrowserEventsSupported) {
    // Browsers introduced an intervention, making these events
    // passive by default on document. React doesn't bind them
    // to document anymore, but changing this now would undo
    // the performance wins from the change. So we emulate
    // the existing behavior manually on the roots now.
    // https://github.com/facebook/react/issues/19651
    if (
      domEventName === "touchstart" ||
      domEventName === "touchmove" ||
      domEventName === "wheel"
    ) {
      isPassiveListener = true;
    }
  }

  let unsubscribeListener;

  // TODO: There are too many combinations here. Consolidate them.
  if (isCapturePhaseListener) {
    if (isPassiveListener !== undefined) {
      unsubscribeListener = addEventCaptureListenerWithPassiveFlag(
        targetContainer,
        domEventName,
        listener,
        isPassiveListener
      );
    } else {
      unsubscribeListener = addEventCaptureListener(
        targetContainer,
        domEventName,
        listener
      );
    }
  } else {
    if (isPassiveListener !== undefined) {
      unsubscribeListener = addEventBubbleListenerWithPassiveFlag(
        targetContainer,
        domEventName,
        listener,
        isPassiveListener
      );
    } else {
      unsubscribeListener = addEventBubbleListener(
        targetContainer,
        domEventName,
        listener
      );
    }
  }
}

const randomKey = Math.random().toString(36).slice(2);
const internalEventHandlersKey = "__reactEvents$" + randomKey;
export function getEventListenerSet(node: EventTarget): Set<string> {
  let elementListenerSet = (node as any)[internalEventHandlersKey];
  if (elementListenerSet === undefined) {
    elementListenerSet = (node as any)[internalEventHandlersKey] = new Set();
  }
  return elementListenerSet;
}

export function getListenerSetKey(
  domEventName: DOMEventName,
  capture: boolean
): string {
  return `${domEventName}__${capture ? "capture" : "bubble"}`;
}
