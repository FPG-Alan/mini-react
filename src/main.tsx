import "./index.css";

function createElement(type: string, props: any): HTMLElement {
  console.log("createElement", type, props.children);
  const element = document.createElement(type);

  // 添加children
  const children = props.children;
  if (props.children !== null && props.children !== undefined) {
    let childNode = props.children;

    if (typeof children === "string") {
      childNode = document.createTextNode(children);
    } else if (typeof children === "number") {
      childNode = document.createTextNode(children.toString());
    } else if (typeof children === "function") {
      // 响应式?
      childNode = document.createTextNode(
        children((value: any) => {
          // childNode = document.createTextNode(childNode);
          (childNode as Text).textContent = value;
        })
      );
    } else if (Array.isArray(children)) {
      childNode = document.createDocumentFragment();
      for (let i = 0, l = children.length; i < l; i += 1) {
        childNode.appendChild(children[i]);
      }
    }

    element.appendChild(childNode);
  }

  // 添加其他属性
  if (props.onClick) {
    element.addEventListener("click", props.onClick);
  }

  return element;
}

function render(app: () => HTMLElement, container: HTMLElement) {
  const dom = app();

  container.replaceChildren(dom);
}

function useSignal(initValue: any): [() => void, (next: any) => void] {
  let value = initValue;
  let listeners: any[] = [];

  function setter(next: any) {
    if (typeof next === "function") {
      value = next(value);
    } else {
      value = next;
    }

    // 如何引起对应的dom变化？
    console.log(value, "call listener", listeners);
    for (let i = 0, l = listeners.length; i < l; i += 1) {
      listeners[i](value);
    }
  }

  function getter(listener?: () => void) {
    console.log("getter being called");
    // 如何注册对应的dom， 并且塞一个update dom的语句进来？

    listeners.push(listener);
    return value;
  }

  return [getter, setter];
}

const App = () => {
  const [counter, setCounter] = useSignal(1);

  return createElement("div", {
    children: [
      createElement("p", {
        children: counter,
      }),
      createElement("button", {
        children: "count + 1",
        onClick: () => {
          setCounter((current: any) => current + 1);
        },
      }),
    ],
  });
};

render(App, document.getElementById("root")!);
