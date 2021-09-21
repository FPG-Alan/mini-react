import { createElement } from "./mini-react/react";
import "./App.css";

function App() {
  return createElement(
    "div",
    { className: "App" },
    createElement("h1", null, "hello world!")
  );
}

export default App;
