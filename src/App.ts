import { createElement } from "./mini-react/react/react";
import { useEffect, useState } from "./mini-react/react/ReactHooks";
import "./App.css";

function App() {
  const [state, dispatch] = useState(0);

  useEffect(() => {
    console.log(state);
  }, [state]);

  return createElement(
    "div",
    {
      className: "App2",
      onClick: () => {
        console.log("hello darkness my old friend");
        dispatch((state) => state + 1);
      },
    },
    createElement("h1", { style: { opacity: 0.5, fontSize: "19px" } }, [
      "hello world!" + state,
      "test",
    ])
  );
}

export default App;

function App2() {
  return createElement(
    "div",
    {
      className: "App2",
      onClick: () => {
        console.log("hello darkness my old friend");
      },
    },
    createElement("h1", { style: { opacity: 0.5, fontSize: "19px" } }, [
      "hello world!",
      "test",
    ])
  );
}

export { App2 };
