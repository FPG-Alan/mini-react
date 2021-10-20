import { ReactElement } from "react";
import { LegacyRoot } from "../constants";
import { createFiberRoot } from "../react-reconciler/ReactFiber";
import { updateContainer } from "../react-reconciler/ReactFiberReconciler";

import {
  BOOLEAN,
  getPropertyInfo,
  isAttributeNameSafe,
  OVERLOADED_BOOLEAN,
  shouldIgnoreAttribute,
  shouldRemoveAttribute,
} from "./DOMProperty";
import { ensureListeningTo } from "./events/miniEvent";

const randomKey = Math.random().toString(36).slice(2);

export const ELEMENT_NODE = 1;
export const TEXT_NODE = 3;
export const COMMENT_NODE = 8;
export const DOCUMENT_NODE = 9;
export const DOCUMENT_FRAGMENT_NODE = 11;

const internalPropsKey = "__reactProps$" + randomKey;
export const internalInstanceKey = "__reactFiber$" + randomKey;
export const internalContainerInstanceKey = "__reactContainer$" + randomKey;

function render(
  children: ReactElement,
  container: HTMLElement & { _reactRootContainer?: any }
) {
  let fiberRoot = container._reactRootContainer;
  if (!fiberRoot) {
    // First clear any existing content.
    let rootSibling;
    while ((rootSibling = container.lastChild)) {
      container.removeChild(rootSibling);
    }

    fiberRoot = container._reactRootContainer = createFiberRoot(
      container,
      LegacyRoot
    );
  }

  updateContainer(children, fiberRoot);
}

export function createTextInstance(text: string, internalInstanceHandle: any) {
  const textNode = document.createTextNode(text);
  // precacheFiberNode(internalInstanceHandle, textNode);
  (textNode as any)[internalInstanceKey] = internalInstanceHandle;
  return textNode;
}

export function createInstance(
  type: string,
  props: any,
  internalInstanceHandle: any
) {
  const domElement = createElement(type, props);
  (domElement as any)["__reactFiber$" + randomKey] = internalInstanceHandle;
  // updateFiberProps(domElement, props);
  (domElement as any)[`__reactProps$${randomKey}`] = props;
  return domElement;
}

export function createElement(type: string, props: any): Element {
  // We create tags in the namespace of their parent container, except HTML
  // tags get no namespace.
  let domElement: Element;

  if (type === "script") {
    const div = document.createElement("div");
    div.innerHTML = "<script><" + "/script>";
    // This is guaranteed to yield a script element.
    const firstChild = div.firstChild;
    domElement = div.removeChild(firstChild!) as Element;
  } else if (typeof props.is === "string") {
    domElement = document.createElement(type, { is: props.is });
  } else {
    domElement = document.createElement(type);

    if (type === "select") {
      const node = domElement;
      if (props.multiple) {
        (node as any).multiple = true;
      } else if (props.size) {
        // Setting a size greater than 1 causes a select to behave like `multiple=true`, where
        // it is possible that no option is selected.
        //
        // This is only necessary when a select in "single selection mode".
        (node as any).size = props.size;
      }
    }
  }

  return domElement;
}

export function clearContainer(container: Element | Document): void {
  if (container.nodeType === ELEMENT_NODE) {
    container.textContent = "";
  } else if (container.nodeType === DOCUMENT_NODE) {
    const body = (container as Document).body;
    if (body != null) {
      body.textContent = "";
    }
  }
}

export function resetTextContent(domElement: Element): void {
  setTextContent(domElement, "");
}

export function insertBefore(
  parentInstance: Element,
  child: Element,
  beforeChild: Element
): void {
  parentInstance.insertBefore(child, beforeChild);
}

