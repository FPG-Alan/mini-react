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
      className: "App",
      onClick: () => {
        console.log("hello darkness my old friend");
        dispatch((state) => state + 1);
      },
    },
    createElement("h1", null, "hello world!" + state)
  );
}

export default App;
