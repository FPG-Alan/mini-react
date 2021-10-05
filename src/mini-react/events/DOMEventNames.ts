export type DOMEventName =
  | "abort"
  | "afterblur" // Not a real event. This is used by event experiments.
  // These are vendor-prefixed so you should use the exported constants instead:
  // 'animationiteration' |
  // 'animationend |
  // 'animationstart' |
  | "beforeblur" // Not a real event. This is used by event experiments.
  | "canplay"
  | "canplaythrough"
  | "cancel"
  | "change"
  | "click"
  | "close"
  | "compositionend"
  | "compositionstart"
  | "compositionupdate"
  | "contextmenu"
  | "copy"
  | "cut"
  | "dblclick"
  | "auxclick"
  | "drag"
  | "dragend"
  | "dragenter"
  | "dragexit"
  | "dragleave"
  | "dragover"
  | "dragstart"
  | "drop"
  | "durationchange"
  | "emptied"
  | "encrypted"
  | "ended"
  | "error"
  | "focusin"
  | "focusout"
  | "gotpointercapture"
  | "input"
  | "invalid"
  | "keydown"
  | "keypress"
  | "keyup"
  | "load"
  | "loadstart"
  | "loadeddata"
  | "loadedmetadata"
  | "lostpointercapture"
  | "mousedown"
  | "mousemove"
  | "mouseout"
  | "mouseover"
  | "mouseup"
  | "paste"
  | "pause"
  | "play"
  | "playing"
  | "pointercancel"
  | "pointerdown"
  | "pointerenter"
  | "pointerleave"
  | "pointermove"
  | "pointerout"
  | "pointerover"
  | "pointerup"
  | "progress"
  | "ratechange"
  | "reset"
  | "scroll"
  | "seeked"
  | "seeking"
  | "selectionchange"
  | "stalled"
  | "submit"
  | "suspend"
  | "textInput" // Intentionally camelCase. Non-standard.
  | "timeupdate"
  | "toggle"
  | "touchcancel"
  | "touchend"
  | "touchmove"
  | "touchstart"
  // These are vendor-prefixed so you should use the exported constants instead:
  // 'transitionend' |
  | "volumechange"
  | "waiting"
  | "wheel";

export const ANIMATION_END: DOMEventName =
  getVendorPrefixedEventName("animationend");
export const ANIMATION_ITERATION: DOMEventName =
  getVendorPrefixedEventName("animationiteration");
export const ANIMATION_START: DOMEventName =
  getVendorPrefixedEventName("animationstart");
export const TRANSITION_END: DOMEventName =
  getVendorPrefixedEventName("transitionend");

/**
 * Generate a mapping of standard vendor prefixes using the defined style property and event name.
 *
 * @param {string} styleProp
 * @param {string} eventName
 * @returns {object}
 */
function makePrefixMap(styleProp: string, eventName: string) {
  const prefixes: any = {};

  prefixes[styleProp.toLowerCase()] = eventName.toLowerCase();
  prefixes["Webkit" + styleProp] = "webkit" + eventName;
  prefixes["Moz" + styleProp] = "moz" + eventName;

  return prefixes;
}

/**
 * A list of event names to a configurable list of vendor prefixes.
 */
const vendorPrefixes: any = {
  animationend: makePrefixMap("Animation", "AnimationEnd"),
  animationiteration: makePrefixMap("Animation", "AnimationIteration"),
  animationstart: makePrefixMap("Animation", "AnimationStart"),
  transitionend: makePrefixMap("Transition", "TransitionEnd"),
};

/**
 * Event names that have already been detected and prefixed (if applicable).
 */
const prefixedEventNames: Record<string, any> = {};
/**
 * Element to check for prefixes on.
 */
let style = {};
/**
 * Attempts to determine the correct vendor prefixed event name.
 *
 * @param {string} eventName
 * @returns {string}
 */
function getVendorPrefixedEventName(eventName: string) {
  if (prefixedEventNames[eventName]) {
    return prefixedEventNames[eventName];
  } else if (!vendorPrefixes[eventName]) {
    return eventName;
  }

  const prefixMap = vendorPrefixes[eventName];

  for (const styleProp in prefixMap) {
    if (prefixMap.hasOwnProperty(styleProp) && styleProp in style) {
      return (prefixedEventNames[eventName] = prefixMap[styleProp]);
    }
  }

  return eventName;
}