export function appendChild(parentInstance: Element, child: Element): void {
  parentInstance.appendChild(child);
}
export function appendChildToContainer(
  container: Element,
  child: Element
): void {
  let parentNode;
  if (container.nodeType === COMMENT_NODE) {
    parentNode = container.parentNode;
    parentNode?.insertBefore(child, container);
  } else {
    parentNode = container;
    parentNode.appendChild(child);
  }
  // This container might be used for a portal.
  // If something inside a portal is clicked, that click should bubble
  // through the React tree. However, on Mobile Safari the click would
  // never bubble through the *DOM* tree unless an ancestor with onclick
  // event exists. So we wouldn't see it and dispatch it.
  // This is why we ensure that non React root containers have inline onclick
  // defined.
  // https://github.com/facebook/react/issues/11918
  const reactRootContainer = (container as any)._reactRootContainer;
  if (
    (reactRootContainer === null || reactRootContainer === undefined) &&
    (parentNode as any).onclick === null
  ) {
    // TODO: This cast may not be sound for SVG, MathML or custom elements.
    // trapClickOnNonInteractiveElement(((parentNode: any): HTMLElement));
  }
}
export function removeChild(parentInstance: Element, child: Element): void {
  parentInstance.removeChild(child);
}
export function removeChildFromContainer(
  container: Element,
  child: Element
): void {
  if (container.nodeType === COMMENT_NODE) {
    container.parentNode?.removeChild(child);
  } else {
    container.removeChild(child);
  }
}
export function insertInContainerBefore(
  container: Element,
  child: Element,
  beforeChild: Element
): void {
  if (container.nodeType === COMMENT_NODE) {
    container.parentNode?.insertBefore(child, beforeChild);
  } else {
    container.insertBefore(child, beforeChild);
  }
}

export function finalizeInitialChildren(
  domElement: any,
  type: string,
  props: any,
  rootContainerInstance: any
): boolean {
  setInitialProperties(domElement, type, props, rootContainerInstance);
  return shouldAutoFocusHostComponent(type, props);
}

function shouldAutoFocusHostComponent(type: string, props: any): boolean {
  switch (type) {
    case "button":
    case "input":
    case "select":
    case "textarea":
      return !!props.autoFocus;
  }
  return false;
}
export function commitMount(
  domElement: any,
  type: string,
  newProps: any,
  internalInstanceHandle: Object
): void {
  // Despite the naming that might imply otherwise, this method only
  // fires if there is an `Update` effect scheduled during mounting.
  // This happens if `finalizeInitialChildren` returns `true` (which it
  // does to implement the `autoFocus` attribute on the client). But
  // there are also other cases when this might happen (such as patching
  // up text content during hydration mismatch). So we'll check this again.
  if (shouldAutoFocusHostComponent(type, newProps)) {
    domElement.focus();
  }
}
export function commitUpdate(
  domElement: HTMLElement,
  updatePayload: any,
  type: string,
  oldProps: any,
  newProps: any
): void {
  // Update the props handle so that we know which props are the ones with
  // with current event handlers.
  // updateFiberProps(domElement, newProps);
  (domElement as any)[internalPropsKey] = newProps;
  // Apply the diff to the DOM node.
  updateProperties(domElement, updatePayload, type, oldProps, newProps);
}

// Apply the diff.
export function updateProperties(
  domElement: HTMLElement,
  updatePayload: Array<any>,
  tag: string,
  lastRawProps: Object,
  nextRawProps: Object
): void {
  // Update checked *before* name.
  // In the middle of an update, it is possible to have multiple checked.
  // When a checked radio tries to change name, browser makes another radio's checked false.
  if (
    tag === "input" &&
    (nextRawProps as any).type === "radio" &&
    (nextRawProps as any).name != null
  ) {
    // ReactDOMInputUpdateChecked(domElement, nextRawProps);

    const node = domElement;
    const checked = (nextRawProps as any).checked;
    if (checked != null) {
      setValueForProperty(node, "checked", checked, false);
    }
  }

  const wasCustomComponentTag = isCustomComponent(tag, lastRawProps);
  const isCustomComponentTag = isCustomComponent(tag, nextRawProps);
  // Apply the diff.
  updateDOMProperties(
    domElement,
    updatePayload,
    wasCustomComponentTag,
    isCustomComponentTag
  );

  // TODO: Ensure that an update gets scheduled if any of the special props
  // changed.
  // switch (tag) {
  //   case 'input':
  //     // Update the wrapper around inputs *after* updating props. This has to
  //     // happen after `updateDOMProperties`. Otherwise HTML5 input validations
  //     // raise warnings and prevent the new value from being assigned.
  //     ReactDOMInputUpdateWrapper(domElement, nextRawProps);
  //     break;
  //   case 'textarea':
  //     ReactDOMTextareaUpdateWrapper(domElement, nextRawProps);
  //     break;
  //   case 'select':
  //     // <select> value update needs to occur after <option> children
  //     // reconciliation
  //     ReactDOMSelectPostUpdateWrapper(domElement, nextRawProps);
  //     break;
  // }
}

