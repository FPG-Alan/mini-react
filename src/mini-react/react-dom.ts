import { ReactElement } from "react";
import { LegacyRoot } from "./constants";
import { createFiberRoot } from "./ReactFiber";
import { updateContainer } from "./ReactFiberReconciler";

const randomKey = Math.random().toString(36).slice(2);

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

export { render };
