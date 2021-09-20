import { ReactElement } from "react";
import { LegacyRoot } from "./constants";
import { createFiberRoot } from "./react-reconciler";

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
  const randomKey = Math.random().toString(36).slice(2);
  (container as any)["__reactContainer$" + randomKey] = root.current;
  return {
    _internalRoot: root,
  };
}

export { render };
