import { render } from "./mini-react/react-dom";
import { createElement } from "./mini-react/react/react";
import "./index.css";
import App from "./App";

render(createElement(App, null, null), document.getElementById("root")!);