function updateDOMProperties(
  domElement: HTMLElement,
  updatePayload: Array<any>,
  wasCustomComponentTag: boolean,
  isCustomComponentTag: boolean
): void {
  // TODO: Handle wasCustomComponentTag
  for (let i = 0; i < updatePayload.length; i += 2) {
    const propKey = updatePayload[i];
    const propValue = updatePayload[i + 1];
    if (propKey === "style") {
      setValueForStyles(domElement, propValue);
    } else if (propKey === "dangerouslySetInnerHTML") {
      // setInnerHTML(domElement, propValue);
      domElement.innerHTML = propValue;
    } else if (propKey === "children") {
      setTextContent(domElement, propValue);
    } else {
      setValueForProperty(domElement, propKey, propValue, isCustomComponentTag);
    }
  }
}

export function commitTextUpdate(
  textInstance: any,
  oldText: string,
  newText: string
): void {
  textInstance.nodeValue = newText;
}
/**
 * Set the textContent property of a node. For text updates, it's faster
 * to set the `nodeValue` of the Text node directly instead of using
 * `.textContent` which will remove the existing node and create a new one.
 *
 * @param {DOMElement} node
 * @param {string} text
 * @internal
 */
const setTextContent = function (node: Element, text: string): void {
  if (text) {
    const firstChild = node.firstChild;

    if (
      firstChild &&
      firstChild === node.lastChild &&
      firstChild.nodeType === TEXT_NODE
    ) {
      firstChild.nodeValue = text;
      return;
    }
  }
  node.textContent = text;
};

export function shouldSetTextContent(type: string, props: any) {
  return (
    type === "textarea" ||
    type === "option" ||
    type === "noscript" ||
    typeof props.children === "string" ||
    typeof props.children === "number" ||
    (typeof props.dangerouslySetInnerHTML === "object" &&
      props.dangerouslySetInnerHTML !== null &&
      props.dangerouslySetInnerHTML.__html != null)
  );
}

export function prepareUpdate(
  domElement: Element,
  type: string,
  oldProps: any,
  newProps: any
  // rootContainerInstance: Container,
) {
  return diffProperties(
    domElement,
    type,
    oldProps,
    newProps
    // rootContainerInstance,
  );
}

