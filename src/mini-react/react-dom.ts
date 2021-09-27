import { ReactElement } from "react";
import { LegacyRoot } from "./constants";
import { createFiberRoot } from "./ReactFiber";
import { updateContainer } from "./ReactFiberReconciler";

const randomKey = Math.random().toString(36).slice(2);

export const ELEMENT_NODE = 1;
export const TEXT_NODE = 3;
export const COMMENT_NODE = 8;
export const DOCUMENT_NODE = 9;
export const DOCUMENT_FRAGMENT_NODE = 11;

const internalPropsKey = "__reactProps$" + randomKey;

function render(
  children: ReactElement,
  container: HTMLElement & { _reactRootContainer?: any }
) {
  let root = container._reactRootContainer;
  let fiberRoot: any;
  if (!root) {
    // Initial mount
    root = container._reactRootContainer =
      legacyCreateRootFromDOMContainer(container);
    fiberRoot = root._internalRoot;

    // Initial mount should not be batched.
    updateContainer(children, fiberRoot);
  } else {
    fiberRoot = root._internalRoot;
    // Update
    updateContainer(children, fiberRoot);
  }
  return;
}

function legacyCreateRootFromDOMContainer(container: HTMLElement) {
  // First clear any existing content.
  let rootSibling;
  while ((rootSibling = container.lastChild)) {
    container.removeChild(rootSibling);
  }

  const root = createFiberRoot(container, LegacyRoot);

  (container as any)["__reactContainer$" + randomKey] = root.current;
  return {
    _internalRoot: root,
  };
}

export function createTextInstance(text: string, internalInstanceHandle: any) {
  const textNode = document.createTextNode(text);
  // precacheFiberNode(internalInstanceHandle, textNode);
  internalInstanceHandle["__reactFiber$" + randomKey] = textNode;
  return textNode;
}

