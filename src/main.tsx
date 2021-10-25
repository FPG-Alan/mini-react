import { render } from "./mini-react/react-dom";
import { createElement } from "./mini-react/react/react";

import {
  render as render_new,
  createElement as createElement_new,
} from "./mini-react-2";
import "./index.css";
import App, { App2 } from "./App";

render(createElement(App, null, null), document.getElementById("root")!);
// render(
//   createElement("div", null, createElement("h1", null, "hello world")),
//   document.getElementById("root")!
// );
// render_new(createElement_new(App2), document.getElementById("root")!);