export function setInitialProperties(
  domElement: Element,
  tag: string,
  rawProps: Object,
  rootContainerElement: Element | Document
): void {
  const isCustomComponentTag = isCustomComponent(tag, rawProps);

  // TODO: Make sure that we check isMounted before firing any of these events.
  let props: Object;
  switch (tag) {
    // case 'dialog':
    //   listenToNonDelegatedEvent('cancel', domElement);
    //   listenToNonDelegatedEvent('close', domElement);
    //   props = rawProps;
    //   break;
    // case 'iframe':
    // case 'object':
    // case 'embed':
    //   // We listen to this event in case to ensure emulated bubble
    //   // listeners still fire for the load event.
    //   listenToNonDelegatedEvent('load', domElement);
    //   props = rawProps;
    //   break;
    // case 'video':
    // case 'audio':
    //   // We listen to these events in case to ensure emulated bubble
    //   // listeners still fire for all the media events.
    //   for (let i = 0; i < mediaEventTypes.length; i++) {
    //     listenToNonDelegatedEvent(mediaEventTypes[i], domElement);
    //   }
    //   props = rawProps;
    //   break;
    // case 'source':
    //   // We listen to this event in case to ensure emulated bubble
    //   // listeners still fire for the error event.
    //   listenToNonDelegatedEvent('error', domElement);
    //   props = rawProps;
    //   break;
    // case 'img':
    // case 'image':
    // case 'link':
    //   // We listen to these events in case to ensure emulated bubble
    //   // listeners still fire for error and load events.
    //   listenToNonDelegatedEvent('error', domElement);
    //   listenToNonDelegatedEvent('load', domElement);
    //   props = rawProps;
    //   break;
    // case 'details':
    //   // We listen to this event in case to ensure emulated bubble
    //   // listeners still fire for the toggle event.
    //   listenToNonDelegatedEvent('toggle', domElement);
    //   props = rawProps;
    //   break;
    // case 'input':
    //   ReactDOMInputInitWrapperState(domElement, rawProps);
    //   props = ReactDOMInputGetHostProps(domElement, rawProps);
    //   // We listen to this event in case to ensure emulated bubble
    //   // listeners still fire for the invalid event.
    //   listenToNonDelegatedEvent('invalid', domElement);
    //   if (!enableEagerRootListeners) {
    //     // For controlled components we always need to ensure we're listening
    //     // to onChange. Even if there is no listener.
    //     ensureListeningTo(rootContainerElement, 'onChange', domElement);
    //   }
    //   break;
    // case 'option':
    //   ReactDOMOptionValidateProps(domElement, rawProps);
    //   props = ReactDOMOptionGetHostProps(domElement, rawProps);
    //   break;
    // case 'select':
    //   ReactDOMSelectInitWrapperState(domElement, rawProps);
    //   props = ReactDOMSelectGetHostProps(domElement, rawProps);
    //   // We listen to this event in case to ensure emulated bubble
    //   // listeners still fire for the invalid event.
    //   listenToNonDelegatedEvent('invalid', domElement);
    //   if (!enableEagerRootListeners) {
    //     // For controlled components we always need to ensure we're listening
    //     // to onChange. Even if there is no listener.
    //     ensureListeningTo(rootContainerElement, 'onChange', domElement);
    //   }
    //   break;
    // case 'textarea':
    //   ReactDOMTextareaInitWrapperState(domElement, rawProps);
    //   props = ReactDOMTextareaGetHostProps(domElement, rawProps);
    //   // We listen to this event in case to ensure emulated bubble
    //   // listeners still fire for the invalid event.
    //   listenToNonDelegatedEvent('invalid', domElement);
    //   if (!enableEagerRootListeners) {
    //     // For controlled components we always need to ensure we're listening
    //     // to onChange. Even if there is no listener.
    //     ensureListeningTo(rootContainerElement, 'onChange', domElement);
    //   }
    //   break;
    default:
      props = rawProps;
  }

  assertValidProps(tag, props);

  setInitialDOMProperties(
    tag,
    domElement,
    rootContainerElement,
    props,
    isCustomComponentTag
  );

  switch (tag) {
    // case 'input':
    //   // TODO: Make sure we check if this is still unmounted or do any clean
    //   // up necessary since we never stop tracking anymore.
    //   track((domElement: any));
    //   ReactDOMInputPostMountWrapper(domElement, rawProps, false);
    //   break;
    // case 'textarea':
    //   // TODO: Make sure we check if this is still unmounted or do any clean
    //   // up necessary since we never stop tracking anymore.
    //   track((domElement: any));
    //   ReactDOMTextareaPostMountWrapper(domElement, rawProps);
    //   break;
    // case 'option':
    //   ReactDOMOptionPostMountWrapper(domElement, rawProps);
    //   break;
    // case 'select':
    //   ReactDOMSelectPostMountWrapper(domElement, rawProps);
    //   break;
    default:
      if (typeof (props as any).onClick === "function") {
        // TODO: This cast may not be sound for SVG, MathML or custom elements.
        // trapClickOnNonInteractiveElement(domElement);
        // (domElement as any).onclick = (props as any).onClick;
      }
      break;
  }
}
function noop() {}
function setInitialDOMProperties(
  tag: string,
  domElement: any,
  rootContainerElement: Element | Document,
  nextProps: any,
  isCustomComponentTag: boolean
): void {
  console.log(nextProps);
  for (const propKey in nextProps) {
    if (!nextProps.hasOwnProperty(propKey)) {
      continue;
    }
    const nextProp = nextProps[propKey];
    if (propKey === "style") {
      setValueForStyles(domElement, nextProp);
    } else if (propKey === "dangerouslySetInnerHTML") {
      const nextHtml = nextProp ? nextProp["HTML"] : undefined;
      if (nextHtml != null) {
        // setInnerHTML(domElement, nextHtml);
        domElement.innerHTML = nextHtml;
      }
    } else if (propKey === "children") {
      if (typeof nextProp === "string") {
        // Avoid setting initial textContent when the text is empty. In IE11 setting
        // textContent on a <textarea> will cause the placeholder to not
        // show within the <textarea> until it has been focused and blurred again.
        // https://github.com/facebook/react/issues/6731#issuecomment-254874553
        const canSetTextContent = tag !== "textarea" || nextProp !== "";
        if (canSetTextContent) {
          console.log("????");
          setTextContent(domElement, nextProp);
          console.log(domElement);
        }
      } else if (typeof nextProp === "number") {
        setTextContent(domElement, "" + nextProp);
      }
    } else if (propKey[0] === "o" && propKey[1] === "n") {
      if (nextProp != null) {
        ensureListeningTo(rootContainerElement, propKey, domElement);
      }
    } else if (nextProp != null) {
      setValueForProperty(domElement, propKey, nextProp, isCustomComponentTag);
    }
  }
}