export function createInstance(
  type: string,
  props: any,
  internalInstanceHandle: any
) {
  const domElement = createElement(type, props);
  internalInstanceHandle["__reactFiber$" + randomKey] = domElement;
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

function shouldAutoFocusHostComponent(type: string, props: any): boolean {
  switch (type) {
    case 'button':
    case 'input':
    case 'select':
    case 'textarea':
      return !!props.autoFocus;
  }
  return false;
}
export function commitMount(
  domElement: any,
  type: string,
  newProps: any,
  internalInstanceHandle: Object,
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
  domElement: Element,
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
  domElement: Element,
  updatePayload: Array<any>,
  tag: string,
  lastRawProps: Object,
  nextRawProps: Object,
): void {
  // Update checked *before* name.
  // In the middle of an update, it is possible to have multiple checked.
  // When a checked radio tries to change name, browser makes another radio's checked false.
  if (
    tag === 'input' &&
    (nextRawProps as any).type === 'radio' &&
    (nextRawProps as any).name != null
  ) {
    // ReactDOMInputUpdateChecked(domElement, nextRawProps);

    const node =domElement;
    const checked = (nextRawProps as any).checked;
    if (checked != null) {
      setValueForProperty(node, 'checked', checked, false);
    }
  }

  const wasCustomComponentTag = isCustomComponent(tag, lastRawProps);
  const isCustomComponentTag = isCustomComponent(tag, nextRawProps);
  // Apply the diff.
  updateDOMProperties(
    domElement,
    updatePayload,
    wasCustomComponentTag,
    isCustomComponentTag,
  );

  // TODO: Ensure that an update gets scheduled if any of the special props
  // changed.
  switch (tag) {
    case 'input':
      // Update the wrapper around inputs *after* updating props. This has to
      // happen after `updateDOMProperties`. Otherwise HTML5 input validations
      // raise warnings and prevent the new value from being assigned.
      ReactDOMInputUpdateWrapper(domElement, nextRawProps);
      break;
    case 'textarea':
      ReactDOMTextareaUpdateWrapper(domElement, nextRawProps);
      break;
    case 'select':
      // <select> value update needs to occur after <option> children
      // reconciliation
      ReactDOMSelectPostUpdateWrapper(domElement, nextRawProps);
      break;
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

/* export function finalizeInitialChildren(
  domElement: Element,
  type: string,
  props: any,
  rootContainerInstance: any,
): boolean {
  setInitialProperties(domElement, type, props, rootContainerInstance);
  return shouldAutoFocusHostComponent(type, props);
} */

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

// Calculate the diff between the two objects.
export function diffProperties(
  domElement: Element,
  tag: string,
  lastRawProps: any,
  nextRawProps: any
  // rootContainerElement: Element | Document,
) {
  let updatePayload: null | Array<any> = null;

  let lastProps = nextRawProps;
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
    } /* else if (registrationNameDependencies.hasOwnProperty(propKey)) {
      if (nextProp != null) {
        // We eagerly listen to this even though we haven't committed yet.
        if (!enableEagerRootListeners) {
          ensureListeningTo(rootContainerElement, propKey, domElement);
        } else if (propKey === "onScroll") {
          listenToNonDelegatedEvent("scroll", domElement);
        }
      }
      if (!updatePayload && lastProp !== nextProp) {
        // This is a special case. If any listener updates we need to ensure
        // that the "current" props pointer gets updated so we need a commit
        // to update this element.
        updatePayload = [];
      }
    } */ else {
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

// A reserved attribute.
// It is handled by React separately and shouldn't be written to the DOM.
export const RESERVED = 0;

// A simple string attribute.
// Attributes that aren't in the filter are presumed to have this type.
export const STRING = 1;

// A string attribute that accepts booleans in React. In HTML, these are called
// "enumerated" attributes with "true" and "false" as possible values.
// When true, it should be set to a "true" string.
// When false, it should be set to a "false" string.
export const BOOLEANISH_STRING = 2;

// A real boolean attribute.
// When true, it should be present (set either to an empty string or its name).
// When false, it should be omitted.
export const BOOLEAN = 3;

// An attribute that can be used as a flag as well as with a value.
// When true, it should be present (set either to an empty string or its name).
// When false, it should be omitted.
// For any other value, should be present with that value.
export const OVERLOADED_BOOLEAN = 4;

// An attribute that must be numeric or parse as a numeric.
// When falsy, it should be removed.
export const NUMERIC = 5;

// An attribute that must be positive numeric or parse as a positive numeric.
// When falsy, it should be removed.
export const POSITIVE_NUMERIC = 6;
export function shouldIgnoreAttribute(
  name: string,
  propertyInfo: any,
  isCustomComponentTag: boolean,
): boolean {
  if (propertyInfo !== null) {
    return propertyInfo.type === RESERVED;
  }
  if (isCustomComponentTag) {
    return false;
  }
  if (
    name.length > 2 &&
    (name[0] === 'o' || name[0] === 'O') &&
    (name[1] === 'n' || name[1] === 'N')
  ) {
    return true;
  }
  return false;
}
export function shouldRemoveAttributeWithWarning(
  name: string,
  value: any,
  propertyInfo: any,
  isCustomComponentTag: boolean,
): boolean {
  if (propertyInfo !== null && propertyInfo.type === RESERVED) {
    return false;
  }
  switch (typeof value) {
    case 'function':
    // $FlowIssue symbol is perfectly valid here
    case 'symbol': // eslint-disable-line
      return true;
    case 'boolean': {
      if (isCustomComponentTag) {
        return false;
      }
      if (propertyInfo !== null) {
        return !propertyInfo.acceptsBooleans;
      } else {
        const prefix = name.toLowerCase().slice(0, 5);
        return prefix !== 'data-' && prefix !== 'aria-';
      }
    }
    default:
      return false;
  }
}
export function shouldRemoveAttribute(
  name: string,
  value: any,
  propertyInfo: any,
  isCustomComponentTag: boolean,
): boolean {
  if (value === null || typeof value === 'undefined') {
    return true;
  }
  if (
    shouldRemoveAttributeWithWarning(
      name,
      value,
      propertyInfo,
      isCustomComponentTag,
    )
  ) {
    return true;
  }
  if (isCustomComponentTag) {
    return false;
  }
  if (propertyInfo !== null) {

    switch (propertyInfo.type) {
      case BOOLEAN:
        return !value;
      case OVERLOADED_BOOLEAN:
        return value === false;
      case NUMERIC:
        return isNaN(value);
      case POSITIVE_NUMERIC:
        return isNaN(value) || value < 1;
    }
  }
  return false;
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
  isCustomComponentTag: boolean,
) {
  const propertyInfo = null;
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
        node.setAttribute(
          attributeName,
          enableTrustedTypesIntegration ? (value: any) : '' + (value: any),
        );
      }
    }
    return;
  }
  const {mustUseProperty} = propertyInfo;
  if (mustUseProperty) {
    const {propertyName} = propertyInfo;
    if (value === null) {
      const {type} = propertyInfo;
      (node: any)[propertyName] = type === BOOLEAN ? false : '';
    } else {
      // Contrary to `setAttribute`, object properties are properly
      // `toString`ed by IE8/9.
      (node: any)[propertyName] = value;
    }
    return;
  }
  // The rest are treated as attributes with special cases.
  const {attributeName, attributeNamespace} = propertyInfo;
  if (value === null) {
    node.removeAttribute(attributeName);
  } else {
    const {type} = propertyInfo;
    let attributeValue;
    if (type === BOOLEAN || (type === OVERLOADED_BOOLEAN && value === true)) {
      // If attribute type is boolean, we know for sure it won't be an execution sink
      // and we won't require Trusted Type here.
      attributeValue = '';
    } else {
      // `setAttribute` with objects becomes only `[object]` in IE8/9,
      // ('' + value) makes it output the correct toString()-value.
      if (enableTrustedTypesIntegration) {
        attributeValue = (value: any);
      } else {
        attributeValue = '' + (value: any);
      }
      if (propertyInfo.sanitizeURL) {
        sanitizeURL(attributeValue.toString());
      }
    }
    if (attributeNamespace) {
      node.setAttributeNS(attributeNamespace, attributeName, attributeValue);
    } else {
      node.setAttribute(attributeName, attributeValue);
    }
  }
}


export { render };
