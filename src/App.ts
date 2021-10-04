import { createElement } from "./mini-react/react";
import "./App.css";

function App() {
  return createElement(
    "div",
    {
      className: "App",
      onClick: () => {
        console.log("click");
      },
    },
    createElement("h1", null, "hello world!")
  );
}

export default App;