// Calculate the diff between the two objects.
export function diffProperties(
  domElement: Element,
  tag: string,
  lastRawProps: any,
  nextRawProps: any
  // rootContainerElement: Element | Document,
) {
  let updatePayload: null | Array<any> = null;

  let lastProps = lastRawProps;
  let nextProps = nextRawProps;
  // switch (tag) {
  //   case 'input':
  //     lastProps = ReactDOMInputGetHostProps(domElement, lastRawProps);
  //     nextProps = ReactDOMInputGetHostProps(domElement, nextRawProps);
  //     updatePayload = [];
  //     break;
  //   case 'option':
  //     lastProps = ReactDOMOptionGetHostProps(domElement, lastRawProps);
  //     nextProps = ReactDOMOptionGetHostProps(domElement, nextRawProps);
  //     updatePayload = [];
  //     break;
  //   case 'select':
  //     lastProps = ReactDOMSelectGetHostProps(domElement, lastRawProps);
  //     nextProps = ReactDOMSelectGetHostProps(domElement, nextRawProps);
  //     updatePayload = [];
  //     break;
  //   case 'textarea':
  //     lastProps = ReactDOMTextareaGetHostProps(domElement, lastRawProps);
  //     nextProps = ReactDOMTextareaGetHostProps(domElement, nextRawProps);
  //     updatePayload = [];
  //     break;
  //   default:
  //     lastProps = lastRawProps;
  //     nextProps = nextRawProps;
  //     if (
  //       typeof lastProps.onClick !== 'function' &&
  //       typeof nextProps.onClick === 'function'
  //     ) {
  //       // TODO: This cast may not be sound for SVG, MathML or custom elements.
  //       trapClickOnNonInteractiveElement(((domElement: any): HTMLElement));
  //     }
  //     break;
  // }

  // assertValidProps(tag, nextProps);

  let propKey;
  let styleName;
  let styleUpdates: any = null;
  for (propKey in lastProps) {
    if (
      nextProps.hasOwnProperty(propKey) ||
      !lastProps.hasOwnProperty(propKey) ||
      lastProps[propKey] == null
    ) {
      continue;
    }
    if (propKey === "style") {
      const lastStyle = lastProps[propKey];
      for (styleName in lastStyle) {
        if (lastStyle.hasOwnProperty(styleName)) {
          if (!styleUpdates) {
            styleUpdates = {};
          }
          styleUpdates[styleName] = "";
        }
      }
    } else if (
      propKey === "dangerouslySetInnerHTML" ||
      propKey === "children"
    ) {
      // Noop. This is handled by the clear text mechanism.
    } else if (propKey === "suppressContentEditableWarning") {
      // Noop
    } else if (propKey === "autoFocus") {
      // Noop. It doesn't work on updates anyway.
      // } else if (registrationNameDependencies.hasOwnProperty(propKey)) {
      //   // This is a special case. If any listener updates we need to ensure
      //   // that the "current" fiber pointer gets updated so we need a commit
      //   // to update this element.
      //   if (!updatePayload) {
      //     updatePayload = [];
      //   }
    } else {
      // For all other deleted properties we add it to the queue. We use
      // the allowed property list in the commit phase instead.
      (updatePayload = updatePayload || []).push(propKey, null);
    }
  }
  for (propKey in nextProps) {
    const nextProp = nextProps[propKey];
    const lastProp = lastProps != null ? lastProps[propKey] : undefined;
    if (
      !nextProps.hasOwnProperty(propKey) ||
      nextProp === lastProp ||
      (nextProp == null && lastProp == null)
    ) {
      continue;
    }
    if (propKey === "style") {
      if (lastProp) {
        // Unset styles on `lastProp` but not on `nextProp`.
        for (styleName in lastProp) {
          if (
            lastProp.hasOwnProperty(styleName) &&
            (!nextProp || !nextProp.hasOwnProperty(styleName))
          ) {
            if (!styleUpdates) {
              styleUpdates = {};
            }
            styleUpdates[styleName] = "";
          }
        }
        // Update styles that changed since `lastProp`.
        for (styleName in nextProp) {
          if (
            nextProp.hasOwnProperty(styleName) &&
            lastProp[styleName] !== nextProp[styleName]
          ) {
            if (!styleUpdates) {
              styleUpdates = {};
            }
            styleUpdates[styleName] = nextProp[styleName];
          }
        }
      } else {
        // Relies on `updateStylesByID` not mutating `styleUpdates`.
        if (!styleUpdates) {
          if (!updatePayload) {
            updatePayload = [];
          }
          updatePayload.push(propKey, styleUpdates);
        }
        styleUpdates = nextProp;
      }
    } else if (propKey === "dangerouslySetInnerHTML") {
      const nextHtml = nextProp ? nextProp["__html"] : undefined;
      const lastHtml = lastProp ? lastProp["__html"] : undefined;
      if (nextHtml != null) {
        if (lastHtml !== nextHtml) {
          (updatePayload = updatePayload || []).push(propKey, nextHtml);
        }
      } else {
        // TODO: It might be too late to clear this if we have children
        // inserted already.
      }
    } else if (propKey === "children") {
      if (typeof nextProp === "string" || typeof nextProp === "number") {
        (updatePayload = updatePayload || []).push(propKey, "" + nextProp);
      }
    } else if (propKey === "suppressContentEditableWarning") {
      // Noop
    } else if (propKey[0] === "o" && propKey[1] === "n") {
      if (nextProp != null) {
        // ensureListeningTo(rootContainerElement, propKey, domElement);
        // // We eagerly listen to this even though we haven't committed yet.
        // if (!enableEagerRootListeners) {
        //   ensureListeningTo(rootContainerElement, propKey, domElement);
        // } else if (propKey === "onScroll") {
        //   listenToNonDelegatedEvent("scroll", domElement);
        // }
      }
      if (!updatePayload && lastProp !== nextProp) {
        // This is a special case. If any listener updates we need to ensure
        // that the "current" props pointer gets updated so we need a commit
        // to update this element.
        updatePayload = [];
      }
    } else {
      // For any other property we always add it to the queue and then we
      // filter it out using the allowed property list during the commit.
      (updatePayload = updatePayload || []).push(propKey, nextProp);
    }
  }
  if (styleUpdates) {
    (updatePayload = updatePayload || []).push("style", styleUpdates);
  }
  return updatePayload;
}

