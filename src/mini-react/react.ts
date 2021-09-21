import { REACT_ELEMENT_TYPE } from "./constants";

function ReactElement(
  type: string,
  key: any,
  ref: any,
  owner: any,
  props: any
) {
  const element = {
    // This tag allows us to uniquely identify this as a React Element
    $$typeof: REACT_ELEMENT_TYPE,

    // Built-in properties that belong on the element
    type: type,
    key: key,
    ref: ref,
    props: props,

    // Record the component responsible for creating this element.
    _owner: owner,
  };

  return element;
}

const RESERVED_PROPS = {
  key: true,
  ref: true,
  __self: true,
  __source: true,
};
const ReactCurrentOwner = {
  current: null,
};
type ReactElementConfig = {
  ref?: any;
  key?: any;
  [key: string]: any;
};
function createElement(
  type: any,
  config: ReactElementConfig | null,
  ...children: Record<string, unknown>[] | string[] | []
) {
  let propName;

  // Reserved names are extracted
  const props: any = {};

  let key = null;
  let ref = null;

  if (config != null) {
    if ("ref" in config) {
      ref = config.ref;
    }
    if ("key" in config) {
      key = "" + config.key;
    }

    // Remaining properties are added to a new props object
    for (propName in config) {
      if (
        Object.prototype.hasOwnProperty.call(config, propName) &&
        !RESERVED_PROPS.hasOwnProperty(propName)
      ) {
        props[propName] = config[propName];
      }
    }
  }

  props.children = children;

  // Resolve default props
  if (type && type.defaultProps) {
    const defaultProps = type.defaultProps;
    for (propName in defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = defaultProps[propName];
      }
    }
  }
  return ReactElement(type, key, ref, ReactCurrentOwner.current, props);
}

export { createElement };
