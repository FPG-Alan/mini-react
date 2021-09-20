import { render } from "./mini-react/react-dom";
import { createElement } from "./mini-react/react";
import "./index.css";
import App from "./App";

// ReactDOM.render(
//   <React.StrictMode>
//     <App />
//   </React.StrictMode>,
//   document.getElementById('root')
// )

render(createElement(App), document.getElementById("root"));