/**
 * Sets the value for a property on a node.
 *
 * @param {DOMElement} node
 * @param {string} name
 * @param {*} value
 */
export function setValueForProperty(
  node: Element,
  name: string,
  value: any,
  isCustomComponentTag: boolean
) {
  const propertyInfo = getPropertyInfo(name);
  // return properties.hasOwnProperty(name) ? properties[name] : null;
  if (shouldIgnoreAttribute(name, propertyInfo, isCustomComponentTag)) {
    return;
  }
  if (shouldRemoveAttribute(name, value, propertyInfo, isCustomComponentTag)) {
    value = null;
  }

  // If the prop isn't in the special list, treat it as a simple attribute.
  if (isCustomComponentTag || propertyInfo === null) {
    if (isAttributeNameSafe(name)) {
      const attributeName = name;
      if (value === null) {
        node.removeAttribute(attributeName);
      } else {
        node.setAttribute(attributeName, value);
      }
    }
    return;
  }
  const { mustUseProperty } = propertyInfo;
  if (mustUseProperty) {
    const { propertyName } = propertyInfo;
    if (value === null) {
      const { type } = propertyInfo;
      (node as any)[propertyName] = type === BOOLEAN ? false : "";
    } else {
      // Contrary to `setAttribute`, object properties are properly
      // `toString`ed by IE8/9.
      (node as any)[propertyName] = value;
    }
    return;
  }
  // The rest are treated as attributes with special cases.
  const { attributeName, attributeNamespace } = propertyInfo;
  if (value === null) {
    node.removeAttribute(attributeName);
  } else {
    const { type } = propertyInfo;
    let attributeValue;
    if (type === BOOLEAN || (type === OVERLOADED_BOOLEAN && value === true)) {
      // If attribute type is boolean, we know for sure it won't be an execution sink
      // and we won't require Trusted Type here.
      attributeValue = "";
    } else {
      // `setAttribute` with objects becomes only `[object]` in IE8/9,
      // ('' + value) makes it output the correct toString()-value.
      attributeValue = "" + value;
      // if ((propertyInfo as any).sanitizeURL) {
      //   sanitizeURL(attributeValue.toString());
      // }
    }
    if (attributeNamespace) {
      node.setAttributeNS(attributeNamespace, attributeName, attributeValue);
    } else {
      node.setAttribute(attributeName, attributeValue);
    }
  }
}

function isCustomComponent(tagName: string, props: Object) {
  if (tagName.indexOf("-") === -1) {
    return typeof (props as any).is === "string";
  }
  switch (tagName) {
    // These are reserved SVG and MathML elements.
    // We don't mind this list too much because we expect it to never grow.
    // The alternative is to track the namespace in a few places which is convoluted.
    // https://w3c.github.io/webcomponents/spec/custom/#custom-elements-core-concepts
    case "annotation-xml":
    case "color-profile":
    case "font-face":
    case "font-face-src":
    case "font-face-uri":
    case "font-face-format":
    case "font-face-name":
    case "missing-glyph":
      return false;
    default:
      return true;
  }
}

/**
 * Sets the value for multiple styles on a node.  If a value is specified as
 * '' (empty string), the corresponding style property will be unset.
 *
 * @param {DOMElement} node
 * @param {object} styles
 */
export function setValueForStyles(node: HTMLElement, styles: any) {
  const style = node.style;
  for (let styleName in styles) {
    if (!styles.hasOwnProperty(styleName)) {
      continue;
    }
    const isCustomProperty = styleName.indexOf("--") === 0;

    const styleValue = dangerousStyleValue(
      styleName,
      styles[styleName],
      isCustomProperty
    );
    if (styleName === "float") {
      styleName = "cssFloat";
    }

    if (isCustomProperty) {
      style.setProperty(styleName, styleValue);
    } else {
      (style as any)[styleName] = styleValue;
    }
  }
}

/**
 * Convert a value into the proper css writable value. The style name `name`
 * should be logical (no hyphens), as specified
 * in `CSSProperty.isUnitlessNumber`.
 *
 * @param {string} name CSS property name such as `topMargin`.
 * @param {*} value CSS property value such as `10px`.
 * @return {string} Normalized style value with dimensions applied.
 */
function dangerousStyleValue(
  name: string,
  value: any,
  isCustomProperty: boolean
) {
  // Note that we've removed escapeTextForBrowser() calls here since the
  // whole string will be escaped when the attribute is injected into
  // the markup. If you provide unsafe user data here they can inject
  // arbitrary CSS which may be problematic (I couldn't repro this):
  // https://www.owasp.org/index.php/XSS_Filter_Evasion_Cheat_Sheet
  // http://www.thespanner.co.uk/2007/11/26/ultimate-xss-css-injection/
  // This is not an XSS hole but instead a potential CSS injection issue
  // which has lead to a greater discussion about how we're going to
  // trust URLs moving forward. See #2115901

  const isEmpty = value == null || typeof value === "boolean" || value === "";
  if (isEmpty) {
    return "";
  }

  if (
    !isCustomProperty &&
    typeof value === "number" &&
    value !== 0 &&
    !(isUnitlessNumber.hasOwnProperty(name) && (isUnitlessNumber as any)[name])
  ) {
    return value + "px"; // Presumes implicit 'px' suffix for unitless numbers
  }

  return ("" + value).trim();
}

/**
 * CSS properties which accept numbers but are not in units of "px".
 */
export const isUnitlessNumber = {
  animationIterationCount: true,
  borderImageOutset: true,
  borderImageSlice: true,
  borderImageWidth: true,
  boxFlex: true,
  boxFlexGroup: true,
  boxOrdinalGroup: true,
  columnCount: true,
  columns: true,
  flex: true,
  flexGrow: true,
  flexPositive: true,
  flexShrink: true,
  flexNegative: true,
  flexOrder: true,
  gridArea: true,
  gridRow: true,
  gridRowEnd: true,
  gridRowSpan: true,
  gridRowStart: true,
  gridColumn: true,
  gridColumnEnd: true,
  gridColumnSpan: true,
  gridColumnStart: true,
  fontWeight: true,
  lineClamp: true,
  lineHeight: true,
  opacity: true,
  order: true,
  orphans: true,
  tabSize: true,
  widows: true,
  zIndex: true,
  zoom: true,

  // SVG-related properties
  fillOpacity: true,
  floodOpacity: true,
  stopOpacity: true,
  strokeDasharray: true,
  strokeDashoffset: true,
  strokeMiterlimit: true,
  strokeOpacity: true,
  strokeWidth: true,
};

const voidElementTags = {
  menuitem: true,
  area: true,
  base: true,
  br: true,
  col: true,
  embed: true,
  hr: true,
  img: true,
  input: true,
  keygen: true,
  link: true,
  meta: true,
  param: true,
  source: true,
  track: true,
  wbr: true,
  // NOTE: menuitem's close tag should be omitted, but that causes problems.
};
function assertValidProps(tag: string, props: any) {
  if (!props) {
    return;
  }
  // Note the use of `==` which checks for null or undefined.
  if ((voidElementTags as any)[tag]) {
    if (!(props.children == null && props.dangerouslySetInnerHTML == null)) {
      throw Error(
        `${tag} is a void element tag and must neither have \`children\` nor use \`dangerouslySetInnerHTML\`.`
      );
    }
  }
  if (props.dangerouslySetInnerHTML != null) {
    if (!(props.children == null)) {
      throw Error(
        "Can only set one of `children` or `props.dangerouslySetInnerHTML`."
      );
    }

    if (
      !(
        typeof props.dangerouslySetInnerHTML === "object" &&
        "HTML" in props.dangerouslySetInnerHTML
      )
    ) {
      throw Error(
        "`props.dangerouslySetInnerHTML` must be in the form `{__html: ...}`. " +
          "Please visit https://reactjs.org/link/dangerously-set-inner-html " +
          "for more information."
      );
    }
  }

  if (!(props.style == null || typeof props.style === "object")) {
    throw Error(
      "The `style` prop expects a mapping from style properties to values, " +
        "not a string. For example, style={{marginRight: spacing + 'em'}} when " +
        "using JSX."
    );
  }
}

export { render };
